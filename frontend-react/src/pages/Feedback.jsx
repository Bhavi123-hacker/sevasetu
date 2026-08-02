import { useState } from 'react'
import client from '../api/client'

export default function Feedback() {
  const [name, setName] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (!text.trim()) {
      setError('Please write something before submitting.')
      return
    }

    setLoading(true)
    try {
      await client.post('/api/feedback', {
        text,
        citizen_name: name || null,
        application_id: applicationId || null,
      })
      setSuccess(true)
      setText('')
    } catch (err) {
      setError('Could not reach SevaSetu\u2019s backend.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>Share Feedback</h2>
      <p style={{ color: 'var(--color-ink-muted)' }}>
        Tell us about your experience. This goes straight to the officer team, not into a black box.
      </p>

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label htmlFor="fb-name">Your name (optional)</label>
          <input id="fb-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="fb-app-id">Application ID (optional, if this is about a specific application)</label>
          <input id="fb-app-id" type="text" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="fb-text">Your feedback</label>
          <textarea id="fb-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </div>

        {error && <div className="status-banner danger">{error}</div>}
        {success && <div className="status-banner success">Thanks — your feedback has been recorded.</div>}

        <button type="submit" className="btn" disabled={loading}>{loading ? 'Submitting\u2026' : 'Submit feedback'}</button>
      </form>
    </div>
  )
}
