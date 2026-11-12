"""PSDE – Reports API Endpoints"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import Permission, has_permission
from app.models.models import Case, User
from app.services.reports.report_service import generate_case_summary_report

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/case/{case_id}/pdf")
async def get_case_report_pdf(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and download a comprehensive Forensic Case Summary PDF report."""
    if not has_permission(current_user.role, Permission.CASE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: CASE_VIEW")

    case_res = await db.execute(select(Case).where((Case.id == case_id) | (Case.case_number == case_id)))
    case = case_res.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    try:
        pdf_bytes = await generate_case_summary_report(db, case.id)
        filename = f"ProofX_Forensic_Report_{case.case_number}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.get("/case/{case_id}/summary")
async def get_case_report_summary_json(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get JSON summary data of all evidence, commitments, and audits for reporting."""
    if not has_permission(current_user.role, Permission.CASE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: CASE_VIEW")

    case_res = await db.execute(select(Case).where((Case.id == case_id) | (Case.case_number == case_id)))
    case = case_res.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    from app.models.models import EvidenceArtifact, MerkleCommitment, AuditEvent

    ev_res = await db.execute(select(EvidenceArtifact).where(EvidenceArtifact.case_id == case.id))
    evidence = ev_res.scalars().all()

    comm_res = await db.execute(select(MerkleCommitment).where(MerkleCommitment.case_id == case.id))
    commitments = comm_res.scalars().all()

    audit_res = await db.execute(select(AuditEvent).where(AuditEvent.case_id == case.id).order_by(AuditEvent.timestamp.desc()).limit(20))
    audits = audit_res.scalars().all()

    return {
        "case": {
            "id": case.id,
            "case_number": case.case_number,
            "case_name": case.case_name,
            "status": case.status,
            "purpose": case.investigation_purpose,
            "created_at": case.created_at.isoformat(),
        },
        "stats": {
            "evidence_count": len(evidence),
            "commitments_count": len(commitments),
            "audit_events_count": len(audits),
        },
        "evidence": [
            {
                "artifact_id": e.artifact_id,
                "filename": e.filename,
                "sha256": e.sha256,
                "sensitivity": e.sensitivity_level,
                "relevance": e.relevance_level,
                "status": e.status,
            }
            for e in evidence
        ],
        "commitments": [
            {
                "version": c.dataset_version,
                "merkle_root": c.merkle_root,
                "tx_hash": c.tx_hash,
                "timestamp": c.created_at.isoformat(),
            }
            for c in commitments
        ],
    }

