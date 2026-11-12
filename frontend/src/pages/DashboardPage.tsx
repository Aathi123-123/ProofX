import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardSkeleton } from '../components/Skeleton'
import { dashboardApi } from '../services/api'
import type { DashboardStats } from '../types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Briefcase, FileSearch, ShieldAlert, Share2, CheckCircle2, Link2, TrendingUp, AlertTriangle, Clock,
  Upload, GitBranch, XCircle, KeyRound, UserCheck, FileText, ArrowRight, ShieldX, Plus
} from 'lucide-react'

const SENSITIVITY_COLORS: Record<string, string> = {
  PUBLIC: '#22c55e',
  LOW: '#84cc16',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
}

function StatCard({ icon: Icon, label, value, sub, color, href }: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  color: string
  href?: string
}) {
      const content = (
      <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-5 flex items-start gap-4 hover:border-[hsl(217.2,32.6%,25%)] transition-all group h-full">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[hsl(215,20.2%,50%)] font-medium uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
            {sub && <p className="text-xs text-[hsl(215,20.2%,45%)] mt-0.5 truncate">{sub}</p>}
          </div>
        </div>
        )

        if (href) {
    return <Link to={href} className="block">{content}</Link>
  }
        return content
}

        const EVENT_CONFIG: Record<string, {icon: React.ElementType; color: string }> = {
          CASE_CREATED: {icon: Briefcase, color: 'text-blue-400 bg-blue-500/10' },
        EVIDENCE_ACQUIRED: {icon: Upload, color: 'text-sky-400 bg-sky-500/10' },
        HASH_CALCULATED: {icon: CheckCircle2, color: 'text-teal-400 bg-teal-500/10' },
        PII_DETECTED: {icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10' },
        CLASSIFICATION_OVERRIDDEN: {icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/10' },
        MERKLE_CREATED: {icon: GitBranch, color: 'text-emerald-400 bg-emerald-500/10' },
        BLOCKCHAIN_COMMITTED: {icon: Link2, color: 'text-amber-400 bg-amber-500/10' },
        DISCLOSURE_REQUESTED: {icon: Share2, color: 'text-teal-400 bg-teal-500/10' },
        DISCLOSURE_APPROVED: {icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10' },
        DISCLOSURE_DENIED: {icon: XCircle, color: 'text-rose-400 bg-rose-500/10' },
        VERIFICATION_PASSED: {icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10' },
        VERIFICATION_FAILED: {icon: XCircle, color: 'text-rose-400 bg-rose-500/10' },
        USER_LOGIN: {icon: KeyRound, color: 'text-slate-400 bg-slate-500/10' },
        USER_CREATED: {icon: UserCheck, color: 'text-slate-400 bg-slate-500/10' },
}

        export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
        const [loading, setLoading] = useState(true)
        const [error, setError] = useState('')

  useEffect(() => {
          dashboardApi.stats()
            .then(setStats)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
        }, [])

        if (loading) return <DashboardSkeleton />

        if (error) {
    return (
        <div className="flex items-center gap-3 bg-red-950/50 border border-red-800 rounded-xl p-6 text-red-400">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <div>
            <p className="font-semibold">Failed to load dashboard</p>
            <p className="text-sm mt-0.5 text-red-500">{error}</p>
          </div>
        </div>
        )
  }

        if (!stats) return null

  const sensitivityData = Object.entries(stats.evidence_by_sensitivity).map(([name, value]) => ({name, value}))
        const typeData = Object.entries(stats.evidence_by_type)
    .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
    .map(([name, value]) => ({name: name.split('/').pop() || name, value }))

        const successRate = stats.total_verifications
        ? Math.round(((stats.total_verifications - stats.failed_verifications) / stats.total_verifications) * 100)
        : 0

        return (
        <div className="space-y-6">
            {/* Header with Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-[hsl(215,20.2%,50%)] text-sm mt-0.5">Real-time digital forensics platform overview</p>
              </div>
              <div className="flex items-center gap-2.5">
                <Link
                  to="/cases"
                  className="flex items-center gap-1.5 bg-[#00a87d] hover:bg-[#00926c] text-white font-semibold text-xs px-3 py-2 rounded-lg transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Case
                </Link>
                <Link
                  to="/verification"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-3 py-2 rounded-lg transition-colors shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verify Artifact
                </Link>
                <Link
                  to="/reports"
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs px-3 py-2 rounded-lg transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Reports
                </Link>
              </div>
            </div>

            {/* 8 Metric Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Briefcase} label="Total Cases" value={stats.total_cases} sub={`${stats.open_cases} open`} color="bg-blue-600" href="/cases" />
              <StatCard icon={FileSearch} label="Evidence Items" value={stats.total_evidence} sub={`${stats.sensitive_evidence} sensitive`} color="bg-slate-700" href="/evidence" />
              <StatCard icon={Share2} label="Disclosures" value={stats.total_disclosures} sub="authorized requests" color="bg-emerald-600" href="/disclosures" />
              <StatCard icon={Link2} label="On-Chain" value={stats.blockchain_commitments} sub="commitments" color="bg-amber-600" href="/commitments" />
              <StatCard icon={CheckCircle2} label="Verifications" value={stats.total_verifications} sub={`${stats.failed_verifications} failed`} color="bg-teal-600" href="/verification" />
              <StatCard icon={TrendingUp} label="Success Rate" value={`${successRate}%`} sub="pass rate" color="bg-slate-700" />
              <StatCard icon={ShieldAlert} label="Sensitive Evidence" value={stats.sensitive_evidence} sub="HIGH + CRITICAL" color="bg-rose-600" href="/privacy-analysis" />
              <StatCard icon={FileSearch} label="Open Cases" value={stats.open_cases} sub={`of ${stats.total_cases} total`} color="bg-sky-600" href="/cases" />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sensitivity distribution */}
              <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[hsl(215,20.2%,70%)] uppercase tracking-wider">Evidence by Sensitivity</h2>
                  <Link to="/privacy-analysis" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium">
                    Inspect PII <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                {sensitivityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={sensitivityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {sensitivityData.map((entry) => (
                          <Cell key={entry.name} fill={SENSITIVITY_COLORS[entry.name] || '#6b7280'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'hsl(222.2,50%,8%)', border: '1px solid hsl(217.2,32.6%,20%)', borderRadius: 8, color: 'white' }}
                        formatter={(v, name) => [v, name]}
                      />
                      <Legend formatter={(v) => <span style={{ color: 'hsl(215,20.2%,65%)' }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-[hsl(215,20.2%,40%)] text-sm">No evidence uploaded yet</div>
                )}
              </div>

              {/* Evidence by type */}
              <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[hsl(215,20.2%,70%)] uppercase tracking-wider">Evidence by File Type</h2>
                  <Link to="/evidence" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium">
                    View All <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                {typeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={typeData} margin={{ left: -20 }}>
                      <XAxis dataKey="name" tick={{ fill: 'hsl(215,20.2%,50%)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'hsl(215,20.2%,50%)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(222.2,50%,8%)', border: '1px solid hsl(217.2,32.6%,20%)', borderRadius: 8, color: 'white' }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-[hsl(215,20.2%,40%)] text-sm">No evidence uploaded yet</div>
                )}
              </div>
            </div>

                            {/* Bottom Section: Recent Security Alerts & Activity */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Security Alerts */}
                              <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                  <h2 className="text-sm font-semibold text-[hsl(215,20.2%,70%)] uppercase tracking-wider flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-amber-400" /> Recent Security Alerts
                                  </h2>
                                  <Link to="/audit-logs" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                                    Audit Logs &rarr;
                                  </Link>
                                </div>
                                {stats.recent_security_alerts && stats.recent_security_alerts.length > 0 ? (
                                  <div className="space-y-2">
                                    {stats.recent_security_alerts.map((alert) => (
                                      <div key={alert.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-md bg-rose-500/15 text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                                          <ShieldX className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-white">{alert.type.replace(/_/g, ' ')}</p>
                                            <span className="text-[10px] text-slate-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                          </div>
                                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                                            Actor: <span className="text-slate-300">{alert.actor}</span>
                                          </p>
                                        </div>
                                      </div>
              ))}
                                  </div>
                                ) : (
                                  <div className="py-10 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-400/60" />
                                    <span>No critical security or verification alerts detected. All systems operational.</span>
                                  </div>
                                )}
                              </div>

                              {/* Recent Events / Activity */}
                              <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                  <h2 className="text-sm font-semibold text-[hsl(215,20.2%,70%)] uppercase tracking-wider flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Recent Activity
                                  </h2>
                                  <Link to="/audit-logs" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                                    View All &rarr;
                                  </Link>
                                </div>
                                {stats.recent_events.length > 0 ? (
                                  <div className="space-y-2">
                                    {stats.recent_events.slice(0, 6).map((ev) => {
                                      const evCfg = EVENT_CONFIG[ev.type] || { icon: FileText, color: 'text-slate-400 bg-slate-500/10' }
                                      const EvIcon = evCfg.icon
                                      return (
                                        <div key={ev.id} className="flex items-center justify-between py-2 border-b border-[hsl(217.2,32.6%,13%)] last:border-0">
                                          <div className="flex items-center gap-2.5">
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${evCfg.color}`}>
                                              <EvIcon className="w-3 h-3" />
                                            </div>
                                            <div>
                                              <span className="text-white text-xs font-medium">{ev.type.replace(/_/g, ' ')}</span>
                                              <span className="text-[hsl(215,20.2%,50%)] text-[11px] ml-2">by {ev.actor}</span>
                                            </div>
                                          </div>
                                          <span className="text-[hsl(215,20.2%,40%)] text-[11px]">
                                            {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-[hsl(215,20.2%,40%)] text-xs py-10 text-center">No recent activity</p>
                                )}
                              </div>
                            </div>
                          </div>
                          )
}
