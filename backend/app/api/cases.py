"""PSDE – Cases API Routes"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import Permission, has_permission
from app.models.models import (
    AuditEvent, AuditEventType, Case, CaseStatus, EvidenceArtifact,
    EvidenceSensitivity, MerkleCommitment, DisclosureRequest, DisclosureItem, User,
)
from app.schemas.schemas import CaseCreate, CaseOut, CaseUpdate
from app.services.audit.audit_service import record_event

router = APIRouter(prefix="/cases", tags=["Cases"])


def _generate_case_number(seq: int) -> str:
    return f"CASE-{seq:04d}"


@router.post("", response_model=CaseOut, status_code=201)
async def create_case(
    data: CaseCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new investigation case."""
    if not has_permission(current_user.role, Permission.CASE_CREATE):
        raise HTTPException(status_code=403, detail="Permission denied: CASE_CREATE")

    # Auto-generate case number
    count_result = await db.execute(select(func.count()).select_from(Case))
    count = count_result.scalar() or 0
    case_number = _generate_case_number(count + 1)

    case = Case(
        id=str(uuid.uuid4()),
        case_number=case_number,
        case_name=data.case_name,
        description=data.description,
        investigation_purpose=data.investigation_purpose,
        created_by=current_user.id,
        status=CaseStatus.OPEN,
    )
    db.add(case)
    await db.flush()

    await record_event(
        db=db,
        event_type=AuditEventType.CASE_CREATED,
        actor_id=current_user.id,
        actor_label=current_user.username,
        case_id=case.id,
        details={
            "case_number": case_number,
            "case_name": data.case_name,
            "investigation_purpose": data.investigation_purpose,
        },
        ip_address=request.client.host if request.client else None,
    )

    return await _enrich_case(case, db)


@router.get("", response_model=list[CaseOut])
async def list_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all cases the user has access to."""
    if not has_permission(current_user.role, Permission.CASE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: CASE_VIEW")

    result = await db.execute(select(Case).order_by(Case.created_at.desc()))
    cases = result.scalars().all()
    return [await _enrich_case(c, db) for c in cases]


@router.get("/{case_id}", response_model=CaseOut)
async def get_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get case details by ID or case_number."""
    if not has_permission(current_user.role, Permission.CASE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: CASE_VIEW")

    # Try by UUID or case_number
    result = await db.execute(
        select(Case).where((Case.id == case_id) | (Case.case_number == case_id))
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    return await _enrich_case(case, db)


@router.patch("/{case_id}", response_model=CaseOut)
async def update_case(
    case_id: str,
    data: CaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update case fields. Requires CASE_CREATE permission."""
    if not has_permission(current_user.role, Permission.CASE_CREATE):
        raise HTTPException(status_code=403, detail="Permission denied.")

    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    if data.case_name is not None:
        case.case_name = data.case_name
    if data.description is not None:
        case.description = data.description
    if data.investigation_purpose is not None:
        case.investigation_purpose = data.investigation_purpose
    if data.status is not None:
        case.status = data.status
        if data.status in (CaseStatus.CLOSED, CaseStatus.SEALED):
            case.closed_at = datetime.now(timezone.utc)

    await db.flush()
    return await _enrich_case(case, db)


@router.delete("/{case_id}", status_code=204)
async def delete_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a case and its associated records."""
    if not has_permission(current_user.role, Permission.CASE_CREATE):
        raise HTTPException(status_code=403, detail="Permission denied.")

    result = await db.execute(
        select(Case).where((Case.id == case_id) | (Case.case_number == case_id))
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    try:
        import os
        evidence_items = list((await db.execute(
            select(EvidenceArtifact).where(EvidenceArtifact.case_id == case.id)
        )).scalars().all())
        for ev in evidence_items:
            if ev.storage_path and os.path.isfile(ev.storage_path):
                try:
                    os.remove(ev.storage_path)
                except OSError:
                    pass

        request_ids = [
            row[0]
            for row in (
                await db.execute(
                    select(DisclosureRequest.id).where(
                        DisclosureRequest.case_id == case.id
                    )
                )
            ).all()
        ]
        evidence_ids = [ev.id for ev in evidence_items]

        # Remove disclosure items before either parent they reference.
        if request_ids:
            await db.execute(
                delete(DisclosureItem).where(
                    DisclosureItem.request_id.in_(request_ids)
                )
            )
        if evidence_ids:
            await db.execute(
                delete(DisclosureItem).where(
                    DisclosureItem.artifact_db_id.in_(evidence_ids)
                )
            )
            await db.execute(
                delete(AuditEvent).where(AuditEvent.artifact_id.in_(evidence_ids))
            )
        await db.execute(delete(AuditEvent).where(AuditEvent.case_id == case.id))
        await db.execute(delete(DisclosureRequest).where(DisclosureRequest.case_id == case.id))
        await db.execute(delete(EvidenceArtifact).where(EvidenceArtifact.case_id == case.id))
        await db.execute(delete(MerkleCommitment).where(MerkleCommitment.case_id == case.id))
        await db.execute(delete(Case).where(Case.id == case.id))
        await db.commit()
        return Response(status_code=204)
    except Exception:
        await db.rollback()
        raise


async def _enrich_case(case: Case, db: AsyncSession) -> CaseOut:
    """Add computed fields to a case."""
    ev_count = await db.execute(
        select(func.count()).select_from(EvidenceArtifact)
        .where(EvidenceArtifact.case_id == case.id)
    )
    total_evidence = ev_count.scalar() or 0

    sensitive_count = await db.execute(
        select(func.count()).select_from(EvidenceArtifact)
        .where(EvidenceArtifact.case_id == case.id)
        .where(EvidenceArtifact.sensitivity_level.in_(
            [EvidenceSensitivity.HIGH, EvidenceSensitivity.CRITICAL]
        ))
    )
    sensitive = sensitive_count.scalar() or 0

    latest_commit_result = await db.execute(
        select(MerkleCommitment)
        .where(MerkleCommitment.case_id == case.id)
        .order_by(MerkleCommitment.dataset_version.desc())
        .limit(1)
    )
    latest_commit = latest_commit_result.scalar_one_or_none()

    out = CaseOut.model_validate(case)
    out.evidence_count = total_evidence
    out.sensitive_count = sensitive
    out.latest_merkle_root = latest_commit.merkle_root if latest_commit else None
    out.latest_version = latest_commit.dataset_version if latest_commit else None
    return out
