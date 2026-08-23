import { useState, useEffect, useCallback } from 'react'
import client, { API_BASE_URL } from '../api/client'
import { useAuth } from '../context/AuthContext'
import StaffGate from '../components/StaffGate'
import { SERVICE_TYPES, DOCUMENT_TYPE_LABELS } from '../config'

const CORRECTION_REASONS = [
  'Address Mismatch across submitted documents',
  'Date of Birth discrepancy between records',
  'Name spelling variation requires clarification',
  'Uploaded document is blurry or unreadable',
  'Missing mandatory supporting document',
  'Expired or invalid document attached',
  'Other / Administrative discrepancy',
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

  async function handleApprove(id) {
    setActionLoading(true)
    setError(null)
    try {
      await client.post(`/api/applications/${id}/approve`, { notes: 'Approved by statutory review.' })
      setActionSuccess(`Application #${id} approved successfully.`)
      setDetailCache((prev) => ({ ...prev, [id]: undefined }))
      setAuditCache((prev) => ({ ...prev, [id]: undefined }))
      await loadApplications()
      const response = await client.get(`/api/applications/${id}`)
      setDetailCache((prev) => ({ ...prev, [id]: response.data }))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to approve application.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(id) {
    if (!window.confirm(`Are you sure you want to reject Application #${id}?`)) return
    setActionLoading(true)
    setError(null)
    try {
      await client.post(`/api/applications/${id}/reject`, { notes: 'Rejected based on eligibility discrepancy.' })
      setActionSuccess(`Application #${id} rejected.`)
      setDetailCache((prev) => ({ ...prev, [id]: undefined }))
      setAuditCache((prev) => ({ ...prev, [id]: undefined }))
      await loadApplications()
      const response = await client.get(`/api/applications/${id}`)
      setDetailCache((prev) => ({ ...prev, [id]: response.data }))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reject application.')
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
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Officer Verification Workbench</h2>
            <p>Review citizen applications, inspect extracted OCR evidence, and authorize official statutory decisions.</p>
          </div>
          <div className="badge badge-info" style={{ padding: '6px 14px', fontSize: 13 }}>
            Reviewing Officer: <strong>{staffUser.name}</strong> ({staffUser.role})
          </div>
        </div>
      </div>

      {error && (
        <div className="status-banner danger">
          <span>⚠️</span>
          <div>{error}</div>
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
              <option value="READY">Ready for Review / Resubmitted</option>
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
          riskBadge = <span className="badge badge-critical">🚨 CRITICAL: Duplicate Risk</span>
        } else if (score < 70) {
          riskBadge = <span className="badge badge-highrisk">⚠️ HIGH RISK: Discrepancies</span>
        } else if (score >= 85) {
          riskBadge = <span className="badge badge-fasttrack">⚡ FAST-TRACK: Ready</span>
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
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>
                  {isAppr ? '✓' : isRej ? '✕' : isNeedsCorr ? '⚠️' : '📄'}
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
                <div style={{ background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--color-info-text)', marginBottom: 16 }}>
                  ℹ️ <strong>Statutory Decision Notice:</strong> Automated OCR metrics and consistency scores provide decision-support assistance. Final administrative decisions rest with the reviewing officer.
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
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.estimated_delay_days} days</div>
                  </div>
                </div>

                {/* Duplicate Flag Alert */}
                {detail.duplicate_suspected && (
                  <div className="status-banner danger" style={{ marginBottom: 16 }}>
                    <span>🚨</span>
                    <div>
                      <strong>Potential Duplicate Application Detected:</strong> System identified a {detail.duplicate_confidence}% match confidence with a previously filed application.
                    </div>
                  </div>
                )}

                {/* Correction details if currently in correction */}
                {isNeedsCorr && (
                  <div className="status-banner warning" style={{ marginBottom: 16 }}>
                    <span>⚠️</span>
                    <div>
                      <strong>Active Correction Request:</strong> {detail.correction_reason}
                      {detail.correction_details && <p style={{ margin: '4px 0 0', fontSize: 13 }}>Notes: {detail.correction_details}</p>}
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
                              {v.status === 'MATCH' && <span className="badge badge-success">✓ MATCH</span>}
                              {v.status === 'LIKELY_MATCH' && <span className="badge badge-success">✓ LIKELY MATCH</span>}
                              {v.status === 'UNCERTAIN' && <span className="badge badge-warning">⚠️ UNCERTAIN</span>}
                              {v.status === 'MISMATCH' && <span className="badge badge-danger">✗ MISMATCH</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Field Extraction Verification Table */}
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
                          {detail.field_checks.find((c) => c.field === 'name' && c.status === 'fail') ? (
                            <span className="badge badge-warning">⚠️ Name Variation</span>
                          ) : (
                            <span className="badge badge-success">✓ Verified Match</span>
                          )}
                        </td>
                      </tr>

                      {/* Date of Birth Check */}
                      <tr>
                        <td><strong>Date of Birth</strong></td>
                        <td>
                          {detail.extracted_fields?.date_of_birth?.value || (detail.field_checks.find((c) => c.field === 'date_of_birth')?.detail?.includes('Lists') ? detail.field_checks.find((c) => c.field === 'date_of_birth')?.detail : 'Extracted on document')}
                        </td>
                        <td>{detail.average_ocr_confidence || 92}%</td>
                        <td>
                          {detail.field_checks.find((c) => c.field === 'date_of_birth' && c.status === 'fail') ? (
                            <span className="badge badge-danger">✗ DOB Mismatch</span>
                          ) : (
                            <span className="badge badge-success">✓ Verified Match</span>
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
                          {detail.field_checks.find((c) => c.field === 'address' && c.status === 'fail') ? (
                            <span className="badge badge-warning">⚠️ Address Discrepancy</span>
                          ) : (
                            <span className="badge badge-success">✓ Verified Match</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Score Breakdown Reasoning */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Readiness Score Breakdown:</div>
                  <div style={{ background: 'var(--color-surface-hover)', borderRadius: 'var(--radius)', padding: '10px 14px', border: '1px solid var(--color-border)' }}>
                    {detail.score_reasoning.map((reason, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: idx < detail.score_reasoning.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
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

                {/* Missing Documents Alert */}
                {detail.missing_documents && detail.missing_documents.length > 0 && (
                  <div className="status-banner danger" style={{ marginBottom: 16 }}>
                    <span>📄</span>
                    <div>
                      <strong>Missing Mandatory Documents:</strong>{' '}
                      {detail.missing_documents.map((d) => DOCUMENT_TYPE_LABELS[d] || d.replace('_', ' ')).join(', ')}
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
                    className="btn btn-secondary btn-sm"
                    href={`${API_BASE_URL}/api/applications/${app.id}/report.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📄 Official PDF Report
                  </a>

                  {staffUser.role === 'Officer' && (
                    <>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--color-success-solid)' }}
                        onClick={() => handleApprove(app.id)}
                        disabled={actionLoading}
                      >
                        ✓ Approve Application
                      </button>

                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--color-warning-solid)' }}
                        onClick={() => {
                          setCorrectionModalAppId(app.id)
                          setSelectedReason(CORRECTION_REASONS[0])
                          setCorrectionNotes('')
                        }}
                        disabled={actionLoading}
                      >
                        ⚠️ Request Correction
                      </button>

                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--color-danger-solid)' }}
                        onClick={() => handleReject(app.id)}
                        disabled={actionLoading}
                      >
                        ✕ Reject Application
                      </button>
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

      {/* Request Correction Modal */}
      {correctionModalAppId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>Request Correction for Application #{correctionModalAppId}</h3>
              <button
                onClick={() => setCorrectionModalAppId(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--color-ink-muted)' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
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
                  rows={4}
                  placeholder="Explain exactly what discrepancy needs to be corrected and which replacement document to upload..."
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCorrectionModalAppId(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmitCorrection} disabled={actionLoading}>
                {actionLoading ? 'Sending…' : 'Send Correction Notice'}
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
