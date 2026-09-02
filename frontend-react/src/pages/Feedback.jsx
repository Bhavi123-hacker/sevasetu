import { useState } from 'react'
import client from '../api/client'
import { Icon } from '../components/Icon'

const CATEGORIES = [
  { value: 'EASE_OF_APPLICATION', label: 'Ease of Application & Form Filling' },
  { value: 'DOCUMENT_SUBMISSION', label: 'Document Submission & Scanning' },
  { value: 'PROCESSING_TRANSPARENCY', label: 'Processing Speed & Transparency' },
  { value: 'COMMUNICATION_NOTIFICATIONS', label: 'SMS & Email Communication' },
  { value: 'GRIEVANCE_HANDLING', label: 'Grievance Resolution & Support' },
  { value: 'GENERAL', label: 'General Experience / Other' },
]

export default function Feedback() {
  const [name, setName] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [grievanceId, setGrievanceId] = useState('')
  const [rating, setRating] = useState(5)
  const [category, setCategory] = useState('EASE_OF_APPLICATION')
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!text.trim()) {
      setError('Please provide feedback details before submitting.')
      return
    }

    setLoading(true)
    try {
      const res = await client.post('/api/feedback', {
        text,
        rating,
        category,
        citizen_name: name || null,
        application_id: applicationId || null,
        grievance_id: grievanceId || null,
      })
      setSuccess(res.data)
      setText('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit feedback.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="card p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white border-teal-800/40 shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-extrabold uppercase tracking-wider">
          <Icon name="star" size={13} />
          <span>Public Voice</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight m-0">
          Citizen Feedback & Public Experience
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 m-0">
          Help us improve civic service delivery. Your feedback is evaluated in real-time on our operational impact dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-5">
        {/* Rating Stars */}
        <div>
          <label className="block text-xs font-bold text-[var(--color-ink)] mb-2">
            Overall Service Rating
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`p-1.5 rounded-lg text-2xl transition-transform hover:scale-110 focus:outline-none ${
                  star <= rating ? 'text-amber-500' : 'text-slate-300 dark:text-slate-700'
                }`}
                aria-label={`Rate ${star} star`}
              >
                ★
              </button>
            ))}
            <span className="ml-3 text-xs font-bold text-[var(--color-ink-muted)]">
              {rating === 5 ? 'Excellent' : rating === 4 ? 'Good' : rating === 3 ? 'Average' : rating === 2 ? 'Needs Improvement' : 'Poor'}
            </span>
          </div>
        </div>

        {/* Category */}
        <div className="field">
          <label htmlFor="fb-cat">Feedback Category</label>
          <select
            id="fb-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="select-field text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="field">
            <label htmlFor="fb-name">Your Name (optional)</label>
            <input
              id="fb-name"
              type="text"
              placeholder="e.g. Rahul Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field text-sm"
            />
          </div>

          <div className="field">
            <label htmlFor="fb-app-id">Application ID (optional)</label>
            <input
              id="fb-app-id"
              type="text"
              placeholder="e.g. 5bce7434"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              className="input-field text-sm font-mono"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="fb-text">Your Comments & Experience *</label>
          <textarea
            id="fb-text"
            rows={4}
            placeholder="Please describe what worked well or what could be made simpler..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="textarea-field text-sm"
          />
        </div>

        {error && (
          <div className="status-banner danger flex items-center gap-2">
            <Icon name="alert-circle" size={16} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="status-banner success flex items-start gap-2">
            <Icon name="check-circle" size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Feedback recorded successfully!</strong>
              <p className="text-xs mt-1 m-0">Thank you for helping improve civic services.</p>
              {success.sentiment && (
                <div className="text-xs mt-1">
                  Sentiment analysis: <span className="badge badge-info">{success.sentiment}</span> (Score: {success.sentiment_score})
                </div>
              )}
            </div>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 font-bold">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Submitting Feedback...</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Icon name="message" size={16} />
              <span>Submit Feedback</span>
            </span>
          )}
        </button>
      </form>
    </div>
  )
}
