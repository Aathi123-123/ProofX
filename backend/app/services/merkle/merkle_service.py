"""
PSDE – Merkle Commitment Service
Orchestrates Merkle tree construction and blockchain anchoring for a case.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.models import (
    AuditEventType, EvidenceArtifact, MerkleCommitment, EvidenceStatus
)
from app.services.audit.audit_service import record_event
from app.services.merkle.tree import (
    build_merkle_tree, generate_merkle_proof, proof_to_dict, verify_merkle_proof, dict_to_proof
)

logger = get_logger(__name__)


async def build_case_merkle_tree(
    db: AsyncSession,
    case_id: str,
    actor_id: str | None = None,
    actor_label: str = "system",
) -> dict[str, Any]:
    """
    Build (or rebuild) the Merkle tree for all evidence in a case.

    Leaf ordering: artifact_id lexicographic (documented, deterministic).
    Returns a dict with merkle_root and ordered artifact list.
    """
    # Fetch all artifacts for this case, ordered by artifact_id
    result = await db.execute(
        select(EvidenceArtifact)
        .where(EvidenceArtifact.case_id == case_id)
        .order_by(EvidenceArtifact.artifact_id.asc())
    )
    artifacts = list(result.scalars().all())

    if not artifacts:
        raise ValueError(f"No evidence artifacts found for case {case_id}")

    leaf_hashes = [a.sha256 for a in artifacts]
    artifact_ids = [a.artifact_id for a in artifacts]

    tree = build_merkle_tree(leaf_hashes)

    await record_event(
        db=db,
        event_type=AuditEventType.MERKLE_CREATED,
        actor_id=actor_id,
        actor_label=actor_label,
        case_id=case_id,
        details={
            "merkle_root": tree.root,
            "leaf_count": tree.leaf_count,
            "algorithm": "SHA-256",
            "leaf_ordering": "artifact_id_lexicographic",
            "artifact_ids": artifact_ids,
        },
    )

    return {
        "merkle_root": tree.root,
        "leaf_count": tree.leaf_count,
        "artifact_ids": artifact_ids,
        "leaf_hashes": leaf_hashes,
        "tree": tree,
    }


async def create_merkle_commitment(
    db: AsyncSession,
    case_id: str,
    actor_id: str | None = None,
    actor_label: str = "system",
) -> MerkleCommitment:
    """
    Build the Merkle tree and store the commitment record (without blockchain).
    Blockchain anchoring is done separately.
    """
    tree_data = await build_case_merkle_tree(db, case_id, actor_id, actor_label)

    # Determine next version
    result = await db.execute(
        select(MerkleCommitment)
        .where(MerkleCommitment.case_id == case_id)
        .order_by(MerkleCommitment.dataset_version.desc())
        .limit(1)
    )
    last_commitment = result.scalar_one_or_none()

    # If the latest commitment has the same Merkle root, return it (no new evidence added)
    if last_commitment and last_commitment.merkle_root == tree_data["merkle_root"]:
        logger.info(
            "merkle_commitment_unchanged",
            case_id=case_id,
            version=last_commitment.dataset_version,
            merkle_root=last_commitment.merkle_root,
        )
        return last_commitment

    next_version = (last_commitment.dataset_version + 1) if last_commitment else 1

    commitment = MerkleCommitment(
        case_id=case_id,
        dataset_version=next_version,
        merkle_root=tree_data["merkle_root"],
        evidence_count=tree_data["leaf_count"],
        algorithm="SHA-256",
        leaf_ordering="artifact_id_lexicographic",
        artifact_ids=tree_data["artifact_ids"],
        committed_by=actor_id,
    )
    db.add(commitment)

    # Update evidence status to COMMITTED
    for artifact_id_str in tree_data["artifact_ids"]:
        upd_result = await db.execute(
            select(EvidenceArtifact)
            .where(EvidenceArtifact.case_id == case_id)
            .where(EvidenceArtifact.artifact_id == artifact_id_str)
        )
        artifact = upd_result.scalar_one_or_none()
        if artifact:
            artifact.status = EvidenceStatus.COMMITTED

    await db.flush()
    return commitment


async def get_merkle_proof_for_artifact(
    db: AsyncSession,
    case_id: str,
    artifact_id_str: str,
    dataset_version: int | None = None,
) -> dict[str, Any]:
    """
    Generate a Merkle inclusion proof for a specific artifact.

    Args:
        case_id: The case identifier.
        artifact_id_str: The artifact_id (e.g., "EV-000001").
        dataset_version: Which version commitment to use (latest if None).

    Returns:
        Dict with leaf_hash, merkle_root, proof, and blockchain reference.
    """
    # Get the commitment
    query = (
        select(MerkleCommitment)
        .where(MerkleCommitment.case_id == case_id)
    )
    if dataset_version:
        query = query.where(MerkleCommitment.dataset_version == dataset_version)
    else:
        query = query.order_by(MerkleCommitment.dataset_version.desc()).limit(1)

    result = await db.execute(query)
    commitment = result.scalar_one_or_none()
    if not commitment:
        raise ValueError(f"No Merkle commitment found for case {case_id}")

    # Find the artifact in the commitment.
    # The commitment stores human-readable artifact_ids (e.g. "EV-000001").
    # If the caller passed a UUID instead, resolve it first.
    ordered_ids = commitment.artifact_ids
    resolved_artifact_id = artifact_id_str  # may already be an artifact_id

    if artifact_id_str not in ordered_ids:
        # Try resolving as a database UUID → artifact_id
        resolve_result = await db.execute(
            select(EvidenceArtifact)
            .where(EvidenceArtifact.case_id == case_id)
            .where(
                (EvidenceArtifact.id == artifact_id_str)
                | (EvidenceArtifact.artifact_id == artifact_id_str)
            )
        )
        resolved_artifact = resolve_result.scalar_one_or_none()
        if resolved_artifact and resolved_artifact.artifact_id in ordered_ids:
            resolved_artifact_id = resolved_artifact.artifact_id
        else:
            raise ValueError(
                f"Artifact {artifact_id_str} is not included in dataset version "
                f"{commitment.dataset_version}"
            )

    leaf_index = ordered_ids.index(resolved_artifact_id)

    # Fetch artifact hash
    art_result = await db.execute(
        select(EvidenceArtifact)
        .where(EvidenceArtifact.case_id == case_id)
        .where(EvidenceArtifact.artifact_id == resolved_artifact_id)
    )
    artifact = art_result.scalar_one_or_none()
    if not artifact:
        raise ValueError(f"Artifact {resolved_artifact_id} not found in database")

    # Rebuild the tree to generate the proof
    all_art_result = await db.execute(
        select(EvidenceArtifact)
        .where(EvidenceArtifact.case_id == case_id)
        .where(EvidenceArtifact.artifact_id.in_(ordered_ids))
        .order_by(EvidenceArtifact.artifact_id.asc())
    )
    all_artifacts = list(all_art_result.scalars().all())

    leaf_hashes = [a.sha256 for a in sorted(all_artifacts, key=lambda x: x.artifact_id)]
    tree = build_merkle_tree(leaf_hashes)
    proof_steps = generate_merkle_proof(tree, leaf_index)

    return {
        "artifact_id": resolved_artifact_id,
        "leaf_hash": artifact.sha256,
        "leaf_index": leaf_index,
        "merkle_root": commitment.merkle_root,
        "dataset_version": commitment.dataset_version,
        "proof": proof_to_dict(proof_steps),
        "blockchain_tx": commitment.tx_hash,
        "blockchain_block": commitment.block_number,
        "contract_address": commitment.contract_address,
        "algorithm": "SHA-256",
        "leaf_ordering": "artifact_id_lexicographic",
    }
