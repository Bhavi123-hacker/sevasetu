import { useState } from 'react'
import client, { API_BASE_URL } from '../api/client'
import { DOCUMENT_TYPE_LABELS, SERVICE_TYPES } from '../config'

export default function CheckStatus() {
  const [applicationId, setApplicationId] = useState('')
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)
  const [resubmitSuccess, setResubmitSuccess] = useState(null)
  const [replacementFiles, setReplacementFiles] = useState({})

  async function fetchDetail(id) {
    const cleanId = id.trim()
    if (!cleanId) return
    setLoading(true)
    setError(null)
    setResubmitSuccess(null)
    try {
      const response = await client.get(`/api/applications/${cleanId}`)
      setDetail(response.data)
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No application found with that ID. Please check the ID provided upon submission.')
      } else {
        const errorDetail = err.response?.data?.detail
        setError(errorDetail || 'Could not connect to SevaSetu service.')
      }
      setDetail(null)
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
  } else if (isNeedsCorrection) {
    statusLabel = 'Action Required: Correction Requested'
    badgeClass = 'badge-warning'
  } else if (isResubmitted) {
    statusLabel = 'Resubmitted — Awaiting Officer Review'
    badgeClass = 'badge-info'
  } else if (isClean) {
    statusLabel = 'Verified — Fast-Track Queue'
    badgeClass = 'badge-success'
  }

  const failedChecks = detail ? detail.field_checks.filter((c) => c.status === 'fail') : []
  const serviceName = detail ? (SERVICE_TYPES[detail.service_type]?.label || detail.service_type.replace('_', ' ').toUpperCase()) : ''

  return (
    <div>
      <div className="page-header">
        <h2>Track Application Status & Lifecycle</h2>
        <p>Look up real-time automated verification, officer review milestones, and resolve correction requests.</p>
      </div>

      <form onSubmit={handleCheck} className="card" style={{ maxWidth: 640 }}>
        <div className="field">
          <label htmlFor="app-id">Application Reference ID</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              id="app-id"
              type="text"
              placeholder="e.g. cf264dfe"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 16, textTransform: 'lowercase' }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Checking…' : 'Check Status'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="status-banner danger" style={{ maxWidth: 840 }}>
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {resubmitSuccess && (
        <div className="status-banner success" style={{ maxWidth: 840 }}>
          <span>✓</span>
          <div>{resubmitSuccess}</div>
        </div>
      )}

      {detail && (
        <div className="card" style={{ maxWidth: 840 }}>
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>Application #{detail.id}</h3>
                <span className={`badge ${badgeClass}`}>{rawStatus}</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-ink-muted)' }}>
                Citizen: <strong>{detail.citizen_name}</strong> • Service: <strong>{serviceName}</strong>
              </p>
            </div>
            <a
              href={`${API_BASE_URL}/api/applications/${detail.id}/report.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              📄 Official PDF Report
            </a>
          </div>

          {/* 5-Stage Lifecycle Timeline */}
          <div style={{ margin: '24px 0 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ink-muted)', marginBottom: 12 }}>
              Application Lifecycle Milestones
            </div>
            <div className="lifecycle-timeline">
              {/* Connector line */}
              <div className="lifecycle-connector">
                <div
                  className="lifecycle-connector-fill"
                  style={{
                    width: isApproved || isRejected ? '100%'
                      : isNeedsCorrection ? '75%'
                      : isResubmitted ? '75%'
                      : '50%',
                  }}
                />
              </div>

              {/* Stage 1: Submitted */}
              <div className="lifecycle-stage completed">
                <div className="lifecycle-node">✓</div>
                <div className="lifecycle-label">1. Submitted</div>
              </div>

              {/* Stage 2: Processing */}
              <div className="lifecycle-stage completed">
                <div className="lifecycle-node">✓</div>
                <div className="lifecycle-label">2. Processing</div>
              </div>

              {/* Stage 3: Automated Verification */}
              <div className="lifecycle-stage completed">
                <div className="lifecycle-node">✓</div>
                <div className="lifecycle-label">3. Auto Verification</div>
              </div>

              {/* Stage 4: Officer Review */}
              <div className={`lifecycle-stage ${isApproved || isRejected ? 'completed' : isNeedsCorrection ? 'warning' : 'active'}`}>
                <div className="lifecycle-node">
                  {isApproved || isRejected ? '✓' : isNeedsCorrection ? '⚠️' : '4'}
                </div>
                <div className="lifecycle-label">4. Officer Review</div>
              </div>

              {/* Stage 5: Decision */}
              <div className={`lifecycle-stage ${isApproved ? 'completed' : isRejected ? 'danger' : ''}`}>
                <div className="lifecycle-node">
                  {isApproved ? '✓' : isRejected ? '✕' : '5'}
                </div>
                <div className="lifecycle-label">5. Decision</div>
              </div>
            </div>
          </div>

          {/* Metric KPIs */}
          <div className="metric-grid" style={{ marginBottom: 20 }}>
            <div className="metric-card">
              <div className="metric-label">Current Status</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)', marginTop: 4 }}>
                {statusLabel}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Readiness Score</div>
              <div className="metric-value" style={{ color: isClean ? 'var(--color-success-solid)' : 'var(--color-warning-solid)' }}>
                {detail.readiness_score}%
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">OCR Confidence</div>
              <div className="metric-value" style={{ fontSize: 20 }}>
                {detail.average_ocr_confidence || 90}%
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Est. Turnaround</div>
              <div className="metric-value" style={{ fontSize: 20 }}>
                {detail.estimated_delay_days} days
              </div>
            </div>
          </div>

          {/* Action Center: Correction Requested */}
          {isNeedsCorrection && (
            <div style={{ background: 'var(--color-warning-bg)', border: '2px solid var(--color-warning-border)', borderRadius: 'var(--radius)', padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 24 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 6px', color: 'var(--color-warning-text)', fontSize: 16 }}>
                    Correction Requested by Verification Officer
                  </h4>
                  <div style={{ fontSize: 14, color: 'var(--color-ink)', marginBottom: 8 }}>
                    <strong>Reason:</strong> {detail.correction_reason || 'Document Discrepancy'}
                  </div>
                  {detail.correction_details && (
                    <div style={{ background: 'var(--color-surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-warning-border)', fontSize: 13, marginBottom: 14 }}>
                      <strong>Officer Remarks:</strong> {detail.correction_details}
                    </div>
                  )}

                  <form onSubmit={handleResubmit} style={{ marginTop: 14, borderTop: '1px solid var(--color-warning-border)', paddingTop: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: 'var(--color-ink)' }}>
                      Upload Replacement / Corrected Documents:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 14 }}>
                      {['aadhaar', 'ration_card', 'electricity_bill', 'residence_proof', 'birth_certificate'].map((docKey) => (
                        <div key={docKey} style={{ background: 'var(--color-surface)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                          <label htmlFor={`replace-${docKey}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                            {DOCUMENT_TYPE_LABELS[docKey] || docKey}
                          </label>
                          <input
                            id={`replace-${docKey}`}
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.pdf"
                            onChange={(e) => handleFileSelection(docKey, e.target.files)}
                            style={{ fontSize: 12 }}
                          />
                        </div>
                      ))}
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={resubmitting}>
                      {resubmitting ? 'Submitting & Reprocessing…' : '📤 Submit Corrected Documents'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Missing Documents Warning */}
          {detail.missing_documents && detail.missing_documents.length > 0 && (
            <div className="status-banner danger">
              <span>📄</span>
              <div>
                <strong>Missing Mandatory Documents:</strong>{' '}
                {detail.missing_documents.map((d) => DOCUMENT_TYPE_LABELS[d] || d.replace('_', ' ')).join(', ')}
              </div>
            </div>
          )}

          {/* Field Checks Breakdown */}
          {failedChecks.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Cross-Document Discrepancies:</div>
              {failedChecks.map((check) => (
                <div className="status-banner warning" key={check.field}>
                  <span>⚠️</span>
                  <div>
                    <strong>{check.field.replace('_', ' ').toUpperCase()}:</strong> {check.detail}
                  </div>
                </div>
              ))}
            </div>
          ) : !isNeedsCorrection && (
            <div className="status-banner success" style={{ marginTop: 16 }}>
              <span>✓</span>
              <div>All cross-document consistency checks passed with verified coherence.</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
