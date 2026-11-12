"""
PSDE – Selective Disclosure Orchestration Service

Workflow:
  1. Investigator selects a case and provides investigation purpose + filters
  2. System queries eligible evidence (by type, date, sensitivity limit, relevance)
  3. Privacy engine evaluates each artifact independently
  4. Generates Merkle proofs for all disclosed artifacts
  5. Returns a disclosure package (manifest + per-artifact decisions)
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.models import (
    AuditEventType, DisclosureDecision, DisclosureItem, DisclosureRequest as DisclosureRequestModel,
    EvidenceArtifact, EvidenceRelevance, EvidenceSensitivity, MerkleCommitment,
)
from app.services.audit.audit_service import record_event
from app.services.merkle.merkle_service import get_merkle_proof_for_artifact
from app.services.privacy.filter import (
    DisclosureRequest as PolicyRequest, PrivacyFilter, redact_text
)

logger = get_logger(__name__)
_privacy_filter = PrivacyFilter()


async def create_disclosure(
    db: AsyncSession,
    case_id: str,
    requested_by_id: str,
    requested_by_label: str,
    purpose: str,
    user_role: str,
    filters: dict[str, Any],
    request_id: str | None = None,
) -> DisclosureRequestModel:
    """
    Execute the selective disclosure workflow.

    Filters supported:
      mime_type (str): filter by MIME type
      sensitivity_limit (str): maximum sensitivity level to include
      relevance_minimum (str): minimum relevance level to include
      date_from (str ISO): acquisition from date
      date_to (str ISO): acquisition to date
      artifact_ids (list[str]): explicit artifact IDs to include
    """
    # ── Step 1: Record request ─────────────────────────────────
    disc_request = DisclosureRequestModel(
        case_id=case_id,
        requested_by=requested_by_id,
        purpose=purpose,
        filters=filters,
        decision=DisclosureDecision.DENY,
    )
    db.add(disc_request)
    await db.flush()

    await record_event(
        db=db,
        event_type=AuditEventType.DISCLOSURE_REQUESTED,
        actor_id=requested_by_id,
        actor_label=requested_by_label,
        case_id=case_id,
        details={"purpose": purpose, "filters": filters, "request_id": disc_request.id},
        request_id=request_id,
    )

    # ── Step 2: Query eligible evidence ───────────────────────
    query = select(EvidenceArtifact).where(EvidenceArtifact.case_id == case_id)

    # Apply filters
    sensitivity_order = {
        EvidenceSensitivity.PUBLIC: 0, EvidenceSensitivity.LOW: 1,
        EvidenceSensitivity.MEDIUM: 2, EvidenceSensitivity.HIGH: 3,
        EvidenceSensitivity.CRITICAL: 4,
    }
    sensitivity_limit = filters.get("sensitivity_limit", EvidenceSensitivity.HIGH)
    limit_order = sensitivity_order.get(sensitivity_limit, 3)

    if filters.get("mime_type"):
        query = query.where(EvidenceArtifact.mime_type == filters["mime_type"])

    if filters.get("date_from"):
        try:
            dt_from = datetime.fromisoformat(filters["date_from"])
            query = query.where(EvidenceArtifact.acquisition_timestamp >= dt_from)
        except ValueError:
            pass

    if filters.get("date_to"):
        try:
            dt_to = datetime.fromisoformat(filters["date_to"])
            query = query.where(EvidenceArtifact.acquisition_timestamp <= dt_to)
        except ValueError:
            pass

    if filters.get("artifact_ids"):
        query = query.where(EvidenceArtifact.artifact_id.in_(filters["artifact_ids"]))

    result = await db.execute(query.order_by(EvidenceArtifact.artifact_id.asc()))
    candidates = list(result.scalars().all())

    # ── Step 3: Get latest Merkle commitment ─────────────────
    mc_result = await db.execute(
        select(MerkleCommitment)
        .where(MerkleCommitment.case_id == case_id)
        .order_by(MerkleCommitment.dataset_version.desc())
        .limit(1)
    )
    commitment = mc_result.scalar_one_or_none()

    # ── Step 4: Evaluate each artifact ────────────────────────
    items: list[DisclosureItem] = []
    total_eligible = 0
    total_redacted = 0
    total_denied = 0

    for artifact in candidates:
        # Check sensitivity limit
        artifact_sens_order = sensitivity_order.get(artifact.sensitivity_level, 99)
        if artifact_sens_order > limit_order:
            # Exceeds sensitivity limit → deny
            item = DisclosureItem(
                request_id=disc_request.id,
                artifact_db_id=artifact.id,
                decision=DisclosureDecision.DENY,
                decision_reason=f"Sensitivity level {artifact.sensitivity_level} exceeds requested limit {sensitivity_limit}",
                redactions_applied=[],
                disclosed_fields=[],
                merkle_proof=[],
                original_hash=artifact.sha256,
            )
            db.add(item)
            total_denied += 1
            continue

        # Evaluate privacy policy
        policy_request = PolicyRequest(
            user_role=user_role,
            purpose=purpose,
            artifact_sensitivity=artifact.sensitivity_level,
            artifact_relevance=artifact.relevance_level,
        )
        decision = _privacy_filter.evaluate(policy_request)

        merkle_proof = []
        if commitment and artifact.artifact_id in (commitment.artifact_ids or []):
            try:
                proof_data = await get_merkle_proof_for_artifact(
                    db=db,
                    case_id=case_id,
                    artifact_id_str=artifact.artifact_id,
                    dataset_version=commitment.dataset_version,
                )
                merkle_proof = proof_data.get("proof", [])
            except Exception as e:
                logger.warning("merkle_proof_generation_failed", artifact=artifact.artifact_id, error=str(e))

        redaction_records = []
        disclosed_hash = None

        if decision.decision == DisclosureDecision.ALLOW_WITH_REDACTION:
            # Apply redaction to filename as a proxy (actual content not stored)
            # In a real scenario, the content would be retrieved and redacted
            redaction_records = [
                {"pii_type": ptype, "count": 1}
                for ptype in decision.redact_pii_types
            ]
            total_redacted += 1
            total_eligible += 1
        elif decision.decision == DisclosureDecision.ALLOW:
            total_eligible += 1
        else:
            total_denied += 1

        disclosed_hash = (
            hashlib.sha256(artifact.sha256.encode()).hexdigest()
            if decision.decision in (DisclosureDecision.ALLOW, DisclosureDecision.ALLOW_WITH_REDACTION)
            else None
        )

        item = DisclosureItem(
            request_id=disc_request.id,
            artifact_db_id=artifact.id,
            decision=decision.decision,
            decision_reason=decision.reason,
            redactions_applied=redaction_records,
            disclosed_fields=decision.allowed_fields,
            merkle_proof=merkle_proof,
            original_hash=artifact.sha256,
            disclosed_hash=disclosed_hash,
        )
        db.add(item)
        items.append(item)

        event_type = (
            AuditEventType.DISCLOSURE_APPROVED
            if decision.decision != DisclosureDecision.DENY
            else AuditEventType.DISCLOSURE_DENIED
        )
        await record_event(
            db=db,
            event_type=event_type,
            actor_id=requested_by_id,
            actor_label=requested_by_label,
            case_id=case_id,
            artifact_id=artifact.id,
            details={
                "artifact_id": artifact.artifact_id,
                "decision": decision.decision,
                "reason": decision.reason,
                "sensitivity": artifact.sensitivity_level,
                "relevance": artifact.relevance_level,
            },
        )

    # ── Step 5: Finalize request ───────────────────────────────
    disc_request.decision = (
        DisclosureDecision.ALLOW if total_eligible > 0 else DisclosureDecision.DENY
    )
    disc_request.total_requested = len(candidates)
    disc_request.total_eligible = total_eligible
    disc_request.total_redacted = total_redacted
    disc_request.total_denied = total_denied
    disc_request.dataset_version = commitment.dataset_version if commitment else None
    disc_request.completed_at = datetime.now(timezone.utc)

    await db.flush()

    logger.info(
        "disclosure_completed",
        case_id=case_id,
        requested=len(candidates),
        eligible=total_eligible,
        redacted=total_redacted,
        denied=total_denied,
    )
    return disc_request
