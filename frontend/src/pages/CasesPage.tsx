import { useEffect, useState, type FormEvent } from 'react'
import { ListSkeleton } from '../components/Skeleton'
import { Link } from 'react-router-dom'
import { casesApi } from '../services/api'
import type { Case } from '../types'
import { Plus, Briefcase, Loader2, AlertTriangle, ChevronRight, X, CheckCircle2, Lock, FolderOpen, Trash2 } from 'lucide-react'

const STATUS_CONFIG = {
  OPEN: { label: 'Open', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  SEALED: { label: 'Sealed', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  CLOSED: { label: 'Closed', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
}

const STATUS_ICONS = { OPEN: FolderOpen, SEALED: Lock, CLOSED: CheckCircle2 }

function Badge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.OPEN
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

interface CreateModalProps {
  onClose: () => void
  onCreated: (c: Case) => void
}

function CreateCaseModal({ onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState({ case_name: '', description: '', investigation_purpose: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const c = await casesApi.create(form)
      onCreated(c)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create case')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[hsl(222.2,50%,7%)] border border-[hsl(217.2,32.6%,20%)] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(217.2,32.6%,17%)]">
          <h2 className="text-lg font-bold text-white">Create New Case</h2>
          <button onClick={onClose} className="text-[hsl(215,20.2%,50%)] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1.5">Case Name *</label>
            <input
              type="text"
              value={form.case_name}
              onChange={(e) => setForm({ ...form, case_name: e.target.value })}
              required
              placeholder="e.g. Operation Nightfall"
              className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white placeholder:text-[hsl(215,20.2%,30%)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Brief description of the case"
              className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white placeholder:text-[hsl(215,20.2%,30%)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1.5">Investigation Purpose *</label>
            <textarea
              value={form.investigation_purpose}
              onChange={(e) => setForm({ ...form, investigation_purpose: e.target.value })}
              required
              rows={3}
              placeholder="Describe the purpose and scope of this investigation (min 10 chars)"
              className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white placeholder:text-[hsl(215,20.2%,30%)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm resize-none"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-[hsl(217.2,32.6%,25%)] text-[hsl(215,20.2%,60%)] hover:text-white hover:border-[hsl(217.2,32.6%,35%)] rounded-lg py-2.5 text-sm font-medium transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-all">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDeleteCase = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Are you sure you want to delete case "${name}"? This will permanently delete all associated evidence and commitments.`)) return
    setDeletingId(id)
    try {
      await casesApi.delete(id)
      setCases(prev => prev.filter(c => c.id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete case')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    casesApi.list()
      .then(setCases)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <ListSkeleton rows={4} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cases</h1>
          <p className="text-[hsl(215,20.2%,50%)] text-sm mt-0.5">{cases.length} investigation case{cases.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          id="create-case-btn"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#00a87d] hover:bg-[#00926c] text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Case
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />{error}
        </div>
      )}

      {cases.length === 0 ? (
        <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-12 text-center">
          <Briefcase className="w-12 h-12 text-[hsl(215,20.2%,30%)] mx-auto mb-3" />
          <p className="text-[hsl(215,20.2%,50%)] font-medium">No cases yet</p>
          <p className="text-[hsl(215,20.2%,35%)] text-sm mt-1">Create your first investigation case to get started</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors">
            Create First Case
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {cases.map((c) => {
            const StatusIcon = STATUS_ICONS[c.status as keyof typeof STATUS_ICONS] || FolderOpen
            return (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="group bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] hover:border-[hsl(217.2,32.6%,30%)] rounded-xl p-5 flex items-center justify-between transition-all hover:bg-[hsl(222.2,50%,9%)]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <StatusIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{c.case_name}</span>
                      <Badge status={c.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[hsl(215,20.2%,45%)] text-xs font-mono">{c.case_number}</span>
                      <span className="text-[hsl(215,20.2%,35%)] text-xs">·</span>
                      <span className="text-[hsl(215,20.2%,45%)] text-xs">{c.evidence_count} evidence items</span>
                      {c.sensitive_count > 0 && (
                        <><span className="text-[hsl(215,20.2%,35%)] text-xs">·</span>
                        <span className="text-rose-400 text-xs">{c.sensitive_count} sensitive</span></>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-[hsl(215,20.2%,40%)] text-xs">Created</p>
                    <p className="text-[hsl(215,20.2%,55%)] text-xs">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteCase(e, c.id, c.case_name)}
                    disabled={deletingId === c.id}
                    title="Delete Case"
                    className="p-2 text-[hsl(215,20.2%,40%)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin text-red-400" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                  <ChevronRight className="w-4 h-4 text-[hsl(215,20.2%,40%)] group-hover:text-white transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateCaseModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => { setCases([c, ...cases]); setShowCreate(false) }}
        />
      )}
    </div>
  )
}
