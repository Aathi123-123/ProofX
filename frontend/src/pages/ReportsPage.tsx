import { useEffect, useState } from 'react'
import { casesApi, reportsApi } from '../services/api'
import type { Case } from '../types'
import { FileDown, RefreshCw, Eye } from 'lucide-react'

export default function ReportsPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [previewCase, setPreviewCase] = useState<any | null>(null)

  const loadCases = async () => {
    setLoading(true)
    try {
      const res = await casesApi.list()
      setCases(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCases()
  }, [])

  const handleDownloadPdf = async (c: Case) => {
    setDownloadingId(c.id)
    try {
      await reportsApi.downloadCasePdf(c.id, c.case_number)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download report')
    } finally {
      setDownloadingId(null)
    }
  }

  const handlePreviewSummary = async (c: Case) => {
    try {
      const summary = await reportsApi.caseSummary(c.id)
      setPreviewCase(summary)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to load case summary')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Forensic Evidence Reports</h1>
          <p className="text-[hsl(215,20.2%,50%)] text-sm mt-0.5">
            Generate formal court-admissible forensic certificates, Merkle root audits, and PDF case reports
          </p>
        </div>
        <button
          onClick={loadCases}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Cases
        </button>
      </div>

      {/* Case Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-sm">
            Loading investigation cases for reporting...
          </div>
        ) : cases.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-sm">
            No investigation cases found. Create a case to generate evidence reports.
          </div>
        ) : (
          cases.map((c) => (
            <div
              key={c.id}
              className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="font-mono text-xs font-bold text-white bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded">
                    {c.case_number}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${c.status === 'OPEN'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                  >
                    {c.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                  {c.case_name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {c.investigation_purpose || c.description || 'No description provided.'}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span>{c.evidence_count} Artifacts</span>
                  <span>{c.latest_version ? `v${c.latest_version} Committed` : 'Uncommitted'}</span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf(c)}
                  disabled={downloadingId === c.id}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs py-2 px-3 rounded-lg transition-colors shadow-sm"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {downloadingId === c.id ? 'Generating PDF...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => handlePreviewSummary(c)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors"
                  title="Inspect Summary Data"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview Summary Modal */}
      {previewCase && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(222.2,50%,9%)] border border-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Forensic Summary: {previewCase.case.case_number}
                </h3>
                <p className="text-xs text-slate-400">{previewCase.case.case_name}</p>
              </div>
              <button
                onClick={() => setPreviewCase(null)}
                className="text-slate-400 hover:text-white text-xs font-semibold"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                <p className="text-xs text-slate-500 font-semibold uppercase">Artifacts</p>
                <p className="text-lg font-bold text-white">{previewCase.stats.evidence_count}</p>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                <p className="text-xs text-slate-500 font-semibold uppercase">Merkle Trees</p>
                <p className="text-lg font-bold text-white">{previewCase.stats.commitments_count}</p>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
                <p className="text-xs text-slate-500 font-semibold uppercase">Audit Events</p>
                <p className="text-lg font-bold text-white">{previewCase.stats.audit_events_count}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Committed Artifacts &amp; Hashes
              </h4>
              <div className="border border-slate-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2 font-semibold">ID</th>
                      <th className="p-2 font-semibold">Filename</th>
                      <th className="p-2 font-semibold">SHA-256 Digest</th>
                      <th className="p-2 font-semibold">Sensitivity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {previewCase.evidence.map((ev: any) => (
                      <tr key={ev.artifact_id}>
                        <td className="p-2 font-mono font-bold text-white">{ev.artifact_id}</td>
                        <td className="p-2 text-slate-300">{ev.filename}</td>
                        <td className="p-2 font-mono text-slate-400">
                          {ev.sha256.substring(0, 10)}...{ev.sha256.substring(ev.sha256.length - 8)}
                        </td>
                        <td className="p-2 font-semibold text-slate-400">{ev.sensitivity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => reportsApi.downloadCasePdf(previewCase.case.id, previewCase.case.case_number)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" /> Download Full PDF Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}