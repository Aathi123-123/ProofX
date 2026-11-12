import { useEffect, useState } from 'react'
import { authApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Loader2, AlertTriangle, Users, Shield, Mail, Calendar, Plus, X, Eye, EyeOff } from 'lucide-react'
import React from 'react'

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  FORENSIC_EXAMINER: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  INVESTIGATOR: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  VERIFIER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

interface UserRecord {
  id: string; username: string; email: string; full_name: string;
  role: string; is_active: boolean; created_at: string; last_login: string | null
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: UserRecord) => void }) {
  const [form, setForm] = useState({ email: '', username: '', full_name: '', password: '', role: 'INVESTIGATOR' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const u = await authApi.register(form) as UserRecord
      onCreated(u)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[hsl(222.2,50%,7%)] border border-[hsl(217.2,32.6%,20%)] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(217.2,32.6%,17%)]">
          <h2 className="text-lg font-bold text-white">Create User</h2>
          <button onClick={onClose} className="text-[hsl(215,20.2%,50%)] hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-3">
          {[
            { label: 'Full Name', key: 'full_name', type: 'text', placeholder: 'Jane Smith' },
            { label: 'Username', key: 'username', type: 'text', placeholder: 'jsmith' },
            { label: 'Email', key: 'email', type: 'email', placeholder: 'jane@example.com' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1">{label}</label>
              <input type={type} value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder} required
                className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white placeholder:text-[hsl(215,20.2%,30%)] focus:outline-none focus:border-blue-500 transition-all text-sm" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1">Password (min 12 chars)</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Strong password" required minLength={12}
                className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 pr-10 py-2.5 text-white placeholder:text-[hsl(215,20.2%,30%)] focus:outline-none focus:border-blue-500 transition-all text-sm" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(215,20.2%,40%)] hover:text-white transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full bg-[hsl(222.2,40%,6%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-sm">
              {['ADMIN', 'FORENSIC_EXAMINER', 'INVESTIGATOR', 'VERIFIER'].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          {error && <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-[hsl(217.2,32.6%,25%)] text-[hsl(215,20.2%,60%)] hover:text-white rounded-lg py-2.5 text-sm font-medium transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-all shadow-sm">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (isAdmin) {
      authApi.users()
        .then((u) => setUsers(u as UserRecord[]))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-[hsl(215,20.2%,50%)] text-sm mt-0.5">Account and system configuration</p>
      </div>

      {/* Current user card */}
      <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-[hsl(215,20.2%,60%)] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" /> My Account
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Username', value: user?.username, icon: Users },
            { label: 'Email', value: user?.email, icon: Mail },
            { label: 'Role', value: user?.role, icon: Shield },
            { label: 'Member Since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-', icon: Calendar },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-[hsl(222.2,40%,6%)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-[hsl(215,20.2%,45%)]" />
                <p className="text-xs text-[hsl(215,20.2%,45%)]">{label}</p>
              </div>
              <p className="text-sm text-white font-medium truncate">{value || '-'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* User management (admin only) */}
      {isAdmin && (
        <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(217.2,32.6%,13%)]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" /> User Management
              <span className="text-xs text-[hsl(215,20.2%,45%)] font-normal">{users.length} users</span>
            </h2>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-3 py-1.5 text-xs transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add User
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
          ) : error ? (
            <div className="flex items-center gap-2 m-4 bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(217.2,32.6%,13%)]">
                    {['User', 'Email', 'Role', 'Status', 'Last Login'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,20.2%,50%)] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[hsl(217.2,32.6%,10%)] hover:bg-[hsl(222.2,50%,9%)] transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">{u.full_name}</p>
                          <p className="text-[hsl(215,20.2%,45%)] text-xs">@{u.username}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[hsl(215,20.2%,50%)] text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${ROLE_COLORS[u.role] || ''}`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${u.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[hsl(215,20.2%,45%)] text-xs">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(u) => { setUsers([u, ...users]); setShowCreate(false) }}
        />
      )}
    </div>
  )
}
