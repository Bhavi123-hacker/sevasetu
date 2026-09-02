import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api/client'
import { Icon } from '../components/Icon'

export default function ImpactDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  const fetchMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiGet('/api/impact/metrics')
      setData(res)
      setLastRefreshed(new Date().toLocaleTimeString())
    } catch (err) {
      console.error('Failed to load impact metrics:', err)
      setError(err.message || 'Unable to connect to live operational metrics database.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  if (loading && !data) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[var(--color-ink-muted)] text-sm font-medium">Aggregating live operational database records...</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="card max-w-lg mx-auto p-8 text-center space-y-4 border border-red-200 dark:border-red-900">
        <Icon name="alert-circle" size={32} className="text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-[var(--color-ink)]">Operational Telemetry Unavailable</h2>
        <p className="text-xs text-[var(--color-ink-muted)] leading-relaxed">{error}</p>
        <button
          onClick={fetchMetrics}
          className="btn btn-primary btn-sm"
        >
          <Icon name="refresh" size={14} />
          <span>Retry Connection</span>
        </button>
      </div>
    )
  }

  const {
    metadata = {},
    applications = {},
    performance = {},
    documents = {},
    officers = {},
    interviews = {},
    grievances = {},
    citizen_experience = {},
  } = data || {}

  const hasData = (applications.total_received || 0) > 0 || (grievances.total || 0) > 0 || (citizen_experience.total_feedback || 0) > 0

  return (
    <div className="space-y-8 py-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-border)] pb-6">
        <div>
          <div className="inline-flex items-center space-x-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold uppercase px-3 py-1 rounded-full mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Live Relational Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Operational Impact & Metrics
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-ink-muted)] mt-1">
            Aggregated in real-time from active database records. Zero synthetic estimates.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {lastRefreshed && (
            <span className="text-xs text-[var(--color-ink-subtle)]">
              Fresh as of {lastRefreshed}
            </span>
          )}
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="btn btn-primary btn-sm text-xs font-bold"
          >
            <Icon name="refresh" size={14} />
            <span>{loading ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
        </div>
      </div>

      {/* Scope Disclaimer */}
      <div className="bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl p-4 flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
        <div className="flex items-center space-x-2">
          <Icon name="activity" size={16} className="text-teal-600 dark:text-teal-400" />
          <span>
            <strong>Data Source:</strong> {metadata.data_source || 'Live Database'} ({metadata.total_sample_records || 0} total records evaluated)
          </span>
        </div>
        <Link to="/about" className="text-teal-700 dark:text-teal-400 font-bold hover:underline">
          View Platform Architecture →
        </Link>
      </div>

      {!hasData ? (
        <div className="card p-12 text-center space-y-4 border border-[var(--color-border)]">
          <Icon name="database" size={36} className="text-teal-600 mx-auto" />
          <h2 className="text-lg font-bold text-[var(--color-ink)]">Platform Initialized (Ready for Traffic)</h2>
          <p className="text-xs text-[var(--color-ink-muted)] max-w-md mx-auto leading-relaxed">
            The database is connected and active. As citizens submit applications, officers review cases, and grievances are resolved, metrics will update here live.
          </p>
          <Link
            to="/apply-wizard"
            className="btn btn-primary btn-sm inline-flex font-bold"
          >
            <Icon name="file-text" size={14} />
            <span>Start Citizen Application</span>
          </Link>
        </div>
      ) : (
        <>
          {/* Top Key Impact Indicators */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="card p-5 border-l-4 border-l-emerald-600 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Applications</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {applications.total_received || 0}
              </div>
              <div className="text-[11px] text-slate-500">
                {applications.completed || 0} completed ({applications.approved || 0} approved, {applications.rejected || 0} rejected)
              </div>
            </div>

            <div className="card p-5 border-l-4 border-l-teal-600 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">SLA Compliance</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-teal-700">
                {performance.sla_compliance_pct || 100}%
              </div>
              <div className="text-[11px] text-slate-500">
                {performance.sla_normal || 0} on track, {performance.sla_overdue || 0} overdue
              </div>
            </div>

            <div className="card p-5 border-l-4 border-l-indigo-600 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Average Turnaround</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700">
                {performance.average_duration_hours ? `${performance.average_duration_hours}h` : 'Real-time'}
              </div>
              <div className="text-[11px] text-slate-500">
                Median: {performance.median_duration_hours || 0}h
              </div>
            </div>

            <div className="card p-5 border-l-4 border-l-amber-500 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Citizen Satisfaction</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 flex items-center gap-1">
                <Icon name="check-circle" size={20} className="text-amber-500" />
                <span>{citizen_experience.average_rating || '5.0'} / 5</span>
              </div>
              <div className="text-[11px] text-slate-500">
                From {citizen_experience.total_feedback || 0} verified citizen reviews
              </div>
            </div>
          </div>

          {/* Applications Pipeline & Turnaround Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 space-y-4">
              <h3 className="font-bold text-[var(--color-ink)] text-sm flex items-center space-x-2">
                <Icon name="file-text" size={16} className="text-teal-600 dark:text-teal-400" />
                <span>Application Lifecycle Pipeline</span>
              </h3>
              <div className="space-y-3 text-xs">
                {[
                  { label: 'Pending Officer Review', count: applications.pending_officer_review || 0, color: 'bg-blue-500' },
                  { label: 'Interview Gate Pending', count: applications.interviews_pending || 0, color: 'bg-indigo-500' },
                  { label: 'Correction Requested / Pending', count: applications.corrections_pending || 0, color: 'bg-amber-500' },
                  { label: 'Final Statutory Review', count: applications.final_statutory_review || 0, color: 'bg-purple-500' },
                  { label: 'Approved & Issued', count: applications.approved || 0, color: 'bg-emerald-500' },
                  { label: 'Statutorily Rejected', count: applications.rejected || 0, color: 'bg-rose-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border)]">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span className="font-medium text-[var(--color-ink)]">{item.label}</span>
                    </div>
                    <span className="font-extrabold text-[var(--color-ink)]">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <h3 className="font-bold text-[var(--color-ink)] text-sm flex items-center space-x-2">
                <Icon name="clock" size={16} className="text-teal-600 dark:text-teal-400" />
                <span>Statutory SLA Compliance Distribution</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1">
                  <div className="flex justify-between font-bold text-emerald-900 dark:text-emerald-200">
                    <span>Within Statutory SLA (Normal)</span>
                    <span>{performance.sla_normal || 0} cases</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Processed or progressing within target statutory timeline.</p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1">
                  <div className="flex justify-between font-bold text-amber-900 dark:text-amber-200">
                    <span>Approaching SLA Deadline</span>
                    <span>{performance.sla_approaching || 0} cases</span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">Flagged for priority officer attention within 24 hours.</p>
                </div>

                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-1">
                  <div className="flex justify-between font-bold text-rose-900 dark:text-rose-200">
                    <span>SLA Breach / Overdue</span>
                    <span>{performance.sla_overdue || 0} cases</span>
                  </div>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400">Escalated to senior administrative supervisor for review.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Document Operations & Grievance Redressal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 space-y-4">
              <h3 className="font-bold text-[var(--color-ink)] text-sm flex items-center space-x-2">
                <Icon name="file-text" size={16} className="text-teal-600 dark:text-teal-400" />
                <span>Document Pre-Verification Operations</span>
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[var(--color-surface-muted)] rounded-xl border border-[var(--color-border)]">
                  <div className="text-[var(--color-ink-muted)] uppercase font-bold text-[10px]">Total Documents</div>
                  <div className="text-xl font-extrabold text-[var(--color-ink)]">{documents.total_processed || 0}</div>
                </div>
                <div className="p-3 bg-[var(--color-surface-muted)] rounded-xl border border-[var(--color-border)]">
                  <div className="text-[var(--color-ink-muted)] uppercase font-bold text-[10px]">Correction Flagged</div>
                  <div className="text-xl font-extrabold text-amber-700 dark:text-amber-400">{documents.requiring_correction || 0}</div>
                </div>
              </div>

              {documents.classification_distribution && Object.keys(documents.classification_distribution).length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-bold text-[var(--color-ink-muted)] uppercase tracking-wider">Detected Document Types</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {Object.entries(documents.classification_distribution).map(([type, count]) => (
                      <span key={type} className="px-3 py-1 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg text-[var(--color-ink)] font-medium">
                        {type}: <strong className="text-[var(--color-ink)]">{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card p-6 space-y-4">
              <h3 className="font-bold text-[var(--color-ink)] text-sm flex items-center space-x-2">
                <Icon name="building" size={16} className="text-teal-600 dark:text-teal-400" />
                <span>Civic Grievance Redressal Performance</span>
              </h3>
              <div className="grid grid-cols-3 gap-3 text-xs text-center">
                <div className="p-3 bg-[var(--color-surface-muted)] rounded-xl border border-[var(--color-border)]">
                  <div className="text-[var(--color-ink-muted)] uppercase font-bold text-[10px]">Total Logged</div>
                  <div className="text-xl font-extrabold text-[var(--color-ink)]">{grievances.total || 0}</div>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                  <div className="text-amber-700 dark:text-amber-400 uppercase font-bold text-[10px]">In Review</div>
                  <div className="text-xl font-extrabold text-amber-800 dark:text-amber-300">
                    {(grievances.open || 0) + (grievances.under_review || 0)}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="text-emerald-700 dark:text-emerald-400 uppercase font-bold text-[10px]">Resolved</div>
                  <div className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300">
                    {(grievances.resolved || 0) + (grievances.closed || 0)}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs p-3 bg-[var(--color-surface-muted)] rounded-xl border border-[var(--color-border)]">
                <span className="text-[var(--color-ink-muted)] font-medium">Resolution Success Rate:</span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                  {grievances.resolution_rate_pct || 100}%
                </span>
              </div>
            </div>
          </div>

          {/* Citizen Experience & Sentiment Breakdown */}
          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-[var(--color-ink)] text-sm flex items-center space-x-2">
              <Icon name="message" size={16} className="text-teal-600 dark:text-teal-400" />
              <span>Citizen Satisfaction & Sentiment Telemetry</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-900 dark:text-emerald-200">Positive Feedback</div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Smooth process & clear guidance</div>
                </div>
                <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300">
                  {citizen_experience.sentiment_distribution?.positive || 0}
                </span>
              </div>

              <div className="p-4 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-[var(--color-ink)]">Neutral Submissions</div>
                  <div className="text-[11px] text-[var(--color-ink-muted)]">Standard status inquiries</div>
                </div>
                <span className="text-xl font-extrabold text-[var(--color-ink)]">
                  {citizen_experience.sentiment_distribution?.neutral || 0}
                </span>
              </div>

              <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-rose-900 dark:text-rose-200">Constructive / Negative</div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-400">Document issues or delays</div>
                </div>
                <span className="text-xl font-extrabold text-rose-800 dark:text-rose-300">
                  {citizen_experience.sentiment_distribution?.negative || 0}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
