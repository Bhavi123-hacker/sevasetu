import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client, { API_BASE_URL } from '../api/client'
import { DOCUMENT_TYPE_LABELS, SERVICE_TYPES } from '../config'
import ApplicationLifecycleView from '../components/ApplicationLifecycleView'
import CitizenApplicationTimeline from '../components/CitizenApplicationTimeline'
import RaiseGrievanceModal from '../components/RaiseGrievanceModal'
import { Icon } from '../components/Icon'

export default function CheckStatus() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [applicationId, setApplicationId] = useState(() => searchParams.get('id') || searchParams.get('application_id') || '')
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)
  const [resubmitSuccess, setResubmitSuccess] = useState(null)
  const [replacementFiles, setReplacementFiles] = useState({})
  const [showGrievanceModal, setShowGrievanceModal] = useState(false)
  const [linkedGrievances, setLinkedGrievances] = useState([])

  useEffect(() => {
    const urlId = searchParams.get('id') || searchParams.get('application_id')
    if (urlId) {
      setApplicationId(urlId)
      fetchDetail(urlId)
    }
  }, [searchParams])

  async function fetchDetail(id) {
    let cleanId = id.trim().toLowerCase()
    if (cleanId.startsWith('ss-2026-')) {
      cleanId = cleanId.replace('ss-2026-', '')
    } else if (cleanId.startsWith('ss-')) {
      cleanId = cleanId.split('-').pop()
    }
    if (!cleanId) return
    setLoading(true)
    setError(null)
    setResubmitSuccess(null)
    try {
      const response = await client.get(`/api/applications/${cleanId}`)
      setDetail(response.data)
      try {
        const grvRes = await client.get(`/api/applications/${cleanId}/grievances`, {
          params: response.data.tracking_token ? { token: response.data.tracking_token } : {},
        })
        setLinkedGrievances(grvRes.data || [])
      } catch {
        setLinkedGrievances([])
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No application found with that ID. Please check the reference ID provided upon submission.')
      } else {
        const errorDetail = err.response?.data?.detail
        setError(errorDetail || 'Could not connect to SevaSetu service.')
      }
      setDetail(null)
      setLinkedGrievances([])
    } finally {
      setLoading(false)
    }
  }

  function handleCheck(event) {
    event.preventDefault()
    fetchDetail(applicationId)
  }

  function handleFileSelection(docType, files) {
    if (files && files[0]) {
      setReplacementFiles((prev) => ({ ...prev, [docType]: files[0] }))
    } else {
      setReplacementFiles((prev) => {
        const next = { ...prev }
        delete next[docType]
        return next
      })
    }
  }

  async function handleResubmit(event) {
    event.preventDefault()
    if (Object.keys(replacementFiles).length === 0) {
      setError('Please attach at least one replacement or corrected document.')
      return
    }

    setResubmitting(true)
    setError(null)
    const formData = new FormData()
    Object.entries(replacementFiles).forEach(([docType, file]) => {
      formData.append(docType, file)
    })

    try {
      await client.post(`/api/applications/${detail.id}/resubmit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setReplacementFiles({})
      setResubmitSuccess('Corrected documents submitted successfully. Verification re-run completed.')
      await fetchDetail(detail.id)
    } catch (err) {
      const detailMsg = err.response?.data?.detail
      setError(detailMsg || 'Failed to resubmit corrected documents.')
    } finally {
      setResubmitting(false)
    }
  }

  const rawStatus = detail ? (detail.status || 'SUBMITTED').toUpperCase() : ''
  const isApproved = rawStatus === 'APPROVED' || rawStatus === 'RESOLVED'
  const isRejected = rawStatus === 'REJECTED'
  const isNeedsCorrection = rawStatus === 'NEEDS_CORRECTION'
  const isResubmitted = rawStatus === 'RESUBMITTED' || rawStatus === 'READY_FOR_REVIEW'
  const isClean = detail && detail.readiness_score >= 85

  let statusLabel = 'Submitted — In Verification Queue'
  let badgeClass = 'badge-info'

  if (isApproved) {
    statusLabel = 'Approved by Officer'
    badgeClass = 'badge-success'
  } else if (isRejected) {
    statusLabel = 'Rejected by Officer'
    badgeClass = 'badge-danger'
  } else if (rawStatus === 'FINAL_OFFICER_REVIEW' || rawStatus === 'INTERVIEW_COMPLETED') {
    statusLabel = 'Interview Completed — Final Officer Review'
    badgeClass = 'badge-info'
  } else if (rawStatus === 'INTERVIEW_IN_PROGRESS') {
    statusLabel = 'Interview In Progress'
    badgeClass = 'badge-info'
  } else if (rawStatus === 'INTERVIEW_ELIGIBLE') {
    statusLabel = 'Document Review Passed — Interview Available'
    badgeClass = 'badge-success'
  } else if (isNeedsCorrection) {
    statusLabel = 'Action Required: Correction Requested'
    badgeClass = 'badge-warning'
  } else if (isResubmitted) {
    statusLabel = 'Awaiting Officer Document Review'
    badgeClass = 'badge-info'
  } else if (isClean) {
    statusLabel = 'Pre-Verified — Awaiting Officer Review'
    badgeClass = 'badge-success'
  }

  const failedChecks = detail ? ((detail.field_checks || detail.field_mismatches || []).filter((c) => c.status === 'fail' || c.status === 'mismatch')) : []
  const serviceName = detail ? (SERVICE_TYPES[detail.service_type]?.label || detail.service_type?.replace('_', ' ').toUpperCase() || '') : ''

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h2>Track Application Status & Lifecycle</h2>
        <p>Look up real-time automated verification, officer review milestones, and resolve correction requests.</p>
      </div>

      <form onSubmit={handleCheck} className="card p-5 max-w-xl">
        <div className="field">
          <label htmlFor="app-id" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
            Application Reference ID
          </label>
          <div className="flex gap-2">
            <input
              id="app-id"
              type="text"
              placeholder="e.g. cf264dfe"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              className="input-field text-xs font-mono lowercase flex-1"
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? (
                <span>Checking…</span>
              ) : (
                <>
                  <Icon name="search" size={14} />
                  <span>Check Status</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="status-banner danger max-w-4xl">
          <Icon name="alert-circle" size={18} />
          <div>{error}</div>
        </div>
      )}

      {resubmitSuccess && (
        <div className="status-banner success max-w-4xl">
          <Icon name="check-circle" size={18} />
          <div>{resubmitSuccess}</div>
        </div>
      )}

      {detail && (
        <div className="card p-6 max-w-4xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Application #{detail.id}</h3>
                <span className={`badge ${badgeClass}`}>{rawStatus}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Citizen: <strong>{detail.citizen_name}</strong> • Service: <strong>{serviceName}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowGrievanceModal(true)}
                className="btn btn-secondary btn-sm"
              >
                <Icon name="message" size={14} />
                <span>Raise Grievance</span>
              </button>
              <a
                href={`${API_BASE_URL}/api/applications/${detail.id}/report.pdf${(searchParams.get('token') || localStorage.getItem('sevasetu_citizen_token') || localStorage.getItem('sevasetu_staff_token')) ? `?token=${searchParams.get('token') || localStorage.getItem('sevasetu_citizen_token') || localStorage.getItem('sevasetu_staff_token')}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <Icon name="download" size={14} />
                <span>Official PDF Report</span>
              </a>
            </div>
          </div>

          {/* Standardized 6-Stage Statutory Lifecycle Tracker */}
          <div>
            <ApplicationLifecycleView
              status={rawStatus}
              applicationId={detail.id}
              trackingToken={detail.tracking_token}
              serviceName={serviceName}
              citizenName={detail.citizen_name}
              readinessScore={detail.readiness_score}
              riskLevel={detail.risk_level}
              correctionReason={detail.correction_reason}
              correctionDetails={detail.correction_details}
              resolvedBy={detail.resolved_by}
              showActionCard={true}
            />
          </div>

          {/* Decision Detail Experience: Approved */}
          {isApproved && (
            <div className="card p-5 border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20">
              <div className="flex items-start gap-3">
                <Icon name="check-circle" size={24} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-300">
                    Application Approved
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    Your civic service application has completed pre-verification, document review, and factual interview consistency verification and has received official approval.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Reference</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200">SS-2026-{detail.id.toUpperCase()}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Certificate ID</div>
                      <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{detail.decision_certificate_id || 'SS-CERT-2026-ISSUED'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Decision Date</div>
                      <div className="text-slate-800 dark:text-slate-200">{detail.resolved_at ? new Date(detail.resolved_at).toLocaleDateString('en-IN') : 'Authorized'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Reviewing Officer</div>
                      <div className="text-slate-800 dark:text-slate-200">{detail.resolved_by || 'Verification Officer'}</div>
                    </div>
                  </div>
                  <a
                    href={`${API_BASE_URL}/api/applications/${detail.id}/certificate.pdf${detail.tracking_token ? `?token=${encodeURIComponent(detail.tracking_token)}` : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm mt-2"
                  >
                    <Icon name="download" size={14} />
                    <span>Download Official Certificate (PDF)</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Decision Detail Experience: Rejected */}
          {isRejected && (
            <div className="card p-5 border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20">
              <div className="flex items-start gap-3">
                <Icon name="alert-circle" size={24} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h4 className="text-base font-bold text-red-900 dark:text-red-300">
                    Application Decision: Rejected
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-red-200 dark:border-red-800 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Decision Date</div>
                      <div className="text-slate-800 dark:text-slate-200">{detail.resolved_at ? new Date(detail.resolved_at).toLocaleDateString('en-IN') : 'Recorded'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Rejection Reason</div>
                      <div className="text-slate-800 dark:text-slate-200 font-medium">{detail.rejection_reason || detail.correction_reason || 'Statutory eligibility criteria not met.'}</div>
                    </div>
                  </div>
                  <a
                    href={`${API_BASE_URL}/api/applications/${detail.id}/decision.pdf${detail.tracking_token ? `?token=${encodeURIComponent(detail.tracking_token)}` : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm mt-2"
                  >
                    <Icon name="download" size={14} />
                    <span>Download Decision Notice (PDF)</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Metric KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{statusLabel}</div>
            </div>
            <div className="card p-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Readiness Score</div>
              <div className={`text-base font-extrabold mt-1 ${isClean ? 'text-emerald-600' : 'text-amber-600'}`}>
                {detail.readiness_score}%
              </div>
            </div>
            <div className="card p-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Turnaround SLA</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                {detail.sla_status === 'OVERDUE' ? 'Extended Examination' : 'Within Normal SLA'}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Est. Completion</div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                {detail.estimated_delay_days || 3} business days
              </div>
            </div>
          </div>

          {/* Citizen Milestone History Timeline */}
          <CitizenApplicationTimeline
            applicationId={detail.id}
            trackingToken={detail.tracking_token}
            currentStatus={rawStatus}
            refreshTrigger={detail.updated_at}
          />

          {/* Action Center: Interview Eligible */}
          {rawStatus === 'INTERVIEW_ELIGIBLE' && (
            <div className="card p-5 border-teal-300 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20">
              <div className="flex items-start gap-3">
                <Icon name="camera" size={24} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <h4 className="text-base font-bold text-teal-900 dark:text-teal-300">
                    Verification Interview Available
                  </h4>
                  <p className="text-xs text-teal-800 dark:text-teal-300 leading-relaxed">
                    An authorized revenue officer has reviewed your documents and approved your application for the optional AI verification interview.
                    You may complete the short spoken/text consistency check now or whenever you are ready.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/verification-interview?application_id=${detail.id}${detail.tracking_token ? `&token=${detail.tracking_token}` : ''}`)}
                    >
                      <Icon name="mic" size={14} />
                      <span>Start Verification Interview →</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => alert('Your application will remain in INTERVIEW_ELIGIBLE status until you choose to start.')}
                    >
                      Do This Later
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Center: Correction Requested */}
          {isNeedsCorrection && (
            <div className="card p-5 border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <Icon name="alert-triangle" size={24} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <h4 className="text-base font-bold text-amber-900 dark:text-amber-300">
                    Action Required: Correct Uploaded Documents
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    {detail.correction_reason || 'An issue was flagged during pre-verification. Please review and attach corrected documents below.'}
                  </p>

                  <form onSubmit={handleResubmit} className="space-y-3 pt-2 border-t border-amber-200 dark:border-amber-800">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Upload Replacement / Corrected Documents:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {['aadhaar', 'ration_card', 'electricity_bill', 'residence_proof', 'birth_certificate'].map((docKey) => (
                        <div key={docKey} className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <label htmlFor={`replace-${docKey}`} className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {DOCUMENT_TYPE_LABELS[docKey] || docKey}
                          </label>
                          <input
                            id={`replace-${docKey}`}
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.pdf"
                            onChange={(e) => handleFileSelection(docKey, e.target.files)}
                            className="text-xs text-slate-500"
                          />
                        </div>
                      ))}
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={resubmitting}>
                      <Icon name="upload" size={14} />
                      <span>{resubmitting ? 'Submitting & Reprocessing…' : 'Submit Corrected Documents'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Missing Documents Warning */}
          {detail.missing_documents && detail.missing_documents.length > 0 && (
            <div className="status-banner danger">
              <Icon name="file-text" size={16} />
              <div>
                <strong>Missing Mandatory Documents:</strong>{' '}
                {detail.missing_documents.map((d) => DOCUMENT_TYPE_LABELS[d] || d.replace('_', ' ')).join(', ')}
              </div>
            </div>
          )}

          {/* Field Checks Breakdown */}
          {failedChecks.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Cross-Document Discrepancies:</div>
              {failedChecks.map((check) => (
                <div className="status-banner warning" key={check.field}>
                  <Icon name="alert-triangle" size={16} />
                  <div>
                    <strong>{check.field.replace('_', ' ').toUpperCase()}:</strong> {check.detail}
                  </div>
                </div>
              ))}
            </div>
          ) : !isNeedsCorrection && (
            <div className="status-banner success">
              <Icon name="check-circle" size={16} />
              <div>All cross-document consistency checks passed with verified coherence.</div>
            </div>
          )}

          {/* Linked Application Grievances */}
          {linkedGrievances.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <Icon name="message" size={14} className="text-teal-600" />
                  <span>Registered Grievances for this Application ({linkedGrievances.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGrievanceModal(true)}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  + Lodge Another
                </button>
              </div>
              <div className="space-y-2">
                {linkedGrievances.map((g) => (
                  <div
                    key={g.id}
                    className="card p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-teal-800 dark:text-teal-300 mr-2">
                        {g.public_reference}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{g.subject}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-info">{g.status}</span>
                      <button
                        type="button"
                        onClick={() => navigate(`/grievances/${g.id}`)}
                        className="btn btn-secondary btn-sm text-[11px]"
                      >
                        View →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Raise Grievance Modal */}
      {detail && (
        <RaiseGrievanceModal
          isOpen={showGrievanceModal}
          onClose={() => setShowGrievanceModal(false)}
          applicationId={detail.id}
          serviceType={detail.service_type}
          onSuccess={() => fetchDetail(detail.id)}
        />
      )}
    </div>
  )
}
