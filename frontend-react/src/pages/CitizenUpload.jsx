import { useState } from 'react'
import client from '../api/client'
import { API_BASE_URL } from '../api/client'
import { SERVICE_TYPES } from '../config'

export default function CitizenUpload() {
  const [citizenName, setCitizenName] = useState('')
  const [serviceKey, setServiceKey] = useState('income_certificate')
  const [files, setFiles] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const service = SERVICE_TYPES[serviceKey]

  function handleFileChange(docType, fileList) {
    setFiles((prev) => ({ ...prev, [docType]: fileList[0] || null }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (!citizenName.trim()) {
      setError('Please enter your name.')
      return
    }
    const attached = Object.values(files).filter(Boolean)
    if (attached.length === 0) {
      setError('Please upload at least one document.')
      return
    }

    const formData = new FormData()
    formData.append('citizen_name', citizenName)
    formData.append('service_type', serviceKey)
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
      setError(err.response?.data?.detail || 'Could not reach SevaSetu\u2019s backend.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setFiles({})
    setCitizenName('')
  }

  if (result) {
    return <ReadinessResult result={result} onStartNew={reset} />
  }

  return (
    <div>
      <h2>SevaSetu</h2>
      <p style={{ color: 'var(--color-ink-muted)' }}>
        Helping citizens submit complete, consistent government applications before they reach an officer.
      </p>

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label htmlFor="citizen-name">Your full name</label>
          <input
            id="citizen-name"
            type="text"
            value={citizenName}
            onChange={(e) => setCitizenName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="service-select">Which service are you applying for?</label>
          <select
            id="service-select"
            value={serviceKey}
            onChange={(e) => {
              setServiceKey(e.target.value)
              setFiles({})
            }}
          >
            {Object.entries(SERVICE_TYPES).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>
        </div>

        <h3>Required documents</h3>
        <p style={{ fontSize: 14, color: 'var(--color-ink-muted)' }}>
          Upload each of the following. It's fine to skip one if you don't have it yet
          — SevaSetu will tell you exactly what's missing.
        </p>

        {Object.entries(service.requiredDocuments).map(([docType, docLabel]) => (
          <div className="field" key={docType}>
            <label htmlFor={`file-${docType}`}>{docLabel}</label>
            <input
              id={`file-${docType}`}
              type="file"
              accept="image/png, image/jpeg"
              onChange={(e) => handleFileChange(docType, e.target.files)}
            />
            {files[docType] && (
              <img
                src={URL.createObjectURL(files[docType])}
                alt={`${docLabel} preview`}
                style={{ marginTop: 8, maxHeight: 100, borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}
              />
            )}
          </div>
        ))}

        {error && <div className="status-banner danger">{error}</div>}

        <button type="submit" className="btn" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Checking\u2026' : 'Check my application'}
        </button>
      </form>
    </div>
  )
}

function ReadinessResult({ result, onStartNew }) {
  const statusLabel = result.readiness_score >= 90 ? 'Ready'
    : result.readiness_score >= 60 ? 'Needs attention'
    : 'Not ready'
  const bannerClass = result.readiness_score >= 90 ? 'success'
    : result.readiness_score >= 60 ? 'warning'
    : 'danger'

  return (
    <div>
      <h2>Application Readiness</h2>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span className="readiness-score">{result.readiness_score}%</span>
          <span className={`status-banner ${bannerClass}`} style={{ marginBottom: 0 }}>{statusLabel}</span>
        </div>
        <p style={{ color: 'var(--color-ink-muted)', marginTop: 4 }}>
          {SERVICE_TYPES[result.service_type]?.label || result.service_type} application for {result.citizen_name}
        </p>

        <details style={{ margin: '8px 0' }}>
          <summary style={{ cursor: 'pointer', fontSize: 14, color: 'var(--color-primary)' }}>Why this score?</summary>
          <div style={{ marginTop: 8 }}>
            {result.score_reasoning.map((reason, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 14, padding: '2px 0' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  color: reason.points > 0 ? 'var(--color-success-text)' : reason.points < 0 ? 'var(--color-danger-text)' : 'var(--color-ink-muted)',
                  minWidth: 40,
                }}>
                  {reason.points > 0 ? '+' : ''}{reason.points}
                </span>
                <span>{reason.label}</span>
              </div>
            ))}
          </div>
        </details>

        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>
          OCR confidence: {result.average_ocr_confidence}%
        </p>

        {result.duplicate_suspected && (
          <div className="status-banner warning">
            This looks like a repeat submission of an existing application ({result.duplicate_confidence}% confidence).
          </div>
        )}

        <h3>Document checks</h3>
        {result.field_checks.map((check) => (
          <div className="check-row" key={check.field}>
            <span className={`check-icon ${check.status}`}>{check.status === 'pass' ? '\u2713' : '\u2717'}</span>
            <div>
              <strong>{check.field.replace('_', ' ')}</strong> — {check.detail}
            </div>
          </div>
        ))}

        {result.missing_documents.length > 0 && (
          <>
            <h3>Missing documents</h3>
            <ul>
              {result.missing_documents.map((doc) => (
                <li key={doc}>{doc.replace('_', ' ')}</li>
              ))}
            </ul>
          </>
        )}

        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Estimated delay</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{result.estimated_delay_days} days</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Application ID</div>
            <div style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{result.application_id}</div>
          </div>
        </div>

        <div className="status-banner" style={{ background: '#eaf3f2', color: 'var(--color-primary)', marginTop: 16 }}>
          <strong>Recommendation:</strong> {result.recommendation}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <a
          className="btn"
          href={`${API_BASE_URL}/api/applications/${result.application_id}/report.pdf`}
          download
        >
          Download report (PDF)
        </a>
        <button className="btn btn-secondary" onClick={onStartNew}>Start a new application</button>
      </div>
    </div>
  )
}
