import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Icon, EmptyState } from '../components/Icon'

const STATUS_BADGES = {
  OPEN: { bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800', label: 'Open / Unacknowledged', icon: 'inbox' },
  ACKNOWLEDGED: { bg: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800', label: 'Acknowledged', icon: 'file-text' },
  ASSIGNED: { bg: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800', label: 'Assigned', icon: 'user' },
  UNDER_REVIEW: { bg: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800', label: 'Under Review', icon: 'search' },
  AWAITING_CITIZEN: { bg: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800', label: 'Awaiting Citizen Info', icon: 'alert-triangle' },
  ESCALATED: { bg: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800', label: 'Escalated', icon: 'alert-triangle' },
  SENIOR_REVIEW: { bg: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800', label: 'Senior Officer Review', icon: 'shield' },
  RESOLVED: { bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', label: 'Resolved', icon: 'check-circle' },
  REOPENED: { bg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800', label: 'Reopened by Citizen', icon: 'refresh' },
  CLOSED: { bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700', label: 'Closed', icon: 'lock' },
}

const PRIORITY_BADGES = {
  LOW: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  NORMAL: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300',
  HIGH: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold',
  URGENT: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 font-bold animate-pulse',
}

const SLA_BADGES = {
  NORMAL: { bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', label: 'Within SLA' },
  APPROACHING_SLA: { bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold', label: 'Approaching SLA' },
  OVERDUE: { bg: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 font-bold', label: 'Overdue SLA' },
  MET: { bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300', label: 'Resolved in SLA' },
  BREACHED: { bg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300', label: 'SLA Breached' },
}

export default function OfficerGrievanceQueue() {
  const [grievances, setGrievances] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedPriority, setSelectedPriority] = useState('')

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const params = {
        page,
        page_size: pageSize,
        ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
        ...(selectedCategory ? { category: selectedCategory } : {}),
        ...(selectedStatus ? { status: selectedStatus } : {}),
        ...(selectedPriority ? { priority: selectedPriority } : {}),
      }
      const res = await api.listGrievances(params)
      setGrievances(res.data?.items || [])
      setTotal(res.data?.total || 0)
      setError(null)
    } catch (err) {
      setError('Unable to load grievance queue. Please verify officer permissions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [page, selectedCategory, selectedStatus, selectedPriority])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    fetchQueue()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="card p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white border-teal-900/40 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 bg-teal-900/60 border border-teal-500/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span>Civic Redressal & Review Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Officer Grievance Queue</h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
            Examine citizen grievances, dispute claims, request missing evidence, and issue statutory resolutions under tracked SLAs.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs bg-slate-800/90 border border-slate-700 px-4 py-2.5 rounded-xl shadow-xs">
          <div>
            <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">Total Active Cases</span>
            <span className="text-base font-bold text-white font-mono">{total}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search by Ref ID, Citizen Name, Subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field text-xs"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setPage(1)
              }}
              className="select-field text-xs"
            >
              <option value="">All Categories</option>
              <option value="APPLICATION_DELAYED">Application Delayed</option>
              <option value="DOCUMENT_REJECTED">Document Rejected</option>
              <option value="CORRECTION_REQUEST_ISSUE">Correction Request Issue</option>
              <option value="INTERVIEW_ISSUE">Interview Issue</option>
              <option value="DECISION_DISPUTE">Decision Dispute</option>
              <option value="TECHNICAL_PROBLEM">Technical Problem</option>
              <option value="NOTIFICATION_PROBLEM">Notification Issue</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setPage(1)
              }}
              className="select-field text-xs"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="AWAITING_CITIZEN">Awaiting Citizen</option>
              <option value="ESCALATED">Escalated</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REOPENED">Reopened</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value)
                setPage(1)
              }}
              className="select-field text-xs"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <button
              type="submit"
              className="btn btn-sm btn-primary shrink-0"
            >
              <Icon name="filter" size={14} />
              <span>Filter</span>
            </button>
          </div>
        </form>
      </div>

      {/* Queue Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading grievance queue...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 dark:text-red-400 text-xs sm:text-sm font-semibold">{error}</div>
        ) : grievances.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No Grievances Match Criteria"
            description="Adjust your search keyword or filter dropdowns above."
          />
        ) : (
          <div className="table-responsive">
            <table className="civic-table">
              <thead>
                <tr>
                  <th className="py-3 px-4">Reference ID</th>
                  <th className="py-3 px-4">Citizen</th>
                  <th className="py-3 px-4">Category & Subject</th>
                  <th className="py-3 px-4">Linked App</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority & SLA</th>
                  <th className="py-3 px-4">Assigned Desk</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {grievances.map((g) => {
                  const statusStyle = STATUS_BADGES[g.status] || { bg: 'bg-slate-100 text-slate-700 border-slate-300', label: g.status, icon: 'info' }
                  const slaStyle = SLA_BADGES[g.sla_status] || { bg: 'bg-slate-100 text-slate-700', label: g.sla_status }
                  const priorityClass = PRIORITY_BADGES[g.priority] || PRIORITY_BADGES.NORMAL

                  return (
                    <tr key={g.id}>
                      <td className="py-3 px-4 font-mono font-bold text-teal-800 dark:text-teal-300">
                        {g.public_reference}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{g.citizen_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {g.created_at ? new Date(g.created_at).toLocaleDateString() : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          {g.category_label || g.category}
                        </div>
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate" title={g.subject}>
                          {g.subject}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {g.application_id ? (
                          <span className="font-mono text-xs text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                            {g.application_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">General</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${statusStyle.bg}`}>
                          <Icon name={statusStyle.icon} size={11} />
                          <span>{statusStyle.label}</span>
                        </span>
                        {g.reopen_count > 0 && (
                          <span className="ml-1 text-[10px] bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                            #{g.reopen_count}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        <div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${priorityClass}`}>
                            {g.priority}
                          </span>
                        </div>
                        <div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${slaStyle.bg}`}>
                            {slaStyle.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {g.assigned_officer_name || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/officer/grievances/${g.id}`}
                          className="btn btn-sm btn-secondary font-bold text-xs inline-flex items-center gap-1"
                        >
                          <span>Review</span>
                          <Icon name="chevron-right" size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {Math.min((page - 1) * pageSize + 1, total)} to {Math.min(page * pageSize, total)} of {total} records
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="btn btn-sm btn-secondary disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-sm btn-secondary disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
