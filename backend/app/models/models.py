"""
PSDE – SQLAlchemy ORM Models
All database tables are defined here.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


# ── Enumerations (stored as string to avoid migration friction) ───────────────

class UserRole:
    ADMIN = "ADMIN"
    FORENSIC_EXAMINER = "FORENSIC_EXAMINER"
    INVESTIGATOR = "INVESTIGATOR"
    VERIFIER = "VERIFIER"

ALL_ROLES = [UserRole.ADMIN, UserRole.FORENSIC_EXAMINER, UserRole.INVESTIGATOR, UserRole.VERIFIER]

class CaseStatus:
    OPEN = "OPEN"
    SEALED = "SEALED"
    CLOSED = "CLOSED"

class EvidenceSensitivity:
    PUBLIC = "PUBLIC"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class EvidenceRelevance:
    RELEVANT = "RELEVANT"
    POTENTIALLY_RELEVANT = "POTENTIALLY_RELEVANT"
    IRRELEVANT = "IRRELEVANT"
    UNKNOWN = "UNKNOWN"

class EvidenceStatus:
    ACQUIRED = "ACQUIRED"
    HASHED = "HASHED"
    CLASSIFIED = "CLASSIFIED"
    COMMITTED = "COMMITTED"
    DISCLOSED = "DISCLOSED"
    REVOKED = "REVOKED"

class AuditEventType:
    CASE_CREATED = "CASE_CREATED"
    EVIDENCE_ACQUIRED = "EVIDENCE_ACQUIRED"
    HASH_CALCULATED = "HASH_CALCULATED"
    PII_DETECTED = "PII_DETECTED"
    CLASSIFIED = "CLASSIFIED"
    CLASSIFICATION_OVERRIDDEN = "CLASSIFICATION_OVERRIDDEN"
    MERKLE_CREATED = "MERKLE_CREATED"
    BLOCKCHAIN_COMMITTED = "BLOCKCHAIN_COMMITTED"
    DISCLOSURE_REQUESTED = "DISCLOSURE_REQUESTED"
    DISCLOSURE_APPROVED = "DISCLOSURE_APPROVED"
    DISCLOSURE_DENIED = "DISCLOSURE_DENIED"
    EVIDENCE_DISCLOSED = "EVIDENCE_DISCLOSED"
    VERIFICATION_STARTED = "VERIFICATION_STARTED"
    VERIFICATION_PASSED = "VERIFICATION_PASSED"
    VERIFICATION_FAILED = "VERIFICATION_FAILED"
    USER_CREATED = "USER_CREATED"
    USER_LOGIN = "USER_LOGIN"
    BENCHMARK_STARTED = "BENCHMARK_STARTED"
    BENCHMARK_COMPLETED = "BENCHMARK_COMPLETED"
    DATASET_GENERATED = "DATASET_GENERATED"

class DisclosureDecision:
    ALLOW = "ALLOW"
    ALLOW_WITH_REDACTION = "ALLOW_WITH_REDACTION"
    DENY = "DENY"

class VerificationStatus:
    VERIFIED = "VERIFIED"
    HASH_MISMATCH = "HASH_MISMATCH"
    MERKLE_MISMATCH = "MERKLE_MISMATCH"
    BLOCKCHAIN_MISMATCH = "BLOCKCHAIN_MISMATCH"
    COMMITMENT_NOT_FOUND = "COMMITMENT_NOT_FOUND"
    INVALID_PROOF = "INVALID_PROOF"
    VERSION_MISMATCH = "VERSION_MISMATCH"


# ── User Model ────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default=UserRole.INVESTIGATOR)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    cases: Mapped[list["Case"]] = relationship("Case", back_populates="creator", foreign_keys="Case.created_by")
    audit_events: Mapped[list["AuditEvent"]] = relationship("AuditEvent", back_populates="actor_user")


# ── Case Model ────────────────────────────────────────────────────────────────

class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    case_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    case_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    investigation_purpose: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=CaseStatus.OPEN)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    creator: Mapped["User"] = relationship("User", back_populates="cases", foreign_keys=[created_by])
    evidence_artifacts: Mapped[list["EvidenceArtifact"]] = relationship("EvidenceArtifact", back_populates="case")
    merkle_commitments: Mapped[list["MerkleCommitment"]] = relationship("MerkleCommitment", back_populates="case")
    audit_events: Mapped[list["AuditEvent"]] = relationship("AuditEvent", back_populates="case")
    disclosures: Mapped[list["DisclosureRequest"]] = relationship("DisclosureRequest", back_populates="case")


# ── Evidence Artifact Model ────────────────────────────────────────────────────

class EvidenceArtifact(Base):
    __tablename__ = "evidence_artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    artifact_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # e.g. EV-000001
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(500), nullable=False, default="upload")
    acquisition_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    sensitivity_level: Mapped[str] = mapped_column(String(20), nullable=False, default=EvidenceSensitivity.UNKNOWN if hasattr(EvidenceSensitivity, 'UNKNOWN') else "UNKNOWN")
    relevance_level: Mapped[str] = mapped_column(String(30), nullable=False, default=EvidenceRelevance.UNKNOWN)
    classification_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    evidence_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    pii_findings: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    sensitivity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    relevance_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=EvidenceStatus.ACQUIRED)
    # Override tracking
    original_sensitivity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    original_relevance: Mapped[str | None] = mapped_column(String(30), nullable=True)
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    overridden_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    overridden_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    case: Mapped["Case"] = relationship("Case", back_populates="evidence_artifacts")
    audit_events: Mapped[list["AuditEvent"]] = relationship("AuditEvent", back_populates="artifact")
    disclosure_items: Mapped[list["DisclosureItem"]] = relationship("DisclosureItem", back_populates="artifact")

    __table_args__ = (
        UniqueConstraint("case_id", "artifact_id", name="uq_case_artifact_id"),
    )


# ── Merkle Commitment Model ────────────────────────────────────────────────────

class MerkleCommitment(Base):
    __tablename__ = "merkle_commitments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    dataset_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    merkle_root: Mapped[str] = mapped_column(String(64), nullable=False)
    evidence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    algorithm: Mapped[str] = mapped_column(String(20), nullable=False, default="SHA-256")
    leaf_ordering: Mapped[str] = mapped_column(Text, nullable=False, default="artifact_id_lexicographic")
    artifact_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    # Blockchain anchoring
    tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    block_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contract_address: Mapped[str | None] = mapped_column(String(42), nullable=True)
    blockchain_network: Mapped[str | None] = mapped_column(String(100), nullable=True)
    blockchain_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    committed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    case: Mapped["Case"] = relationship("Case", back_populates="merkle_commitments")

    __table_args__ = (
        UniqueConstraint("case_id", "dataset_version", name="uq_case_version"),
    )


# ── Audit Event Model ─────────────────────────────────────────────────────────

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    case_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cases.id"), nullable=True, index=True)
    artifact_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("evidence_artifacts.id"), nullable=True, index=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    actor_label: Mapped[str] = mapped_column(String(255), nullable=False, default="system")
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    details_hash: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    request_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    # Relationships
    case: Mapped["Case | None"] = relationship("Case", back_populates="audit_events")
    artifact: Mapped["EvidenceArtifact | None"] = relationship("EvidenceArtifact", back_populates="audit_events")
    actor_user: Mapped["User | None"] = relationship("User", back_populates="audit_events")


# ── Disclosure Request Model ───────────────────────────────────────────────────

class DisclosureRequest(Base):
    __tablename__ = "disclosure_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    requested_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    filters: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    decision: Mapped[str] = mapped_column(String(30), nullable=False, default=DisclosureDecision.DENY)
    decision_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    total_requested: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_eligible: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_redacted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_denied: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dataset_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    case: Mapped["Case"] = relationship("Case", back_populates="disclosures")
    items: Mapped[list["DisclosureItem"]] = relationship("DisclosureItem", back_populates="request")


# ── Disclosure Item Model ─────────────────────────────────────────────────────

class DisclosureItem(Base):
    __tablename__ = "disclosure_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("disclosure_requests.id"), nullable=False, index=True)
    artifact_db_id: Mapped[str] = mapped_column(String(36), ForeignKey("evidence_artifacts.id"), nullable=False)
    decision: Mapped[str] = mapped_column(String(30), nullable=False)
    decision_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    redactions_applied: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    disclosed_fields: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    merkle_proof: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    original_hash: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    disclosed_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    request: Mapped["DisclosureRequest"] = relationship("DisclosureRequest", back_populates="items")
    artifact: Mapped["EvidenceArtifact"] = relationship("EvidenceArtifact", back_populates="disclosure_items")


# ── Benchmark Run Model ────────────────────────────────────────────────────────

class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    run_label: Mapped[str] = mapped_column(String(100), nullable=False)
    dataset_size: Mapped[int] = mapped_column(Integer, nullable=False)
    dataset_seed: Mapped[int] = mapped_column(Integer, nullable=False)
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    system_version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0.0")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="RUNNING")
    output_file: Mapped[str | None] = mapped_column(String(500), nullable=True)
