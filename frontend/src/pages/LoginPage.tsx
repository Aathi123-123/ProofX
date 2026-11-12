import React, { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { ShieldCheck, Lock, User, AlertCircle, Loader2, Mail, UserCircle, KeyRound, Fingerprint, Activity } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../services/api'
import { ProofXIcon } from '../components/ProofXLogo'
import ParticleDrift from '../components/originkit/ui/particle-drift'

type Tab = 'login' | 'register'

const INPUT_CLS =
  'w-full bg-[hsl(222.2,40%,7%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-[hsl(215,20.2%,28%)] focus:outline-none focus:border-[#00a87d] focus:ring-1 focus:ring-[#00a87d]/40 transition-all text-sm'

function Field({
  icon: Icon,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = true,
}: {
  icon: React.ElementType
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={INPUT_CLS}
        />
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { user, login } = useAuth()
  const [tab, setTab] = useState<Tab>('login')

  // Login state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Register state
  const [regForm, setRegForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
    role: 'INVESTIGATOR',
  })
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regSuccess, setRegSuccess] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await login(username, password)
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')
    if (regForm.password !== regForm.confirm) {
      setRegError('Passwords do not match')
      return
    }
    if (regForm.password.length < 12) {
      setRegError('Password must be at least 12 characters')
      return
    }
    setRegLoading(true)
    try {
      await authApi.register({
        email: regForm.email,
        username: regForm.username,
        full_name: regForm.full_name,
        password: regForm.password,
        role: regForm.role,
      })
      setRegSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      if (msg.includes('403') || msg.includes('administrator')) {
        setRegError('An admin must approve new accounts. Please contact your administrator.')
      } else {
        setRegError(msg)
      }
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] flex relative overflow-hidden">
      {/* ── Interactive particle drift background ── */}
      <div className="absolute inset-0 pointer-events-auto">
        <ParticleDrift
          background="transparent"
          baseColor="#334155"
          accentColor="#00a87d"
          density={200}
          dotSize={4}
          speed={35}
          hover={200}
          linkDistance={200}
          linkThickness={1.2}
        />
      </div>
      {/* Top-right emerald glow */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-[#00a87d]/[0.06] rounded-full blur-[120px] pointer-events-none" />
      {/* Bottom-left blue glow */}
      <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-blue-600/[0.04] rounded-full blur-[100px] pointer-events-none" />

      {/* ── Left panel - brand showcase (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col justify-between p-12 relative z-10">
        {/* Top: Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800/80 border border-slate-700/50 rounded-lg flex items-center justify-center">
            <ProofXIcon size={24} accentColor="#00a87d" baseColor="#ffffff" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-white tracking-tight">Proof</span>
            <span className="text-xl font-bold text-[#00a87d] tracking-tight">X</span>
          </div>
        </div>

        {/* Center: Hero content */}
        <div className="max-w-lg">
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight mb-6">
            Privacy-Preserving
            <br />
            <span className="text-[#00a87d]">Digital Forensics</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-10">
            Verify digital evidence integrity with cryptographic proofs. Selectively disclose forensic data while preserving chain-of-custody guarantees.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4">
            {[
              {
                icon: Fingerprint,
                title: 'Evidence Integrity',
                desc: 'SHA-256 hashing with Merkle tree commitments',
              },
              {
                icon: ShieldCheck,
                title: 'Blockchain Anchoring',
                desc: 'Immutable on-chain commitment records',
              },
              {
                icon: Activity,
                title: 'Selective Disclosure',
                desc: 'Zero-knowledge proofs for partial evidence reveal',
              },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-4 group">
                <div className="w-9 h-9 bg-slate-800/80 border border-slate-700/50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="w-4.5 h-4.5 text-[#00a87d]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{f.title}</p>
                  <p className="text-sm text-slate-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Subtle branding */}
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="w-1.5 h-1.5 bg-[#00a87d] rounded-full" />
          <span>Cryptographically audited evidence platform</span>
        </div>
      </div>

      {/* ── Right panel - auth card ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative z-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo (visible only on small screens) */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-14 h-14 bg-slate-800/80 border border-slate-700/50 rounded-xl flex items-center justify-center mb-3">
              <ProofXIcon size={34} accentColor="#00a87d" baseColor="#ffffff" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white tracking-tight">Proof</span>
              <span className="text-2xl font-bold text-[#00a87d] tracking-tight">X</span>
            </div>
            <p className="text-slate-500 text-xs mt-1">Privacy-Preserving Digital Forensics</p>
          </div>

          {/* Auth card */}
          <div className="bg-[#0a0f1a]/90 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Card header */}
            <div className="px-7 pt-7 pb-0">
              <h2 className="text-lg font-semibold text-white mb-1">
                {tab === 'login' ? 'Sign in to your account' : 'Create an account'}
              </h2>
              <p className="text-sm text-slate-500 mb-5">
                {tab === 'login'
                  ? 'Access evidence management and verification tools'
                  : 'Register for the forensic evidence platform'}
              </p>

              {/* Tabs */}
              <div className="flex border-b border-slate-800">
                {(['login', 'register'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setLoginError(''); setRegError(''); setRegSuccess(false) }}
                    className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-all border-b-2 ${tab === t
                        ? 'text-white border-[#00a87d]'
                        : 'text-slate-500 border-transparent hover:text-slate-300'
                      }`}
                  >
                    {t === 'login' ? 'Sign In' : 'Register'}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-7 py-6">
              {/* ── LOGIN ── */}
              {tab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <Field icon={User} label="Username" value={username} onChange={setUsername} placeholder="admin" />
                  <Field icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••••••" />

                  {loginError && (
                    <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/60 rounded-lg px-3 py-2.5 text-red-400 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {loginError}
                    </div>
                  )}

                  <button
                    id="login-btn"
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-[#00a87d] hover:bg-[#00926c] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#00a87d]/15 text-sm mt-2"
                  >
                    {loginLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</>
                    ) : 'Sign In'}
                  </button>

                  {/* Hint box */}
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-4 py-3 mt-2">
                    <p className="text-xs font-semibold text-slate-400 mb-1.5">Default admin credentials</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Username</span>
                        <code className="text-xs text-[#00a87d] font-mono bg-[#00a87d]/10 px-1.5 py-0.5 rounded">admin</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Password</span>
                        <code className="text-xs text-[#00a87d] font-mono bg-[#00a87d]/10 px-1.5 py-0.5 rounded">CHANGE_ME_STRONG_PASSWORD</code>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* ── REGISTER ── */}
              {tab === 'register' && (
                <>
                  {regSuccess ? (
                    <div className="text-center py-6 space-y-3">
                      <div className="w-14 h-14 bg-emerald-500/15 border border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto">
                        <ShieldCheck className="w-7 h-7 text-emerald-400" />
                      </div>
                      <p className="text-white font-semibold">Account Requested!</p>
                      <p className="text-slate-400 text-sm">
                        Your account has been created. You can now sign in with your credentials.
                      </p>
                      <button
                        onClick={() => { setTab('login'); setUsername(regForm.username) }}
                        className="mt-2 text-[#00a87d] hover:text-emerald-300 text-sm font-medium transition-colors"
                      >
                        Go to Sign In →
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRegister} className="space-y-3">
                      <Field icon={UserCircle} label="Full Name" value={regForm.full_name} onChange={(v) => setRegForm({ ...regForm, full_name: v })} placeholder="Jane Smith" />
                      <Field icon={User} label="Username" value={regForm.username} onChange={(v) => setRegForm({ ...regForm, username: v })} placeholder="jsmith" />
                      <Field icon={Mail} label="Email" type="email" value={regForm.email} onChange={(v) => setRegForm({ ...regForm, email: v })} placeholder="jane@example.com" />

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Role</label>
                        <select
                          value={regForm.role}
                          onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                          className="w-full bg-[hsl(222.2,40%,7%)] border border-[hsl(217.2,32.6%,20%)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#00a87d] focus:ring-1 focus:ring-[#00a87d]/40 transition-all text-sm"
                        >
                          <option value="INVESTIGATOR">Investigator</option>
                          <option value="FORENSIC_EXAMINER">Forensic Examiner</option>
                          <option value="VERIFIER">Verifier</option>
                        </select>
                      </div>

                      <Field icon={Lock} label="Password (min 12 chars)" type="password" value={regForm.password} onChange={(v) => setRegForm({ ...regForm, password: v })} placeholder="••••••••••••" />
                      <Field icon={KeyRound} label="Confirm Password" type="password" value={regForm.confirm} onChange={(v) => setRegForm({ ...regForm, confirm: v })} placeholder="••••••••••••" />

                      {regError && (
                        <div className="flex items-start gap-2 bg-red-950/50 border border-red-800/60 rounded-lg px-3 py-2.5 text-red-400 text-xs">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {regError}
                        </div>
                      )}

                      <button
                        id="register-btn"
                        type="submit"
                        disabled={regLoading}
                        className="w-full bg-[#00a87d] hover:bg-[#00926c] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#00a87d]/15 text-sm mt-1"
                      >
                        {regLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />Creating Account...</>
                        ) : 'Create Account'}
                      </button>

                      <p className="text-center text-xs text-slate-600">
                        Registration requires admin approval if the server restricts it
                      </p>
                    </form>
                  )}
                </>
              )}
            </div>

            <div className="px-7 pb-5 text-center">
              <p className="text-xs text-slate-600">All actions are cryptographically audited and recorded</p>
            </div>
          </div>

          {/* Footer links */}
          <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-600">
            <Link to="/privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
            <span className="text-slate-700">|</span>
            <Link to="/terms" className="hover:text-slate-400 transition-colors">Terms and Conditions</Link>
            <span className="text-slate-700">|</span>
            <span>ProofX v1.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
