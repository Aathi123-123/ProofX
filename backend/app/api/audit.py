"""PSDE – Audit API Routes"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import Permission, has_permission
from app.models.models import User
from app.schemas.schemas import AuditEventOut
from app.services.audit.audit_service import (
    get_all_events, get_artifact_audit_trail, get_case_audit_trail
)

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("", response_model=list[AuditEventOut])
async def list_events(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    event_type: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List global audit events (Admin/Auditor only)."""
    if not has_permission(current_user.role, Permission.AUDIT_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: AUDIT_VIEW")

    events = await get_all_events(db=db, limit=limit, offset=offset, event_type=event_type)
    return [AuditEventOut.model_validate(e) for e in events]


@router.get("/case/{case_id}", response_model=list[AuditEventOut])
async def get_case_audit(
    case_id: str,
    limit: int = Query(default=500, ge=1),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List audit events for a specific case."""
    if not has_permission(current_user.role, Permission.CASE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied.")

    events = await get_case_audit_trail(db=db, case_id=case_id, limit=limit, offset=offset)
    return [AuditEventOut.model_validate(e) for e in events]


@router.get("/artifact/{artifact_db_id}", response_model=list[AuditEventOut])
async def get_artifact_audit(
    artifact_db_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List audit events for a specific artifact."""
    if not has_permission(current_user.role, Permission.EVIDENCE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied.")

    events = await get_artifact_audit_trail(db=db, artifact_db_id=artifact_db_id)
    return [AuditEventOut.model_validate(e) for e in events]
