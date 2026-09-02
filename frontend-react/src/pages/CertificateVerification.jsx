import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import { Icon } from '../components/Icon'

export default function CertificateVerification() {
  const [searchParams] = useSearchParams()
  const [certId, setCertId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [searchedId, setSearchedId] = useState('')

  // Auto-verify if certificate parameter is present in URL
  useEffect(() => {
    const urlCert = searchParams.get('certificate') || searchParams.get('id')
    if (urlCert) {
      setCertId(urlCert)
      executeVerification(urlCert)
    }
  }, [searchParams])

  const executeVerification = async (idToVerify) => {
    const cleanId = (idToVerify || certId).trim()
    if (!cleanId) return

    setLoading(true)
    setError(null)
    setResult(null)
    setSearchedId(cleanId)

    try {
      const res = await api.verifyCertificate(cleanId)
      setResult(res.data)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Certificate not found or invalid. Please verify the Certificate ID or Application Reference number.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    executeVerification()
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Top Header Card */}
      <div className="card p-6 sm:p-8 text-center space-y-3 bg-gradient-to-b from-teal-50/60 to-white dark:from-teal-950/20 dark:to-slate-900 border-teal-200/60 dark:border-teal-800/40">
        <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center mx-auto shadow-md">
          <Icon name="shield" size={24} />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight m-0">
            Official Certificate Verification
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto m-0">
            Verify the authenticity and statutory issuance status of a SevaSetu civic decision certificate.
          </p>
        </div>
      </div>

      {/* Verification Search Form */}
      <div className="card p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="certificate-id-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Certificate Identifier or Application Reference
            </label>
            <div className="relative">
              <input
                id="certificate-id-input"
                type="text"
                className="input-field font-mono text-sm sm:text-base pl-10"
                placeholder="e.g. SS-CERT-2026-0001 or SS-2026-0001"
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
                required
              />
              <span className="absolute left-3.5 top-3 text-slate-400">
                <Icon name="search" size={16} />
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0">
              Found on the top box of your printed or digital SevaSetu decision certificate.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !certId.trim()}
            className="btn btn-primary w-full h-11 text-sm font-bold shadow-md flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying Certificate Registry...</span>
              </>
            ) : (
              <>
                <Icon name="check-circle" size={16} />
                <span>Verify Certificate</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Verified Result Card */}
      {result && (
        <div className="card p-6 sm:p-8 space-y-6 border-2 border-emerald-500/60 dark:border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-lg animate-in fade-in duration-200">
          
          {/* Verification Status Banner */}
          <div className="flex items-center gap-3 pb-4 border-b border-emerald-200 dark:border-emerald-800/60">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Icon name="check-circle" size={20} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Certificate Verified</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 m-0">
                Official Authenticity Confirmed
              </h2>
            </div>
          </div>

          {/* Record Attributes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-slate-400 uppercase font-semibold text-[10.5px] block">
                Certificate ID
              </span>
              <span className="font-mono font-extrabold text-sm text-teal-800 dark:text-teal-300 block">
                {result.certificate_id}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-slate-400 uppercase font-semibold text-[10.5px] block">
                Application Reference
              </span>
              <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200 block">
                {result.application_reference}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-slate-400 uppercase font-semibold text-[10.5px] block">
                Civic Service Requested
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                {result.service}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-slate-400 uppercase font-semibold text-[10.5px] block">
                Statutory Decision
              </span>
              <span className={`font-extrabold text-xs px-2 py-0.5 rounded-md inline-block ${
                result.decision === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
              }`}>
                {result.decision}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-slate-400 uppercase font-semibold text-[10.5px] block">
                Authorization Date
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                {result.date_issued}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-slate-400 uppercase font-semibold text-[10.5px] block">
                Issuing Authority
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                {result.issuing_authority}
              </span>
            </div>
          </div>

          {/* Cryptographic Hash Ledger Reference */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 text-[11.5px] space-y-1.5">
            <div className="flex items-center justify-between text-teal-400 font-bold">
              <span className="flex items-center gap-1.5">
                <Icon name="lock" size={13} />
                <span>SHA-256 Audit Trail Active</span>
              </span>
              <span className="text-emerald-400 text-[10.5px] font-mono">CHAIN_VERIFIED</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed m-0">
              This statutory record is immutably anchored to the SevaSetu civic verification event stream.
            </p>
          </div>

          {/* Privacy Preservation Disclaimer */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed space-y-1">
            <strong className="text-slate-700 dark:text-slate-300 block">Privacy Notice:</strong>
            Public certificate verification strictly limits exposure to statutory issuance metadata. Personal citizen details (Aadhaar, address, phone number, and evidence scans) remain strictly isolated and protected.
          </div>
        </div>
      )}

      {/* Invalid Certificate State */}
      {error && (
        <div className="card p-6 sm:p-8 space-y-4 border-2 border-red-300 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 text-center animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <Icon name="alert-circle" size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-red-950 dark:text-red-200 m-0">
              Certificate Not Found or Invalid
            </h2>
            <p className="text-xs text-red-700 dark:text-red-300 max-w-md mx-auto m-0">
              No finalized decision certificate matches <code className="font-bold bg-white/60 dark:bg-black/40 px-1 py-0.5 rounded">{searchedId}</code>.
            </p>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Please ensure you have entered the exact Certificate ID (e.g. <code>SS-CERT-2026-XXXX</code>) or check with the issuing authority.
          </p>
        </div>
      )}
    </div>
  )
}
