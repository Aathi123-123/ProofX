"""PSDE – Blockchain API Routes"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import Permission, has_permission
from app.models.models import AuditEventType, Case, MerkleCommitment, User
from app.schemas.schemas import BlockchainCommitRequest, BlockchainStatusOut
from app.services.audit.audit_service import record_event
from app.services.blockchain.blockchain_service import get_blockchain_service
from app.core.config import get_settings

router = APIRouter(prefix="/blockchain", tags=["Blockchain"])
settings = get_settings()


@router.get("/status", response_model=BlockchainStatusOut)
async def get_status(current_user: User = Depends(get_current_user)):
    """Check if the configured blockchain node and contract are available."""
    svc = get_blockchain_service()
    available = svc.is_available()
    return BlockchainStatusOut(
        available=available,
        rpc_url=settings.blockchain_rpc_url,
        network=settings.blockchain_network,
        chain_id=settings.blockchain_chain_id,
        contract_address=settings.commitment_contract_address or "Not configured",
        message="Blockchain connection successful." if available else "Blockchain node or contract unavailable.",
    )


@router.get("/commitments")
async def list_all_commitments(
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all Merkle and Blockchain commitments across all cases."""
    if not has_permission(current_user.role, Permission.CASE_VIEW):
        raise HTTPException(status_code=403, detail="Permission denied: CASE_VIEW")

    query = (
        select(MerkleCommitment, Case.case_number, Case.case_name)
        .join(Case, Case.id == MerkleCommitment.case_id)
        .order_by(MerkleCommitment.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    items = []
    for comm, case_num, case_name in rows:
        items.append({
            "id": comm.id,
            "case_id": comm.case_id,
            "case_number": case_num,
            "case_name": case_name,
            "dataset_version": comm.dataset_version,
            "merkle_root": comm.merkle_root,
            "evidence_count": comm.evidence_count,
            "algorithm": comm.algorithm,
            "tx_hash": comm.tx_hash,
            "block_number": comm.block_number,
            "contract_address": comm.contract_address,
            "blockchain_network": comm.blockchain_network,
            "blockchain_timestamp": comm.blockchain_timestamp.isoformat() if comm.blockchain_timestamp else None,
            "created_at": comm.created_at.isoformat(),
        })
    return items


@router.post("/{case_id}/anchor", status_code=200)
@router.post("/{case_id}/commit", status_code=200)
async def anchor_commitment(
    case_id: str,
    data: BlockchainCommitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Anchor a Merkle dataset version to the blockchain."""
    if not has_permission(current_user.role, Permission.BLOCKCHAIN_COMMIT):
        raise HTTPException(status_code=403, detail="Permission denied.")

    svc = get_blockchain_service()
    if not svc.is_available():
        raise HTTPException(
            status_code=503,
            detail="Blockchain service is currently unavailable. Check node and contract configuration.",
        )

    case_result = await db.execute(
        select(Case).where((Case.id == case_id) | (Case.case_number == case_id))
    )
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    query = select(MerkleCommitment).where(MerkleCommitment.case_id == case.id)
    if data.dataset_version:
        query = query.where(MerkleCommitment.dataset_version == data.dataset_version)
    else:
        query = query.order_by(MerkleCommitment.dataset_version.desc()).limit(1)

    commit_result = await db.execute(query)
    commitment = commit_result.scalar_one_or_none()

    if not commitment:
        raise HTTPException(status_code=404, detail="Merkle commitment not found for case.")

    # Check if already registered on-chain
    existing_on_chain = svc.get_commitment(case.id, commitment.dataset_version)
    if existing_on_chain and existing_on_chain.get("exists"):
        commitment.contract_address = existing_on_chain["contract_address"]
        commitment.blockchain_network = existing_on_chain["blockchain_network"]
        commitment.blockchain_timestamp = datetime.fromisoformat(existing_on_chain["timestamp"])
        return {"success": True, "message": "Commitment is already verified on-chain.", "transaction": existing_on_chain}

    # If the local Hardhat blockchain node was restarted, the old tx_hash no longer exists on-chain.
    # Re-register to establish the fresh on-chain commitment.

    try:
        bc_result = svc.register_commitment(
            case_id=case.id,
            merkle_root_hex=commitment.merkle_root,
            dataset_version=commitment.dataset_version,
            algorithm=commitment.algorithm,
            evidence_count=commitment.evidence_count,
        )

        if bc_result["status"] == "success":
            commitment.tx_hash = bc_result["tx_hash"]
            commitment.block_number = bc_result["block_number"]
            commitment.contract_address = bc_result["contract_address"]
            commitment.blockchain_network = bc_result["blockchain_network"]
            commitment.blockchain_timestamp = datetime.fromisoformat(bc_result["blockchain_timestamp"])
            await db.flush()

            await record_event(
                db=db,
                event_type=AuditEventType.BLOCKCHAIN_COMMITTED,
                actor_id=current_user.id,
                actor_label=current_user.username,
                case_id=case.id,
                details={
                    "dataset_version": commitment.dataset_version,
                    "tx_hash": bc_result["tx_hash"],
                    "block_number": bc_result["block_number"],
                },
            )

            return {"success": True, "transaction": bc_result}
        else:
            raise HTTPException(status_code=500, detail="Transaction failed on-chain.")

    except Exception as e:
        err_msg = str(e)
        if "already exists" in err_msg.lower():
            # If mined previously but unrecorded, sync from chain
            chain_info = svc.get_commitment(case.id, commitment.dataset_version)
            if chain_info and chain_info.get("exists"):
                commitment.contract_address = chain_info["contract_address"]
                commitment.blockchain_network = chain_info["blockchain_network"]
                commitment.blockchain_timestamp = datetime.fromisoformat(chain_info["timestamp"])
                commitment.tx_hash = "anchored_on_chain"
                await db.flush()
                return {"success": True, "transaction": chain_info}
        raise HTTPException(status_code=500, detail=err_msg)
