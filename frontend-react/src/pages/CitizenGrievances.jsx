import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import RaiseGrievanceModal from '../components/RaiseGrievanceModal'
import { Icon, EmptyState, ErrorState } from '../components/Icon'

const STATUS_BADGES = {
  OPEN: { bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800', label: 'Lodged / Open', icon: 'inbox' },
  ACKNOWLEDGED: { bg: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800', label: 'Acknowledged', icon: 'file-text' },
  ASSIGNED: { bg: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800', label: 'Officer Assigned', icon: 'user' },
  UNDER_REVIEW: { bg: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800', label: 'Under Review', icon: 'search' },
  AWAITING_CITIZEN: { bg: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800', label: 'Action Required (Citizen)', icon: 'alert-triangle' },
  ESCALATED: { bg: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800', label: 'Escalated', icon: 'alert-triangle' },
  SENIOR_REVIEW: { bg: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800', label: 'Senior Officer Review', icon: 'shield' },
  RESOLVED: { bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', label: 'Resolved', icon: 'check-circle' },
  REOPENED: { bg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800', label: 'Reopened / In Review', icon: 'refresh' },
  CLOSED: { bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700', label: 'Closed', icon: 'lock' },
}

const SLA_BADGES = {
  NORMAL: { bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', label: 'Within SLA' },
  APPROACHING_SLA: { bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300', label: 'Approaching SLA' },
  OVERDUE: { bg: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300', label: 'Overdue SLA' },
  MET: { bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300', label: 'Resolved in SLA' },
  BREACHED: { bg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300', label: 'SLA Breached' },
}

export default function CitizenGrievances() {
  const [grievances, setGrievances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showRaiseModal, setShowRaiseModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')

  const fetchGrievances = async () => {
    setLoading(true)
    try {
      const res = await api.listGrievances()
      setGrievances(res.data?.items || [])
      setError(null)
    } catch (err) {
      setError('Unable to load grievances. Please ensure you are logged in.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGrievances()
  }, [])

  const filtered = (Array.isArray(grievances) ? grievances : []).filter((g) => {
    if (statusFilter === 'ACTIVE') {
      return !['RESOLVED', 'CLOSED'].includes(g.status)
    }
    if (statusFilter === 'RESOLVED') {
      return ['RESOLVED', 'CLOSED'].includes(g.status)
    }
    return true
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Page Header Banner */}
      <div className="card p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white border-teal-900/40 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 bg-teal-900/60 border border-teal-500/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Civic Redressal & Support</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Citizen Grievance Portal</h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
            Lodge service disputes, track statutory investigation progress, and submit clarification responses under tracked SLAs.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowRaiseModal(true)}
            className="btn btn-primary shadow-md w-full sm:w-auto"
          >
            <Icon name="message" size={16} />
            <span>Lodge Grievance</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
            statusFilter === 'ALL'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All ({grievances.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('ACTIVE')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
            statusFilter === 'ACTIVE'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          In Progress ({grievances.filter((g) => !['RESOLVED', 'CLOSED'].includes(g.status)).length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('RESOLVED')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
            statusFilter === 'RESOLVED'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Resolved ({grievances.filter((g) => ['RESOLVED', 'CLOSED'].includes(g.status)).length})
        </button>
      </div>

      {/* Grievances List */}
      {loading ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading grievance records...</p>
        </div>
      ) : error ? (
        <ErrorState
          title="Unable to Load Grievances"
          description={error}
          onRetry={fetchGrievances}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="grievance"
          title="No Grievances Found"
          description="You do not have any registered grievances under this filter. If you are experiencing difficulties with an application, feel free to lodge one."
          action={
            <button
              type="button"
              onClick={() => setShowRaiseModal(true)}
              className="btn btn-primary btn-sm"
            >
              <Icon name="message" size={14} />
              <span>Lodge Grievance</span>
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((g) => {
            const statusConfig = STATUS_BADGES[g.status] || { bg: 'bg-slate-100 text-slate-700 border-slate-300', label: g.status, icon: 'info' }
            const slaConfig = SLA_BADGES[g.sla_status] || { bg: 'bg-slate-100 text-slate-700', label: g.sla_status }

            return (
              <div
                key={g.id}
                className="card p-5 hover:border-teal-600 dark:hover:border-teal-500 transition space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded-lg text-xs">
                      {g.public_reference}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {g.category_label || g.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${statusConfig.bg}`}>
                      <Icon name={statusConfig.icon} size={11} />
                      <span>{statusConfig.label}</span>
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${slaConfig.bg}`}>
                      {slaConfig.label}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 transition">
                    <Link to={`/grievances/${g.id}`}>{g.subject}</Link>
                  </h3>
                  {g.application_id && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                      <span>Linked Application:</span>
                      <Link to={`/status?id=${g.application_id}`} className="font-mono font-semibold text-teal-700 dark:text-teal-400 hover:underline">
                        {g.application_id}
                      </Link>
                      {g.service_type && <span className="text-slate-400">({g.service_type})</span>}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-50 dark:border-slate-800/60">
                  <div className="flex items-center gap-4 flex-wrap text-[11px]">
                    <span>Lodged: {g.created_at ? new Date(g.created_at).toLocaleDateString() : 'N/A'}</span>
                    {g.assigned_officer_name && (
                      <span className="text-slate-600 dark:text-slate-300">Assigned: {g.assigned_officer_name}</span>
                    )}
                    {g.reopen_count > 0 && (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        Reopened ({g.reopen_count}/2)
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/grievances/${g.id}`}
                    className="inline-flex items-center gap-1 font-bold text-teal-700 dark:text-teal-400 hover:text-teal-900 transition text-xs"
                  >
                    <span>View Timeline & Updates</span>
                    <Icon name="chevron-right" size={14} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Raise Modal */}
      <RaiseGrievanceModal
        isOpen={showRaiseModal}
        onClose={() => setShowRaiseModal(false)}
        onSuccess={() => {
          fetchGrievances()
        }}
      />
    </div>
  )
}
