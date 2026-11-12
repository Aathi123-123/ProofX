"""
PSDE – Evidence Ingestion Service

Handles the full evidence acquisition pipeline:
1. Validate file
2. Detect MIME type
3. Calculate SHA-256 (immutable original hash)
4. Extract metadata
5. Detect PII
6. Calculate sensitivity
7. Score relevance
8. Store evidence
9. Record acquisition audit event
"""
from __future__ import annotations

import io
import json
import mimetypes
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.models import (
    AuditEventType, EvidenceArtifact, EvidenceRelevance, EvidenceSensitivity,
    EvidenceStatus,
)
from app.services.audit.audit_service import record_event
from app.services.crypto.hashing import sha256_bytes, sha256_file
from app.services.privacy.pii_detector import (
    PIIFinding, RegexPIIDetector, MetadataPIIDetector
)
from app.services.privacy.sensitivity import classify_sensitivity
from app.services.privacy.relevance import score_relevance

logger = get_logger(__name__)
settings = get_settings()

_pii_detector = RegexPIIDetector()
_meta_pii_detector = MetadataPIIDetector()


def _safe_filename(filename: str) -> str:
    """Sanitise a filename to prevent path traversal."""
    # Remove any directory separators
    name = Path(filename).name
    # Allow only safe characters
    import re
    safe = re.sub(r'[^\w\s\-_\.]', '', name)
    return safe[:255] if safe else "unnamed_evidence"


def _detect_mime_type(file_bytes: bytes, filename: str) -> str:
    """
    Detect MIME type using available methods.
    Falls back to mimetypes if python-magic is not available.
    """
    # Try python-magic first
    try:
        import magic
        return magic.from_buffer(file_bytes[:4096], mime=True)
    except (ImportError, Exception):
        pass

    # Fallback: use file extension
    mime, _ = mimetypes.guess_type(filename)
    return mime or "application/octet-stream"


def _extract_text_content(file_bytes: bytes, mime_type: str, filename: str) -> str:
    """
    Extract readable text content from a file for analysis.
    Limited to first 50KB to manage performance.
    """
    MAX_TEXT = 50_000

    if mime_type == "text/plain" or mime_type == "text/csv":
        try:
            return file_bytes[:MAX_TEXT].decode("utf-8", errors="replace")
        except Exception:
            return ""

    if mime_type == "application/json":
        try:
            text = file_bytes[:MAX_TEXT].decode("utf-8", errors="replace")
            # Validate and pretty-print to aid pattern matching
            parsed = json.loads(text)
            return json.dumps(parsed, indent=2)[:MAX_TEXT]
        except Exception:
            return file_bytes[:MAX_TEXT].decode("utf-8", errors="replace")

    if mime_type == "application/pdf":
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            texts = []
            for page in reader.pages:
                texts.append(page.extract_text() or "")
                if sum(len(t) for t in texts) > MAX_TEXT:
                    break
            return " ".join(texts)[:MAX_TEXT]
        except Exception:
            return ""

    # For images and other binary formats, return empty string
    return ""


def _extract_metadata(file_bytes: bytes, mime_type: str, filename: str) -> dict[str, Any]:
    """Extract file metadata."""
    metadata: dict[str, Any] = {
        "filename": filename,
        "mime_type": mime_type,
        "size_bytes": len(file_bytes),
    }

    # Image EXIF
    if mime_type in ("image/jpeg", "image/png", "image/gif", "image/tiff"):
        try:
            import exifread
            tags = exifread.process_file(io.BytesIO(file_bytes), details=False)
            exif_data = {}
            for tag, value in tags.items():
                if not tag.startswith("Thumbnail"):
                    exif_data[tag] = str(value)
            if exif_data:
                metadata["exif"] = exif_data
        except Exception:
            pass

    # PDF metadata
    if mime_type == "application/pdf":
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            info = reader.metadata
            if info:
                pdf_meta = {}
                for key in info:
                    pdf_meta[str(key).lstrip("/")] = str(info[key])
                metadata["pdf"] = pdf_meta
        except Exception:
            pass

    return metadata


async def ingest_evidence(
    db: AsyncSession,
    case_id: str,
    case_number: str,
    investigation_purpose: str,
    filename: str,
    file_bytes: bytes,
    source: str = "upload",
    acquisition_timestamp: datetime | None = None,
    actor_id: str | None = None,
    actor_label: str = "system",
    artifact_index: int | None = None,
    request_id: str | None = None,
) -> EvidenceArtifact:
    """
    Full evidence acquisition pipeline.

    IMPORTANT: The original file bytes are stored BEFORE any analysis.
    The SHA-256 is calculated from the ORIGINAL unmodified bytes.
    """
    acq_ts = acquisition_timestamp or datetime.now(timezone.utc)

    # ── 1. Sanitise filename ─────────────────────────────────────
    safe_name = _safe_filename(filename)

    # ── 2. Validate size ─────────────────────────────────────────
    max_size = settings.max_upload_size_bytes
    if len(file_bytes) > max_size:
        raise ValueError(
            f"File size {len(file_bytes)} bytes exceeds maximum "
            f"allowed size {max_size} bytes ({settings.max_upload_size_mb} MB)."
        )

    # ── 3. Detect MIME type ───────────────────────────────────────
    mime_type = _detect_mime_type(file_bytes, safe_name)

    # ── 4. Calculate SHA-256 (on ORIGINAL bytes) ──────────────────
    original_sha256 = sha256_bytes(file_bytes)

    # ── 5. Generate artifact ID ────────────────────────────────────
    if artifact_index is not None:
        artifact_id = f"EV-{artifact_index:06d}"
    else:
        # Count existing artifacts for this case
        from sqlalchemy import select, func
        count_result = await db.execute(
            select(func.count()).select_from(EvidenceArtifact)
            .where(EvidenceArtifact.case_id == case_id)
        )
        count = count_result.scalar() or 0
        artifact_id = f"EV-{count + 1:06d}"

    # ── 6. Store original file ────────────────────────────────────
    storage_dir = Path(settings.evidence_storage_path) / case_number
    storage_dir.mkdir(parents=True, exist_ok=True)
    db_artifact_id = str(uuid.uuid4())
    storage_path = storage_dir / f"{db_artifact_id}_{safe_name}"

    with open(storage_path, "wb") as f:
        f.write(file_bytes)

    # ── 7. Extract text content ───────────────────────────────────
    text_content = _extract_text_content(file_bytes, mime_type, safe_name)

    # ── 8. Extract metadata ───────────────────────────────────────
    metadata = _extract_metadata(file_bytes, mime_type, safe_name)

    # ── 9. Detect PII ─────────────────────────────────────────────
    content_findings = _pii_detector.detect(text_content, context_label="content")
    meta_text = json.dumps(metadata, default=str)
    metadata_findings = _meta_pii_detector.detect(meta_text, context_label="metadata")
    all_findings = content_findings + metadata_findings

    # ── 10. Classify sensitivity ──────────────────────────────────
    sensitivity_result = classify_sensitivity(
        pii_findings=content_findings,
        mime_type=mime_type,
        metadata=metadata,
        metadata_pii=metadata_findings,
    )

    # ── 11. Score relevance ───────────────────────────────────────
    relevance_result = score_relevance(
        purpose=investigation_purpose,
        filename=safe_name,
        content_text=text_content,
        mime_type=mime_type,
        acquisition_timestamp=acq_ts,
        metadata=metadata,
        source=source,
    )

    # ── 12. Create ORM model ──────────────────────────────────────
    artifact = EvidenceArtifact(
        id=db_artifact_id,
        case_id=case_id,
        artifact_id=artifact_id,
        filename=safe_name,
        mime_type=mime_type,
        source=source,
        acquisition_timestamp=acq_ts,
        file_size=len(file_bytes),
        sha256=original_sha256,
        sensitivity_level=sensitivity_result.level,
        relevance_level=relevance_result.level,
        classification_reason=(
            f"Sensitivity: {sensitivity_result.reason}. "
            f"Relevance: {relevance_result.reason}"
        ),
        storage_path=str(storage_path),
        evidence_metadata=metadata,
        pii_findings=[f.to_dict() for f in all_findings],
        sensitivity_score=sensitivity_result.score,
        relevance_score=relevance_result.score,
        status=EvidenceStatus.CLASSIFIED,
    )
    db.add(artifact)
    await db.flush()

    # ── 13. Record audit events ───────────────────────────────────
    await record_event(
        db=db,
        event_type=AuditEventType.EVIDENCE_ACQUIRED,
        actor_id=actor_id,
        actor_label=actor_label,
        case_id=case_id,
        artifact_id=artifact.id,
        details={
            "artifact_id": artifact_id,
            "filename": safe_name,
            "mime_type": mime_type,
            "file_size": len(file_bytes),
            "source": source,
        },
        request_id=request_id,
    )

    await record_event(
        db=db,
        event_type=AuditEventType.HASH_CALCULATED,
        actor_id=actor_id,
        actor_label=actor_label,
        case_id=case_id,
        artifact_id=artifact.id,
        details={
            "algorithm": "SHA-256",
            "sha256": original_sha256,
            "note": "Hash computed from original unmodified file bytes",
        },
        request_id=request_id,
    )

    pii_count = len(all_findings)
    if pii_count > 0:
        await record_event(
            db=db,
            event_type=AuditEventType.PII_DETECTED,
            actor_id=actor_id,
            actor_label=actor_label,
            case_id=case_id,
            artifact_id=artifact.id,
            details={
                "pii_count": pii_count,
                "pii_types": list({f.pii_type for f in all_findings}),
                "note": "Raw PII values not stored; only type/hash/location",
            },
            request_id=request_id,
        )

    await record_event(
        db=db,
        event_type=AuditEventType.CLASSIFIED,
        actor_id=actor_id,
        actor_label=actor_label,
        case_id=case_id,
        artifact_id=artifact.id,
        details={
            "sensitivity_level": sensitivity_result.level,
            "sensitivity_score": sensitivity_result.score,
            "relevance_level": relevance_result.level,
            "relevance_score": relevance_result.score,
            "classification_reason": artifact.classification_reason,
        },
        request_id=request_id,
    )

    logger.info(
        "evidence_ingested",
        artifact_id=artifact_id,
        case_id=case_id,
        mime_type=mime_type,
        sensitivity=sensitivity_result.level,
        relevance=relevance_result.level,
        pii_count=pii_count,
    )

    return artifact


async def verify_stored_evidence(artifact: EvidenceArtifact) -> dict[str, Any]:
    """
    Verify that a stored evidence file has not been modified.
    Recalculates SHA-256 and compares against the immutable original hash.
    """
    storage_path = Path(artifact.storage_path)

    if not storage_path.exists():
        return {
            "status": "FILE_MISSING",
            "expected_sha256": artifact.sha256,
            "actual_sha256": None,
            "integrity": False,
            "message": f"Evidence file not found at {storage_path}",
        }

    actual_sha256 = sha256_file(storage_path)
    import hmac
    integrity = hmac.compare_digest(actual_sha256, artifact.sha256)

    return {
        "status": "VERIFIED" if integrity else "HASH_MISMATCH",
        "expected_sha256": artifact.sha256,
        "actual_sha256": actual_sha256,
        "integrity": integrity,
        "message": (
            "File integrity verified: SHA-256 matches original acquisition hash."
            if integrity else
            "INTEGRITY VIOLATION: File SHA-256 does not match original acquisition hash."
        ),
    }
