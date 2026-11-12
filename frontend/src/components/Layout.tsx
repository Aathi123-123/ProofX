import { Link, Outlet, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, FileSearch, ShieldAlert, Link2, Share2, ShieldCheck,
  ClipboardList, FileText, Settings, LogOut, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ProofXLogo, ProofXIcon } from './ProofXLogo'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Cases', href: '/cases', icon: Briefcase },
  { name: 'Evidence', href: '/evidence', icon: FileSearch },
  { name: 'Privacy & Analysis', href: '/privacy-analysis', icon: ShieldAlert },
  { name: 'Commitments', href: '/commitments', icon: Link2 },
  { name: 'Disclosures', href: '/disclosures', icon: Share2 },
  { name: 'Verification', href: '/verification', icon: ShieldCheck },
  { name: 'Audit Logs', href: '/audit-logs', icon: ClipboardList },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
  FORENSIC_EXAMINER: 'bg-sky-500/15 text-sky-400 border border-sky-500/20',
  INVESTIGATOR: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  VERIFIER: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
}

export function Layout() {
  const location = useLocation()
  const { user, logout, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(222.2,84%,4.9%)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center animate-pulse">
            <ProofXIcon size={24} baseColor="#ffffff" accentColor="#00a87d" />
          </div>
          <p className="text-[hsl(215,20.2%,45%)] text-sm">Initializing ProofX…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(222.2,84%,4.9%)]">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-60 md:flex-col border-r border-[hsl(217.2,32.6%,13%)] bg-[hsl(222.2,55%,5%)]">
        <div className="flex flex-col flex-grow overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center px-4 h-16 border-b border-[hsl(217.2,32.6%,13%)] flex-shrink-0">
            <Link to="/dashboard" className="flex items-center group transition-transform hover:opacity-90">
              <ProofXLogo iconSize={30} textSize="md" subtitle="Digital Forensics" />
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={classNames(
                    isActive
                      ? 'bg-blue-600/10 text-white border-l-2 border-blue-500'
                      : 'text-[hsl(215,20.2%,55%)] hover:bg-[hsl(217.2,32.6%,13%)] hover:text-white border-l-2 border-transparent',
                    'group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-r-lg transition-all'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={classNames(
                      isActive ? 'text-blue-400' : 'text-[hsl(215,20.2%,45%)] group-hover:text-[hsl(215,20.2%,70%)]',
                      'h-4 w-4 flex-shrink-0 transition-colors'
                    )} />
                    {item.name}
                  </div>
                  {isActive && <ChevronRight className="w-3 h-3 text-blue-400" />}
                </Link>
              )
            })}
          </nav>

          {/* User footer */}
          <div className="flex-shrink-0 border-t border-[hsl(217.2,32.6%,13%)] p-3">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{user.username[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{user.username}</p>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_BADGE[user.role] || ''}`}>
                  {user.role}
                </span>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="text-[hsl(215,20.2%,40%)] hover:text-rose-400 transition-colors flex-shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto flex flex-col justify-between">
          <div className="max-w-7xl w-full mx-auto px-6 py-6 flex-1">
            <Outlet />
          </div>

          {/* Professional Forensic Platform Footer */}
          <footer className="border-t border-[hsl(217.2,32.6%,12%)] bg-[hsl(222.2,55%,4%)] px-6 py-4 mt-8">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[hsl(215,20.2%,45%)]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00a87d] inline-block" />
                <span className="text-slate-300 font-medium">ProofX Platform v1.0</span>
                <span>|</span>
                <span>Offline-First Cryptographic Commitment Engine</span>
              </div>
              <div className="flex items-center gap-4">
                <Link to="/privacy" className="hover:text-slate-200 transition-colors">Privacy Policy</Link>
                <Link to="/terms" className="hover:text-slate-200 transition-colors">Terms and Conditions</Link>
                <Link to="/verification" className="hover:text-slate-200 transition-colors">Verify Artifact</Link>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
