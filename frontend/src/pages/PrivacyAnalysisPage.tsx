import { useEffect, useState } from 'react'
import { evidenceApi } from '../services/api'
import type { Evidence } from '../types'
import {
  ShieldAlert, CheckCircle2, Search, Info
} from 'lucide-react'

export default function PrivacyAnalysisPage() {
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([])
  const [selectedItem, setSelectedItem] = useState<Evidence | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL')

  useEffect(() => {
    evidenceApi.listAll(1, 100).then((res) => {
      setEvidenceList(res.items)
      if (res.items.length > 0) setSelectedItem(res.items[0])
    }).finally(() => setLoading(false))
  }, [])

  const filteredItems = evidenceList.filter((item) => {
    const matchesSearch = item.artifact_id.toLowerCase().includes(search.toLowerCase()) ||
      item.filename.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false
    if (filterType === 'HAS_PII') return item.pii_findings && item.pii_findings.length > 0
    if (filterType === 'HIGH_SENS') return item.sensitivity_level === 'HIGH' || item.sensitivity_level === 'CRITICAL'
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Privacy &amp; Sensitivity Analysis</h1>
        <p className="text-[hsl(215,20.2%,50%)] text-sm mt-0.5">
          Deterministic PII detection, sensitivity scoring, and selective disclosure redaction rules
        </p>
      </div>

      {/* Main Analysis Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Artifact List */}
        <div className="lg:col-span-5 bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter artifacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[hsl(222.2,40%,6%)] border border-slate-700/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[hsl(222.2,40%,6%)] border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs text-white"
            >
              <option value="ALL">All Items</option>
              <option value="HAS_PII">With PII</option>
              <option value="HIGH_SENS">High/Critical</option>
            </select>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-[600px] overflow-y-auto">
            {loading ? (
              <p className="text-xs text-slate-500 py-6 text-center">Loading artifacts...</p>
            ) : filteredItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No matching artifacts.</p>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id
                const piiCount = item.pii_findings?.length || 0
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between ${isSelected ? 'bg-blue-600/15 border border-blue-500/40 text-white' : 'hover:bg-slate-800/40 text-slate-300'
                      }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{item.artifact_id}</span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {item.sensitivity_level}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-[200px] mt-0.5">{item.filename}</p>
                    </div>
                    <div className="text-right">
                      {piiCount > 0 ? (
                        <span className="text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          {piiCount} PII
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-emerald-400">Clean</span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right: Detailed Privacy Breakdown */}
        <div className="lg:col-span-7 bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-6 space-y-6">
          {selectedItem ? (
            <>
              {/* Top Banner */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">{selectedItem.artifact_id}</h2>
                    <span className="text-xs text-slate-400 font-mono">{selectedItem.filename}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    SHA-256: <span className="font-mono text-slate-300">{selectedItem.sha256}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Sensitivity Score</p>
                  <p className="text-2xl font-bold text-white">{(selectedItem.sensitivity_score * 100).toFixed(0)}%</p>
                </div>
              </div>

              {/* Assessment Reason */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-400" /> Automated Classification Reason
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedItem.classification_reason || 'Artifact processed with baseline forensic sensitivity rules.'}
                </p>
              </div>

              {/* PII Findings Table */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Detected Personally Identifiable Information (PII)
                </h3>
                {selectedItem.pii_findings && selectedItem.pii_findings.length > 0 ? (
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="px-3.5 py-2 font-semibold">PII Type</th>
                          <th className="px-3.5 py-2 font-semibold">Matched Pattern / Value</th>
                          <th className="px-3.5 py-2 font-semibold">Redaction Directive</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {selectedItem.pii_findings.map((finding: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/20">
                            <td className="px-3.5 py-2 font-semibold text-rose-400 font-mono">
                              {finding.pii_type || finding.type || 'UNKNOWN'}
                            </td>
                            <td className="px-3.5 py-2 font-mono text-slate-300">
                              {finding.value ? `"${finding.value}"` : finding.snippet || 'Token matched'}
                            </td>
                            <td className="px-3.5 py-2 text-slate-400">
                              Mask with deterministic placeholder before selective disclosure
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-4 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    No sensitive PII patterns (emails, tokens, phone numbers, or credentials) were detected in this artifact.
                  </div>
                )}
              </div>

              {/* Redaction Policy Guarantee */}
              <div className="border-t border-slate-800 pt-4 text-xs text-slate-500 space-y-1.5">
                <p className="font-semibold text-slate-400">Privacy-Preserving Guarantees:</p>
                <p>&bull; Original physical evidence files are never modified or rewritten during redaction.</p>
                <p>&bull; Redactions are applied dynamically upon authorized Selective Disclosure requests.</p>
                <p>&bull; Recalculated disclosed hashes and Merkle membership proofs ensure forensic verifiability without exposing raw PII.</p>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-slate-500 text-sm">
              Select an evidence artifact from the left panel to inspect its sensitivity breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}