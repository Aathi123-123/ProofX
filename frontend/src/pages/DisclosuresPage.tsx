import { useEffect, useState } from 'react'
import { ListSkeleton } from '../components/Skeleton'
import { Link } from 'react-router-dom'
import { casesApi, disclosureApi } from '../services/api'
import type { Case, DisclosureRequest } from '../types'
import { Share2, Loader2, AlertTriangle, Plus, X, Check, XCircle } from 'lucide-react'

const DECISION_COLORS: Record<string, string> = {
  APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PARTIALLY_APPROVED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  DENIED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

interface CreateModalProps {
  cases: Case[]
  onClose: () => void
  onCreated: (d: DisclosureRequest) => void
}

function CreateDisclosureModal({ cases, onClose, onCreated }: CreateModalProps) {
  const [caseId, setCaseId] = useState(cases[0]?.id || '')
  const [purpose, setPurpose] = useState('')
  const [sensitivityLimit, setSensitivityLimit] = useState('HIGH')
  const [relevanceMin, setRelevanceMin] = useState('POTENTIALLY_RELEVANT')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const d = await disclosureApi.create(caseId, purpose, {
        sensitivity_limit: sensitivityLimit,
        relevance_minimum: relevanceMin,
      })
      onCreated(d)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[hsl(222.2,50%,7%)] border border-[hsl(217.2,32.6%,20%)] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(217.2,32.6%,17%)]">
          <h2 className="text-lg font-bold text-white">Create Disclosure Request</h2>
          <button onClick={onClose} className="text-[hsl(215,20.2%,50%)] hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1.5">Case *</label>
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)} required
              className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-sm">
              {cases.map((c) => <option key={c.id} value={c.id}>{c.case_name} ({c.case_number})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1.5">Purpose *</label>
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} required rows={3}
              placeholder="Describe the purpose of this disclosure request (min 10 chars)"
              className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white placeholder:text-[hsl(215,20.2%,30%)] focus:outline-none focus:border-blue-500 transition-all text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1.5">Max Sensitivity</label>
              <select value={sensitivityLimit} onChange={(e) => setSensitivityLimit(e.target.value)}
                className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-sm">
                {['PUBLIC', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1.5">Min Relevance</label>
              <select value={relevanceMin} onChange={(e) => setRelevanceMin(e.target.value)}
                className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-sm">
                {['RELEVANT', 'POTENTIALLY_RELEVANT', 'IRRELEVANT'].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-[hsl(217.2,32.6%,25%)] text-[hsl(215,20.2%,60%)] hover:text-white rounded-lg py-2.5 text-sm font-medium transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-all">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Disclosure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DisclosuresPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [disclosures, setDisclosures] = useState<DisclosureRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedCase, setSelectedCase] = useState<string>('all')

  useEffect(() => {
    const load = async () => {
      try {
        const cs = await casesApi.list()
        setCases(cs)
        const allDisclosures: DisclosureRequest[] = []
        for (const c of cs) {
          try {
            const ds = await disclosureApi.list(c.id)
            allDisclosures.push(...ds)
          } catch { /* case may have no disclosures */ }
        }
        allDisclosures.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setDisclosures(allDisclosures)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = selectedCase === 'all' ? disclosures : disclosures.filter((d) => d.case_id === selectedCase)

  if (loading) return <ListSkeleton rows={3} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Disclosures</h1>
          <p className="text-[hsl(215,20.2%,50%)] text-sm mt-0.5">Privacy-preserving selective disclosure requests</p>
        </div>
        <button onClick={() => setShowCreate(true)} disabled={cases.length === 0}
          className="flex items-center gap-2 bg-[#00a87d] hover:bg-[#00926c] disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-all shadow-sm">
          <Plus className="w-4 h-4" /> New Disclosure
        </button>
      </div>

      {/* Case filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSelectedCase('all')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCase === 'all' ? 'bg-blue-600 text-white' : 'bg-[hsl(222.2,50%,8%)] text-[hsl(215,20.2%,50%)] hover:text-white border border-[hsl(217.2,32.6%,17.5%)]'}`}>
          All Cases
        </button>
        {cases.map((c) => (
          <button key={c.id} onClick={() => setSelectedCase(c.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCase === c.id ? 'bg-blue-600 text-white' : 'bg-[hsl(222.2,50%,8%)] text-[hsl(215,20.2%,50%)] hover:text-white border border-[hsl(217.2,32.6%,17.5%)]'}`}>
            {c.case_number}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />{error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-12 text-center">
          <Share2 className="w-12 h-12 text-[hsl(215,20.2%,30%)] mx-auto mb-3" />
          <p className="text-[hsl(215,20.2%,50%)] font-medium">No disclosure requests</p>
          <p className="text-[hsl(215,20.2%,35%)] text-sm mt-1">Create a disclosure request to selectively share evidence</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const decisionCls = DECISION_COLORS[d.decision] || DECISION_COLORS.DENIED
            const caseInfo = cases.find((c) => c.id === d.case_id)
            return (
              <div key={d.id} className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] hover:border-[hsl(217.2,32.6%,28%)] rounded-xl p-5 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${decisionCls}`}>
                        {d.decision === 'APPROVED' ? <Check className="w-3 h-3" /> : d.decision === 'DENIED' ? <XCircle className="w-3 h-3" /> : null}
                        {d.decision}
                      </span>
                      {caseInfo && (
                        <Link to={`/cases/${d.case_id}`} className="text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors">
                          {caseInfo.case_number}
                        </Link>
                      )}
                    </div>
                    <p className="text-white font-medium mt-2 text-sm">{d.purpose}</p>
                    <p className="text-[hsl(215,20.2%,40%)] text-xs mt-1">{d.decision_reason}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs text-[hsl(215,20.2%,50%)]"><strong className="text-white">{d.total_requested}</strong> requested</span>
                      <span className="text-xs text-emerald-400"><strong>{d.total_eligible}</strong> eligible</span>
                      <span className="text-xs text-amber-400"><strong>{d.total_redacted}</strong> redacted</span>
                      <span className="text-xs text-rose-400"><strong>{d.total_denied}</strong> denied</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[hsl(215,20.2%,40%)] text-xs">{new Date(d.created_at).toLocaleDateString()}</p>
                    {d.dataset_version && <p className="text-xs text-slate-400 mt-0.5">v{d.dataset_version}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateDisclosureModal
          cases={cases}
          onClose={() => setShowCreate(false)}
          onCreated={(d) => { setDisclosures([d, ...disclosures]); setShowCreate(false) }}
        />
      )}
    </div>
  )
}
