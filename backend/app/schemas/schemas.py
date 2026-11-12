"""PSDE – Pydantic schemas for all API request/response models."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=12)
    role: Literal["ADMIN", "FORENSIC_EXAMINER", "INVESTIGATOR", "VERIFIER"] = "INVESTIGATOR"


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=12)


# ── Cases ─────────────────────────────────────────────────────────────────────

class CaseCreate(BaseModel):
    case_name: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    investigation_purpose: str = Field(..., min_length=10)


class CaseUpdate(BaseModel):
    case_name: Optional[str] = None
    description: Optional[str] = None
    investigation_purpose: Optional[str] = None
    status: Optional[Literal["OPEN", "SEALED", "CLOSED"]] = None


class CaseOut(BaseModel):
    id: str
    case_number: str
    case_name: str
    description: str
    investigation_purpose: str
    created_by: str
    status: str
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    # Computed fields
    evidence_count: int = 0
    sensitive_count: int = 0
    latest_merkle_root: Optional[str] = None
    latest_version: Optional[int] = None
    model_config = {"from_attributes": True}


# ── Evidence ──────────────────────────────────────────────────────────────────

class EvidenceOut(BaseModel):
    id: str  # Database UUID
    artifact_uuid: str = Field(default="", description="Artifact UUID (same as id)")
    case_id: str
    artifact_id: str  # Human readable ID, e.g. EV-000001
    filename: str
    mime_type: str
    source: str
    acquisition_timestamp: datetime
    file_size: int
    sha256: str
    sensitivity_level: str
    relevance_level: str
    classification_reason: str
    sensitivity_score: float
    relevance_score: float
    status: str
    pii_findings: list[dict] = []
    evidence_metadata: dict = {}
    created_at: datetime
    model_config = {"from_attributes": True}

    def __init__(self, **data: Any):
        super().__init__(**data)
        if not self.artifact_uuid and self.id:
            self.artifact_uuid = self.id


class EvidenceListOut(BaseModel):
    items: list[EvidenceOut]
    total: int
    page: int
    page_size: int
    pages: int


class ClassificationOverride(BaseModel):
    sensitivity_level: Optional[Literal["PUBLIC", "LOW", "MEDIUM", "HIGH", "CRITICAL"]] = None
    relevance_level: Optional[Literal["RELEVANT", "POTENTIALLY_RELEVANT", "IRRELEVANT", "UNKNOWN"]] = None
    reason: str = Field(..., min_length=10)


# ── Merkle ────────────────────────────────────────────────────────────────────

class MerkleCommitmentOut(BaseModel):
    id: str
    case_id: str
    dataset_version: int
    merkle_root: str
    evidence_count: int
    algorithm: str
    leaf_ordering: str
    artifact_ids: list[str]
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    contract_address: Optional[str] = None
    blockchain_network: Optional[str] = None
    blockchain_timestamp: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class MerkleProofOut(BaseModel):
    artifact_id: str
    leaf_hash: str
    leaf_index: int
    merkle_root: str
    dataset_version: int
    proof: list[dict]
    blockchain_tx: Optional[str] = None
    blockchain_block: Optional[int] = None
    contract_address: Optional[str] = None
    algorithm: str
    leaf_ordering: str


# ── Blockchain ────────────────────────────────────────────────────────────────

class BlockchainCommitRequest(BaseModel):
    dataset_version: Optional[int] = None  # Latest if None


class BlockchainStatusOut(BaseModel):
    available: bool
    rpc_url: str
    network: str
    chain_id: int
    contract_address: str
    message: str


# ── Disclosure ────────────────────────────────────────────────────────────────

class DisclosureFilters(BaseModel):
    mime_type: Optional[str] = None
    sensitivity_limit: Literal["PUBLIC", "LOW", "MEDIUM", "HIGH", "CRITICAL"] = "HIGH"
    relevance_minimum: Literal["RELEVANT", "POTENTIALLY_RELEVANT", "IRRELEVANT"] = "POTENTIALLY_RELEVANT"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    artifact_ids: Optional[list[str]] = None


class DisclosureCreateRequest(BaseModel):
    purpose: str = Field(..., min_length=10)
    filters: DisclosureFilters = Field(default_factory=DisclosureFilters)


class DisclosureItemOut(BaseModel):
    id: str
    artifact_db_id: str
    decision: str
    decision_reason: str
    redactions_applied: list[dict]
    disclosed_fields: list[str]
    merkle_proof: list[dict]
    original_hash: str
    disclosed_hash: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class DisclosureRequestOut(BaseModel):
    id: str
    case_id: str
    requested_by: str
    purpose: str
    filters: dict
    decision: str
    decision_reason: str
    total_requested: int
    total_eligible: int
    total_redacted: int
    total_denied: int
    dataset_version: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    items: list[DisclosureItemOut] = []
    model_config = {"from_attributes": True}


# ── Verification ──────────────────────────────────────────────────────────────

class VerificationStepOut(BaseModel):
    step: int
    name: str
    passed: bool
    detail: str
    expected: str = ""
    actual: str = ""


class VerificationResultOut(BaseModel):
    overall_status: str
    passed: bool
    artifact_id: str
    case_id: str
    dataset_version: Optional[int] = None
    verified_at: str
    message: str
    steps: list[VerificationStepOut]


# ── Audit ─────────────────────────────────────────────────────────────────────

class AuditEventOut(BaseModel):
    id: str
    case_id: Optional[str] = None
    artifact_id: Optional[str] = None
    actor_label: str
    event_type: str
    timestamp: datetime
    details: dict
    details_hash: str
    model_config = {"from_attributes": True}


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_cases: int
    open_cases: int
    total_evidence: int
    sensitive_evidence: int
    total_disclosures: int
    total_verifications: int
    failed_verifications: int
    blockchain_commitments: int
    evidence_by_sensitivity: dict[str, int]
    evidence_by_type: dict[str, int]
    recent_events: list[dict]
    recent_security_alerts: list[dict] = []


# ── Benchmark ─────────────────────────────────────────────────────────────────

class BenchmarkRunRequest(BaseModel):
    dataset_size: Literal[10, 100, 1000, 10000] = 100
    seed: int = 42
    run_label: Optional[str] = None


class BenchmarkRunOut(BaseModel):
    id: str
    run_label: str
    dataset_size: int
    dataset_seed: int
    configuration: dict
    metrics: dict
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Generic ───────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    request_id: Optional[str] = None


class SuccessResponse(BaseModel):
    success: bool = True
    message: str
