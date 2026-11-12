// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  username: string
  full_name: string
  role: 'ADMIN' | 'FORENSIC_EXAMINER' | 'INVESTIGATOR' | 'VERIFIER'
  is_active: boolean
  created_at: string
  last_login: string | null
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: User
}

// ── Cases ─────────────────────────────────────────────────────────────────────
export interface Case {
  id: string
  case_number: string
  case_name: string
  description: string
  investigation_purpose: string
  created_by: string
  status: 'OPEN' | 'SEALED' | 'CLOSED'
  created_at: string
  updated_at: string
  closed_at: string | null
  evidence_count: number
  sensitive_count: number
  latest_merkle_root: string | null
  latest_version: number | null
}

// ── Evidence ──────────────────────────────────────────────────────────────────
export interface Evidence {
  id: string
  artifact_uuid?: string
  case_id: string
  artifact_id: string
  filename: string
  mime_type: string
  source: string
  acquisition_timestamp: string
  file_size: number
  sha256: string
  sensitivity_level: 'PUBLIC' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  relevance_level: 'RELEVANT' | 'POTENTIALLY_RELEVANT' | 'IRRELEVANT' | 'UNKNOWN'
  classification_reason: string
  sensitivity_score: number
  relevance_score: number
  status: string
  pii_findings: Record<string, unknown>[]
  evidence_metadata: Record<string, unknown>
  created_at: string
}

export interface EvidenceListOut {
  items: Evidence[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardStats {
  total_cases: number
  open_cases: number
  total_evidence: number
  sensitive_evidence: number
  total_disclosures: number
  total_verifications: number
  failed_verifications: number
  blockchain_commitments: number
  evidence_by_sensitivity: Record<string, number>
  evidence_by_type: Record<string, number>
  recent_events: { id: string; type: string; actor: string; timestamp: string }[]
  recent_security_alerts?: { id: string; type: string; actor: string; details: Record<string, unknown>; timestamp: string }[]
}

// ── Merkle ────────────────────────────────────────────────────────────────────
export interface MerkleCommitment {
  id: string
  case_id: string
  dataset_version: number
  merkle_root: string
  evidence_count: number
  algorithm: string
  leaf_ordering: string
  artifact_ids: string[]
  tx_hash: string | null
  block_number: number | null
  contract_address: string | null
  blockchain_network: string | null
  blockchain_timestamp: string | null
  created_at: string
}

// ── Disclosure ────────────────────────────────────────────────────────────────
export interface DisclosureItem {
  id: string
  artifact_db_id: string
  decision: string
  decision_reason: string
  redactions_applied: Record<string, unknown>[]
  disclosed_fields: string[]
  merkle_proof: Record<string, unknown>[]
  original_hash: string
  disclosed_hash: string | null
  created_at: string
}

export interface DisclosureRequest {
  id: string
  case_id: string
  requested_by: string
  purpose: string
  filters: Record<string, unknown>
  decision: string
  decision_reason: string
  total_requested: number
  total_eligible: number
  total_redacted: number
  total_denied: number
  dataset_version: number | null
  created_at: string
  completed_at: string | null
  items: DisclosureItem[]
}

// ── Audit ─────────────────────────────────────────────────────────────────────
export interface AuditEvent {
  id: string
  case_id: string | null
  artifact_id: string | null
  actor_label: string
  event_type: string
  timestamp: string
  details: Record<string, unknown>
  details_hash: string
}

// ── Benchmark ─────────────────────────────────────────────────────────────────
export interface BenchmarkRun {
  id: string
  run_label: string
  dataset_size: number
  dataset_seed: number
  configuration: Record<string, unknown>
  metrics: Record<string, unknown>
  status: string
  started_at: string
  completed_at: string | null
}

// ── Verification ──────────────────────────────────────────────────────────────
export interface VerificationStep {
  step: number
  name: string
  passed: boolean
  detail: string
  expected: string
  actual: string
}

export interface VerificationResult {
  overall_status: string
  passed: boolean
  artifact_id: string
  case_id: string
  dataset_version: number | null
  verified_at: string
  message: string
  steps: VerificationStep[]
}
