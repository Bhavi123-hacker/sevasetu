import { useState } from 'react'
import client from '../api/client'

export default function CheckStatus() {
  const [applicationId, setApplicationId] = useState('')
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleCheck(event) {
    event.preventDefault()
    setError(null)
    setDetail(null)
    if (!applicationId.trim()) return

    setLoading(true)
    try {
      const response = await client.get(`/api/applications/${applicationId.trim()}`)
      setDetail(response.data)
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No application found with that ID. Double-check it — it\u2019s the ID you were shown right after submitting.')
      } else {
        setError('Could not reach SevaSetu\u2019s backend.')
      }
    } finally {
      setLoading(false)
    }
  }

  const statusDisplay = detail && (
    detail.status === 'resolved' ? 'Resolved'
    : detail.readiness_score >= 90 ? 'Submitted — looks clean, should move quickly'
    : 'Submitted — awaiting officer review'
  )

  const failedChecks = detail ? detail.field_checks.filter((c) => c.status === 'fail') : []

  return (
    <div>
      <h2>Check Application Status</h2>
      <p style={{ color: 'var(--color-ink-muted)' }}>
        Look up an application you already submitted using its Application ID.
      </p>

      <form onSubmit={handleCheck} className="card">
        <div className="field">
          <label htmlFor="app-id">Application ID</label>
          <input
            id="app-id"
            type="text"
            placeholder="e.g. 5bce7434"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
          />
        </div>
        <button type="submit" className="btn" disabled={loading}>{loading ? 'Checking\u2026' : 'Check status'}</button>
      </form>

      {error && <div className="status-banner danger">{error}</div>}

      {detail && (
        <div className="card">
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Status</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{statusDisplay}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Readiness score</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{detail.readiness_score}%</div>
            </div>
          </div>

          {detail.missing_documents.length > 0 && (
            <p><strong>Still missing:</strong> {detail.missing_documents.map((d) => d.replace('_', ' ')).join(', ')}</p>
          )}

          {failedChecks.length > 0 ? (
            <>
              <p><strong>Unresolved flags:</strong></p>
              {failedChecks.map((check) => (
                <div className="status-banner warning" key={check.field}>
                  {check.field.replace('_', ' ')} — {check.detail}
                </div>
              ))}
            </>
          ) : detail.status !== 'resolved' && (
            <div className="status-banner success">No open flags — waiting on officer processing, not on you.</div>
          )}
        </div>
      )}
    </div>
  )
}
