"""PSDE – Evidence API Routes"""
from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import Permission, has_permission
from app.models.models import (
    AuditEventType, Case, EvidenceArtifact, EvidenceRelevance,
    EvidenceSensitivity, EvidenceStatus, User,
)
from app.schemas.schemas import (
    ClassificationOverride, EvidenceListOut, EvidenceOut,
)
from app.services.audit.audit_service import record_event
from app.services.evidence.ingestion import ingest_evidence, verify_stored_evidence

router = APIRouter(prefix="/evidence", tags=["Evidence"])


@router.post("/{case_id}/upload", response_model=EvidenceOut, status_code=201)
async def upload_evidence(
    case_id: str,
    request: Request,
    file: UploadFile = File(...),
    source: str = Form(default="upload"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload and ingest a new evidence artifact into a case."""
    if not has_permission(current_user.role, Permission.EVIDENCE_UPLOAD):
        raise HTTPException(status_code=403, detail="Permission denied: EVIDENCE_UPLOAD")

    # Verify case exists
    case_result = await db.execute(
        select(Case).where((Case.id == case_id) | (Case.case_number == case_id))
    )
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    if case.status != "OPEN":
        raise HTTPException(status_code=409, detail=f"Case is {case.status}. Cannot add evidence.")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    file_bytes = await file.read()

    try:
        artifact = await ingest_evidence(
            db=db,
            case_id=case.id,
            case_number=case.case_number,
            investigation_purpose=case.investigation_purpose,
            filename=file.filename,
            file_bytes=file_bytes,
            source=source,
            actor_id=current_user.id,
            actor_label=current_user.username,
            request_id=request.headers.get("X-Request-ID"),
        )
        return EvidenceOut.model_validate(artifact)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=EvidenceListOut)
async def list_all_evidence(
    case_id: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    sensitivity: Optional[str] = Query(default=None),
    relevance: Optional[str] = Query(default=None),
    mime_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all evidence artifacts across all cases or for a specific case with filtering and pagination."""
    if not has_permission(current_user.role, Permission.EVIDENCE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: EVIDENCE_VIEW")

    query = select(EvidenceArtifact)
    count_query = select(func.count()).select_from(EvidenceArtifact)

    if case_id:
        case_res = await db.execute(select(Case).where((Case.id == case_id) | (Case.case_number == case_id)))
        c = case_res.scalar_one_or_none()
        if c:
            query = query.where(EvidenceArtifact.case_id == c.id)
            count_query = count_query.where(EvidenceArtifact.case_id == c.id)

    if sensitivity:
        query = query.where(EvidenceArtifact.sensitivity_level == sensitivity)
        count_query = count_query.where(EvidenceArtifact.sensitivity_level == sensitivity)
    if relevance:
        query = query.where(EvidenceArtifact.relevance_level == relevance)
        count_query = count_query.where(EvidenceArtifact.relevance_level == relevance)
    if mime_type:
        query = query.where(EvidenceArtifact.mime_type == mime_type)
        count_query = count_query.where(EvidenceArtifact.mime_type == mime_type)
    if status:
        query = query.where(EvidenceArtifact.status == status)
        count_query = count_query.where(EvidenceArtifact.status == status)
    if search:
        like = f"%{search}%"
        query = query.where(
            EvidenceArtifact.filename.ilike(like) | EvidenceArtifact.artifact_id.ilike(like)
        )
        count_query = count_query.where(
            EvidenceArtifact.filename.ilike(like) | EvidenceArtifact.artifact_id.ilike(like)
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.order_by(EvidenceArtifact.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return EvidenceListOut(
        items=[EvidenceOut.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.get("/{case_id}", response_model=EvidenceListOut)
async def list_evidence(
    case_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    sensitivity: Optional[str] = Query(default=None),
    relevance: Optional[str] = Query(default=None),
    mime_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List evidence artifacts for a case with filtering and pagination."""
    if not has_permission(current_user.role, Permission.EVIDENCE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: EVIDENCE_VIEW")

    # Resolve case
    case_result = await db.execute(
        select(Case).where((Case.id == case_id) | (Case.case_number == case_id))
    )
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    query = select(EvidenceArtifact).where(EvidenceArtifact.case_id == case.id)
    count_query = select(func.count()).select_from(EvidenceArtifact).where(EvidenceArtifact.case_id == case.id)

    if sensitivity:
        query = query.where(EvidenceArtifact.sensitivity_level == sensitivity)
        count_query = count_query.where(EvidenceArtifact.sensitivity_level == sensitivity)
    if relevance:
        query = query.where(EvidenceArtifact.relevance_level == relevance)
        count_query = count_query.where(EvidenceArtifact.relevance_level == relevance)
    if mime_type:
        query = query.where(EvidenceArtifact.mime_type == mime_type)
        count_query = count_query.where(EvidenceArtifact.mime_type == mime_type)
    if status:
        query = query.where(EvidenceArtifact.status == status)
        count_query = count_query.where(EvidenceArtifact.status == status)
    if search:
        like = f"%{search}%"
        query = query.where(
            EvidenceArtifact.filename.ilike(like) | EvidenceArtifact.artifact_id.ilike(like)
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.order_by(EvidenceArtifact.artifact_id.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return EvidenceListOut(
        items=[EvidenceOut.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.get("/artifact/{artifact_db_id}", response_model=EvidenceOut)
async def get_evidence_detail(
    artifact_db_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed information about a single evidence artifact."""
    if not has_permission(current_user.role, Permission.EVIDENCE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: EVIDENCE_VIEW")

    result = await db.execute(
        select(EvidenceArtifact).where(
            (EvidenceArtifact.id == artifact_db_id) | (EvidenceArtifact.artifact_id == artifact_db_id)
        )
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Evidence artifact not found.")
    return EvidenceOut.model_validate(artifact)


@router.delete("/artifact/{artifact_db_id}", status_code=204)
async def delete_evidence(
    artifact_db_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an evidence artifact record."""
    if not has_permission(current_user.role, Permission.EVIDENCE_UPLOAD):
        raise HTTPException(status_code=403, detail="Permission denied: EVIDENCE_UPLOAD")
    result = await db.execute(
        select(EvidenceArtifact).where(
            (EvidenceArtifact.id == artifact_db_id) | (EvidenceArtifact.artifact_id == artifact_db_id)
        )
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Evidence artifact not found.")
    import os
    if artifact.storage_path and os.path.isfile(artifact.storage_path):
        try:
            os.remove(artifact.storage_path)
        except OSError:
            pass
    await db.delete(artifact)


@router.get("/artifact/{artifact_db_id}/download")
async def download_evidence(
    artifact_db_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download the raw evidence file by UUID or artifact_id."""
    import os
    from pathlib import Path
    from fastapi.responses import FileResponse
    from app.core.config import get_settings
    settings = get_settings()

    if not has_permission(current_user.role, Permission.EVIDENCE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: EVIDENCE_VIEW")

    result = await db.execute(
        select(EvidenceArtifact).where(
            (EvidenceArtifact.id == artifact_db_id) | (EvidenceArtifact.artifact_id == artifact_db_id)
        )
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Evidence artifact not found.")

    storage_path = artifact.storage_path
    if not storage_path:
        raise HTTPException(status_code=404, detail="Evidence file not found on disk.")

    resolved_path = Path(storage_path)
    if not resolved_path.is_absolute():
        # Check relative to backend directory or current working directory
        candidates = [
            resolved_path,
            Path("backend") / resolved_path,
            Path(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))) / resolved_path,
            Path(settings.evidence_storage_path) / resolved_path.name,
        ]
        found = False
        for cand in candidates:
            if cand.exists() and cand.is_file():
                resolved_path = cand
                found = True
                break
        if not found:
            raise HTTPException(status_code=404, detail="Evidence file not found on disk.")
    elif not resolved_path.exists():
        raise HTTPException(status_code=404, detail="Evidence file not found on disk.")

    return FileResponse(
        path=str(resolved_path),
        filename=artifact.filename,
        media_type=artifact.mime_type or "application/octet-stream",
        content_disposition_type="attachment",
    )


@router.post("/artifact/{artifact_db_id}/verify-integrity")
async def verify_evidence_integrity(
    artifact_db_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify the physical integrity of a stored evidence file against its original hash."""
    if not has_permission(current_user.role, Permission.EVIDENCE_VERIFY):
        raise HTTPException(status_code=403, detail="Permission denied: EVIDENCE_VERIFY")

    result = await db.execute(
        select(EvidenceArtifact).where(
            (EvidenceArtifact.id == artifact_db_id) | (EvidenceArtifact.artifact_id == artifact_db_id)
        )
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Evidence artifact not found.")

    return await verify_stored_evidence(artifact)


@router.post("/artifact/{artifact_db_id}/override-classification")
async def override_classification(
    artifact_db_id: str,
    data: ClassificationOverride,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Override the automated sensitivity/relevance classification. Creates audit record."""
    if not has_permission(current_user.role, Permission.CLASSIFICATION_OVERRIDE):
        raise HTTPException(status_code=403, detail="Permission denied: CLASSIFICATION_OVERRIDE")

    result = await db.execute(select(EvidenceArtifact).where(EvidenceArtifact.id == artifact_db_id))
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Evidence artifact not found.")

    # Store original values
    original_sensitivity = artifact.sensitivity_level
    original_relevance = artifact.relevance_level

    if data.sensitivity_level:
        artifact.original_sensitivity = original_sensitivity
        artifact.sensitivity_level = data.sensitivity_level
    if data.relevance_level:
        artifact.original_relevance = original_relevance
        artifact.relevance_level = data.relevance_level

    artifact.override_reason = data.reason
    artifact.overridden_by = current_user.id
    from datetime import datetime, timezone
    artifact.overridden_at = datetime.now(timezone.utc)

    await record_event(
        db=db,
        event_type=AuditEventType.CLASSIFICATION_OVERRIDDEN,
        actor_id=current_user.id,
        actor_label=current_user.username,
        case_id=artifact.case_id,
        artifact_id=artifact.id,
        details={
            "artifact_id": artifact.artifact_id,
            "original_sensitivity": original_sensitivity,
            "new_sensitivity": data.sensitivity_level or original_sensitivity,
            "original_relevance": original_relevance,
            "new_relevance": data.relevance_level or original_relevance,
            "reason": data.reason,
        },
    )

    return {"success": True, "message": "Classification overridden and audit event recorded."}
