"""PSDE – Dashboard API Routes"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import (
    AuditEvent, AuditEventType, Case, DisclosureRequest,
    EvidenceArtifact, EvidenceSensitivity, MerkleCommitment, User,
)
from app.schemas.schemas import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregated metrics for the dashboard (real data only)."""
    # Base counts
    total_cases = (await db.execute(select(func.count()).select_from(Case))).scalar() or 0
    open_cases = (await db.execute(select(func.count()).select_from(Case).where(Case.status == "OPEN"))).scalar() or 0
    total_evidence = (await db.execute(select(func.count()).select_from(EvidenceArtifact))).scalar() or 0

    # Sensitivity
    sensitive_evidence = (await db.execute(
        select(func.count()).select_from(EvidenceArtifact).where(
            EvidenceArtifact.sensitivity_level.in_([EvidenceSensitivity.HIGH, EvidenceSensitivity.CRITICAL])
        )
    )).scalar() or 0

    sens_dist = (await db.execute(
        select(EvidenceArtifact.sensitivity_level, func.count())
        .group_by(EvidenceArtifact.sensitivity_level)
    )).all()
    evidence_by_sensitivity = {s: c for s, c in sens_dist}

    # Type
    type_dist = (await db.execute(
        select(EvidenceArtifact.mime_type, func.count())
        .group_by(EvidenceArtifact.mime_type)
    )).all()
    evidence_by_type = {t: c for t, c in type_dist}

    # Disclosures & Verifications
    total_disclosures = (await db.execute(select(func.count()).select_from(DisclosureRequest))).scalar() or 0

    verifications = (await db.execute(
        select(func.count()).select_from(AuditEvent).where(
            AuditEvent.event_type.in_([
                AuditEventType.VERIFICATION_PASSED,
                AuditEventType.VERIFICATION_FAILED
            ])
        )
    )).scalar() or 0

    failed_verifications = (await db.execute(
        select(func.count()).select_from(AuditEvent).where(
            AuditEvent.event_type == AuditEventType.VERIFICATION_FAILED
        )
    )).scalar() or 0

    # Blockchain
    commitments = (await db.execute(
        select(func.count()).select_from(MerkleCommitment).where(
            MerkleCommitment.tx_hash.isnot(None)
        )
    )).scalar() or 0

    # Recent events
    recent_events_result = await db.execute(
        select(AuditEvent)
        .order_by(AuditEvent.timestamp.desc())
        .limit(10)
    )
    recent_events = [
        {
            "id": e.id,
            "type": e.event_type,
            "actor": e.actor_label,
            "timestamp": e.timestamp.isoformat(),
        } for e in recent_events_result.scalars().all()
    ]

    # Security Alerts: failed verifications, classification overrides, denied disclosures
    alert_events_result = await db.execute(
        select(AuditEvent)
        .where(
            AuditEvent.event_type.in_([
                AuditEventType.VERIFICATION_FAILED,
                AuditEventType.CLASSIFICATION_OVERRIDDEN,
                AuditEventType.DISCLOSURE_DENIED,
            ])
        )
        .order_by(AuditEvent.timestamp.desc())
        .limit(6)
    )
    security_alerts = [
        {
            "id": a.id,
            "type": a.event_type,
            "actor": a.actor_label,
            "details": a.details,
            "timestamp": a.timestamp.isoformat(),
        }
        for a in alert_events_result.scalars().all()
    ]

    return DashboardStats(
        total_cases=total_cases,
        open_cases=open_cases,
        total_evidence=total_evidence,
        sensitive_evidence=sensitive_evidence,
        total_disclosures=total_disclosures,
        total_verifications=verifications,
        failed_verifications=failed_verifications,
        blockchain_commitments=commitments,
        evidence_by_sensitivity=evidence_by_sensitivity,
        evidence_by_type=evidence_by_type,
        recent_events=recent_events,
        recent_security_alerts=security_alerts,
    )
