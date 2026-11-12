import { Link } from 'react-router-dom'
import { FileCheck, ArrowLeft, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8 text-slate-300">
      {/* Top back navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Platform
        </Link>
        <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
          Pre-Launch Draft: Pending Legal Review
        </span>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
            <FileCheck className="w-5 h-5 text-[#00a87d]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Terms and Conditions</h1>
        </div>
        <p className="text-sm text-slate-400">
          Last Updated: November 10, 2026 | Document Version: 1.0
        </p>
      </div>

      {/* Notice Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs leading-relaxed">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Notice:</strong> These terms govern the operational use of the ProofX digital evidence commitment and
          verification suite. This draft reflects the current technical architecture and requires final review by the deploying
          institution's legal department before production commissioning.
        </p>
      </div>

      {/* Content Sections */}
      <div className="space-y-6 text-sm leading-relaxed">
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#00a87d]" />
            1. Permitted Use and Authorized Roles
          </h2>
          <p>
            ProofX is licensed for legitimate digital forensics investigations, evidentiary audits, legal discovery compliance,
            and cryptographic integrity verification. Users may only access cases, evidence artifacts, and disclosure tools within
            the boundaries of their assigned organizational role:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-400">
            <li>
              <strong>Administrator:</strong> System user management, audit review, and node configuration.
            </li>
            <li>
              <strong>Forensic Examiner:</strong> Evidence acquisition, artifact ingestion, Merkle dataset compilation, and blockchain anchoring.
            </li>
            <li>
              <strong>Investigator:</strong> Case review, investigative purpose specification, and selective disclosure request generation.
            </li>
            <li>
              <strong>Verifier:</strong> Independent mathematical verification of evidence artifacts against cryptographic commitments.
            </li>
          </ul>
        </section>

        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-sky-400" />
            2. Chain of Custody and Evidence Integrity Responsibilities
          </h2>
          <p>
            The software provides cryptographic tools (SHA-256 leaf hashing, Merkle tree construction, and smart contract anchoring)
            to mathematically demonstrate data integrity. However, the integrity of evidence prior to digital ingestion remains the
            responsibility of the handling forensic examiner. Proper physical and digital chain-of-custody protocols must be maintained
            outside the software environment.
          </p>
        </section>

        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            3. Verification Results and Courtroom Admissibility
          </h2>
          <p>
            ProofX generates deterministic verification certificates based on byte-level hash matches and Merkle inclusion proofs.
            While designed to meet strict evidentiary standards, the software does not guarantee judicial admissibility in any specific
            court, tribunal, or arbitration venue. Admissibility depends on adherence to applicable rules of evidence, examiner qualification,
            and legal procedure.
          </p>
        </section>

        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            4. Limitation of Liability
          </h2>
          <p className="text-slate-400">
            In no event shall the software authors, developers, or contributing entities be liable for any direct, indirect,
            incidental, special, exemplary, or consequential damages (including, but not limited to, loss of evidentiary value,
            data corruption, prosecution outcomes, or business interruption) arising in any way out of the use of this software,
            even if advised of the possibility of such damage.
          </p>
        </section>

        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-slate-400" />
            5. Modifications to Systems and Policies
          </h2>
          <p className="text-slate-400">
            These terms may be revised to reflect changes in cryptographic standards, supported blockchain protocols, or statutory
            requirements. Continued use of the platform after updates indicates operational acceptance of revised terms.
          </p>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>ProofX Digital Forensics Platform &copy; 2026. All rights reserved.</p>
        <div className="flex gap-4">
          <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
          <Link to="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
        </div>
      </div>
    </div>
  )
}

