import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Icon } from '../components/Icon'

export default function AdminOperations() {
  const { isStaff } = useAuth()
  const { t } = useLanguage()
  const [health, setHealth] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Sandbox Identity Test State
  const [testName, setTestName] = useState('Aarav Sharma')
  const [testDob, setTestDob] = useState('1990-05-12')
  const [testDocNum, setTestDocNum] = useState('1234 5678 9012')
  const [sandboxResult, setSandboxResult] = useState(null)
  const [sandboxLoading, setSandboxLoading] = useState(false)

  useEffect(() => {
    fetchOperationsData()
  }, [])

  const fetchOperationsData = async () => {
    setLoading(true)
    setError(null)
    try {
      const healthRes = await api.getSystemHealth()
      setHealth(healthRes.data)

      try {
        const metricsRes = await api.getOperationsMetrics()
        setMetrics(metricsRes.data)
      } catch {
        // If unauthenticated or citizen, keep metrics null
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load operations metrics.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchOperationsData()
  }

  const handleRunSandboxTest = async (e) => {
    e.preventDefault()
    setSandboxLoading(true)
    setSandboxResult(null)
    try {
      const res = await api.verifyIdentitySandbox({
        name: testName,
        dob: testDob,
        document_number: testDocNum,
      })
      setSandboxResult(res.data)
    } catch (err) {
      setSandboxResult({ error: err.response?.data?.detail || 'Sandbox evaluation failed.' })
    } finally {
      setSandboxLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-muted))',
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          marginBottom: 24,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Icon name="sliders" size={24} className="text-teal-600" />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--color-ink)' }}>
              {t('operations_title', 'System Operations & Live Health')}
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--color-ink-muted)', fontSize: 13 }}>
            {t('operations_subtitle', 'Real-time metrics, infrastructure health, and SLA monitoring computed from active database records.')}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="refresh" size={14} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Live Status'}</span>
        </button>
      </div>

      {error && (
        <div className="status-banner warning" style={{ marginBottom: 20 }}>
          <Icon name="alert-triangle" size={16} className="text-amber-600" />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 140, width: '100%' }} />
          <div className="skeleton" style={{ height: 220, width: '100%' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Subsystem Health Grid */}
          <div className="card">
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="activity" size={16} className="text-teal-600" />
              <span>{t('subsystem_health_title', 'Subsystem Real Health Status')}</span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {health?.subsystems &&
                Object.entries(health.subsystems).map(([key, sys]) => {
                  const isOk = sys.status === 'HEALTHY' || sys.status === 'CONFIGURED' || sys.status === 'AVAILABLE'
                  return (
                    <div
                      key={key}
                      style={{
                        padding: '14px 16px',
                        background: 'var(--color-surface)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'capitalize', color: 'var(--color-ink)' }}>
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className={`badge ${isOk ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                          {sys.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>
                        {sys.engine || sys.provider || sys.type || sys.algorithm || sys.citizen_provider || 'Active'}
                        {sys.latency_ms !== undefined && ` • ${sys.latency_ms}ms`}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Application Pipeline Operations */}
          {metrics?.applications && (
            <div className="card">
              <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="file-text" size={16} className="text-teal-600" />
                <span>{t('apps_overview_title', 'Application Pipeline Workload')}</span>
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <div style={{ padding: '12px 14px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-primary)' }}>{metrics.applications.total}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)' }}>Total Received</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-gold)' }}>{metrics.applications.pending_officer_review}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)' }}>Pending Review</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-accent)' }}>{metrics.applications.interviews_pending}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)' }}>Interviews Pending</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-danger-solid)' }}>{metrics.applications.corrections_pending}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)' }}>Corrections Pending</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-success-solid)' }}>{metrics.applications.approved}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)' }}>Approved</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-ink-subtle)' }}>{metrics.applications.rejected}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-muted)' }}>Rejected</div>
                </div>
              </div>
            </div>
          )}

          {/* SLA Performance & Grievances */}
          {metrics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* SLA Metrics */}
              <div className="card">
                <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="clock" size={16} className="text-teal-600" />
                  <span>{t('sla_performance_title', 'Statutory SLA Compliance')}</span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-success-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-success-border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success-text)' }}>Normal (Within SLA)</span>
                    <span style={{ fontWeight: 800, color: 'var(--color-success-text)' }}>{metrics.sla_performance.normal}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-warning-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-warning-border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-warning-text)' }}>Approaching Deadline (&lt;24h)</span>
                    <span style={{ fontWeight: 800, color: 'var(--color-warning-text)' }}>{metrics.sla_performance.approaching_deadline}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-danger-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-danger-border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger-text)' }}>Overdue / SLA Breached</span>
                    <span style={{ fontWeight: 800, color: 'var(--color-danger-text)' }}>{metrics.sla_performance.overdue}</span>
                  </div>
                </div>
              </div>

              {/* Grievance Metrics */}
              <div className="card">
                <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="building" size={16} className="text-teal-600" />
                  <span>{t('grievances_overview_title', 'Civic Grievance Operations')}</span>
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div style={{ padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-ink)' }}>{metrics.grievances.total}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>Total Lodged</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-gold)' }}>{metrics.grievances.open}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>Open Cases</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-danger-solid)' }}>{metrics.grievances.escalated}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>Escalated</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-success-solid)' }}>{metrics.grievances.resolved}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>Resolved</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Integration Sandbox Gateway Tool */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="shield" size={16} className="text-teal-600" />
                  <span>Decoupled Integration Gateway (Sandbox Adapter)</span>
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-ink-muted)' }}>
                  Test modular identity format evaluation adapters without fabricating live external government connections.
                </p>
              </div>
            </div>

            <form onSubmit={handleRunSandboxTest} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 14 }}>
              <div>
                <label className="label" style={{ fontSize: 12 }}>Citizen Name</label>
                <input
                  type="text"
                  className="input"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: 12 }}>Date of Birth</label>
                <input
                  type="date"
                  className="input"
                  value={testDob}
                  onChange={(e) => setTestDob(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: 12 }}>Aadhaar / ID Number</label>
                <input
                  type="text"
                  className="input"
                  value={testDocNum}
                  onChange={(e) => setTestDocNum(e.target.value)}
                  placeholder="1234 5678 9012"
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={sandboxLoading}
                  className="btn btn-primary"
                  style={{ width: '100%', height: 42 }}
                >
                  {sandboxLoading ? 'Evaluating...' : 'Evaluate Format'}
                </button>
              </div>
            </form>

            {sandboxResult && (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--color-border)',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-ink)' }}>{sandboxResult.provider}</span>
                  <span className={`badge ${sandboxResult.is_verified ? 'badge-success' : 'badge-warning'}`}>
                    {sandboxResult.status}
                  </span>
                </div>
                <p style={{ margin: '0 0 6px', color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
                  {sandboxResult.disclaimer}
                </p>
                {sandboxResult.discrepancies?.length > 0 && (
                  <div style={{ color: 'var(--color-danger-text)', fontWeight: 600 }}>
                    {sandboxResult.discrepancies.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
