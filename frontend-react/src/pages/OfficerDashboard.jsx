import { useState, useEffect } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import StaffGate from '../components/StaffGate'

function BarList({ data, color = 'var(--color-primary)' }) {
  const entries = Object.entries(data)
  const max = Math.max(1, ...entries.map(([, v]) => v))
  const total = entries.reduce((acc, [, v]) => acc + v, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map(([label, value]) => {
        const pct = Math.round((value / max) * 100)
        const sharePct = total > 0 ? Math.round((value / total) * 100) : 0
        return (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontWeight: 500 }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-muted)' }}>
                <strong>{value}</strong> ({sharePct}%)
              </span>
            </div>
            <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ background: color, width: `${pct}%`, height: 8, borderRadius: 4, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )
      })}
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
  if (!stats) return <p style={{ color: 'var(--color-ink-muted)' }}>Loading analytics data\u2026</p>

  const resolutionRate = stats.total_applications > 0
    ? Math.round((stats.resolved_count / stats.total_applications) * 100)
    : 0

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Productivity & Analytics Dashboard</h2>
            <p>Real-time civic operational metrics, workload distribution, and citizen sentiment.</p>
          </div>
          <div className="badge badge-info" style={{ padding: '6px 12px', fontSize: 13 }}>
            Logged in as <strong>{staffUser.name}</strong>
          </div>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="metric-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-primary)' }}>
          <div className="metric-label">Total applications</div>
          <div className="metric-value">{stats.total_applications}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-success-solid)' }}>
          <div className="metric-label">Resolved</div>
          <div className="metric-value" style={{ color: 'var(--color-success-solid)' }}>
            {stats.resolved_count} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink-muted)' }}>({resolutionRate}%)</span>
          </div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-warning-solid)' }}>
          <div className="metric-label">Pending</div>
          <div className="metric-value" style={{ color: 'var(--color-warning-solid)' }}>{stats.pending_count}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid #6366f1' }}>
          <div className="metric-label">Average readiness score</div>
          <div className="metric-value">{stats.average_readiness_score}%</div>
        </div>
      </div>

      {/* Distribution Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Resolutions by officer</h3>
            <span className="badge badge-neutral">Workload</span>
          </div>
          {Object.keys(stats.resolutions_by_officer).length
            ? <BarList data={stats.resolutions_by_officer} color="var(--color-success-solid)" />
            : <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No applications resolved yet.</p>}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Applications by service type</h3>
            <span className="badge badge-neutral">Demand</span>
          </div>
          {Object.keys(stats.applications_by_service).length
            ? <BarList data={stats.applications_by_service} color="var(--color-primary)" />
            : <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No applications submitted yet.</p>}
        </div>
      </div>

      {/* Distribution Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Applications by day</h3>
            <span className="badge badge-neutral">Timeline</span>
          </div>
          {Object.keys(stats.applications_by_date || {}).length
            ? <BarList data={stats.applications_by_date} color="#0f766e" />
            : <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No applications submitted yet.</p>}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Common mismatch reasons</h3>
            <span className="badge badge-warning">Verification Flags</span>
          </div>
          {Object.keys(stats.common_mismatch_reasons || {}).length
            ? <BarList data={stats.common_mismatch_reasons} color="var(--color-danger-solid)" />
            : <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No mismatches flagged yet.</p>}
        </div>
      </div>

      {/* Citizen Sentiment Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 style={{ margin: 0 }}>Citizen Feedback & Sentiment Insights</h3>
            <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', margin: '4px 0 0' }}>
              Sentiment analysis scored via VADER compound classification from real citizen submissions.
            </p>
          </div>
          <span className="badge badge-neutral">{stats.total_feedback || 0} Total Submissions</span>
        </div>

        <div className="metric-grid" style={{ marginBottom: 20 }}>
          <div className="metric-card" style={{ background: 'var(--color-success-bg)', borderColor: 'var(--color-success-border)' }}>
            <div className="metric-label" style={{ color: 'var(--color-success-text)' }}>Positive</div>
            <div className="metric-value" style={{ color: 'var(--color-success-solid)' }}>
              {stats.feedback_sentiment_counts.positive || 0}
            </div>
          </div>
          <div className="metric-card" style={{ background: 'var(--color-warning-bg)', borderColor: 'var(--color-warning-border)' }}>
            <div className="metric-label" style={{ color: 'var(--color-warning-text)' }}>Neutral</div>
            <div className="metric-value" style={{ color: 'var(--color-warning-solid)' }}>
              {stats.feedback_sentiment_counts.neutral || 0}
            </div>
          </div>
          <div className="metric-card" style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger-border)' }}>
            <div className="metric-label" style={{ color: 'var(--color-danger-text)' }}>Negative</div>
            <div className="metric-value" style={{ color: 'var(--color-danger-solid)' }}>
              {stats.feedback_sentiment_counts.negative || 0}
            </div>
          </div>
        </div>

        {feedback.length ? (
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Recent Citizen Comments:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {feedback.slice(0, 8).map((item) => {
                const badgeStyle = item.sentiment_label === 'positive' ? 'badge-success'
                  : item.sentiment_label === 'negative' ? 'badge-danger' : 'badge-neutral'
                const emoji = item.sentiment_label === 'positive' ? '😊'
                  : item.sentiment_label === 'negative' ? '🙁' : '😐'

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--color-surface-hover)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {emoji} {item.citizen_name || 'Anonymous Citizen'}
                      </span>
                      <span className={`badge ${badgeStyle}`} style={{ fontSize: 11 }}>
                        {item.sentiment_label} ({item.sentiment_score})
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-ink)' }}>
                      "{item.text}"
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No feedback submitted yet.</p>
        )}
      </div>
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
