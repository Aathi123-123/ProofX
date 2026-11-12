import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { casesApi, merkleApi, evidenceApi } from '../services/api'
import type { Case, VerificationResult, Evidence } from '../types'
import {
  ShieldCheck, ShieldX, Upload, Loader2, AlertTriangle, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, Copy, Check, FileCheck
} from 'lucide-react'
import React from 'react'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export default function VerificationPage() {
  const [searchParams] = useSearchParams()
  const [cases, setCases] = useState<Case[]>([])
  const [caseId, setCaseId] = useState(searchParams.get('case_id') || '')
  const [artifactDbId, setArtifactDbId] = useState(searchParams.get('uuid') || '')
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([])
  const [selectedArtifactId, setSelectedArtifactId] = useState('')
  const [merkleProof, setMerkleProof] = useState('[]')
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedSteps, setExpandedSteps] = useState<number[]>([])
  const [copiedUuid, setCopiedUuid] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load cases and evidence artifacts
  useEffect(() => {
    casesApi.list().then(setCases).catch(() => { })
    evidenceApi.listAll(1, 100).then((res) => {
      setEvidenceList(res.items || [])
      // If URL has uuid, select that item
      const initialUuid = searchParams.get('uuid')
      if (initialUuid) {
        const match = res.items.find((item) => (item.artifact_uuid || item.id) === initialUuid || item.artifact_id === initialUuid)
        if (match) {
          setSelectedArtifactId(match.id)
          if (!caseId) setCaseId(match.case_id)
        }
      }
    }).catch(() => {})
  }, [])

  // Auto-load Merkle proof when caseId and artifactDbId are set
  useEffect(() => {
    if (caseId && artifactDbId) {
      loadProof(caseId, artifactDbId)
    }
  }, [caseId, artifactDbId])

  const loadProof = async (cid = caseId, aid = artifactDbId) => {
    if (!cid || !aid) return
    try {
      const proof = await merkleApi.proof(cid, aid) as { proof: unknown[] }
      setMerkleProof(JSON.stringify(proof.proof || [], null, 2))
    } catch {
      setMerkleProof('[]')
    }
  }

  const handleSelectArtifact = (itemId: string) => {
    setSelectedArtifactId(itemId)
    if (!itemId) return
    const match = evidenceList.find((e) => e.id === itemId)
    if (match) {
      const uuid = match.artifact_uuid || match.id
      setArtifactDbId(uuid)
      setCaseId(match.case_id)
      loadProof(match.case_id, uuid)
    }
  }

  const copyUuid = () => {
    if (!artifactDbId) return
    navigator.clipboard.writeText(artifactDbId)
    setCopiedUuid(true)
    setTimeout(() => setCopiedUuid(false), 2000)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Please select an evidence file to verify')
      return
    }
    if (!artifactDbId.trim()) {
      setError('Artifact UUID / Database ID is required')
      return
    }

    setError('')
    setLoading(true)
    setResult(null)

    const fd = new FormData()
    fd.append('artifact_db_id', artifactDbId.trim())
    fd.append('case_id', caseId || '')
    fd.append('merkle_proof', merkleProof)
    fd.append('evidence_file', file)

    try {
      const token = localStorage.getItem('access_token')
      const resp = await fetch(`${BASE_URL}/verify`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(errJson.detail || `HTTP ${resp.status}`)
      }
      setResult(await resp.json())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const toggleStep = (i: number) => {
    setExpandedSteps((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Cryptographic Verification</h1>
        <p className="text-[hsl(215,20.2%,50%)] text-sm mt-0.5">
          Cryptographically verify evidence integrity against backend-computed hashes, Merkle proofs, and blockchain commitments.
        </p>
      </div>

      <form onSubmit={handleVerify} className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-6 space-y-4">
        {/* Quick select evidence artifact */}
        {evidenceList.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1.5">
              Select Evidence Record (Auto-populates UUID & Case)
            </label>
            <select
              value={selectedArtifactId}
              onChange={(e) => handleSelectArtifact(e.target.value)}
              className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-sm"
            >
              <option value="">Choose an artifact to auto-fill…</option>
              {evidenceList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.artifact_id} · {item.filename} (UUID: {(item.artifact_uuid || item.id).slice(0, 8)}…)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1.5">
              Case
            </label>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-sm"
            >
              <option value="">Select a case…</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_name} ({c.case_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider">
                Artifact UUID *
              </label>
              {artifactDbId && (
                <button
                  type="button"
                  onClick={copyUuid}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  {copiedUuid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedUuid ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            <input
              type="text"
              value={artifactDbId}
              onChange={(e) => setArtifactDbId(e.target.value)}
              required
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white font-mono placeholder:text-[hsl(215,20.2%,30%)] focus:outline-none focus:border-blue-500 transition-all text-xs"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider">
              Merkle Proof (JSON Array)
            </label>
            <button
              type="button"
              onClick={() => loadProof()}
              disabled={!caseId || !artifactDbId}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors"
            >
              Auto-load proof from case
            </button>
          </div>
          <textarea
            value={merkleProof}
            onChange={(e) => setMerkleProof(e.target.value)}
            rows={4}
            className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500 transition-all resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1.5">
            Original Evidence File * (Uploaded bytes will be hashed on server)
          </label>
          <div
            className="border-2 border-dashed border-[hsl(217.2,32.6%,22%)] hover:border-blue-500/50 rounded-lg p-6 text-center cursor-pointer transition-all"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-[hsl(215,20.2%,35%)] mx-auto mb-2" />
            <p className="text-sm text-[hsl(215,20.2%,50%)]">
              {fileRef.current?.files?.[0]?.name ? (
                <span className="text-emerald-400 font-medium flex items-center justify-center gap-1.5">
                  <FileCheck className="w-4 h-4" /> Selected: {fileRef.current.files[0].name}
                </span>
              ) : (
                'Click to select the evidence file to verify'
              )}
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={() => {
              setError('')
              // Force state refresh so file name displays
              setArtifactDbId((prev) => prev)
            }}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying Cryptographic Evidence…
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Verify Evidence Integrity
            </>
          )}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div
          className={`bg-[hsl(222.2,50%,8%)] border rounded-xl p-6 space-y-4 shadow-xl ${
            result.passed ? 'border-emerald-500/40' : 'border-rose-500/40'
          }`}
        >
          <div className="flex items-center gap-3">
            {result.passed ? (
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            ) : (
              <ShieldX className="w-8 h-8 text-rose-400" />
            )}
            <div>
              <p className={`text-xl font-bold ${result.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.overall_status}
              </p>
              <p className="text-[hsl(215,20.2%,55%)] text-sm mt-0.5">{result.message}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-[hsl(222.2,40%,6%)] rounded-lg p-3">
              <p className="text-[hsl(215,20.2%,45%)] text-xs">Artifact ID / UUID</p>
              <p className="text-white font-mono text-xs mt-0.5 break-all">{result.artifact_id}</p>
            </div>
            <div className="bg-[hsl(222.2,40%,6%)] rounded-lg p-3">
              <p className="text-[hsl(215,20.2%,45%)] text-xs">Verified At</p>
              <p className="text-white text-xs mt-0.5">{new Date(result.verified_at).toLocaleString()}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-3">
              Verification Pipeline Steps
            </p>
            <div className="space-y-2">
              {result.steps.map((step, i) => (
                <div
                  key={step.name || i}
                  className="bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,14%)] rounded-lg overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
                    onClick={() => toggleStep(i)}
                  >
                    <div className="flex items-center gap-2.5">
                      {step.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-semibold text-white">{step.name}</p>
                        <p className="text-[11px] text-[hsl(215,20.2%,45%)] mt-0.5">{step.detail}</p>
                      </div>
                    </div>
                    {expandedSteps.includes(i) ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>

                  {expandedSteps.includes(i) && (step.expected || step.actual) && (
                    <div className="px-4 pb-3 pt-1 border-t border-[hsl(217.2,32.6%,12%)] bg-slate-950/40 space-y-1 text-[11px] font-mono">
                      {step.expected && (
                        <p className="text-slate-400 break-all">
                          <span className="text-slate-500">Expected:</span> {step.expected}
                        </p>
                      )}
                      {step.actual && (
                        <p className="text-slate-300 break-all">
                          <span className="text-slate-500">Actual:</span> {step.actual}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
