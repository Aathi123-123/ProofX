import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { blockchainApi } from '../services/api'
import { Link2, Shield, RefreshCw, Database } from 'lucide-react'

export default function CommitmentsPage() {
  const [commitments, setCommitments] = useState<any[]>([])
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [comms, bcStatus] = await Promise.all([
        blockchainApi.commitments(100),
        blockchainApi.status(),
      ])
      setCommitments(comms)
      setStatus(bcStatus)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cryptographic &amp; Blockchain Commitments</h1>
          <p className="text-[hsl(215,20.2%,50%)] text-sm mt-0.5">
            Immutable Merkle tree root commitments and on-chain timestamp anchors
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Commitments
        </button>
      </div>

      {/* Blockchain Status Card */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[hsl(222.2,50%,8%)] border border-slate-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status.available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Network Status</p>
              <p className="text-sm font-bold text-white">{status.available ? 'Connected' : 'Unavailable'}</p>
            </div>
          </div>

          <div className="bg-[hsl(222.2,50%,8%)] border border-slate-800 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Network Name</p>
              <p className="text-sm font-bold text-white">{status.network} ({status.chain_id})</p>
            </div>
          </div>

          <div className="bg-[hsl(222.2,50%,8%)] border border-slate-800 rounded-xl p-4 flex items-center gap-3 md:col-span-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-semibold uppercase">Deployed Contract</p>
              <p className="text-xs font-mono font-medium text-slate-300 truncate" title={status.contract_address}>
                {status.contract_address}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Commitments Table */}
      <div className="bg-[hsl(222.2,50%,8%)] border border-[hsl(217.2,32.6%,17.5%)] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Version</th>
                <th className="px-5 py-3.5 font-semibold">Case</th>
                <th className="px-5 py-3.5 font-semibold">Evidence Count</th>
                <th className="px-5 py-3.5 font-semibold">Merkle Root Digest</th>
                <th className="px-5 py-3.5 font-semibold">Blockchain Transaction</th>
                <th className="px-5 py-3.5 font-semibold">Block</th>
                <th className="px-5 py-3.5 font-semibold">Committed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Loading commitments...
                  </td>
                </tr>
              ) : commitments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No Merkle tree commitments recorded yet. Commit evidence in a case to register roots.
                  </td>
                </tr>
              ) : (
                commitments.map((comm) => {
                  const isAnchored = !!comm.tx_hash
                  return (
                    <tr key={comm.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-white">
                        <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          v{comm.dataset_version}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-300">
                        <Link to={`/cases/${comm.case_id}`} className="hover:text-blue-400 font-medium">
                          {comm.case_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                        {comm.evidence_count} items
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-emerald-400">
                        <span title={comm.merkle_root}>
                          {comm.merkle_root.substring(0, 14)}...{comm.merkle_root.substring(comm.merkle_root.length - 10)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs">
                        {isAnchored ? (
                          <span className="text-amber-400" title={comm.tx_hash}>
                            {comm.tx_hash.substring(0, 14)}...{comm.tx_hash.substring(comm.tx_hash.length - 8)}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Pending Anchor</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                        {comm.block_number ? `#${comm.block_number}` : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {new Date(comm.created_at).toLocaleString()}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
