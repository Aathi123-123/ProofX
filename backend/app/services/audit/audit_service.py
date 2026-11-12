"""
PSDE – Audit Service
Append-only chain-of-custody event logging.

All audit events are immutable once written.
Each event stores a SHA-256 hash of its own details for integrity checking.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AuditEvent, AuditEventType
from app.core.logging import get_logger

logger = get_logger(__name__)


def _hash_details(details: dict[str, Any]) -> str:
    """Compute SHA-256 of the event details dict (sorted keys)."""
    serialised = json.dumps(details, sort_keys=True, default=str)
    return hashlib.sha256(serialised.encode("utf-8")).hexdigest()


async def record_event(
    db: AsyncSession,
    event_type: str,
    actor_id: str | None = None,
    actor_label: str = "system",
    case_id: str | None = None,
    artifact_id: str | None = None,
    details: dict[str, Any] | None = None,
    request_id: str | None = None,
    ip_address: str | None = None,
) -> AuditEvent:
    """
    Record an immutable audit event.

    The event's details_hash is computed from the details dict,
    providing tamper-evidence for the event record itself.
    Note: database-level modification (T10) is out of scope for
    blockchain-grade protection but provides a detectable integrity signal.
    """
    event_details = details or {}
    event_details["event_type"] = event_type
    event_details["timestamp"] = datetime.now(timezone.utc).isoformat()

    details_hash = _hash_details(event_details)

    event = AuditEvent(
        id=str(uuid.uuid4()),
        case_id=case_id,
        artifact_id=artifact_id,
        actor_id=actor_id,
        actor_label=actor_label,
        event_type=event_type,
        timestamp=datetime.now(timezone.utc),
        details=event_details,
        details_hash=details_hash,
        request_id=request_id,
        ip_address=ip_address,
    )
    db.add(event)
    await db.flush()  # Get the ID without committing

    logger.info(
        "audit_event_recorded",
        event_type=event_type,
        event_id=event.id,
        case_id=case_id,
        actor=actor_label,
    )
    return event


async def get_case_audit_trail(
    db: AsyncSession,
    case_id: str,
    limit: int = 500,
    offset: int = 0,
) -> list[AuditEvent]:
    """Retrieve audit events for a case, ordered chronologically."""
    result = await db.execute(
        select(AuditEvent)
        .where(AuditEvent.case_id == case_id)
        .order_by(AuditEvent.timestamp.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def get_artifact_audit_trail(
    db: AsyncSession,
    artifact_db_id: str,
) -> list[AuditEvent]:
    """Retrieve audit events for a specific evidence artifact."""
    result = await db.execute(
        select(AuditEvent)
        .where(AuditEvent.artifact_id == artifact_db_id)
        .order_by(AuditEvent.timestamp.asc())
    )
    return list(result.scalars().all())


async def get_all_events(
    db: AsyncSession,
    limit: int = 200,
    offset: int = 0,
    event_type: str | None = None,
) -> list[AuditEvent]:
    """Retrieve all audit events with optional filtering."""
    query = select(AuditEvent).order_by(AuditEvent.timestamp.desc())
    if event_type:
        query = query.where(AuditEvent.event_type == event_type)
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())
