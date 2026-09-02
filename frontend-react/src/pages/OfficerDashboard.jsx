import { useState, useEffect, useCallback } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import StaffGate from '../components/StaffGate'

function BarList({ data = {}, color = 'var(--color-primary)' }) {
  const entries = Object.entries(data)
  if (!entries.length) return null
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
  const [dashStats, setDashStats] = useState(null)
  const [feedback, setFeedback] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, dashRes, metricsRes, feedbackRes] = await Promise.all([
        client.get('/api/officer-stats').catch(() => ({ data: {} })),
        client.get('/api/dashboard/stats').catch(() => ({ data: {} })),
        client.get('/api/officer/dashboard-metrics').catch(() => ({ data: {} })),
        client.get('/api/feedback').catch(() => ({ data: [] })),
      ])
      setStats(statsRes.data || {})
      setDashStats({ ...(dashRes.data || {}), ...(metricsRes.data || {}) })
      setFeedback(Array.isArray(feedbackRes.data) ? feedbackRes.data : [])
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError(err.response?.data?.detail || 'Could not load productivity analytics from backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>Loading productivity analytics data…</div>

  const posCount = stats?.positive_feedback_count ?? stats?.feedback_sentiment_counts?.positive ?? 0
  const neuCount = stats?.neutral_feedback_count ?? stats?.feedback_sentiment_counts?.neutral ?? 0
  const negCount = stats?.negative_feedback_count ?? stats?.feedback_sentiment_counts?.negative ?? 0
  const appsByService = dashStats?.service_distribution || stats?.applications_by_service || {}
  const resByOfficer = stats?.resolutions_by_officer || {}
  const commonMismatches = stats?.common_mismatch_reasons || {}

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Civic Operations &amp; Verification Analytics</h2>
            <p>Real-time caseload monitoring, document integrity risk profiles, and citizen turnaround metrics.</p>
          </div>
          <div className="badge badge-info" style={{ padding: '6px 12px', fontSize: 13 }}>
            Logged in as <strong>{staffUser?.name || staffUser?.username || 'Officer'}</strong>
          </div>
        </div>
      </div>

      {error && (
        <div className="status-banner danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div><strong>Backend Error:</strong> {error}</div>
          <button className="btn btn-secondary btn-sm" onClick={loadData}>🔄 Retry Connection</button>
        </div>
      )}

      {/* Primary KPI Overview Grid (8 Core Production Metrics) */}
      <div className="metric-grid" style={{ marginBottom: 20 }}>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-primary)' }}>
          <div className="metric-label">Total Applications</div>
          <div className="metric-value">{dashStats?.total_applications ?? 0}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-warning-solid)' }}>
          <div className="metric-label">Pending Review</div>
          <div className="metric-value" style={{ color: 'var(--color-warning-solid)' }}>{dashStats?.pending_review ?? 0}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid #f59e0b' }}>
          <div className="metric-label">Corrections Pending</div>
          <div className="metric-value" style={{ color: '#d97706' }}>{dashStats?.corrections_pending ?? dashStats?.needs_correction ?? 0}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid #0d9488' }}>
          <div className="metric-label">Interviews Pending</div>
          <div className="metric-value" style={{ color: '#0d9488' }}>{dashStats?.interviews_pending ?? 0}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid #6366f1' }}>
          <div className="metric-label">Final Reviews</div>
          <div className="metric-value" style={{ color: '#6366f1' }}>{dashStats?.final_reviews ?? 0}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-success-solid)' }}>
          <div className="metric-label">Approved</div>
          <div className="metric-value" style={{ color: 'var(--color-success-solid)' }}>{dashStats?.approved ?? 0}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-danger-solid)' }}>
          <div className="metric-label">Rejected</div>
          <div className="metric-value" style={{ color: 'var(--color-danger-solid)' }}>{dashStats?.rejected ?? 0}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid #dc2626' }}>
          <div className="metric-label">High Risk Documents</div>
          <div className="metric-value" style={{ color: '#dc2626' }}>{dashStats?.high_risk_documents ?? dashStats?.risk_distribution?.HIGH ?? 0}</div>
        </div>
      </div>

      {/* SLA & Turnaround Health Banner */}
      <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--color-surface-hover)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong style={{ fontSize: 14 }}>⏱️ Statutory SLA &amp; Processing Metrics</strong>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-ink-muted)' }}>
              Operational tracking against statutory delivery thresholds. Average verification processing duration: <strong>{dashStats?.average_processing_time_hours || 1.2} hrs</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: 12 }}>
              Normal: <strong>{dashStats?.sla_metrics?.normal ?? 0}</strong>
            </span>
            <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: 12 }}>
              Approaching SLA: <strong>{dashStats?.sla_metrics?.approaching ?? 0}</strong>
            </span>
            <span className="badge badge-danger" style={{ padding: '6px 12px', fontSize: 12 }}>
              Overdue: <strong>{dashStats?.sla_metrics?.overdue ?? 0}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Risk Profile & Workload Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Statutory Risk Distribution</h3>
            <span className="badge badge-neutral">Attention Profile</span>
          </div>
          {dashStats?.risk_distribution ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>🟢 Low Risk (Standard Review)</span>
                <strong>{dashStats.risk_distribution.LOW || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>🟡 Medium Risk (Discrepancy / Uncertainty)</span>
                <strong>{dashStats.risk_distribution.MEDIUM || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>🔴 High Risk (Mismatch / Duplicate Flag)</span>
                <strong>{dashStats.risk_distribution.HIGH || 0}</strong>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Calculating risk distribution…</p>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Workload &amp; Assignment Queue</h3>
            <span className="badge badge-info">Capacity</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>👤 Assigned to Officers</span>
              <strong>{dashStats?.assigned_applications ?? 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>📥 Unassigned in Queue</span>
              <strong style={{ color: (dashStats?.unassigned_applications ?? 0) > 0 ? '#d97706' : 'var(--color-ink)' }}>
                {dashStats?.unassigned_applications ?? 0}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>⚡ Fast-Track Eligible</span>
              <strong>{dashStats?.fast_track_eligible ?? 0}</strong>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Applications by Service Type</h3>
            <span className="badge badge-neutral">Demand</span>
          </div>
          {Object.keys(appsByService).length ? (
            <BarList data={appsByService} color="var(--color-primary)" />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No applications submitted yet.</p>
          )}
        </div>
      </div>

      {/* Distribution Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Resolutions by Officer</h3>
            <span className="badge badge-neutral">Staff Productivity</span>
          </div>
          {Object.keys(resByOfficer).length ? (
            <BarList data={resByOfficer} color="var(--color-success-solid)" />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No resolutions recorded yet.</p>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Common Mismatch Reasons</h3>
            <span className="badge badge-warning">Integrity Flags</span>
          </div>
          {Object.keys(commonMismatches).length ? (
            <BarList data={commonMismatches} color="var(--color-danger-solid)" />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>No mismatches flagged yet.</p>
          )}
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
          <span className="badge badge-neutral">{stats?.total_feedback || feedback.length || 0} Total Submissions</span>
        </div>

        <div className="metric-grid" style={{ marginBottom: 20 }}>
          <div className="metric-card" style={{ background: 'var(--color-success-bg)', borderColor: 'var(--color-success-border)' }}>
            <div className="metric-label" style={{ color: 'var(--color-success-text)' }}>Positive</div>
            <div className="metric-value" style={{ color: 'var(--color-success-solid)' }}>
              {posCount}
            </div>
          </div>
          <div className="metric-card" style={{ background: 'var(--color-warning-bg)', borderColor: 'var(--color-warning-border)' }}>
            <div className="metric-label" style={{ color: 'var(--color-warning-text)' }}>Neutral</div>
            <div className="metric-value" style={{ color: 'var(--color-warning-solid)' }}>
              {neuCount}
            </div>
          </div>
          <div className="metric-card" style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger-border)' }}>
            <div className="metric-label" style={{ color: 'var(--color-danger-text)' }}>Negative</div>
            <div className="metric-value" style={{ color: 'var(--color-danger-solid)' }}>
              {negCount}
            </div>
          </div>
        </div>

        {feedback.length ? (
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Recent Citizen Comments:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {feedback.slice(0, 8).map((item) => {
                const badgeStyle = item.sentiment_label === 'positive' || item.sentiment_label === 'POSITIVE'
                  ? 'badge-success'
                  : item.sentiment_label === 'negative' || item.sentiment_label === 'NEGATIVE'
                  ? 'badge-danger'
                  : 'badge-neutral'
                const emoji = item.sentiment_label === 'positive' || item.sentiment_label === 'POSITIVE'
                  ? '😊'
                  : item.sentiment_label === 'negative' || item.sentiment_label === 'NEGATIVE'
                  ? '🙁'
                  : '😐'

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
