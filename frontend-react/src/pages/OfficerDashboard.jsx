import { useState, useEffect } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import StaffGate from '../components/StaffGate'

function BarList({ data }) {
  const entries = Object.entries(data)
  const max = Math.max(1, ...entries.map(([, v]) => v))
  return (
    <div>
      {entries.map(([label, value]) => (
        <div key={label} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{label}</span><span>{value}</span>
          </div>
          <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 8 }}>
            <div style={{ background: 'var(--color-primary)', width: `${(value / max) * 100}%`, height: 8, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function OfficerDashboardContent() {
  const { staffUser } = useAuth()
  const [stats, setStats] = useState(null)
  const [feedback, setFeedback] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([client.get('/api/officer-stats'), client.get('/api/feedback')])
      .then(([statsRes, feedbackRes]) => {
        setStats(statsRes.data)
        setFeedback(feedbackRes.data)
      })
      .catch(() => setError('Could not reach SevaSetu\u2019s backend.'))
  }, [])

  if (error) return <div className="status-banner danger">{error}</div>
  if (!stats) return <p>Loading\u2026</p>

  return (
    <div>
      <h2>Officer Dashboard</h2>
      <p style={{ color: 'var(--color-ink-muted)' }}>Logged in as {staffUser.name}</p>

      <h3>Productivity</h3>
      <div className="card" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <Metric label="Total applications" value={stats.total_applications} />
        <Metric label="Resolved" value={stats.resolved_count} />
        <Metric label="Pending" value={stats.pending_count} />
        <Metric label="Average readiness score" value={`${stats.average_readiness_score}%`} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div className="card" style={{ flex: 1 }}>
          <p><strong>Resolutions by officer</strong></p>
          {Object.keys(stats.resolutions_by_officer).length
            ? <BarList data={stats.resolutions_by_officer} />
            : <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No applications resolved yet.</p>}
        </div>
        <div className="card" style={{ flex: 1 }}>
          <p><strong>Applications by service type</strong></p>
          {Object.keys(stats.applications_by_service).length
            ? <BarList data={stats.applications_by_service} />
            : <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No applications submitted yet.</p>}
        </div>
      </div>

      <h3>Feedback Insights</h3>
      <div className="card" style={{ display: 'flex', gap: 24 }}>
        <Metric label="Positive" value={stats.feedback_sentiment_counts.positive || 0} />
        <Metric label="Neutral" value={stats.feedback_sentiment_counts.neutral || 0} />
        <Metric label="Negative" value={stats.feedback_sentiment_counts.negative || 0} />
      </div>

      {feedback.length ? (
        <div className="card">
          <p><strong>Recent feedback</strong></p>
          {feedback.slice(0, 10).map((item) => {
            const icon = { positive: '\ud83d\ude42', neutral: '\ud83d\ude10', negative: '\ud83d\ude41' }[item.sentiment_label] || ''
            return (
              <p key={item.id}>
                {icon} <strong>{item.citizen_name || 'Anonymous'}</strong> ({item.sentiment_label}, score {item.sentiment_score}): {item.text}
              </p>
            )
          })}
        </div>
      ) : <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No feedback submitted yet.</p>}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

export default function OfficerDashboard() {
  return (
    <StaffGate>
      <OfficerDashboardContent />
    </StaffGate>
  )
}
