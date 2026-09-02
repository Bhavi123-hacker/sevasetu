import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'

export default function ExecutiveCommandCenter() {
  const { staffUser } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [daysFilter, setDaysFilter] = useState('0')
  const [servicesList, setServicesList] = useState([])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (serviceFilter !== 'ALL') params.service_id = serviceFilter
      if (parseInt(daysFilter, 10) > 0) params.days = parseInt(daysFilter, 10)

      const [metricsRes, servRes] = await Promise.all([
        api.getCommandCenterMetrics(params),
        api.getServices().catch(() => ({ data: [] })),
      ])
      setData(metricsRes.data)
      setServicesList(servRes.data || [])
    } catch (err) {
      console.error('Failed to load command center metrics:', err)
      setError(err.response?.data?.detail || 'Unable to retrieve live relational database telemetry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [serviceFilter, daysFilter])

  const overview = data?.overview || {}
  const sla = data?.sla_health || {}
  const perf = data?.performance || {}
  const grv = data?.grievances || {}
  const officers = Array.isArray(data?.officers) ? data.officers : []
  const services = Array.isArray(data?.service_performance) ? data.service_performance : []
  const meta = data?.metadata || {}

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-2">
      {/* Top Header Card */}
      <div className="card p-6 sm:p-8 space-y-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white border-teal-800/40 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-extrabold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Executive Command Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight m-0">
              Institutional Case Telemetry & SLA Engine
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl m-0 leading-relaxed">
              Real-time administrative operations, officer assignment workloads, statutory SLA health, and grievance resolution tracking. Sourced directly from live relational database records.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="btn btn-secondary btn-sm text-white border-white/20 hover:bg-white/10 text-xs font-bold"
            >
              <Icon name="refresh" size={13} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
            </button>
            <Link
              to="/officer-queue"
              className="btn btn-primary btn-sm font-bold text-xs shadow-md"
            >
              <Icon name="inbox" size={13} />
              <span>Officer Queue</span>
            </Link>
          </div>
        </div>

        {/* Live Data Source Notice */}
        <div className="pt-3 border-t border-teal-900/80 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-teal-200">
          <div className="flex items-center gap-2">
            <Icon name="database" size={13} className="text-teal-400" />
            <span><strong>Data Source:</strong> {meta.data_source || 'Live relational database'}</span>
          </div>
          <div>
            <span>Last refreshed: <strong>{meta.last_refreshed ? new Date(meta.last_refreshed).toLocaleTimeString() : 'Just now'}</strong></span>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase tracking-wider text-[11px]">Service Filter:</span>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="select-field py-1.5 px-3 text-xs font-bold"
            >
              <option value="ALL">All Civic Services ({servicesList.length})</option>
              {servicesList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase tracking-wider text-[11px]">Time Window:</span>
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value)}
              className="select-field py-1.5 px-3 text-xs font-bold"
            >
              <option value="0">All Time (Complete Registry)</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last Quarter (90 Days)</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Viewer Role: <strong className="text-teal-700 dark:text-teal-400 font-bold">{staffUser?.role || meta.caller_role}</strong>
        </div>
      </div>

      {error && (
        <div className="card p-6 border-red-300 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 text-center space-y-2">
          <p className="text-xs font-bold text-red-700 dark:text-red-300 m-0">{error}</p>
          <button onClick={loadData} className="btn btn-secondary btn-sm text-xs">Retry</button>
        </div>
      )}

      {/* 1. Application Overview & SLA Health Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="card p-4 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-[10.5px] uppercase font-bold tracking-wider block">
            Total Applications
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {overview.total_applications || 0}
          </div>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold block">Registered Cases</span>
        </div>

        <div className="card p-4 space-y-1 border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10">
          <span className="text-amber-800 dark:text-amber-300 text-[10.5px] uppercase font-bold tracking-wider block">
            Pending Review
          </span>
          <div className="text-2xl font-black text-amber-900 dark:text-amber-200">
            {overview.pending_review || 0}
          </div>
          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold block">Awaiting Officer Action</span>
        </div>

        <div className="card p-4 space-y-1 border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/10">
          <span className="text-blue-800 dark:text-blue-300 text-[10.5px] uppercase font-bold tracking-wider block">
            Interview Gate
          </span>
          <div className="text-2xl font-black text-blue-900 dark:text-blue-200">
            {overview.interviews_pending || 0}
          </div>
          <span className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold block">Active Citizen Sessions</span>
        </div>

        <div className="card p-4 space-y-1 border-purple-200 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/10">
          <span className="text-purple-800 dark:text-purple-300 text-[10.5px] uppercase font-bold tracking-wider block">
            Final Review
          </span>
          <div className="text-2xl font-black text-purple-900 dark:text-purple-200">
            {overview.final_review || 0}
          </div>
          <span className="text-[10px] text-purple-700 dark:text-purple-400 font-semibold block">Senior Determination</span>
        </div>

        <div className="card p-4 space-y-1 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10">
          <span className="text-emerald-800 dark:text-emerald-300 text-[10.5px] uppercase font-bold tracking-wider block">
            Approved
          </span>
          <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
            {overview.approved || 0}
          </div>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block">Certificates Issued</span>
        </div>

        <div className="card p-4 space-y-1 border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10">
          <span className="text-red-800 dark:text-red-300 text-[10.5px] uppercase font-bold tracking-wider block">
            Rejected
          </span>
          <div className="text-2xl font-black text-red-900 dark:text-red-200">
            {overview.rejected || 0}
          </div>
          <span className="text-[10px] text-red-700 dark:text-red-400 font-semibold block">Formal Decision Notices</span>
        </div>
      </div>

      {/* 2. Statutory SLA Engine & Turnaround Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SLA Health Card */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 m-0 flex items-center gap-2">
              <Icon name="clock" size={16} className="text-teal-600 dark:text-teal-400" />
              <span>Statutory SLA Compliance</span>
            </h2>
            <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
              {sla.compliance_pct || 100}% On-Time
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10.5px] text-emerald-800 dark:text-emerald-300 uppercase font-bold block">Normal</span>
              <span className="text-xl font-black text-emerald-950 dark:text-emerald-200 block">{sla.normal || 0}</span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Within Standard SLA</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <span className="text-[10.5px] text-amber-800 dark:text-amber-300 uppercase font-bold block">Approaching</span>
              <span className="text-xl font-black text-amber-950 dark:text-amber-200 block">{sla.approaching_sla || 0}</span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400">&lt; 48h to Deadline</span>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <span className="text-[10.5px] text-red-800 dark:text-red-300 uppercase font-bold block">Overdue</span>
              <span className="text-xl font-black text-red-950 dark:text-red-200 block">{sla.overdue || 0}</span>
              <span className="text-[10px] text-red-700 dark:text-red-400">Statutory Breach</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Average Turnaround Time:</span>
              <strong className="font-mono">{perf.average_processing_hours || 0} hours</strong>
            </div>
            <div className="flex justify-between">
              <span>Median Turnaround Time:</span>
              <strong className="font-mono">{perf.median_processing_hours || 0} hours</strong>
            </div>
            <div className="flex justify-between">
              <span>Cases Resolved Within SLA:</span>
              <strong className="font-mono">{perf.completed_within_sla || 0} / {overview.total_applications || 0}</strong>
            </div>
          </div>
        </div>

        {/* Civic Grievance Redressal Health */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 m-0 flex items-center gap-2">
              <Icon name="message" size={16} className="text-teal-600 dark:text-teal-400" />
              <span>Civic Grievance Redressal</span>
            </h2>
            <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {grv.resolution_rate_pct || 100}% Resolved
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-[10.5px] text-slate-500 uppercase font-bold block">Open & Assigned</span>
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 block">{(grv.open || 0) + (grv.under_review || 0)}</span>
              <span className="text-[10px] text-slate-400">Active Inquiries</span>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
              <span className="text-[10.5px] text-purple-800 dark:text-purple-300 uppercase font-bold block">Escalated</span>
              <span className="text-xl font-black text-purple-950 dark:text-purple-200 block">{grv.escalated || 0}</span>
              <span className="text-[10px] text-purple-700 dark:text-purple-400">Senior Reconsideration</span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10.5px] text-emerald-800 dark:text-emerald-300 uppercase font-bold block">Resolved</span>
              <span className="text-xl font-black text-emerald-950 dark:text-emerald-200 block">{grv.resolved || 0}</span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Closed with Redressal</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Total Grievances Lodged:</span>
              <strong className="font-mono">{grv.total || 0}</strong>
            </div>
            <div className="flex justify-between">
              <span>Reopened Cases:</span>
              <strong className="font-mono">{grv.reopened || 0}</strong>
            </div>
            <div className="flex justify-between">
              <span>Grievance Queue:</span>
              <Link to="/officer-grievance-queue" className="text-teal-600 dark:text-teal-400 font-bold hover:underline">
                View Grievance Queue →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Officer Workload & Allocation Table */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 m-0 flex items-center gap-2">
            <Icon name="users" size={16} className="text-teal-600 dark:text-teal-400" />
            <span>Officer Workload Distribution & SLA Risk</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {officers.length} Active Verification Officers
          </span>
        </div>

        <div className="table-responsive">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="pb-2">Officer</th>
                <th className="pb-2">Role</th>
                <th className="pb-2 text-center">Assigned Cases</th>
                <th className="pb-2 text-center">Pending Review</th>
                <th className="pb-2 text-center">Completed Decisions</th>
                <th className="pb-2 text-center">Overdue Cases</th>
                <th className="pb-2 text-right">SLA Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {officers.map((off) => (
                <tr key={off.username} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 font-bold text-slate-900 dark:text-slate-100">
                    {off.name} <span className="text-slate-400 font-normal">(@{off.username})</span>
                  </td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-400">
                    <span className="badge badge-neutral text-[10px]">{off.role}</span>
                  </td>
                  <td className="py-2.5 text-center font-mono font-bold">{off.assigned}</td>
                  <td className="py-2.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">{off.pending}</td>
                  <td className="py-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{off.completed}</td>
                  <td className="py-2.5 text-center font-mono font-bold text-red-600 dark:text-red-400">{off.sla_overdue}</td>
                  <td className="py-2.5 text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      off.sla_risk === 'HIGH'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}>
                      {off.sla_risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Service Breakdown Table */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 m-0 flex items-center gap-2">
            <Icon name="sliders" size={16} className="text-teal-600 dark:text-teal-400" />
            <span>Civic Service Intake & Resolution Breakdown</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {services.length} Monitored Schemes
          </span>
        </div>

        <div className="table-responsive">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="pb-2">Service Scheme</th>
                <th className="pb-2 text-center">Total Volume</th>
                <th className="pb-2 text-center">Approved</th>
                <th className="pb-2 text-center">Rejected</th>
                <th className="pb-2 text-center">SLA Breaches</th>
                <th className="pb-2 text-right">SLA Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {services.map((s) => (
                <tr key={s.service_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 font-bold text-slate-900 dark:text-slate-100">
                    {s.service_name}
                  </td>
                  <td className="py-2.5 text-center font-mono font-bold">{s.total_applications}</td>
                  <td className="py-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{s.approved}</td>
                  <td className="py-2.5 text-center font-mono font-bold text-red-600 dark:text-red-400">{s.rejected}</td>
                  <td className="py-2.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">{s.overdue}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-teal-700 dark:text-teal-300">
                    {s.sla_compliance_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
