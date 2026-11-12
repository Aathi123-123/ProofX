import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { lazy, Suspense, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

// ── Lazy-loaded pages (each becomes its own JS chunk) ──────────────────────────
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CasesPage = lazy(() => import('./pages/CasesPage'))
const CaseDetailPage = lazy(() => import('./pages/CaseDetailPage'))
const EvidencePage = lazy(() => import('./pages/EvidencePage'))
const PrivacyAnalysisPage = lazy(() => import('./pages/PrivacyAnalysisPage'))
const CommitmentsPage = lazy(() => import('./pages/CommitmentsPage'))
const DisclosuresPage = lazy(() => import('./pages/DisclosuresPage'))
const VerificationPage = lazy(() => import('./pages/VerificationPage'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))

// Minimal full-screen loader shown during chunk download (first visit to a page)
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
        <p className="text-[hsl(215,20.2%,40%)] text-xs">Loading…</p>
      </div>
    </div>
  )
}

const ROUTE_TITLES: Record<string, string> = {
  '/login': 'Sign In',
  '/dashboard': 'Dashboard',
  '/cases': 'Cases',
  '/evidence': 'Evidence Management',
  '/privacy-analysis': 'Privacy & Sensitivity Analysis',
  '/commitments': 'Cryptographic Commitments',
  '/disclosures': 'Selective Disclosures',
  '/verification': 'Cryptographic Verification',
  '/audit-logs': 'Audit Logs & Chain of Custody',
  '/reports': 'Forensic Reports',
  '/settings': 'Settings',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms and Conditions',
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const location = useLocation()

  useEffect(() => {
    const path = location.pathname
    let subTitle = ROUTE_TITLES[path]
    if (!subTitle && path.startsWith('/cases/')) {
      subTitle = 'Case Details'
    }
    if (subTitle) {
      document.title = `ProofX | ${subTitle}`
    } else {
      document.title = 'ProofX - Privacy-Preserving Digital Forensics Platform'
    }
  }, [location.pathname])

  if (loading) return <PageLoader />

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:caseId" element={<CaseDetailPage />} />
          <Route path="evidence" element={<EvidencePage />} />
          <Route path="privacy-analysis" element={<PrivacyAnalysisPage />} />
          <Route path="commitments" element={<CommitmentsPage />} />
          <Route path="disclosures" element={<DisclosuresPage />} />
          <Route path="verification" element={<VerificationPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="*" element={
            <div className="flex items-center justify-center h-64">
              <p className="text-[hsl(215,20.2%,45%)] text-lg">404: Page Not Found</p>
            </div>
          } />
        </Route>
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
