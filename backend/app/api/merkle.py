"""PSDE – Merkle API Routes"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import Permission, has_permission
from app.models.models import Case, EvidenceArtifact, MerkleCommitment, User
from app.schemas.schemas import MerkleCommitmentOut, MerkleProofOut
from app.services.merkle.merkle_service import (
    create_merkle_commitment, get_merkle_proof_for_artifact
)

router = APIRouter(prefix="/merkle", tags=["Merkle"])


@router.post("/{case_id}/commit", response_model=MerkleCommitmentOut, status_code=201)
async def create_commitment(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Build a Merkle tree for the case's evidence and create a commitment record.
    This does NOT anchor to the blockchain automatically.
    """
    if not has_permission(current_user.role, Permission.BLOCKCHAIN_COMMIT):
        raise HTTPException(status_code=403, detail="Permission denied: BLOCKCHAIN_COMMIT")

    # Verify case
    case_result = await db.execute(
        select(Case).where((Case.id == case_id) | (Case.case_number == case_id))
    )
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    try:
        commitment = await create_merkle_commitment(
            db=db,
            case_id=case.id,
            actor_id=current_user.id,
            actor_label=current_user.username,
        )
        return MerkleCommitmentOut.model_validate(commitment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{case_id}/commitments", response_model=list[MerkleCommitmentOut])
async def list_commitments(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all dataset version commitments for a case."""
    if not has_permission(current_user.role, Permission.CASE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: CASE_VIEW")

    case_result = await db.execute(
        select(Case).where((Case.id == case_id) | (Case.case_number == case_id))
    )
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    result = await db.execute(
        select(MerkleCommitment)
        .where(MerkleCommitment.case_id == case.id)
        .order_by(MerkleCommitment.dataset_version.desc())
    )
    commitments = result.scalars().all()
    return [MerkleCommitmentOut.model_validate(c) for c in commitments]


@router.get("/{case_id}/proof/{artifact_id}", response_model=MerkleProofOut)
async def get_merkle_proof(
    case_id: str,
    artifact_id: str,
    dataset_version: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the Merkle inclusion proof for a specific artifact in a specific dataset version.
    """
    if not has_permission(current_user.role, Permission.EVIDENCE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied.")

    case_result = await db.execute(
        select(Case).where((Case.id == case_id) | (Case.case_number == case_id))
    )
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    try:
        proof_data = await get_merkle_proof_for_artifact(
            db=db,
            case_id=case.id,
            artifact_id_str=artifact_id,
            dataset_version=dataset_version,
        )
        return MerkleProofOut(**proof_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
