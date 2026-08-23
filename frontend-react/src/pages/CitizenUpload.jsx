import { useState, useEffect } from 'react'
import client from '../api/client'
import { API_BASE_URL } from '../api/client'
import { DEFAULT_SERVICE_CATALOG, DOCUMENT_TYPE_LABELS, SERVICE_TYPES } from '../config'

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf']
const MAX_SIZE_MB = 10

export default function CitizenUpload() {
  const [services, setServices] = useState(DEFAULT_SERVICE_CATALOG)
  const [selectedServiceId, setSelectedServiceId] = useState('income_certificate')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [citizenName, setCitizenName] = useState('')
  const [files, setFiles] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  // Fetch live service catalog on mount
  useEffect(() => {
    client
      .get('/api/services')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setServices(res.data)
        }
      })
      .catch((err) => {
        console.warn('Using default service catalog fallback:', err.message)
      })
  }, [])

  const currentService =
    services.find((s) => s.id === selectedServiceId) || services[0] || DEFAULT_SERVICE_CATALOG[0]

  const categories = ['All', ...new Set(services.map((s) => s.category || 'General'))]

  const filteredServices = services.filter((s) => {
    const matchesCat = selectedCategory === 'All' || s.category === selectedCategory
    const matchesSearch =
      !searchQuery.trim() ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  function handleServiceSelect(serviceId) {
    if (serviceId === selectedServiceId) return
    setSelectedServiceId(serviceId)
    setFiles({})
    setError(null)
  }

  function handleFileChange(docType, fileList) {
    setError(null)
    const file = fileList[0]
    if (!file) {
      setFiles((prev) => ({ ...prev, [docType]: null }))
      return
    }

    const docLabel =
      currentService.required_documents?.find((d) => d.key === docType)?.label ||
      DOCUMENT_TYPE_LABELS[docType] ||
      docType

    // Client-side extension validation
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext) && !file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError(`Invalid file format for ${docLabel}. Supported formats are PDF, PNG, JPG, JPEG, and WEBP.`)
      return
    }

    // Client-side size validation (10MB limit)
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File size for ${docLabel} exceeds the ${MAX_SIZE_MB}MB limit.`)
      return
    }

    setFiles((prev) => ({ ...prev, [docType]: file }))
  }

  function removeFile(docType) {
    setFiles((prev) => ({ ...prev, [docType]: null }))
    const input = document.getElementById(`file-${docType}`)
    if (input) input.value = ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (!citizenName.trim()) {
      setError('Please enter your full name.')
      return
    }

    const attached = Object.values(files).filter(Boolean)
    if (attached.length === 0) {
      setError('Please upload at least one document.')
      return
    }

    const formData = new FormData()
    formData.append('citizen_name', citizenName.trim())
    formData.append('service_type', selectedServiceId)
    for (const [docType, file] of Object.entries(files)) {
      if (file) formData.append(docType, file)
    }

    setLoading(true)
    try {
      const response = await client.post('/api/applications', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(response.data)
    } catch (err) {
      if (err.response) {
        // Backend returned a structured HTTP response (400, 413, 422, 500)
        const detail = err.response.data?.detail
        if (typeof detail === 'string') {
          setError(detail)
        } else if (Array.isArray(detail)) {
          setError(detail.map((d) => d.msg || JSON.stringify(d)).join(', '))
        } else if (err.response.status === 413) {
          setError('Uploaded document exceeds maximum allowed size (10 MB).')
        } else {
          setError(`Server error (${err.response.status}): Failed to process application.`)
        }
      } else if (err.request) {
        // Network connection error / server unreachable
        setError('Could not reach SevaSetu server. Please ensure the backend is running and reachable.')
      } else {
        setError(err.message || 'An unexpected error occurred.')
      }
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setFiles({})
    setCitizenName('')
    setError(null)
  }

  if (result) {
    return <ReadinessResult result={result} onStartNew={reset} />
  }

  const reqDocs = currentService.required_documents || []
  const uploadedCount = reqDocs.filter((d) => files[d.key]).length
  const totalRequired = reqDocs.length

  return (
    <div>
      <div className="page-header">
        <h2>SevaSetu Civic Services Portal</h2>
        <p>
          AI-assisted document verification platform. Select a government service, verify your documents, and check application readiness instantly before officer submission.
        </p>
      </div>

      {/* Step Progress Indicator */}
      <div className="stepper">
        <div className="step-item active">
          <div className="step-badge">1</div>
          <span>Select Civic Service</span>
        </div>
        <div style={{ color: 'var(--color-border)', fontSize: 18 }}>→</div>
        <div className={`step-item ${citizenName.trim() ? 'active' : ''}`}>
          <div className="step-badge">2</div>
          <span>Citizen Information</span>
        </div>
        <div style={{ color: 'var(--color-border)', fontSize: 18 }}>→</div>
        <div className={`step-item ${uploadedCount > 0 ? 'active' : ''}`}>
          <div className="step-badge">3</div>
          <span>Upload Documents ({uploadedCount}/{totalRequired})</span>
        </div>
        <div style={{ color: 'var(--color-border)', fontSize: 18 }}>→</div>
        <div className="step-item">
          <div className="step-badge">4</div>
          <span>Instant Readiness Check</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Civic Service Catalog Selector */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <h3 style={{ margin: 0 }}>1. Select Government Service</h3>
              <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', margin: '4px 0 0' }}>
                Choose the civic service you want to apply for ({services.length} services available)
              </p>
            </div>
            <span className="badge badge-info">Service Catalog</span>
          </div>

          {/* Search & Category Filter */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="🔍 Search services (e.g. Income, Domicile, EWS, Birth, Disability)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 12, padding: '6px 12px' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Service Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filteredServices.map((srv) => {
              const isSelected = srv.id === selectedServiceId
              const docCount = srv.required_documents?.length || 0
              return (
                <div
                  key={srv.id}
                  onClick={() => handleServiceSelect(srv.id)}
                  style={{
                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: isSelected ? 'var(--color-primary-light, #f0f7f6)' : 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
                      {srv.category || 'Service'}
                    </span>
                    {isSelected && <span className="badge badge-success">Selected ✓</span>}
                  </div>
                  <h4 style={{ margin: '6px 0 4px', fontSize: 15, color: isSelected ? 'var(--color-primary)' : 'var(--color-ink)' }}>
                    {srv.name}
                  </h4>
                  <p style={{ fontSize: 12, color: 'var(--color-ink-muted)', margin: '0 0 10px', lineHeight: 1.4 }}>
                    {srv.description}
                  </p>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)' }}>
                    📄 {docCount} required document{docCount !== 1 ? 's' : ''}
                  </div>
                </div>
              )
            })}
            {filteredServices.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: 'var(--color-ink-muted)' }}>
                No services found matching "{searchQuery}".
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Citizen Details */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>2. Applicant Information</h3>
            <span className="badge badge-neutral">Step 2</span>
          </div>

          <div className="field">
            <label htmlFor="citizen-name">Your Full Name (as per government ID)</label>
            <input
              id="citizen-name"
              type="text"
              placeholder="e.g. Rahul Kumar"
              value={citizenName}
              onChange={(e) => setCitizenName(e.target.value)}
            />
          </div>
        </div>

        {/* Step 3: Required Documents Upload */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <h3 style={{ margin: 0 }}>3. Required Documents for {currentService.name}</h3>
              <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', margin: '4px 0 0' }}>
                Accepted formats: <strong>PDF (including multi-page)</strong>, PNG, JPG, JPEG, WEBP. Max 10MB per file.
              </p>
            </div>
            <span className="badge badge-neutral">{uploadedCount} of {totalRequired} Attached</span>
          </div>

          {/* Document Checklist Preview Strip */}
          <div style={{ background: 'var(--color-bg)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--color-ink-muted)' }}>
              DOCUMENT CHECKLIST:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {reqDocs.map((doc) => {
                const hasDoc = Boolean(files[doc.key])
                return (
                  <span
                    key={doc.key}
                    style={{
                      fontSize: 12,
                      color: hasDoc ? 'var(--color-success-solid, #0f5c56)' : 'var(--color-ink-muted)',
                      fontWeight: hasDoc ? 600 : 400,
                    }}
                  >
                    {hasDoc ? '✓' : '○'} {doc.label}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Dynamic Document Upload Slots */}
          {reqDocs.map((doc) => {
            const docType = doc.key
            const docLabel = doc.label
            const file = files[docType]
            const isPdf = file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
            const fileSizeKb = file ? Math.round(file.size / 1024) : 0

            return (
              <div className={`doc-upload-box ${file ? 'has-file' : ''}`} key={docType}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor={`file-${docType}`} style={{ fontWeight: 600, fontSize: 14 }}>
                    {docLabel} <span style={{ color: 'var(--color-danger-solid)' }}>*</span>
                  </label>
                  {file && <span className="badge badge-success">Attached ✓</span>}
                </div>

                <div style={{ marginTop: 6 }}>
                  <input
                    id={`file-${docType}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf"
                    onChange={(e) => handleFileChange(docType, e.target.files)}
                  />
                </div>

                {file && (
                  <div className="file-preview-card">
                    {isPdf ? (
                      <span className="pdf-icon-badge">PDF DOCUMENT</span>
                    ) : (
                      <img
                        src={typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : ''}
                        alt={`${docLabel} preview`}
                        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>
                        {fileSizeKb} KB • {isPdf ? 'Multi-page supported' : 'Image document'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(docType)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--color-danger-solid)',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 4,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <div className="status-banner danger" style={{ marginBottom: 16 }}>
            <span>⚠️</span>
            <div>{error}</div>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-lg"
          disabled={loading}
          style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
        >
          {loading ? 'Processing OCR & Checking Application Consistency\u2026' : `Check My ${currentService.name} Application`}
        </button>
      </form>
    </div>
  )
}

function ReadinessResult({ result, onStartNew }) {
  const isReady = result.readiness_score >= 90
  const isWarning = result.readiness_score >= 60 && result.readiness_score < 90

  const statusLabel = isReady ? 'Ready for Fast-Track'
    : isWarning ? 'Needs Attention'
    : 'Action Required'

  const scoreClass = isReady ? 'score-green' : isWarning ? 'score-amber' : 'score-red'
  const bannerClass = isReady ? 'success' : isWarning ? 'warning' : 'danger'

  const failedChecks = result.field_checks.filter((c) => c.status === 'fail')

  return (
    <div>
      <div className="page-header">
        <h2>Application Readiness Result</h2>
        <p>
          Instant automated assessment of document consistency, identity matching, and missing requirements.
        </p>
      </div>

      {/* Visual Centerpiece Score Card */}
      <div className="readiness-hero">
        <div className="readiness-score-display">
          <div>
            <div className={`readiness-score ${scoreClass}`}>{result.readiness_score}%</div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink-muted)' }}>
              Readiness Score
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className={`badge badge-${bannerClass}`} style={{ fontSize: 14, padding: '4px 12px' }}>
                {statusLabel}
              </span>
              <span className="badge badge-neutral" style={{ fontSize: 12 }}>
                OCR Confidence: {result.average_ocr_confidence}%
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 500, color: 'var(--color-ink)' }}>
              {SERVICE_TYPES[result.service_type]?.label || result.service_type} for <strong>{result.citizen_name}</strong>
            </p>
          </div>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Estimated Delay</div>
              <div className="metric-value">{result.estimated_delay_days} days</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Application ID</div>
              <div className="metric-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 20 }}>
                {result.application_id}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Status</div>
              <div className="metric-value" style={{ fontSize: 18 }}>Pre-Verified</div>
            </div>
          </div>
        </div>

        <div className={`status-banner ${bannerClass}`} style={{ marginTop: 20, marginBottom: 0 }}>
          <span>💡</span>
          <div>
            <strong>Recommendation:</strong> {result.recommendation}
          </div>
        </div>
      </div>

      {result.duplicate_suspected && (
        <div className="status-banner warning">
          <span>⚠️</span>
          <div>
            <strong>Repeat Submission Warning:</strong> This looks like a repeat submission of an existing application ({result.duplicate_confidence}% match confidence).
          </div>
        </div>
      )}

      {/* Actionable How To Fix This Section */}
      {(failedChecks.length > 0 || result.missing_documents.length > 0) && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-warning-solid)' }}>
          <div className="card-header">
            <h3 style={{ margin: 0, color: 'var(--color-warning-text)' }}>📋 How to Fix This Application</h3>
            <span className="badge badge-warning">Action Items</span>
          </div>
          <ul style={{ paddingLeft: 20, margin: '8px 0 0', lineHeight: 1.8 }}>
            {failedChecks.map((check) => (
              <li key={check.field}>
                <strong>Fix {check.field.replace('_', ' ')}:</strong> {check.detail}
              </li>
            ))}
            {result.missing_documents.map((doc) => (
              <li key={doc}>
                <strong>Upload missing document:</strong> {doc.replace('_', ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Document Checks List */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Document Consistency Checks</h3>
          <span className="badge badge-neutral">{result.field_checks.length} checks performed</span>
        </div>

        {result.field_checks.map((check) => (
          <div className="check-row" key={check.field}>
            <span className={`check-icon ${check.status}`}>
              {check.status === 'pass' ? '✓' : '✗'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {check.field.replace('_', ' ')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 2 }}>
                {check.detail}
              </div>
            </div>
            <span className={`badge badge-${check.status === 'pass' ? 'success' : 'danger'}`}>
              {check.status === 'pass' ? 'Verified' : 'Mismatch'}
            </span>
          </div>
        ))}
      </div>

      {/* Missing Documents Card */}
      {result.missing_documents.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Missing Documents</h3>
            <span className="badge badge-danger">{result.missing_documents.length} Missing</span>
          </div>
          <ul style={{ paddingLeft: 20, margin: '8px 0', lineHeight: 1.8 }}>
            {result.missing_documents.map((doc) => (
              <li key={doc} style={{ color: 'var(--color-danger-text)', fontWeight: 500 }}>
                {doc.replace('_', ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Score Reasoning Breakdown */}
      <div className="card">
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-primary)', fontSize: 14 }}>
            View Full Scoring Breakdown ({result.score_reasoning.length} factors)
          </summary>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-subtle)' }}>
            {result.score_reasoning.map((reason, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span>{reason.label}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: reason.points > 0 ? 'var(--color-success-solid)' : reason.points < 0 ? 'var(--color-danger-solid)' : 'var(--color-ink-muted)',
                }}>
                  {reason.points > 0 ? '+' : ''}{reason.points}
                </span>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
        <a
          className="btn"
          href={`${API_BASE_URL}/api/applications/${result.application_id}/report.pdf`}
          download
        >
          📄 Download report (PDF)
        </a>
        <button className="btn btn-secondary" onClick={onStartNew}>
          Start a new application
        </button>
      </div>
    </div>
  )
}
