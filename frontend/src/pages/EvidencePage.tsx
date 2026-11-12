import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { evidenceApi } from '../services/api'
import type { Evidence } from '../types'
import {
  Search, CheckCircle2, AlertTriangle, RefreshCw, FileText, ChevronRight,
  Download, Copy, Check, Eye, X, ExternalLink, Loader2
} from 'lucide-react'

const SENSITIVITY_BADGE: Record<string, string> = {
  PUBLIC: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  LOW: 'bg-lime-500/15 text-lime-400 border-lime-500/20',
  MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  CRITICAL: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function EvidencePage() {
  const navigate = useNavigate()
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sensitivity, setSensitivity] = useState('')
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [verifyStatus, setVerifyStatus] = useState<Record<string, { valid: boolean; calculated_hash: string }>>({})

  // Modal states
  const [selectedItem, setSelectedItem] = useState<Evidence | null>(null)
  const [overrideItem, setOverrideItem] = useState<Evidence | null>(null)
  const [overrideSens, setOverrideSens] = useState('PUBLIC')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const evRes = await evidenceApi.listAll(1, 100, {
        sensitivity: sensitivity || undefined,
        search: search || undefined,
      })
      setEvidence(evRes.items)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [sensitivity, search])

  const handleVerifyIntegrity = async (item: Evidence) => {
    setVerifyingId(item.id)
    try {
      const res = await evidenceApi.verifyIntegrity(item.id)
      setVerifyStatus((prev) => ({ ...prev, [item.id]: res }))
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Integrity check failed', 'error')
    } finally {
      setVerifyingId(null)
    }
  }

  const handleDownload = async (item: Evidence) => {
    const targetId = item.id || item.artifact_id
    setDownloadingId(targetId)
    try {
      await evidenceApi.download(targetId, item.filename)
      showNotification(`Downloaded "${item.filename}" successfully.`, 'success')
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Evidence download failed', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!overrideItem || !overrideReason) return
    setOverrideSubmitting(true)
    try {
      await evidenceApi.overrideClassification(overrideItem.id, {
        sensitivity_level: overrideSens,
        reason: overrideReason,
      })
      setOverrideItem(null)
      setOverrideReason('')
      showNotification('Sensitivity classification updated and audited.', 'success')
      await loadData()
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Override failed', 'error')
    } finally {
      setOverrideSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Forensic Evidence Repository</h1>
        <p className="text-[hsl(215,20.2%,50%)] text-sm mt-0.5">
          Immutable cryptographic evidence management, sensitivity classifications, and Artifact UUID registry.
        </p>
      </div>

      {notification && (
        <div
          className={`flex items-center gap-2 border rounded-lg px-4 py-3 text-sm ${
            notification.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400'
              : 'bg-red-950/50 border-red-800 text-red-400'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          {notification.message}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search filename, artifact ID, or UUID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[hsl(222.2,40%,6%)] border border-slate-700/60 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <select
            value={sensitivity}
            onChange={(e) => setSensitivity(e.target.value)}
            className="bg-[hsl(222.2,40%,6%)] border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Sensitivities</option>
            <option value="PUBLIC">PUBLIC</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Evidence Table */}
      <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Artifact ID</th>
                <th className="px-5 py-3.5 font-semibold">Artifact UUID</th>
                <th className="px-5 py-3.5 font-semibold">Filename</th>
                <th className="px-5 py-3.5 font-semibold">Case</th>
                <th className="px-5 py-3.5 font-semibold">Sensitivity</th>
                <th className="px-5 py-3.5 font-semibold">Integrity</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Loading evidence artifacts...
                  </td>
                </tr>
              ) : evidence.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No evidence artifacts found matching your criteria.
                  </td>
                </tr>
              ) : (
                evidence.map((item) => {
                  const verified = verifyStatus[item.id]
                  const uuid = item.artifact_uuid || item.id
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-blue-400">
                        {item.artifact_id}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
                          <span title={uuid} className="truncate max-w-[120px]">
                            {uuid ? `${uuid.slice(0, 8)}...${uuid.slice(-4)}` : 'N/A'}
                          </span>
                          {uuid && (
                            <button
                              onClick={() => copyToClipboard(uuid, `table-uuid-${item.id}`)}
                              title="Copy Artifact UUID"
                              className="p-1 hover:text-emerald-400 text-slate-400 transition-colors"
                            >
                              {copiedId === `table-uuid-${item.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-200">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="flex items-center gap-2 hover:text-blue-400 transition-colors text-left group"
                        >
                          <FileText className="w-4 h-4 text-slate-500 flex-shrink-0 group-hover:text-blue-400" />
                          <span className="truncate max-w-[180px] group-hover:underline">{item.filename}</span>
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        <Link
                          to={`/cases/${item.case_id}`}
                          className="hover:text-blue-400 flex items-center gap-1 transition-colors"
                        >
                          View Case <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            SENSITIVITY_BADGE[item.sensitivity_level] || 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {item.sensitivity_level}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {verified ? (
                          verified.valid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Untampered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" /> Tampered
                            </span>
                          )
                        ) : (
                          <button
                            onClick={() => handleVerifyIntegrity(item)}
                            disabled={verifyingId === item.id}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                          >
                            {verifyingId === item.id ? 'Hashing...' : 'Verify Hash'}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="p-1 hover:text-blue-400 text-slate-400 transition-colors"
                            title="Inspect Evidence Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(item)}
                            disabled={downloadingId === (item.id || item.artifact_id)}
                            className="p-1 hover:text-emerald-400 text-slate-400 transition-colors disabled:opacity-40"
                            title="Download Evidence File"
                          >
                            {downloadingId === (item.id || item.artifact_id) ? (
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setOverrideItem(item)
                              setOverrideSens(item.sensitivity_level)
                            }}
                            className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-2 py-0.5 rounded-md transition-all ml-1"
                            title="Override Sensitivity"
                          >
                            Classify
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(222.2,50%,9%)] border border-slate-700/80 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[hsl(222.2,50%,7%)]">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-base font-bold text-white truncate max-w-md">{selectedItem.filename}</h3>
                  <span className="text-xs font-mono text-blue-400">{selectedItem.artifact_id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Artifact UUID Highlight */}
              <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Artifact UUID (Unique Database Record Identifier)
                </label>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-emerald-400 select-all break-all">
                    {selectedItem.artifact_uuid || selectedItem.id}
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedItem.artifact_uuid || selectedItem.id, 'modal-ev-uuid')}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-slate-700 hover:border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex-shrink-0"
                  >
                    {copiedId === 'modal-ev-uuid' ? (
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
                  <span className="font-mono text-slate-200">{selectedItem.case_id}</span>
                </div>
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">File Size</span>
                  <span className="text-slate-200 font-semibold">{formatBytes(selectedItem.file_size)}</span>
                </div>
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">MIME Type</span>
                  <span className="text-slate-200 font-mono">{selectedItem.mime_type}</span>
                </div>
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">Sensitivity Level</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border mt-0.5 ${
                      SENSITIVITY_BADGE[selectedItem.sensitivity_level] || 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedItem.sensitivity_level}
                  </span>
                </div>
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">Uploaded At</span>
                  <span className="text-slate-200">{new Date(selectedItem.created_at).toLocaleString()}</span>
                </div>
                <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">Source / Origin</span>
                  <span className="text-slate-200">{selectedItem.source || 'Direct Forensic Ingestion'}</span>
                </div>
              </div>

              {/* SHA-256 Digest */}
              <div className="bg-[hsl(222.2,40%,6%)] border border-slate-800 rounded-lg p-3.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Cryptographic SHA-256 Digest
                </label>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-300 break-all select-all">
                    {selectedItem.sha256}
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedItem.sha256, 'modal-ev-sha')}
                    className="p-1 hover:text-emerald-400 text-slate-400 transition-colors flex-shrink-0"
                    title="Copy SHA-256"
                  >
                    {copiedId === 'modal-ev-sha' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-800 bg-[hsl(222.2,50%,7%)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigate(`/verification?case_id=${selectedItem.case_id}&uuid=${selectedItem.artifact_uuid || selectedItem.id}`)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-500/30 hover:border-blue-500 bg-blue-500/10 text-blue-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in Verification
                </button>
                <Link
                  to={`/cases/${selectedItem.case_id}`}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 transition-colors inline-block"
                >
                  Go to Case
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedItem)}
                  disabled={downloadingId === (selectedItem.id || selectedItem.artifact_id)}
                  className="flex items-center gap-1.5 bg-[#00a87d] hover:bg-[#00926c] text-white px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-40"
                >
                  {downloadingId === (selectedItem.id || selectedItem.artifact_id) ? (
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

      {/* Override Modal */}
      {overrideItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(222.2,50%,9%)] border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Override Classification</h3>
            <p className="text-slate-400 text-xs mb-4">
              Override automated PII and sensitivity assessment for{' '}
              <span className="text-white font-mono">{overrideItem.artifact_id}</span>. This action is cryptographically audited.
            </p>
            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  New Sensitivity Level
                </label>
                <select
                  value={overrideSens}
                  onChange={(e) => setOverrideSens(e.target.value)}
                  className="w-full bg-[hsl(222.2,40%,6%)] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Justification / Reason (Required)
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why this sensitivity level is being overridden..."
                  className="w-full bg-[hsl(222.2,40%,6%)] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-all"
                >
                  {overrideSubmitting ? 'Recording...' : 'Commit Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
