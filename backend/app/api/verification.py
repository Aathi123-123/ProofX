"""PSDE – Verification API Routes"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import Permission, has_permission
from app.models.models import User
from app.schemas.schemas import VerificationResultOut
from app.services.verification.verification_service import verify_evidence
from app.services.reports.report_service import generate_verification_report_pdf

router = APIRouter(prefix="/verify", tags=["Verification"])


@router.post("", response_model=VerificationResultOut)
async def verify_disclosed_evidence(
    request: Request,
    artifact_db_id: str = Form(...),
    case_id: str = Form(default=None),
    dataset_version: int = Form(default=None),
    merkle_proof: str = Form(default="[]"),
    evidence_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verify a disclosed evidence file cryptographically against its Merkle proof
    and on-chain commitment.
    """
    if not has_permission(current_user.role, Permission.EVIDENCE_VERIFY):
        raise HTTPException(status_code=403, detail="Permission denied: EVIDENCE_VERIFY")

    evidence_bytes = await evidence_file.read()

    try:
        proof_data = json.loads(merkle_proof)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for merkle_proof")

    result = await verify_evidence(
        db=db,
        evidence_bytes=evidence_bytes,
        artifact_db_id=artifact_db_id,
        merkle_proof_data=proof_data,
        case_id=case_id,
        dataset_version=dataset_version,
        actor_id=current_user.id,
        actor_label=current_user.username,
        request_id=request.headers.get("X-Request-ID"),
    )

    return VerificationResultOut(**result.to_dict())


@router.post("/certificate-pdf")
async def download_verification_certificate(
    request: Request,
    verification_data: dict,
    current_user: User = Depends(get_current_user),
):
    """Generate a formal PDF Verification Certificate for an already performed verification."""
    if not has_permission(current_user.role, Permission.EVIDENCE_VERIFY):
        raise HTTPException(status_code=403, detail="Permission denied: EVIDENCE_VERIFY")

    try:
        pdf_bytes = await generate_verification_report_pdf(verification_data)
        artifact_id = verification_data.get("artifact_id", "artifact")
        filename = f"Verification_Certificate_{artifact_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate certificate: {str(e)}")
