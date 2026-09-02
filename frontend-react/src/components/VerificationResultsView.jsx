import React from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../api/client'
import { DOCUMENT_TYPE_LABELS, SERVICE_TYPES } from '../config'
import ApplicationLifecycleView from './ApplicationLifecycleView'
import { Icon } from './Icon'

export default function VerificationResultsView({
  result,
  onStartNew,
  onResubmit,
  resubmitting = false,
  replacementFiles = {},
  setReplacementFiles = () => {},
  checklist = [],
}) {
  let navigate = null
  try {
    navigate = useNavigate()
  } catch {
    navigate = null
  }

  const goTo = (path) => {
    if (navigate) {
      try {
        navigate(path)
        return
      } catch {}
    }
    window.location.href = path
  }

  if (!result) return null

  const isReady = result.readiness_score >= 80 && result.status !== 'NEEDS_CORRECTION'
  const isWarning = (result.readiness_score >= 50 && result.readiness_score < 80) || result.status === 'NEEDS_CORRECTION'

  const statusLabel = result.status === 'NEEDS_CORRECTION'
    ? 'Correction Required'
    : result.status === 'INTERVIEW_ELIGIBLE'
    ? 'Interview Eligible'
    : isReady
    ? 'Ready for Review'
    : isWarning
    ? 'Needs Attention'
    : 'Action Required'

  const scoreClass = result.status === 'NEEDS_CORRECTION' ? 'score-amber' : isReady ? 'score-green' : isWarning ? 'score-amber' : 'score-red'
  const bannerClass = result.status === 'NEEDS_CORRECTION' ? 'warning' : isReady ? 'success' : isWarning ? 'warning' : 'danger'

  const failedChecks = (result.field_checks || []).filter((c) => c.status === 'fail')
  const mismatches = (result.document_verifications || []).filter((v) => v.status === 'MISMATCH')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h2>Automated Document Pre-Verification Assessment</h2>
        <p>
          Instant algorithmic pre-evaluation of document slot matching, OCR text extraction, demographic consistency, and risk factors.
        </p>
      </div>

      {/* Standardized 6-Stage Application Lifecycle */}
      <ApplicationLifecycleView
        status={result.status || 'READY_FOR_REVIEW'}
        applicationId={result.application_id}
        trackingToken={result.tracking_token}
        serviceName={SERVICE_TYPES[result.service_type]?.label || result.service_type}
        citizenName={result.citizen_name}
        readinessScore={result.readiness_score}
        riskLevel={result.risk_level}
        correctionReason={result.correction_reason}
        correctionDetails={result.correction_details}
        showActionCard={false}
      />

      {/* Visual Hero Score & Status Card */}
      <div className="readiness-hero" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
        <div className="readiness-score-display" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className={`readiness-score ${scoreClass}`} style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>
              {result.readiness_score ?? 0}%
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-muted)', marginTop: 4 }}>
              Readiness Score
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span className={`badge badge-${bannerClass}`} style={{ fontSize: 13, padding: '4px 10px', fontWeight: 700 }}>
                {statusLabel}
              </span>
              <span
                className={`badge ${result.risk_level === 'HIGH' ? 'badge-danger' : result.risk_level === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}
                style={{ fontSize: 12, padding: '4px 8px' }}
              >
                Review Risk: {result.risk_level || 'LOW'}
              </span>
              <span className="badge badge-neutral" style={{ fontSize: 12, padding: '4px 8px' }}>
                OCR Confidence: {result.average_ocr_confidence != null ? `${result.average_ocr_confidence}%` : 'Not determinable'}
              </span>
            </div>

            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
              {SERVICE_TYPES[result.service_type]?.label || result.service_type?.replace(/_/g, ' ').toUpperCase()} for <strong>{result.citizen_name}</strong>
            </p>
          </div>
        </div>

        {/* Quick Metric Bar */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div className="metric-card" style={{ padding: 12, background: 'var(--color-bg-subtle)', borderRadius: 8 }}>
              <div className="metric-label" style={{ fontSize: 11, color: 'var(--color-muted)' }}>Estimated Turnaround</div>
              <div className="metric-value" style={{ fontSize: 16, fontWeight: 700 }}>{result.estimated_delay_days || 3} business days</div>
            </div>
            <div className="metric-card" style={{ padding: 12, background: 'var(--color-bg-subtle)', borderRadius: 8 }}>
              <div className="metric-label" style={{ fontSize: 11, color: 'var(--color-muted)' }}>Application Reference ID</div>
              <div className="metric-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700 }}>
                {result.application_id}
              </div>
            </div>
            <div className="metric-card" style={{ padding: 12, background: 'var(--color-bg-subtle)', borderRadius: 8 }}>
              <div className="metric-label" style={{ fontSize: 11, color: 'var(--color-muted)' }}>Processing State</div>
              <div className="metric-value" style={{ fontSize: 16, fontWeight: 700, color: result.status === 'NEEDS_CORRECTION' ? '#d97706' : '#059669' }}>
                {result.status || 'READY_FOR_REVIEW'}
              </div>
            </div>
          </div>
        </div>

        {result.recommendation && (
          <div className={`status-banner ${bannerClass} flex items-start gap-2.5`} style={{ marginTop: 16, marginBottom: 0, padding: 12, borderRadius: 8 }}>
            <Icon name="check-circle" size={16} className="text-teal-600 shrink-0 mt-0.5" />
            <div style={{ fontSize: 13 }}>
              <strong>Algorithmic Recommendation:</strong> {result.recommendation}
            </div>
          </div>
        )}
      </div>

      {/* Document Authenticity Risk Assessment */}
      {result.authenticity_assessment && (
        <div
          className={`risk-card ${
            result.authenticity_assessment.risk_level === 'HIGH'
              ? 'risk-high'
              : result.authenticity_assessment.risk_level === 'MEDIUM'
              ? 'risk-medium'
              : 'risk-low'
          }`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={18} className="text-teal-700" />
              <h3 className="risk-title" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Document Authenticity Risk Assessment
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="risk-score-label" style={{ fontSize: 12 }}>
                Risk Score: <strong>{result.authenticity_assessment.risk_score}/100</strong>
              </span>
              <span
                className={`badge ${result.authenticity_assessment.risk_level === 'HIGH' ? 'badge-danger' : result.authenticity_assessment.risk_level === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}
                style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px' }}
              >
                {result.authenticity_assessment.risk_level === 'HIGH' ? 'HIGH RISK' : result.authenticity_assessment.risk_level === 'MEDIUM' ? 'MEDIUM RISK' : 'LOW RISK'}
              </span>
            </div>
          </div>

          <div className="risk-body" style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.4 }}>
            <strong>Assessment:</strong> {result.authenticity_assessment.recommendation}
          </div>

          {result.authenticity_assessment.detected_signals && result.authenticity_assessment.detected_signals.length > 0 ? (
            <div className="risk-signals-container" style={{ margin: '8px 0', paddingLeft: 12 }}>
              <div className="risk-signals-header" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Detected Integrity Signals:
              </div>
              <ul className="risk-signals-list" style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
                {result.authenticity_assessment.detected_signals.map((sig, sidx) => (
                  <li key={sidx} style={{ marginBottom: 2 }}>
                    <strong>{sig.name}</strong> ({sig.severity}): {sig.description}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ fontSize: 12, margin: '4px 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="check" size={14} className="text-emerald-600" />
              <span>No abnormal formatting, slot conflicts, or integrity warnings detected.</span>
            </div>
          )}

          <div className="risk-disclaimer text-[11px] pt-1.5 mt-2 flex items-center gap-1.5 text-slate-500">
            <Icon name="shield" size={12} className="text-slate-400 shrink-0" />
            <em>{result.authenticity_assessment.disclaimer}</em>
          </div>
        </div>
      )}

      {/* 1. Document Slot Fulfillment & Classification Matrix */}
      {result.document_verifications && result.document_verifications.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="file-text" size={16} className="text-teal-600" />
              <span>Document Classification & Slot Fulfillment</span>
            </h3>
            <span className="badge badge-neutral" style={{ fontSize: 11 }}>Multi-Signal Positive & Negative Signatures</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {result.document_verifications.map((v, i) => {
              const isMatch = v.status === 'MATCH' || v.status === 'LIKELY_MATCH'
              const isMismatch = v.status === 'MISMATCH'
              const expectedLabel = DOCUMENT_TYPE_LABELS[v.expected_type] || v.expected_type?.replace(/_/g, ' ').toUpperCase()
              const detectedLabel = DOCUMENT_TYPE_LABELS[v.detected_type] || v.detected_type?.replace(/_/g, ' ').toUpperCase()

              return (
                <div
                  key={i}
                  style={{
                    background: isMismatch ? 'var(--color-danger-bg)' : isMatch ? 'var(--color-success-bg)' : 'var(--color-bg-subtle)',
                    border: `1.5px solid ${isMismatch ? 'var(--color-danger-border)' : isMatch ? 'var(--color-success-border)' : 'var(--color-border)'}`,
                    borderRadius: 8,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13, color: isMismatch ? 'var(--color-danger-text)' : isMatch ? 'var(--color-success-text)' : 'var(--color-ink)' }}>
                      {expectedLabel}
                    </strong>
                    <span className={`badge ${isMatch ? 'badge-success' : isMismatch ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 11, fontWeight: 700 }}>
                      {v.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: isMismatch ? 'var(--color-danger-text)' : isMatch ? 'var(--color-success-text)' : 'var(--color-muted)', marginBottom: 4 }}>
                    Detected Type: <strong style={{ color: isMismatch ? 'var(--color-danger-text)' : 'var(--color-ink)' }}>{detectedLabel}</strong>
                  </div>

                  {v.confidence != null && (
                    <div style={{ fontSize: 11, color: isMismatch ? 'var(--color-danger-text)' : isMatch ? 'var(--color-success-text)' : 'var(--color-muted)', opacity: 0.9 }}>
                      Classification Confidence: <strong>{Math.round(v.confidence * 100)}%</strong>
                    </div>
                  )}

                  <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 6, fontStyle: 'italic' }}>
                    Authenticity: Not independently verified (Civic pre-verification)
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 2. Cross-Document Demographic Consistency Checks */}
      {result.field_checks && result.field_checks.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="search" size={16} className="text-teal-600" />
              <span>Cross-Document Demographic Consistency</span>
            </h3>
            <span className="badge badge-neutral" style={{ fontSize: 11 }}>RapidFuzz Normalized Matching</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.field_checks.map((check) => {
              const isPass = check.status === 'pass'
              return (
                <div
                  key={check.field}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 14px',
                    background: isPass ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                    border: `1px solid ${isPass ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                    borderRadius: 8,
                  }}
                >
                  <Icon name={isPass ? 'check' : 'x'} size={16} className={isPass ? 'text-emerald-600 shrink-0 mt-0.5' : 'text-red-600 shrink-0 mt-0.5'} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, textTransform: 'capitalize', color: isPass ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                        {check.field.replace(/_/g, ' ')}
                      </strong>
                      <span className={`badge ${isPass ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 10 }}>
                        {isPass ? 'MATCH' : 'MISMATCH'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: isPass ? 'var(--color-success-text)' : 'var(--color-danger-text)', marginTop: 2, opacity: 0.9 }}>
                      {check.detail}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Missing Documents Warning */}
      {result.missing_documents && result.missing_documents.length > 0 && (
        <div className="alert-card alert-danger" style={{ borderLeft: '4px solid var(--color-danger-solid)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="alert-triangle" size={16} className="text-red-600" />
              <span>Missing Required Documents</span>
            </h3>
            <span className="badge badge-danger" style={{ fontSize: 11 }}>{result.missing_documents.length} Missing</span>
          </div>
          <p style={{ fontSize: 13, margin: '0 0 10px 0' }}>
            The following statutory documents were not attached. Your application cannot be approved until all mandatory slots are provided:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
            {result.missing_documents.map((doc) => (
              <li key={doc}>
                <strong>{DOCUMENT_TYPE_LABELS[doc] || doc.replace(/_/g, ' ').toUpperCase()}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. Score Deductions & Reasoning Ledger */}
      {result.score_reasoning && result.score_reasoning.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="activity" size={16} className="text-teal-600" />
              <span>Readiness Score Calculation & Deductions</span>
            </h3>
            <span className="badge badge-neutral" style={{ fontSize: 11 }}>Audit Trail Ledger</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.score_reasoning.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--color-bg-subtle)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <span>{r.label}</span>
                <strong style={{ color: r.points > 0 ? 'var(--color-success-solid)' : r.points < 0 ? 'var(--color-danger-solid)' : 'var(--color-muted)' }}>
                  {r.points > 0 ? `+${r.points}` : r.points}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Actionable Civic Correction Guide (When in NEEDS_CORRECTION) */}
      {result.status === 'NEEDS_CORRECTION' && (
        <div className="alert-card alert-warning" style={{ padding: 24, border: '2px solid var(--color-warning-solid)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Icon name="alert-triangle" size={24} className="text-amber-600 shrink-0" />
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Statutory Correction Required Before Officer Review
              </h3>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                Follow the 4-part civic guidance below to resubmit valid evidence.
              </div>
            </div>
          </div>

          {/* 4-Part Civic Structure */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-warning-border)', padding: 12, borderRadius: 8 }}>
              <strong style={{ fontSize: 13, color: 'var(--color-warning-text)' }}>1. WHAT IS WRONG:</strong>
              <div style={{ fontSize: 13, color: 'var(--color-ink)', marginTop: 2 }}>
                {result.correction_details || result.recommendation || 'One or more document slots contain an incompatible or unreadable document.'}
              </div>
            </div>

            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-warning-border)', padding: 12, borderRadius: 8 }}>
              <strong style={{ fontSize: 13, color: 'var(--color-warning-text)' }}>2. WHY IT MATTERS:</strong>
              <div style={{ fontSize: 13, color: 'var(--color-ink)', marginTop: 2 }}>
                Statutory regulations require verified authentic identity and address proof to generate legally valid certificates.
              </div>
            </div>

            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-warning-border)', padding: 12, borderRadius: 8 }}>
              <strong style={{ fontSize: 13, color: 'var(--color-warning-text)' }}>3. WHAT TO UPLOAD:</strong>
              <div style={{ fontSize: 13, color: 'var(--color-ink)', marginTop: 2 }}>
                Please attach clear, full-page scans of the exact required statutory document in PDF, PNG, or JPG format.
              </div>
            </div>

            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-warning-border)', padding: 12, borderRadius: 8 }}>
              <strong style={{ fontSize: 13, color: 'var(--color-warning-text)' }}>4. WHAT HAPPENS NEXT:</strong>
              <div style={{ fontSize: 13, color: 'var(--color-ink)', marginTop: 2 }}>
                Once submitted, your replacements will be pre-verified instantly. Upon matching, your application will advance to the Authorized Officer Queue.
              </div>
            </div>
          </div>

          {/* Replacement Document Upload Form */}
          {onResubmit && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 18 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Attach Replacement Documents:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(checklist.length > 0 ? checklist : ['aadhaar', 'income_proof', 'residence_proof']).map((slot) => (
                  <div key={slot} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-bg-subtle)', borderRadius: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{DOCUMENT_TYPE_LABELS[slot] || slot.replace(/_/g, ' ').toUpperCase()}</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          setReplacementFiles({ ...replacementFiles, [slot]: e.target.files[0] })
                        }
                      }}
                      style={{ fontSize: 11 }}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={resubmitting || Object.keys(replacementFiles).length === 0}
                onClick={onResubmit}
                className="btn btn-primary"
                style={{ marginTop: 14, width: '100%', padding: '10px' }}
              >
                {resubmitting ? 'Pre-Verifying Replacement Documents...' : 'Submit Corrected Documents for Pre-Verification'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 6. Officer Gating & Interview Status Notice */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="building" size={16} className="text-teal-600" />
              <span>Official Decision & Interview Status</span>
            </h4>
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              {result.status === 'INTERVIEW_ELIGIBLE' ? (
                <span style={{ color: '#059669', fontWeight: 600 }}>
                  Document Review Passed! Your verification interview is now available.
                </span>
              ) : result.status === 'INTERVIEW_IN_PROGRESS' ? (
                <span style={{ color: '#0d9488', fontWeight: 600 }}>
                  Your verification interview is currently in progress.
                </span>
              ) : result.status === 'READY_FOR_REVIEW' ? (
                <span>
                  Your documents have been submitted to the authorized officer for document review (Awaiting officer document review).
                </span>
              ) : (
                <span>
                  Status: <strong>{result.status}</strong>. Please resolve pending items above.
                </span>
              )}
            </div>
          </div>

          {result.status === 'INTERVIEW_ELIGIBLE' && (
            <button
              className="btn btn-primary"
              onClick={() => goTo(`/verification-interview?app_id=${result.application_id}&token=${result.tracking_token}`)}
              style={{ background: '#0d9488', borderColor: '#0d9488' }}
            >
              🎙️ Start Verification Interview ➔
            </button>
          )}

          {result.status === 'INTERVIEW_IN_PROGRESS' && (
            <button
              className="btn btn-primary"
              onClick={() => goTo(`/verification-interview?app_id=${result.application_id}&token=${result.tracking_token}`)}
              style={{ background: '#0d9488', borderColor: '#0d9488' }}
            >
              🎙️ Continue Interview ➔
            </button>
          )}
        </div>
      </div>

      {/* 7. Action Bar & Deep Links */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          Tracking Token: <code style={{ fontSize: 11, background: 'var(--color-bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>{result.tracking_token?.slice(0, 16)}...</code>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            className="btn btn-secondary btn-sm"
            href={`${API_BASE_URL}/api/applications/${result.application_id}/report.pdf`}
            download
            style={{ fontSize: 12 }}
          >
            📄 Download Official PDF Report
          </a>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => goTo(`/status?app_id=${result.application_id}&token=${result.tracking_token}`)}
            style={{ fontSize: 12 }}
          >
            🔍 Track Live Status
          </button>
          {onStartNew && (
            <button
              className="btn btn-primary btn-sm"
              onClick={onStartNew}
              style={{ fontSize: 12 }}
            >
              + Start New Application
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
