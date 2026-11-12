"""PSDE – Disclosure API Routes"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import Permission, has_permission
from app.models.models import Case, DisclosureRequest as DisclosureRequestModel, User
from app.schemas.schemas import DisclosureCreateRequest, DisclosureRequestOut
from app.services.disclosure.disclosure_service import create_disclosure

router = APIRouter(prefix="/disclosure", tags=["Disclosure"])


@router.post("/{case_id}", response_model=DisclosureRequestOut, status_code=201)
async def request_disclosure(
    case_id: str,
    data: DisclosureCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Request a privacy-preserving selective disclosure of evidence.
    Applies filters and redactions based on investigator purpose and roles.
    """
    if not has_permission(current_user.role, Permission.EVIDENCE_DISCLOSE):
        raise HTTPException(status_code=403, detail="Permission denied: EVIDENCE_DISCLOSE")

    case_result = await db.execute(
        select(Case).where((Case.id == case_id) | (Case.case_number == case_id))
    )
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    disclosure = await create_disclosure(
        db=db,
        case_id=case.id,
        requested_by_id=current_user.id,
        requested_by_label=current_user.username,
        purpose=data.purpose,
        user_role=current_user.role,
        filters=data.filters.model_dump(exclude_unset=True),
        request_id=request.headers.get("X-Request-ID"),
    )

    # Load newly-created disclosure items before converting the ORM object to
    # the response schema. This avoids FastAPI attempting to serialize the
    # SQLAlchemy relationship itself.
    await db.refresh(disclosure, attribute_names=["items"])
    return DisclosureRequestOut.model_validate(disclosure)


@router.get("", response_model=list[DisclosureRequestOut])
async def list_all_disclosures(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all disclosure requests across all cases."""
    if not has_permission(current_user.role, Permission.CASE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied.")

    result = await db.execute(
        select(DisclosureRequestModel)
        .order_by(DisclosureRequestModel.created_at.desc())
    )
    requests = result.scalars().all()
    return [DisclosureRequestOut.model_validate(r) for r in requests]


@router.get("/{case_id}", response_model=list[DisclosureRequestOut])
async def list_disclosures(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all disclosure requests for a case."""
    if not has_permission(current_user.role, Permission.CASE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied.")

    case_result = await db.execute(
        select(Case).where((Case.id == case_id) | (Case.case_number == case_id))
    )
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    result = await db.execute(
        select(DisclosureRequestModel)
        .where(DisclosureRequestModel.case_id == case.id)
        .order_by(DisclosureRequestModel.created_at.desc())
    )
    requests = result.scalars().all()
    return [DisclosureRequestOut.model_validate(r) for r in requests]


@router.get("/request/{disclosure_id}", response_model=DisclosureRequestOut)
async def get_disclosure(
    disclosure_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific disclosure request details and its items."""
    if not has_permission(current_user.role, Permission.EVIDENCE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied.")

    result = await db.execute(
        select(DisclosureRequestModel).where(DisclosureRequestModel.id == disclosure_id)
    )
    disclosure = result.scalar_one_or_none()
    if not disclosure:
        raise HTTPException(status_code=404, detail="Disclosure request not found.")

    return DisclosureRequestOut.model_validate(disclosure)
