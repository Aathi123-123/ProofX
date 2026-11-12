import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, FileText, Lock, Database, AlertCircle } from 'lucide-react'

export default function PrivacyPage() {
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
            <ShieldCheck className="w-5 h-5 text-[#00a87d]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Privacy Policy</h1>
        </div>
        <p className="text-sm text-slate-400">
          Effective Date: November 10, 2026 | Application Version: ProofX PSDE 1.0
        </p>
      </div>

      {/* Notice Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs leading-relaxed">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Notice to Legal Reviewers:</strong> This privacy policy describes the actual technical data architecture,
          cryptographic commitment engine, and evidence processing workflows of the ProofX digital forensics platform.
          Prior to commercial or jurisdictional deployment, formal review and localized legal adaptation by qualified legal
          counsel is required.
        </p>
      </div>

      {/* Content Sections */}
      <div className="space-y-6 text-sm leading-relaxed">
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-[#00a87d]" />
            1. Evidence Storage and Processing Architecture
          </h2>
          <p>
            ProofX is architected with an offline-first, dual-layer design separating raw forensic evidence storage from
            cryptographic commitments:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-400">
            <li>
              <strong>Off-Chain Local Storage:</strong> All original forensic evidence files, case documents, and extracted
              metadata are stored securely within isolated local or on-premises environments (local SQLite or designated
              PostgreSQL instances). Raw evidence payloads are never uploaded to public cloud providers or distributed blockchains.
            </li>
            <li>
              <strong>Cryptographic Artifact Indexing:</strong> Each uploaded artifact is processed deterministically using
              SHA-256 cryptographic hashing to produce immutable fingerprints and Merkle tree leaves.
            </li>
          </ul>
        </section>

        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-sky-400" />
            2. Authentication and Account Information Handling
          </h2>
          <p>
            The platform maintains strict credential protection and role-based access control (RBAC):
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-400">
            <li>
              <strong>Password Protection:</strong> User passwords are encrypted using industry-standard salted key derivation
              (bcrypt / PBKDF2) and are never logged or stored in plaintext.
            </li>
            <li>
              <strong>Role Scoping:</strong> System capabilities are enforced based on explicit operational roles:
              Administrator, Forensic Examiner, Investigator, and Independent Verifier.
            </li>
            <li>
              <strong>Session Security:</strong> Authenticated sessions utilize signed JWT tokens with enforced expiration
              intervals.
            </li>
          </ul>
        </section>

        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            3. Sensitive Evidence Handling & Automated PII Redaction
          </h2>
          <p>
            ProofX incorporates a deterministic privacy engine designed to balance discovery obligations with individual privacy rights:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-400">
            <li>
              <strong>9-Factor Sensitivity Scoring:</strong> Artifacts are automatically analyzed for sensitive content,
              including Personally Identifiable Information (PII), financial identifiers, credentials, and medical attributes.
            </li>
            <li>
              <strong>Selective Disclosure:</strong> During legal discovery requests, the platform executes programmatic
              field-level redaction, disclosing only authorized and relevant fields while generating mathematical Merkle
              inclusion proofs to verify validity without exposing non-pertinent confidential records.
            </li>
          </ul>
        </section>

        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            4. Blockchain-Related Data Limitations
          </h2>
          <p>
            Users and investigative agencies must understand the technical characteristics of distributed ledger commitments:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-400">
            <li>
              <strong>On-Chain Merkle Roots:</strong> Only 32-byte cryptographic Merkle root hashes and timestamp commitments
              are anchored to the blockchain (Ethereum / Hardhat network). No readable case details or evidence payloads exist on-chain.
            </li>
            <li>
              <strong>Immutability Constraints:</strong> Once anchored to a blockchain ledger, transaction hashes and Merkle root
              commitments cannot be altered, modified, or expunged. While off-chain case records may be deleted or purged locally,
              on-chain commitment transactions remain permanently recorded on the ledger.
            </li>
          </ul>
        </section>

        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-400" />
            5. Retention, Archival, and Deletion Practices
          </h2>
          <p>
            Off-chain evidence records are retained according to organizational retention schedules and court preservation orders.
            Case deletion operations within ProofX purge local SQLite/PostgreSQL entries and filesystem evidence artifacts.
            All audit logs documenting evidence intake, verification attempts, and disclosure decisions are retained in accordance
            with forensic chain-of-custody standards.
          </p>
        </section>

        <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            6. Disclaimers and Operational Boundaries
          </h2>
          <p className="text-slate-400">
            ProofX is provided as an evidentiary verification and selective disclosure platform. The cryptographic verification
            results and privacy scoring generated by the platform do not constitute legal advice. Admissibility of evidence,
            compliance with jurisdictional discovery rules (such as Federal Rules of Civil Procedure or GDPR), and warrant scope
            remain the sole legal responsibility of the deploying organization and qualified counsel.
          </p>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>ProofX Digital Forensics Platform &copy; 2026. All rights reserved.</p>
        <div className="flex gap-4">
          <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms and Conditions</Link>
          <Link to="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
        </div>
      </div>
    </div>
  )
}

