import { useEffect, useState, useRef } from 'react'
import { DetailSkeleton } from '../components/Skeleton'
import { useParams, useNavigate } from 'react-router-dom'
import { casesApi, evidenceApi, merkleApi, blockchainApi } from '../services/api'
import type { Case, Evidence, EvidenceListOut, MerkleCommitment } from '../types'
import {
  ArrowLeft, Upload, Loader2, AlertTriangle, FileText, Image, FileArchive,
  File, Shield, ShieldAlert, ChevronLeft, ChevronRight, GitBranch, Link2, Download, Trash2,
  Copy, Check, Eye, X, ExternalLink, CheckCircle2
} from 'lucide-react'

const SENSITIVITY_COLORS = {
  PUBLIC: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  LOW: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  CRITICAL: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

function SensitivityBadge({ level }: { level: string }) {
  const cls = SENSITIVITY_COLORS[level as keyof typeof SENSITIVITY_COLORS] || SENSITIVITY_COLORS.PUBLIC
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>{level}</span>
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <Image className="w-4 h-4 text-sky-400" />
  if (mime.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />
  if (mime.includes('zip') || mime.includes('tar')) return <FileArchive className="w-4 h-4 text-amber-400" />
  return <File className="w-4 h-4 text-blue-400" />
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [evidence, setEvidence] = useState<EvidenceListOut | null>(null)
  const [commitments, setCommitments] = useState<MerkleCommitment[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [anchoring, setAnchoring] = useState(false)
  const [deletingCase, setDeletingCase] = useState(false)
  const [error, setError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const load = async () => {
    if (!caseId) return
    setLoading(true)
    try {
      const [c, ev, hist] = await Promise.all([
        casesApi.get(caseId),
        evidenceApi.list(caseId, page),
        merkleApi.history(caseId),
      ])
      setCaseData(c)
      setEvidence(ev)
      setCommitments(hist)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [caseId, page])

  const handleUpload = async (files: FileList | null) => {
    if (!files || !caseId) return
    setUploadError('')
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('source', 'manual_upload')
        await evidenceApi.upload(caseId, fd)
      }
      await load()
      setActionSuccess('Evidence uploaded successfully.')
      setTimeout(() => setActionSuccess(''), 4000)
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleCommit = async () => {
    if (!caseId) return
    setCommitting(true)
    try {
      await merkleApi.commit(caseId)
      await load()
      setActionSuccess('Merkle tree generated and committed successfully.')
      setTimeout(() => setActionSuccess(''), 4000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Commit failed')
    } finally {
      setCommitting(false)
    }
  }

  const handleAnchor = async () => {
    if (!caseId) return
    setAnchoring(true)
    setError('')
    try {
      await blockchainApi.commit(caseId)
      await load()
      setActionSuccess('Root anchored to blockchain smart contract.')
      setTimeout(() => setActionSuccess(''), 4000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Blockchain anchoring failed')
    } finally {
      setAnchoring(false)
    }
  }

  const handleDeleteCase = async () => {
    if (!caseId || !caseData) return
    if (!window.confirm(`Are you sure you want to permanently delete case "${caseData.case_name}"? All evidence and records in this session will be removed.`)) return
    setDeletingCase(true)
    setError('')
    try {
      await casesApi.delete(caseId)
      navigate('/cases')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete case')
      setDeletingCase(false)
    }
  }

  const handleDelete = async (artifactId: string) => {
    if (!confirm('Delete this evidence item?')) return
    try {
      await evidenceApi.delete(artifactId)
      await load()
      if (selectedEvidence?.id === artifactId || selectedEvidence?.artifact_id === artifactId) {
        setSelectedEvidence(null)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const handleDownload = async (ev: Evidence) => {
    const targetId = ev.id || ev.artifact_id
    setDownloadingId(targetId)
    setError('')
    try {
      await evidenceApi.download(targetId, ev.filename)
      setActionSuccess(`Downloaded "${ev.filename}" successfully.`)
      setTimeout(() => setActionSuccess(''), 4000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to download original evidence')
    } finally {
      setDownloadingId(null)
    }
  }

  if (loading) return <DetailSkeleton />
  if (error) return (
    <div className="flex items-center gap-3 bg-red-950/50 border border-red-800 rounded-xl p-6 text-red-400">
      <AlertTriangle className="w-6 h-6 flex-shrink-0" />
      <div><p className="font-semibold">Error</p><p className="text-sm mt-0.5">{error}</p></div>
    </div>
  )

  const latestCommit = commitments[0]

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate('/cases')}
          className="flex items-center gap-2 text-xs font-semibold text-[hsl(215,20.2%,60%)] hover:text-white transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Cases
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">{caseData?.case_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[hsl(215,20.2%,50%)] text-sm font-mono">{caseData?.case_number}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                caseData?.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                caseData?.status === 'SEALED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-slate-500/10 text-slate-400 border-slate-500/20'
              }`}>{caseData?.status}</span>
            </div>
            {caseData?.description && <p className="text-[hsl(215,20.2%,45%)] text-sm mt-2 max-w-xl">{caseData.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteCase}
              disabled={deletingCase}
              className="flex items-center gap-1.5 border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-400 rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-40"
              title="Delete this case and all session records"
            >
              {deletingCase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Case
            </button>
            <button
              onClick={handleCommit}
              disabled={committing || (evidence?.total || 0) === 0}
              className="flex items-center gap-2 border border-[hsl(217.2,32.6%,25%)] hover:border-slate-500 text-[hsl(215,20.2%,60%)] hover:text-white rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-40"
            >
              {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
              Merkle Commit
            </button>
            <button
              id="upload-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-[#00a87d] hover:bg-[#00926c] disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-all shadow-sm"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload Evidence
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-800 rounded-lg px-4 py-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{actionSuccess}
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{uploadError}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Evidence Items', value: evidence?.total || 0, icon: File, color: 'text-blue-400' },
          { label: 'Sensitive', value: caseData?.sensitive_count || 0, icon: ShieldAlert, color: 'text-rose-400' },
          { label: 'Merkle Versions', value: commitments.length, icon: GitBranch, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-4 flex items-center gap-3">
            <s.icon className={`w-6 h-6 ${s.color}`} />
            <div>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-[hsl(215,20.2%,45%)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Latest Merkle commitment */}
      {latestCommit && (
        <div className="bg-[hsl(222.2,50%,8%)] border border-slate-700/70 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Link2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Latest Merkle Commitment · v{latestCommit.dataset_version}</p>
              <p className="text-sm text-white font-mono mt-1 truncate">{latestCommit.merkle_root}</p>
              <div className="flex items-center gap-4 mt-1.5">
                <span className="text-xs text-[hsl(215,20.2%,45%)]">{latestCommit.evidence_count} artifacts</span>
                {latestCommit.tx_hash ? (
                  <span className="flex items-center gap-1 text-xs text-amber-400 font-mono">
                    <Shield className="w-3 h-3" /> On-chain: {latestCommit.tx_hash.slice(0, 14)}…
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Not anchored to blockchain</span>
                )}
              </div>
            </div>
          </div>
          <div>
            {!latestCommit.tx_hash && (
              <button
                onClick={handleAnchor}
                disabled={anchoring}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-lg px-3 py-1.5 text-xs transition-all shadow-md shadow-amber-600/20 whitespace-nowrap"
              >
                {anchoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                Anchor to Blockchain
              </button>
            )}
          </div>
        </div>
      )}

      {/* Evidence table */}
      <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(217.2,32.6%,13%)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Evidence Items</h2>
          <span className="text-xs text-[hsl(215,20.2%,50%)]">Click file or inspect icon to view full artifact details</span>
        </div>
        {evidence && evidence.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(217.2,32.6%,13%)]">
                    {['File', 'Artifact ID', 'Artifact UUID', 'Type', 'Size', 'Sensitivity', 'SHA-256', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,20.2%,50%)] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evidence.items.map((ev) => {
                    const uuid = ev.artifact_uuid || ev.id
                    return (
                      <tr key={ev.id} className="border-b border-[hsl(217.2,32.6%,10%)] hover:bg-[hsl(222.2,50%,9%)] transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedEvidence(ev)}
                            className="flex items-center gap-2 text-left hover:text-blue-400 group transition-colors"
                          >
                            <FileIcon mime={ev.mime_type} />
                            <span className="text-white font-medium max-w-[180px] truncate group-hover:underline" title={ev.filename}>{ev.filename}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono font-semibold text-blue-400">
                          {ev.artifact_id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
                            <span title={uuid} className="truncate max-w-[110px]">{uuid ? `${uuid.slice(0, 8)}...${uuid.slice(-4)}` : 'N/A'}</span>
                            {uuid && (
                              <button
                                onClick={() => copyToClipboard(uuid, `uuid-${ev.id}`)}
                                title="Copy Artifact UUID"
                                className="p-1 hover:text-emerald-400 text-slate-400 transition-colors"
                              >
                                {copiedId === `uuid-${ev.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[hsl(215,20.2%,50%)] text-xs">{ev.mime_type}</td>
                        <td className="px-4 py-3 text-[hsl(215,20.2%,50%)] text-xs">{formatBytes(ev.file_size)}</td>
                        <td className="px-4 py-3"><SensitivityBadge level={ev.sensitivity_level} /></td>
                        <td className="px-4 py-3 text-[hsl(215,20.2%,40%)] font-mono text-xs">
                          <span title={ev.sha256}>{ev.sha256.slice(0, 10)}…</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedEvidence(ev)}
                              title="View Details"
                              className="p-1 hover:text-blue-400 text-[hsl(215,20.2%,45%)] transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDownload(ev)}
                              disabled={downloadingId === (ev.id || ev.artifact_id)}
                              title="Download Original Evidence"
                              className="p-1 hover:text-emerald-400 text-[hsl(215,20.2%,45%)] disabled:opacity-40 transition-colors"
                            >
                              {downloadingId === (ev.id || ev.artifact_id) ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleDelete(ev.artifact_id)}
                              title="Delete"
                              className="p-1 hover:text-red-400 text-[hsl(215,20.2%,45%)] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {evidence.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(217.2,32.6%,13%)]">
                <span className="text-xs text-[hsl(215,20.2%,45%)]">Page {page} of {evidence.pages} · {evidence.total} total</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-[hsl(217.2,32.6%,20%)] text-[hsl(215,20.2%,50%)] hover:text-white disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(evidence.pages, p + 1))} disabled={page === evidence.pages} className="p-1.5 rounded border border-[hsl(217.2,32.6%,20%)] text-[hsl(215,20.2%,50%)] hover:text-white disabled:opacity-40 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Upload className="w-10 h-10 text-[hsl(215,20.2%,30%)] mx-auto mb-3" />
            <p className="text-[hsl(215,20.2%,45%)] font-medium">No evidence uploaded</p>
            <p className="text-[hsl(215,20.2%,35%)] text-sm mt-1">Click "Upload Evidence" to add files to this case</p>
          </div>
        )}
      </div>

      {/* Evidence Details Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(222.2,50%,9%)] border border-slate-700/80 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[hsl(222.2,50%,7%)]">
              <div className="flex items-center gap-3">
                <FileIcon mime={selectedEvidence.mime_type} />
                <div>
                  <h3 className="text-base font-bold text-white truncate max-w-md">{selectedEvidence.filename}</h3>
                  <span className="text-xs font-mono text-blue-400">{selectedEvidence.artifact_id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvidence(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Artifact UUID Section */}
              <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Artifact UUID (Unique Database Record Identifier)
                </label>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-emerald-400 select-all break-all">
                    {selectedEvidence.artifact_uuid || selectedEvidence.id}
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedEvidence.artifact_uuid || selectedEvidence.id, 'modal-uuid')}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-slate-700 hover:border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex-shrink-0"
                  >
                    {copiedId === 'modal-uuid' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy UUID
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">Case ID</span>
                  <span className="font-mono text-slate-200">{selectedEvidence.case_id}</span>
                </div>
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">File Size</span>
                  <span className="text-slate-200 font-semibold">{formatBytes(selectedEvidence.file_size)}</span>
                </div>
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">MIME Type</span>
                  <span className="text-slate-200 font-mono">{selectedEvidence.mime_type}</span>
                </div>
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">Sensitivity Classification</span>
                  <div className="mt-1"><SensitivityBadge level={selectedEvidence.sensitivity_level} /></div>
                </div>
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">Upload Timestamp</span>
                  <span className="text-slate-200">{new Date(selectedEvidence.created_at).toLocaleString()}</span>
                </div>
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">Blockchain Commitment</span>
                  <span className="text-slate-200">
                    {latestCommit ? `Committed in v${latestCommit.dataset_version}` : 'Pending Merkle commit'}
                  </span>
                </div>
              </div>

              {/* SHA-256 Digest */}
              <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Cryptographic SHA-256 Digest
                </label>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-300 break-all select-all">
                    {selectedEvidence.sha256}
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedEvidence.sha256, 'modal-sha')}
                    className="p-1 hover:text-emerald-400 text-slate-400 transition-colors flex-shrink-0"
                    title="Copy SHA-256"
                  >
                    {copiedId === 'modal-sha' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-800 bg-[hsl(222.2,50%,7%)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigate(`/verification?case_id=${selectedEvidence.case_id}&uuid=${selectedEvidence.artifact_uuid || selectedEvidence.id}`)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-500/30 hover:border-blue-500 bg-blue-500/10 text-blue-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in Verification
                </button>
                <button
                  onClick={() => {
                    navigate('/disclosures')
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 transition-colors"
                >
                  Create Disclosure
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedEvidence)}
                  disabled={downloadingId === (selectedEvidence.id || selectedEvidence.artifact_id)}
                  className="flex items-center gap-1.5 bg-[#00a87d] hover:bg-[#00926c] text-white px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-40"
                >
                  {downloadingId === (selectedEvidence.id || selectedEvidence.artifact_id) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Download Original
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


