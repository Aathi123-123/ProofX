import type { TokenResponse, Case, Evidence, EvidenceListOut, DashboardStats, MerkleCommitment, DisclosureRequest, AuditEvent, BenchmarkRun } from '../types'
import { cacheGet, cacheSet, cacheInvalidate } from '../lib/cache'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

function getToken(): string | null {
  return localStorage.getItem('access_token')
}

/** Convert any FastAPI/Pydantic error body into a readable string */
function parseError(detail: unknown, status: number): string {
  if (!detail) return `HTTP ${status}`
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: string[]; msg?: string }) =>
        d.loc ? `${d.loc.slice(1).join('.')}: ${d.msg}` : (d.msg ?? JSON.stringify(d))
      )
      .join(' · ')
  }
  return JSON.stringify(detail)
}

// In-flight deduplication: prevents duplicate simultaneous requests for the same URL
const inFlight = new Map<string, Promise<unknown>>()

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const isGet = method === 'GET'
  const cacheKey = path

  // ── Serve from cache for GET requests ────────────────────────────────────
  if (isGet) {
    const cached = cacheGet<T>(cacheKey)
    if (cached !== null) return cached

    // Deduplicate in-flight GET requests
    if (inFlight.has(cacheKey)) return inFlight.get(cacheKey) as Promise<T>
  }

  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const request = fetch(`${BASE_URL}${path}`, { ...options, headers }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(parseError(err.detail, res.status))
    }
    if (res.status === 204) return undefined as T
    const data = await res.json() as T

    // Cache successful GET responses
    if (isGet) cacheSet(cacheKey, data)

    return data
  }).finally(() => {
    if (isGet) inFlight.delete(cacheKey)
  })

  if (isGet) inFlight.set(cacheKey, request)

  // Invalidate related caches on mutations
  if (!isGet) {
    const segments = path.split('/').filter(Boolean)
    if (segments[0]) cacheInvalidate(`/${segments[0]}`)
    // Also clear dashboard since counts change
    cacheInvalidate('/dashboard')
  }

  return request.catch((error: unknown) => {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `Unable to reach the API at ${BASE_URL}. Check that the backend is running and CORS allows this frontend origin.`
      )
    }
    throw error
  }) as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => apiFetch<{ id: string; username: string; role: string; email: string; full_name: string; is_active: boolean; created_at: string; last_login: string | null }>('/auth/me'),
  users: () => apiFetch<{ id: string; username: string; role: string; email: string; full_name: string; is_active: boolean; created_at: string; last_login: string | null }[]>('/auth/users'),
  register: (data: { email: string; username: string; full_name: string; password: string; role: string }) =>
    apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  changePassword: (current_password: string, new_password: string) =>
    apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => apiFetch<DashboardStats>('/dashboard/stats'),
}

// ── Cases ─────────────────────────────────────────────────────────────────────
export const casesApi = {
  list: () => apiFetch<Case[]>('/cases'),
  get: (id: string) => apiFetch<Case>(`/cases/${id}`),
  create: (data: { case_name: string; description: string; investigation_purpose: string }) =>
    apiFetch<Case>('/cases', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ case_name: string; description: string; investigation_purpose: string; status: string }>) =>
    apiFetch<Case>(`/cases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/cases/${id}`, { method: 'DELETE' }),
}

// ── Evidence ──────────────────────────────────────────────────────────────────
export const evidenceApi = {
  listAll: (page = 1, pageSize = 50, filters: { sensitivity?: string; mime_type?: string; search?: string } = {}) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (filters.sensitivity) params.append('sensitivity', filters.sensitivity)
    if (filters.mime_type) params.append('mime_type', filters.mime_type)
    if (filters.search) params.append('search', filters.search)
    return apiFetch<EvidenceListOut>(`/evidence?${params.toString()}`)
  },
  list: (caseId: string, page = 1, pageSize = 20) =>
    apiFetch<EvidenceListOut>(`/evidence/${caseId}?page=${page}&page_size=${pageSize}`),
  upload: (caseId: string, formData: FormData) => {
    const token = getToken()
    return fetch(`${BASE_URL}/evidence/${caseId}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (r) => {
      if (!r.ok) { const e = await r.json().catch(() => ({ detail: r.statusText })); throw new Error(parseError(e.detail, r.status)) }
      return r.json() as Promise<Evidence>
    })
  },
  get: (artifactId: string) => apiFetch<Evidence>(`/evidence/artifact/${artifactId}`),
  delete: (artifactId: string) => apiFetch<void>(`/evidence/artifact/${artifactId}`, { method: 'DELETE' }),
  verifyIntegrity: (artifactDbId: string) =>
    apiFetch<{ valid: boolean; calculated_hash: string; stored_hash: string }>(`/evidence/artifact/${artifactDbId}/verify-integrity`, { method: 'POST' }),
  overrideClassification: (artifactDbId: string, data: { sensitivity_level?: string; relevance_level?: string; reason: string }) =>
    apiFetch<{ success: boolean; message: string }>(`/evidence/artifact/${artifactDbId}/override-classification`, { method: 'POST', body: JSON.stringify(data) }),
  download: async (artifactId: string, filename?: string) => {
    const token = getToken()
    const res = await fetch(`${BASE_URL}/evidence/artifact/${artifactId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      let errorMsg = `Download failed with HTTP ${res.status}`
      try {
        const errJson = await res.json()
        if (errJson && errJson.detail) errorMsg = errJson.detail
      } catch {
        // Not a JSON response
      }
      throw new Error(errorMsg)
    }
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // If filename wasn't provided, extract from content-disposition header if available
    let downloadName = filename
    if (!downloadName) {
      const disposition = res.headers.get('content-disposition')
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/)
        if (match && match[1]) downloadName = match[1]
      }
    }
    a.download = downloadName || 'evidence_artifact'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  },
}

// ── Merkle ────────────────────────────────────────────────────────────────────
export const merkleApi = {
  commit: (caseId: string) =>
    apiFetch<MerkleCommitment>(`/merkle/${caseId}/commit`, { method: 'POST' }),
  // backend route is /merkle/{case_id}/commitments
  history: (caseId: string) =>
    apiFetch<MerkleCommitment[]>(`/merkle/${caseId}/commitments`),
  proof: (caseId: string, artifactId: string, version?: number) =>
    apiFetch(`/merkle/${caseId}/proof/${artifactId}${version ? `?dataset_version=${version}` : ''}`),
}

// ── Blockchain ────────────────────────────────────────────────────────────────
export const blockchainApi = {
  status: () => apiFetch<{ available: boolean; rpc_url: string; network: string; chain_id: number; contract_address: string; message: string }>('/blockchain/status'),
  commitments: (limit = 100) => apiFetch<{
    id: string; case_id: string; case_number: string; case_name: string;
    dataset_version: number; merkle_root: string; evidence_count: number;
    algorithm: string; tx_hash: string | null; block_number: number | null;
    contract_address: string | null; blockchain_network: string | null;
    blockchain_timestamp: string | null; created_at: string;
  }[]>(`/blockchain/commitments?limit=${limit}`),
  commit: (caseId: string, datasetVersion?: number) =>
    apiFetch(`/blockchain/${caseId}/commit`, { method: 'POST', body: JSON.stringify({ dataset_version: datasetVersion }) }),
}

// ── Disclosure ────────────────────────────────────────────────────────────────
export const disclosureApi = {
  listAll: () => apiFetch<DisclosureRequest[]>('/disclosure'),
  list: (caseId: string) => apiFetch<DisclosureRequest[]>(`/disclosure/${caseId}`),
  create: (caseId: string, purpose: string, filters: Record<string, unknown>) =>
    apiFetch<DisclosureRequest>(`/disclosure/${caseId}`, {
      method: 'POST',
      body: JSON.stringify({ purpose, filters }),
    }),
  get: (_caseId: string, disclosureId: string) =>
    apiFetch<DisclosureRequest>(`/disclosure/request/${disclosureId}`),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  downloadCasePdf: (caseId: string, caseNumber: string) => {
    const token = getToken()
    return fetch(`${BASE_URL}/reports/case/${caseId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(async (res) => {
      if (!res.ok) throw new Error('Failed to generate PDF report')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ProofX_Report_${caseNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    })
  },
  caseSummary: (caseId: string) => apiFetch<{
    case: { id: string; case_number: string; case_name: string; status: string; purpose: string; created_at: string };
    stats: { evidence_count: number; commitments_count: number; audit_events_count: number };
    evidence: { artifact_id: string; filename: string; sha256: string; sensitivity: string; relevance: string; status: string }[];
    commitments: { version: number; merkle_root: string; tx_hash: string | null; timestamp: string }[];
  }>(`/reports/case/${caseId}/summary`),
  downloadVerificationCertificate: (data: Record<string, unknown>, artifactId: string) => {
    const token = getToken()
    return fetch(`${BASE_URL}/verify/certificate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Failed to generate certificate PDF')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Verification_Certificate_${artifactId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    })
  },
}

// ── Audit ─────────────────────────────────────────────────────────────────────
export const auditApi = {
  // /audit (global, admin only) or /audit/case/{case_id}
  list: (caseId?: string, limit = 50) =>
    caseId
      ? apiFetch<AuditEvent[]>(`/audit/case/${caseId}?limit=${limit}`)
      : apiFetch<AuditEvent[]>(`/audit?limit=${limit}`),
}

// ── Benchmark ─────────────────────────────────────────────────────────────────
export const benchmarkApi = {
  list: () => apiFetch<BenchmarkRun[]>('/benchmark'),
  // backend route is POST /benchmark (not /benchmark/run)
  run: (datasetSize: number, seed: number, label?: string) =>
    apiFetch<BenchmarkRun>('/benchmark', {
      method: 'POST',
      body: JSON.stringify({ dataset_size: datasetSize, seed, run_label: label }),
    }),
  get: (id: string) => apiFetch<BenchmarkRun>(`/benchmark/${id}`),
}
