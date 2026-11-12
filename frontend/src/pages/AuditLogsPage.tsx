import { useEffect, useState } from 'react'
import { auditApi, casesApi } from '../services/api'
import type { AuditEvent, Case } from '../types'
import {
  ShieldCheck, Search, RefreshCw, KeyRound, Briefcase, Upload,
  Share2, CheckCircle2, XCircle, UserCheck, FileText, Lock, AlertTriangle
} from 'lucide-react'

const EVENT_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  CASE_CREATED: { icon: Briefcase, color: 'text-blue-400 bg-blue-500/10' },
  EVIDENCE_ACQUIRED: { icon: Upload, color: 'text-sky-400 bg-sky-500/10' },
  HASH_CALCULATED: { icon: ShieldCheck, color: 'text-teal-400 bg-teal-500/10' },
  PII_DETECTED: { icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10' },
  CLASSIFIED: { icon: FileText, color: 'text-blue-400 bg-blue-500/10' },
  CLASSIFICATION_OVERRIDDEN: { icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/10' },
  MERKLE_CREATED: { icon: ShieldCheck, color: 'text-emerald-400 bg-emerald-500/10' },
  BLOCKCHAIN_COMMITTED: { icon: Lock, color: 'text-amber-400 bg-amber-500/10' },
  DISCLOSURE_REQUESTED: { icon: Share2, color: 'text-teal-400 bg-teal-500/10' },
  DISCLOSURE_APPROVED: { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10' },
  DISCLOSURE_DENIED: { icon: XCircle, color: 'text-rose-400 bg-rose-500/10' },
  VERIFICATION_PASSED: { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10' },
  VERIFICATION_FAILED: { icon: XCircle, color: 'text-rose-400 bg-rose-500/10' },
  USER_LOGIN: { icon: KeyRound, color: 'text-slate-400 bg-slate-500/10' },
  USER_CREATED: { icon: UserCheck, color: 'text-slate-400 bg-slate-500/10' },
}

export default function AuditLogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [inspectEvent, setInspectEvent] = useState<AuditEvent | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [evs, cs] = await Promise.all([
        auditApi.list(selectedCase || undefined, 150),
        casesApi.list(),
      ])
      setEvents(evs)
      setCases(cs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedCase])

  const filtered = events.filter((e) => {
    const s = search.toLowerCase()
    return (
      e.event_type.toLowerCase().includes(s) ||
      e.actor_label.toLowerCase().includes(s) ||
      e.details_hash.toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Chain of Custody &amp; Audit Logs</h1>
          <p className="text-[hsl(215,20.2%,50%)] text-sm mt-0.5">
            Cryptographically hashed immutable ledger of all evidence handling, classification, and disclosure actions
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Audit Trail
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by event type, actor, or details hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[hsl(222.2,40%,6%)] border border-slate-700/60 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedCase}
            onChange={(e) => setSelectedCase(e.target.value)}
            className="bg-[hsl(222.2,40%,6%)] border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Global Audit Log</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.case_number} - {c.case_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Events Table */}
      <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Timestamp (UTC)</th>
                <th className="px-5 py-3.5 font-semibold">Action / Event</th>
                <th className="px-5 py-3.5 font-semibold">Actor</th>
                <th className="px-5 py-3.5 font-semibold">Payload Hash</th>
                <th className="px-5 py-3.5 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const cfg = EVENT_ICONS[item.event_type] || { icon: FileText, color: 'text-slate-400 bg-slate-500/10' }
                  const Icon = cfg.icon
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">
                        {new Date(item.timestamp).toISOString().replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-semibold text-xs text-white">
                            {item.event_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-300 font-medium">
                        {item.actor_label}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                        <span title={item.details_hash}>
                          {item.details_hash ? `${item.details_hash.substring(0, 12)}...` : '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setInspectEvent(item)}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium border border-blue-500/20 px-2.5 py-1 rounded transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal */}
      {inspectEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(222.2,50%,9%)] border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Audit Record Verification</h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">Event ID: {inspectEvent.id}</p>

            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Action Type</p>
                <p className="text-sm font-bold text-white">{inspectEvent.event_type}</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cryptographic Details Hash (SHA-256)</p>
                <p className="text-xs font-mono text-emerald-400 break-all bg-slate-900 p-2 rounded border border-slate-800 mt-1">
                  {inspectEvent.details_hash || 'None'}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Payload Content</p>
                <pre className="text-xs font-mono text-slate-300 bg-slate-900 p-3 rounded border border-slate-800 max-h-48 overflow-y-auto mt-1">
                  {JSON.stringify(inspectEvent.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-5">
              <button
                onClick={() => setInspectEvent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
