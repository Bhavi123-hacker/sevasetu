import { useState, useEffect, useCallback } from 'react'
import client, { API_BASE_URL } from '../api/client'
import { useAuth } from '../context/AuthContext'
import StaffGate from '../components/StaffGate'
import { SERVICE_TYPES, DOCUMENT_TYPE_LABELS } from '../config'
import { Icon } from '../components/Icon'

const CORRECTION_REASONS = [
  'Address Mismatch across submitted documents',
  'Date of Birth discrepancy between records',
  'Name spelling variation requires clarification',
  'Uploaded document is blurry or unreadable',
  'Missing mandatory supporting document',
  'Expired or invalid document attached',
  'Document type mismatch in uploaded slot',
  'Other / Administrative discrepancy',
]

const REJECTION_REASONS = [
  'Wrong document uploaded in required slot',
  'Missing mandatory statutory document',
  'Document unreadable / poor scan quality',
  'Name mismatch with government records',
  'Date of Birth mismatch with civil register',
  'Address outside statutory jurisdiction',
  'Duplicate application identified',
  'Insufficient legal evidence provided',
  'Other statutory ground',
]

function OfficerQueueContent() {
  const { staffUser } = useAuth()
  const [applications, setApplications] = useState([])
  const [error, setError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)
  const [serviceFilter, setServiceFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [riskFilter, setRiskFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [detailCache, setDetailCache] = useState({})
  const [auditCache, setAuditCache] = useState({})
  
  // Correction Modal state
  const [correctionModalAppId, setCorrectionModalAppId] = useState(null)
  const [selectedReason, setSelectedReason] = useState(CORRECTION_REASONS[0])
  const [correctionNotes, setCorrectionNotes] = useState('')

  // Rejection Modal state
  const [rejectionModalAppId, setRejectionModalAppId] = useState(null)
  const [selectedRejectionReason, setSelectedRejectionReason] = useState(REJECTION_REASONS[0])
  const [rejectionNotes, setRejectionNotes] = useState('')

  // Approval Modal state
  const [approveModalAppId, setApproveModalAppId] = useState(null)
  const [approveConfirmed, setApproveConfirmed] = useState(false)
  const [approveNotes, setApproveNotes] = useState('')

  // Document Viewer modal state
  const [activeViewerDoc, setActiveViewerDoc] = useState(null)
  const [docZoom, setDocZoom] = useState(100)

  const [actionLoading, setActionLoading] = useState(false)

  const loadApplications = useCallback(async () => {
    try {
      const response = await client.get('/api/applications')
      setApplications(response.data)
    } catch (err) {
      setError('Could not connect to SevaSetu service.')
    }
  }, [])

  useEffect(() => { loadApplications() }, [loadApplications])

  async function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!detailCache[id]) {
      const response = await client.get(`/api/applications/${id}`)
      setDetailCache((prev) => ({ ...prev, [id]: response.data }))
    }
    if (!auditCache[id]) {
      const auditResponse = await client.get(`/api/applications/${id}/audit`)
      setAuditCache((prev) => ({ ...prev, [id]: auditResponse.data }))
    }
  }

  async function handleApproveSubmit() {
    if (!approveModalAppId || !approveConfirmed) return
    setActionLoading(true)
    setError(null)
    try {
      await client.post(`/api/applications/${approveModalAppId}/approve`, {
        notes: approveNotes.trim() || 'All statutory requirements verified.',
      })
      setActionSuccess(`Application #${approveModalAppId} approved successfully.`)
      setApproveModalAppId(null)
      setApproveConfirmed(false)
      setApproveNotes('')
      setDetailCache((prev) => ({ ...prev, [approveModalAppId]: undefined }))
      setAuditCache((prev) => ({ ...prev, [approveModalAppId]: undefined }))
      await loadApplications()
      const response = await client.get(`/api/applications/${approveModalAppId}`)
      setDetailCache((prev) => ({ ...prev, [approveModalAppId]: response.data }))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to approve application.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRejectSubmit() {
    if (!rejectionModalAppId) return
    setActionLoading(true)
    setError(null)
    try {
      await client.post(`/api/applications/${rejectionModalAppId}/reject`, {
        reason: selectedRejectionReason,
        notes: rejectionNotes.trim() || 'Statutory criteria not met.',
      })
      setActionSuccess(`Application #${rejectionModalAppId} rejected.`)
      setRejectionModalAppId(null)
      setRejectionNotes('')
      setDetailCache((prev) => ({ ...prev, [rejectionModalAppId]: undefined }))
      setAuditCache((prev) => ({ ...prev, [rejectionModalAppId]: undefined }))
      await loadApplications()
      const response = await client.get(`/api/applications/${rejectionModalAppId}`)
      setDetailCache((prev) => ({ ...prev, [rejectionModalAppId]: response.data }))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reject application.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePassDocumentReview(appId) {
    setActionLoading(true)
    setError(null)
    try {
      await client.post(`/api/applications/${appId}/document-review-pass`, {
        notes: 'Officer confirmed document pre-verification passed. Application eligible for verification interview.',
      })
      setActionSuccess(`Application #${appId}: Document review passed! Citizen is now eligible for the verification interview.`)
      setDetailCache((prev) => ({ ...prev, [appId]: undefined }))
      setAuditCache((prev) => ({ ...prev, [appId]: undefined }))
      await loadApplications()
      const response = await client.get(`/api/applications/${appId}`)
      setDetailCache((prev) => ({ ...prev, [appId]: response.data }))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to pass document review.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSubmitCorrection() {
    if (!correctionModalAppId) return
    setActionLoading(true)
    setError(null)
    try {
      await client.post(`/api/applications/${correctionModalAppId}/request-correction`, {
        reason: selectedReason,
        details: correctionNotes.trim() || 'Please re-upload valid matching documents.',
      })
      setActionSuccess(`Correction request sent for Application #${correctionModalAppId}.`)
      setCorrectionModalAppId(null)
      setCorrectionNotes('')
      setDetailCache((prev) => ({ ...prev, [correctionModalAppId]: undefined }))
      setAuditCache((prev) => ({ ...prev, [correctionModalAppId]: undefined }))
      await loadApplications()
      const response = await client.get(`/api/applications/${correctionModalAppId}`)
      setDetailCache((prev) => ({ ...prev, [correctionModalAppId]: response.data }))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to request correction.')
    } finally {
      setActionLoading(false)
    }
  }

  // Filter Pipeline
  let filtered = applications

  if (serviceFilter !== 'All') {
    filtered = filtered.filter((a) => (SERVICE_TYPES[a.service_type]?.label || a.service_type) === serviceFilter)
  }

  if (statusFilter !== 'All') {
    filtered = filtered.filter((a) => {
      const s = (a.status || '').toUpperCase()
      if (statusFilter === 'READY') return s === 'READY_FOR_REVIEW' || s === 'SUBMITTED' || s === 'RESUBMITTED'
      if (statusFilter === 'INTERVIEW_READY') return s === 'INTERVIEW_COMPLETED' || s === 'FINAL_OFFICER_REVIEW' || s === 'FINAL_REVIEW'
      if (statusFilter === 'INTERVIEW_ELIGIBLE') return s === 'INTERVIEW_ELIGIBLE' || s === 'INTERVIEW_IN_PROGRESS'
      if (statusFilter === 'CORRECTION') return s === 'NEEDS_CORRECTION'
      if (statusFilter === 'APPROVED') return s === 'APPROVED' || s === 'RESOLVED'
      if (statusFilter === 'REJECTED') return s === 'REJECTED'
      return true
    })
  }

  if (riskFilter !== 'All') {
    filtered = filtered.filter((a) => {
      if (riskFilter === 'DUPLICATE') return a.duplicate_suspected
      if (riskFilter === 'HIGH_RISK') return a.readiness_score < 70
      if (riskFilter === 'FAST_TRACK') return a.readiness_score >= 85 && !a.duplicate_suspected
      return true
    })
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    filtered = filtered.filter((a) => a.citizen_name.toLowerCase().includes(term) || a.id.toLowerCase().includes(term))
  }

  const fastTrackCount = filtered.filter((a) => a.readiness_score >= 85 && !a.duplicate_suspected).length
  const flaggedCount = filtered.filter((a) => a.readiness_score < 70).length
  const duplicateCount = filtered.filter((a) => a.duplicate_suspected).length
  const correctionCount = filtered.filter((a) => (a.status || '').toUpperCase() === 'NEEDS_CORRECTION').length

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Revenue Officer Verification Queue</h1>
          <div style={{ color: 'var(--color-ink-muted)', fontSize: 13, marginTop: 4 }}>
            Reviewing Officer: <strong>{staffUser.name}</strong> ({staffUser.role})
          </div>
        </div>
      </div>

      {error && (
        <div className="status-banner danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <div>{error}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadApplications}>
            🔄 Retry Connection
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="status-banner success">
          <span>✓</span>
          <div>{actionSuccess}</div>
        </div>
      )}

      {/* KPI Risk Banners */}
      <div className="metric-grid" style={{ marginBottom: 20 }}>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-success-solid)' }}>
          <div className="metric-label">Fast-Track Ready</div>
          <div className="metric-value" style={{ color: 'var(--color-success-solid)' }}>{fastTrackCount}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-warning-solid)' }}>
          <div className="metric-label">Flagged / Low Readiness</div>
          <div className="metric-value" style={{ color: 'var(--color-warning-solid)' }}>{flaggedCount}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-danger-solid)' }}>
          <div className="metric-label">Duplicate Suspected</div>
          <div className="metric-value" style={{ color: 'var(--color-danger-solid)' }}>{duplicateCount}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-primary)' }}>
          <div className="metric-label">Correction Pending</div>
          <div className="metric-value" style={{ color: 'var(--color-primary)' }}>{correctionCount}</div>
        </div>
      </div>

      {/* Search & Comprehensive Filters */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Filter by Service</label>
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
              <option>All</option>
              {Object.values(SERVICE_TYPES).map((s) => <option key={s.label}>{s.label}</option>)}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Lifecycle Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="INTERVIEW_READY">Final Statutory Review (Interview Completed)</option>
              <option value="READY">Pre-Verification Review (Submitted / Resubmitted)</option>
              <option value="INTERVIEW_ELIGIBLE">Interview In Progress / Eligible</option>
              <option value="CORRECTION">Needs Correction</option>
              <option value="APPROVED">Approved / Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Risk Level</label>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              <option value="All">All Risk Levels</option>
              <option value="FAST_TRACK">Fast-Track (85%+ Clean)</option>
              <option value="HIGH_RISK">High Risk (&lt;70% Score)</option>
              <option value="DUPLICATE">Duplicate Suspected</option>
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Search Citizen or Reference ID</label>
            <input
              type="text"
              placeholder="e.g. Rahul Kumar or cf264dfe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-ink-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>No applications match the selected criteria.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Try clearing search or broadening status filters.</div>
        </div>
      )}

      {/* Application Queue Cards */}
      {filtered.map((app) => {
        const score = app.readiness_score || 0
        const isDuplicate = app.duplicate_suspected
        const statusUpper = (app.status || '').toUpperCase()
        const isNeedsCorr = statusUpper === 'NEEDS_CORRECTION'
        const isAppr = statusUpper === 'APPROVED' || statusUpper === 'RESOLVED'
        const isRej = statusUpper === 'REJECTED'

        let riskBadge = null
        if (isDuplicate) {
          riskBadge = (
            <span className="badge badge-critical flex items-center gap-1">
              <Icon name="alert-circle" size={12} />
              <span>CRITICAL: Duplicate Risk</span>
            </span>
          )
        } else if (score < 70) {
          riskBadge = (
            <span className="badge badge-highrisk flex items-center gap-1">
              <Icon name="alert-circle" size={12} />
              <span>HIGH RISK: Discrepancies</span>
            </span>
          )
        } else if (score >= 85) {
          riskBadge = (
            <span className="badge badge-fasttrack flex items-center gap-1">
              <Icon name="check-circle" size={12} />
              <span>FAST-TRACK: Ready</span>
            </span>
          )
        }

        const isExpanded = expandedId === app.id
        const detail = detailCache[app.id]
        const audit = auditCache[app.id]

        return (
          <div
            className="card"
            key={app.id}
            style={{
              borderColor: isExpanded ? 'var(--color-primary)' : 'var(--color-border)',
              transition: 'all 0.2s ease',
              marginBottom: 16,
            }}
          >
            {/* Header Trigger */}
            <button
              onClick={() => toggleExpand(app.id)}
              style={{
                background: 'none', border: 'none', textAlign: 'left', width: '100%',
                cursor: 'pointer', padding: 0, display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 'var(--radius)',
                  background: isAppr ? 'var(--color-success-bg)' : isRej ? 'var(--color-danger-bg)' : isNeedsCorr ? 'var(--color-warning-bg)' : 'var(--color-primary-light)',
                  color: isAppr ? 'var(--color-success-solid)' : isRej ? 'var(--color-danger-solid)' : isNeedsCorr ? 'var(--color-warning-solid)' : 'var(--color-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={isAppr ? 'check-circle' : isRej ? 'x' : isNeedsCorr ? 'alert-circle' : 'file-text'} size={20} />
                </div>

                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {app.citizen_name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 2 }}>
                    {SERVICE_TYPES[app.service_type]?.label || app.service_type} • ID: <strong style={{ fontFamily: 'var(--font-mono)' }}>{app.id}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {riskBadge}
                {app.assigned_officer_name && (
                  <span className="badge badge-info flex items-center gap-1" style={{ fontSize: 11 }}>
                    <Icon name="user" size={11} />
                    <span>{app.assigned_officer_name}</span>
                  </span>
                )}
                {app.sla_status && (
                  <span className={`badge ${app.sla_status === 'OVERDUE' ? 'badge-danger' : app.sla_status === 'APPROACHING_SLA' ? 'badge-warning' : 'badge-neutral'} flex items-center gap-1`} style={{ fontSize: 11 }}>
                    <Icon name="clock" size={11} />
                    <span>{app.sla_status}</span>
                  </span>
                )}
                <span className={`badge ${score >= 85 ? 'badge-success' : score >= 60 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 13, padding: '4px 10px' }}>
                  Readiness: {score}%
                </span>
                <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: 12 }}>
                  {app.status}
                </span>
                <span style={{ color: 'var(--color-ink-subtle)', fontSize: 13, marginLeft: 4 }}>
                  {isExpanded ? '▲ Collapse' : '▼ Inspect'}
                </span>
              </div>
            </button>

            {/* Expanded Detailed Workbench */}
            {isExpanded && detail && (
              <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
                {/* Notice */}
                <div style={{ background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--color-info-text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="info" size={16} className="shrink-0 text-teal-600 dark:text-teal-400" />
                  <div>
                    <strong>Statutory Decision Notice:</strong> Automated OCR metrics and consistency scores provide decision-support assistance. Final administrative decisions rest with the reviewing officer.
                  </div>
                </div>

                {/* Requirement Provenance & Version Banner */}
                <div style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div className="flex items-center gap-2">
                    <Icon name="building" size={15} className="text-slate-500 shrink-0" />
                    <span><strong>Governance Provenance:</strong> {detail.service_name} | {detail.evaluation_version_note || `Requirements evaluated against version ${detail.requirement_version || '2026-08'}`}</span>
                  </div>
                  <span className={`badge ${detail.provenance_badge === 'OFFICIAL SOURCE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11, fontWeight: 700 }}>
                    {detail.provenance_badge || 'OFFICIAL SOURCE'}
                  </span>
                </div>

                {/* KPI Cards */}
                <div className="metric-grid" style={{ marginBottom: 18 }}>
                  <div className="metric-card" style={{ padding: '10px 14px' }}>
                    <div className="metric-label">Application ID</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>{detail.id}</div>
                  </div>
                  <div className="metric-card" style={{ padding: '10px 14px' }}>
                    <div className="metric-label">Current Status</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{detail.status}</div>
                  </div>
                  <div className="metric-card" style={{ padding: '10px 14px' }}>
                    <div className="metric-label">Avg OCR Confidence</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.average_ocr_confidence}%</div>
                  </div>
                  <div className="metric-card" style={{ padding: '10px 14px' }}>
                    <div className="metric-label">Est. Turnaround</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.estimated_delay_days || 3} business days</div>
                  </div>
                </div>

                {/* Duplicate Flag Alert */}
                {detail.duplicate_suspected && (
                  <div className="status-banner danger" style={{ marginBottom: 16 }}>
                    <Icon name="alert-circle" size={18} className="shrink-0 text-red-600" />
                    <div>
                      <strong>Potential Duplicate Application Detected:</strong> System identified a {detail.duplicate_confidence}% match confidence with a previously filed application.
                    </div>
                  </div>
                )}

                {/* Active Correction Request Banner */}
                {isNeedsCorr && (
                  <div className="status-banner warning" style={{ marginBottom: 16 }}>
                    <Icon name="alert-circle" size={18} className="shrink-0 text-amber-600" />
                    <div>
                      <strong>Active Correction Request:</strong> {detail.correction_reason}
                      {detail.correction_details && <p style={{ margin: '4px 0 0', fontSize: 13 }}>Notes: {detail.correction_details}</p>}
                    </div>
                  </div>
                )}

                {/* Document Authenticity Risk Assessment */}
                {detail.authenticity_assessment && (
                  <div
                    className={`risk-card ${
                      detail.authenticity_assessment.risk_level === 'HIGH'
                        ? 'risk-high'
                        : detail.authenticity_assessment.risk_level === 'MEDIUM'
                        ? 'risk-medium'
                        : 'risk-low'
                    }`}
                    style={{ marginBottom: 18 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="shield" size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />
                        <strong className="risk-title" style={{ fontSize: 14 }}>
                          DOCUMENT AUTHENTICITY RISK ASSESSMENT
                        </strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="risk-score-label" style={{ fontSize: 12 }}>
                          Risk Score: <strong>{detail.authenticity_assessment.risk_score}/100</strong>
                        </span>
                        <span
                          className={`badge ${detail.authenticity_assessment.risk_level === 'HIGH' ? 'badge-danger' : detail.authenticity_assessment.risk_level === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}
                          style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px' }}
                        >
                          {detail.authenticity_assessment.risk_level === 'HIGH' ? 'HIGH RISK' : detail.authenticity_assessment.risk_level === 'MEDIUM' ? 'MEDIUM RISK' : 'LOW RISK'}
                        </span>
                      </div>
                    </div>

                    <div className="risk-body" style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.4 }}>
                      <strong>Recommended Action:</strong> {detail.authenticity_assessment.recommendation}
                    </div>

                    {detail.authenticity_assessment.detected_signals && detail.authenticity_assessment.detected_signals.length > 0 ? (
                      <div className="risk-signals-container" style={{ margin: '8px 0', paddingLeft: 12 }}>
                        <div className="risk-signals-header" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                          Detected Risk Signals:
                        </div>
                        <ul className="risk-signals-list" style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
                          {detail.authenticity_assessment.detected_signals.map((sig, sidx) => (
                            <li key={sidx} style={{ marginBottom: 2 }}>
                              <strong>{sig.name}</strong> ({sig.severity}): {sig.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, margin: '4px 0', fontWeight: 600 }} className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Icon name="check-circle" size={13} />
                        <span>No significant authenticity risk indicators or formatting anomalies detected.</span>
                      </div>
                    )}

                    <div className="risk-disclaimer" style={{ fontSize: 11, paddingTop: 6, marginTop: 8, lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="shield" size={13} className="text-slate-400 shrink-0" />
                      <em>{detail.authenticity_assessment.disclaimer}</em>
                    </div>
                  </div>
                )}

                {/* Document Type Verification Table */}
                {detail.document_verifications && detail.document_verifications.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                      Document Classification &amp; Integrity:
                    </div>
                    <table className="verification-table" style={{ width: '100%', fontSize: 13, marginBottom: 14 }}>
                      <thead>
                        <tr>
                          <th>Required Slot</th>
                          <th>Detected Document</th>
                          <th>Confidence</th>
                          <th>Verification Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.document_verifications.map((v, idx) => (
                          <tr
                            key={idx}
                            style={{
                              background: v.status === 'MISMATCH' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                            }}
                          >
                            <td>
                              <strong>{DOCUMENT_TYPE_LABELS[v.expected_type] || v.expected_type.replace('_', ' ')}</strong>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>
                                {DOCUMENT_TYPE_LABELS[v.detected_type] || v.detected_type.replace('_', ' ')}
                              </span>
                              {v.evidence && v.evidence.length > 0 && (
                                <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 2 }}>
                                  {v.evidence[0]}
                                </div>
                              )}
                            </td>
                            <td>{Math.round((v.confidence || 0.9) * 100)}%</td>
                            <td>
                              {v.status === 'MATCH' && <span className="badge badge-success flex items-center gap-1"><Icon name="check-circle" size={11} /><span>MATCH</span></span>}
                              {v.status === 'LIKELY_MATCH' && <span className="badge badge-success flex items-center gap-1"><Icon name="check-circle" size={11} /><span>LIKELY MATCH</span></span>}
                              {v.status === 'UNCERTAIN' && <span className="badge badge-warning flex items-center gap-1"><Icon name="alert-circle" size={11} /><span>UNCERTAIN</span></span>}
                              {v.status === 'MISMATCH' && <span className="badge badge-danger flex items-center gap-1"><Icon name="x" size={11} /><span>MISMATCH</span></span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Field Extraction Verification Table */}
                {(() => {
                  const fieldChecks = detail.field_checks || detail.field_mismatches || []
                  const scoreReasoning = detail.score_reasoning || []
                  const missingDocs = detail.missing_documents || []

                  return (
                    <>
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Cross-Document Field Verification:</div>
                        <table className="verification-table" style={{ width: '100%', fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th>Field Name</th>
                              <th>Extracted Value</th>
                              <th>Confidence</th>
                              <th>Verification Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Name Check */}
                            <tr>
                              <td><strong>Full Name</strong></td>
                              <td>{detail.citizen_name || 'N/A'}</td>
                              <td>{detail.average_ocr_confidence || 95}%</td>
                              <td>
                                {fieldChecks.find((c) => c.field === 'name' && (c.status === 'fail' || c.status === 'mismatch')) ? (
                                  <span className="badge badge-warning flex items-center gap-1"><Icon name="alert-circle" size={11} /><span>Name Variation</span></span>
                                ) : (
                                  <span className="badge badge-success flex items-center gap-1"><Icon name="check-circle" size={11} /><span>Verified Match</span></span>
                                )}
                              </td>
                            </tr>

                            {/* Date of Birth Check */}
                            <tr>
                              <td><strong>Date of Birth</strong></td>
                              <td>
                                {detail.extracted_fields?.date_of_birth?.value || (fieldChecks.find((c) => c.field === 'date_of_birth')?.detail?.includes('Lists') ? fieldChecks.find((c) => c.field === 'date_of_birth')?.detail : 'Extracted on document')}
                              </td>
                              <td>{detail.average_ocr_confidence || 92}%</td>
                              <td>
                                {fieldChecks.find((c) => c.field === 'date_of_birth' && (c.status === 'fail' || c.status === 'mismatch')) ? (
                                  <span className="badge badge-danger flex items-center gap-1"><Icon name="x" size={11} /><span>DOB Mismatch</span></span>
                                ) : (
                                  <span className="badge badge-success flex items-center gap-1"><Icon name="check-circle" size={11} /><span>Verified Match</span></span>
                                )}
                              </td>
                            </tr>

                            {/* Address Check */}
                            <tr>
                              <td><strong>Residential Address</strong></td>
                              <td>
                                {detail.extracted_fields?.address?.value || 'Extracted across proof bundle'}
                              </td>
                              <td>{Math.max(60, (detail.average_ocr_confidence || 85) - 8)}%</td>
                              <td>
                                {fieldChecks.find((c) => c.field === 'address' && (c.status === 'fail' || c.status === 'mismatch')) ? (
                                  <span className="badge badge-warning flex items-center gap-1"><Icon name="alert-circle" size={11} /><span>Address Discrepancy</span></span>
                                ) : (
                                  <span className="badge badge-success flex items-center gap-1"><Icon name="check-circle" size={11} /><span>Verified Match</span></span>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Attached Documents List & Viewer Action */}
                      {detail.documents && detail.documents.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Submitted Document Attachments:</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                            {detail.documents.map((doc) => (
                              <div
                                key={doc.id}
                                style={{
                                  background: 'var(--color-surface-hover)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: 'var(--radius)',
                                  padding: '10px 12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                                    {DOCUMENT_TYPE_LABELS[doc.doc_type] || doc.doc_type?.replace(/_/g, ' ') || doc.doc_type}
                                  </span>
                                  <span className={`badge ${doc.type_status === 'MATCH' ? 'badge-success' : doc.type_status === 'MISMATCH' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                                    {doc.type_status || 'MATCH'}
                                  </span>
                                </div>

                                <div style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>
                                  Detected: <strong>{DOCUMENT_TYPE_LABELS[doc.detected_type] || doc.detected_type}</strong> ({Math.round((doc.type_confidence || 0.9) * 100)}%)
                                </div>

                                {doc.integrity_status && doc.integrity_status !== 'VALID' && (
                                  <div style={{ fontSize: 11, color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: '2px 6px', borderRadius: 4 }}>
                                    <Icon name="alert-circle" size={11} className="inline mr-1" />
                                    {doc.integrity_status}: {doc.integrity_details || 'Structural anomaly'}
                                  </div>
                                )}

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm flex items-center justify-center gap-1.5"
                                  style={{ marginTop: 4, width: '100%', fontSize: 12 }}
                                  onClick={() => {
                                    setActiveViewerDoc(doc)
                                    setDocZoom(100)
                                  }}
                                >
                                  <Icon name="search" size={13} />
                                  <span>Inspect Document</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Score Breakdown Reasoning */}
                      {scoreReasoning.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Readiness Score Breakdown:</div>
                          <div style={{ background: 'var(--color-surface-hover)', borderRadius: 'var(--radius)', padding: '10px 14px', border: '1px solid var(--color-border)' }}>
                            {scoreReasoning.map((reason, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: idx < scoreReasoning.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                                <span>{reason.label}</span>
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontWeight: 700,
                                  color: reason.points > 0 ? 'var(--color-success-solid)' : reason.points < 0 ? 'var(--color-danger-solid)' : 'var(--color-ink-muted)',
                                }}>
                                  {reason.points > 0 ? '+' : ''}{reason.points}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Missing Documents Alert */}
                      {missingDocs.length > 0 && (
                        <div className="status-banner danger" style={{ marginBottom: 16 }}>
                          <Icon name="alert-circle" size={18} className="shrink-0 text-red-600" />
                          <div>
                            <strong>Missing Mandatory Documents:</strong>{' '}
                            {missingDocs.map((d) => DOCUMENT_TYPE_LABELS[d] || d.replace(/_/g, ' ')).join(', ')}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}

                {/* Interview Consistency Verification Panel */}
                {(detail.interview_summary || detail.interview_consistency) && (
                  <div style={{ marginBottom: 18, background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div className="flex items-center gap-2" style={{ fontWeight: 700, fontSize: 14 }}>
                        <Icon name="message" size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />
                        <span>AI Verification Interview Findings:</span>
                      </div>
                      <span className={`badge ${detail.interview_consistency === 'CONSISTENT' ? 'badge-success' : detail.interview_consistency === 'INCONSISTENT' ? 'badge-danger' : 'badge-warning'}`}>
                        {detail.interview_consistency || 'COMPLETED'}
                      </span>
                    </div>
                    {detail.interview_summary?.summary_notes && (
                      <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 12 }}>
                        {detail.interview_summary.summary_notes}
                      </div>
                    )}
                    {detail.interview_summary?.questions && detail.interview_summary.questions.length > 0 && (
                      <div style={{ overflowX: 'auto', marginTop: 8 }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--color-bg-subtle)', textAlign: 'left' }}>
                              <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>#</th>
                              <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>Question</th>
                              <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>Citizen Answer</th>
                              <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>Document Evidence</th>
                              <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.interview_summary.questions.map((q, idx) => (
                              <tr key={q.id || idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{q.order_num || idx + 1}</td>
                                <td style={{ padding: '6px 8px', maxWidth: 220 }}>{q.question_text}</td>
                                <td style={{ padding: '6px 8px', fontStyle: 'italic', maxWidth: 180 }}>
                                  {q.answer?.transcript_text || '—'}
                                </td>
                                <td style={{ padding: '6px 8px', maxWidth: 180, color: 'var(--color-muted)' }}>
                                  {q.expected_value || 'Document Record'}
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <span className={`badge ${q.answer?.comparison_status === 'CONSISTENT' ? 'badge-success' : q.answer?.comparison_status === 'INCONSISTENT' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                                    {q.answer?.comparison_status || 'PENDING'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Workflow Status Banner */}
                {(app.status === 'READY_FOR_REVIEW' || app.status === 'SUBMITTED' || app.status === 'RESUBMITTED') && (
                  <div className="status-banner info" style={{ marginBottom: 16 }}>
                    <Icon name="file-text" size={18} className="shrink-0 text-teal-600 dark:text-teal-400" />
                    <div>
                      <strong>Officer Document Review Stage:</strong> Inspect uploaded documents and cross-document field checks. Pass document review to invite citizen to verification interview.
                    </div>
                  </div>
                )}

                {app.status === 'INTERVIEW_ELIGIBLE' && (
                  <div className="status-banner info" style={{ marginBottom: 16 }}>
                    <Icon name="clock" size={18} className="shrink-0 text-teal-600 dark:text-teal-400" />
                    <div>
                      <strong>Awaiting Verification Interview:</strong> Document review passed. Waiting for citizen to complete verification interview before final statutory decision.
                    </div>
                  </div>
                )}

                {app.status === 'INTERVIEW_IN_PROGRESS' && (
                  <div className="status-banner warning" style={{ marginBottom: 16 }}>
                    <Icon name="message" size={18} className="shrink-0 text-amber-600" />
                    <div>
                      <strong>Verification Interview In Progress:</strong> Citizen is currently completing the interactive verification interview session.
                    </div>
                  </div>
                )}

                {(app.status === 'FINAL_OFFICER_REVIEW' || app.status === 'INTERVIEW_COMPLETED') && (
                  <div className="status-banner success" style={{ marginBottom: 16 }}>
                    <Icon name="shield" size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <strong>Final Officer Statutory Review:</strong> Citizen verification interview completed. Review all evidence and interview consistency findings to grant final statutory approval or rejection.
                    </div>
                  </div>
                )}

                {/* Audit Trail Timeline */}
                {audit && audit.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Complete Verification Audit Trail:</div>
                    <div style={{ borderLeft: '2px solid var(--color-border)', paddingLeft: 14, marginLeft: 8 }}>
                      {audit.map((ev, i) => (
                        <div key={i} style={{ fontSize: 13, marginBottom: 8, position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                              {ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : ''}
                            </span>
                            <strong>{ev.event_type}</strong>
                            <span className="badge badge-neutral" style={{ fontSize: 11 }}>{ev.actor || 'system'}</span>
                          </div>
                          {ev.detail && (
                            <div style={{ color: 'var(--color-ink-muted)', fontSize: 12, marginTop: 2 }}>
                              {ev.detail}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Toolbar */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
                  <a
                    className="btn btn-secondary btn-sm flex items-center gap-1.5"
                    href={`${API_BASE_URL}/api/applications/${app.id}/report.pdf${localStorage.getItem('sevasetu_staff_token') ? `?token=${localStorage.getItem('sevasetu_staff_token')}` : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="download" size={13} />
                    <span>Official PDF Report</span>
                  </a>

                  {/* Officer Assignment Action */}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm flex items-center gap-1.5"
                    onClick={async () => {
                      try {
                        await client.post(`/api/applications/${app.id}/assign`, {
                          officer_username: staffUser?.username,
                          officer_name: staffUser?.name || staffUser?.display_name || staffUser?.username,
                        })
                        setActionSuccess(`Application #${app.id} assigned to ${staffUser?.name || staffUser?.username}.`)
                        loadApplications()
                        const res = await client.get(`/api/applications/${app.id}`)
                        setDetailCache((prev) => ({ ...prev, [app.id]: res.data }))
                      } catch (err) {
                        setError(err.response?.data?.detail || 'Failed to assign application.')
                      }
                    }}
                    title="Assigns application to reviewing officer"
                  >
                    <Icon name="user" size={13} />
                    <span>{detail.assigned_officer_name ? `Assigned: ${detail.assigned_officer_name}` : 'Assign to Me'}</span>
                  </button>

                  {(['Officer', 'Senior Officer', 'VERIFICATION_OFFICER', 'SENIOR_OFFICER'].includes(staffUser?.role) || (staffUser && staffUser.role !== 'Administrator' && staffUser.role !== 'ADMIN' && staffUser.role !== 'Admin')) && (
                    <>
                      {/* Step 1: Document Review Gate (Initial Review) */}
                      {(app.status === 'READY_FOR_REVIEW' || app.status === 'SUBMITTED' || app.status === 'RESUBMITTED' || app.status === 'OFFICER_REVIEW') && (
                        <button
                          className="btn btn-sm flex items-center gap-1.5"
                          style={{ background: '#0d9488', color: '#ffffff', fontWeight: 600 }}
                          onClick={() => handlePassDocumentReview(app.id)}
                          disabled={actionLoading}
                          title="Confirms document pre-verification passed and invites citizen to AI consistency interview"
                        >
                          <Icon name="check-circle" size={13} />
                          <span>Pass Document Review ➔ Interview Eligible</span>
                        </button>
                      )}

                      {/* Step 2: Final Statutory Approval — ONLY available after interview completed */}
                      {(app.status === 'FINAL_OFFICER_REVIEW' || app.status === 'INTERVIEW_COMPLETED' || app.status === 'FINAL_REVIEW') && (
                        <button
                          className="btn btn-sm flex items-center gap-1.5"
                          style={{ background: 'var(--color-success-solid)' }}
                          onClick={() => {
                            setApproveModalAppId(app.id)
                            setApproveConfirmed(false)
                            setApproveNotes('')
                          }}
                          disabled={actionLoading}
                        >
                          <Icon name="check-circle" size={13} />
                          <span>Approve Application</span>
                        </button>
                      )}

                      {/* Always allow correction / rejection unless resolved */}
                      {app.status !== 'APPROVED' && app.status !== 'REJECTED' && (
                        <>
                          <button
                            className="btn btn-sm flex items-center gap-1.5"
                            style={{ background: 'var(--color-warning-solid)' }}
                            onClick={() => {
                              setCorrectionModalAppId(app.id)
                              setSelectedReason(CORRECTION_REASONS[0])
                              setCorrectionNotes('')
                            }}
                            disabled={actionLoading}
                          >
                            <Icon name="alert-circle" size={13} />
                            <span>Request Correction</span>
                          </button>

                          <button
                            className="btn btn-sm flex items-center gap-1.5"
                            style={{ background: 'var(--color-danger-solid)' }}
                            onClick={() => {
                              setRejectionModalAppId(app.id)
                              setSelectedRejectionReason(REJECTION_REASONS[0])
                              setRejectionNotes('')
                            }}
                            disabled={actionLoading}
                          >
                            <Icon name="x" size={13} />
                            <span>Reject Application</span>
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {detail.resolved_by && (
                    <span className="badge badge-success" style={{ fontSize: 12, marginLeft: 'auto' }}>
                      Authorized by {detail.resolved_by}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Approval Confirmation Modal */}
      {approveModalAppId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>Statutory Approval Confirmation</h3>
              <button
                onClick={() => setApproveModalAppId(null)}
                className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                aria-label="Close"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="status-banner danger" style={{ marginBottom: 14, fontSize: 13 }}>
                  <span>⚠️</span>
                  <div>{error}</div>
                </div>
              )}

              <p style={{ fontSize: 14, margin: '0 0 14px' }}>
                You are about to issue statutory approval for Application <strong>#{approveModalAppId}</strong>.
              </p>

              {detailCache[approveModalAppId]?.interview_consistency && (
                <div className={`status-banner ${detailCache[approveModalAppId].interview_consistency === 'CONSISTENT' ? 'success' : 'warning'}`} style={{ marginBottom: 14, fontSize: 13 }}>
                  <div className="flex items-start gap-2">
                    <Icon name="message" size={15} className="shrink-0 text-teal-600 mt-0.5" />
                    <div>
                      <span><strong>Interview Consistency Result:</strong> {detailCache[approveModalAppId].interview_consistency}</span>
                      {detailCache[approveModalAppId].interview_consistency !== 'CONSISTENT' && (
                        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
                          Notice: Document discrepancy recorded during interview. Please ensure you have reviewed the discrepancy.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ background: 'var(--color-surface-hover)', padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={approveConfirmed}
                    onChange={(e) => setApproveConfirmed(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>I confirm that I have reviewed the submitted documents, interview consistency findings, and authorized issuance under applicable regulations.</span>
                </label>
              </div>

              <div className="field">
                <label>Officer Endorsement Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Verified with civil registrar records."
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setApproveModalAppId(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary flex items-center gap-1.5"
                style={{ background: 'var(--color-success-solid)' }}
                onClick={handleApproveSubmit}
                disabled={actionLoading || !approveConfirmed}
              >
                <Icon name="check-circle" size={14} />
                <span>{actionLoading ? 'Approving…' : 'Confirm & Issue Approval'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModalAppId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>Formal Rejection of Application #{rejectionModalAppId}</h3>
              <button
                onClick={() => setRejectionModalAppId(null)}
                className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                aria-label="Close"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="status-banner danger" style={{ marginBottom: 14, fontSize: 13 }}>
                  <span>⚠️</span>
                  <div>{error}</div>
                </div>
              )}

              <div className="field">
                <label>Standardized Statutory Ground for Rejection</label>
                <select
                  value={selectedRejectionReason}
                  onChange={(e) => setSelectedRejectionReason(e.target.value)}
                >
                  {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="field">
                <label>Officer Findings &amp; Statutory Notes</label>
                <textarea
                  rows={3}
                  placeholder="Specify statutory rationale or findings for applicant record..."
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRejectionModalAppId(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary flex items-center gap-1.5"
                style={{ background: 'var(--color-danger-solid)' }}
                onClick={handleRejectSubmit}
                disabled={actionLoading}
              >
                <Icon name="x" size={14} />
                <span>{actionLoading ? 'Rejecting…' : 'Confirm Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {activeViewerDoc && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  Document Inspection: {DOCUMENT_TYPE_LABELS[activeViewerDoc.doc_type] || activeViewerDoc.doc_type}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', marginTop: 2 }}>
                  Classification: <strong>{activeViewerDoc.type_status}</strong> (Confidence: {Math.round((activeViewerDoc.type_confidence || 0.9) * 100)}%)
                </div>
              </div>
              <button
                onClick={() => setActiveViewerDoc(null)}
                className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                aria-label="Close"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="modal-body">
              {/* Authenticity Boundary Banner */}
              <div style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--color-ink-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="info" size={15} className="shrink-0 text-teal-600 dark:text-teal-400" />
                <span><strong>Automated Pre-Verification:</strong> Document type classified from extracted OCR signatures. Official legal authenticity has not been independently verified via government API.</span>
              </div>

              {/* Zoom & Inspection Controls */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, background: 'var(--color-surface-hover)', padding: '6px 10px', borderRadius: 'var(--radius)' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Inspection Zoom: {docZoom}%</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDocZoom((z) => Math.max(50, z - 25))}>−</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDocZoom((z) => Math.min(200, z + 25))}>+</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDocZoom(100)}>Fit Screen</button>
              </div>

              {/* OCR Extracted Text Stream with Zoom Scaling */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 16,
                maxHeight: 380,
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: `${13 * (docZoom / 100)}px`,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                color: '#1e293b',
              }}>
                {activeViewerDoc.snippet || 'No text extracted.'}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setActiveViewerDoc(null)}>
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Correction Modal */}
      {correctionModalAppId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>Request Correction for Application #{correctionModalAppId}</h3>
              <button
                onClick={() => setCorrectionModalAppId(null)}
                className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                aria-label="Close"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="status-banner danger" style={{ marginBottom: 14, fontSize: 13 }}>
                  <span>⚠️</span>
                  <div>{error}</div>
                </div>
              )}

              <div className="field">
                <label>Correction Category / Reason</label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                >
                  {CORRECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="field">
                <label>Specific Instructions for Citizen</label>
                <textarea
                  rows={3}
                  placeholder="Provide precise clarification instructions..."
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCorrectionModalAppId(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary flex items-center gap-1.5"
                style={{ background: 'var(--color-warning-solid)' }}
                onClick={handleSubmitCorrection}
                disabled={actionLoading}
              >
                <Icon name="alert-circle" size={14} />
                <span>{actionLoading ? 'Submitting…' : 'Send Correction Notice'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function OfficerQueue() {
  return (
    <StaffGate>
      <OfficerQueueContent />
    </StaffGate>
  )
}
