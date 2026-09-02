import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, API_BASE_URL } from '../api/client'
import { Icon, DocumentCard, ErrorState } from '../components/Icon'

const STATUS_CONFIG = {
  OPEN: { bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800', label: 'Open / Unacknowledged', icon: 'inbox' },
  ACKNOWLEDGED: { bg: 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50 text-sky-900 dark:text-sky-300', badge: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800', label: 'Acknowledged', icon: 'file-text' },
  ASSIGNED: { bg: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-300', badge: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800', label: 'Assigned', icon: 'user' },
  UNDER_REVIEW: { bg: 'bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/50 text-teal-900 dark:text-teal-300', badge: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800', label: 'Under Active Review', icon: 'search' },
  AWAITING_CITIZEN: { bg: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50 text-purple-900 dark:text-purple-300', badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800', label: 'Awaiting Citizen Clarification', icon: 'alert-triangle' },
  ESCALATED: { bg: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50 text-orange-900 dark:text-orange-300', badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800', label: 'Escalated to Senior Review', icon: 'alert-triangle' },
  SENIOR_REVIEW: { bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-red-900 dark:text-red-300', badge: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800', label: 'Senior Officer Review', icon: 'shield' },
  RESOLVED: { bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-300', badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', label: 'Resolved', icon: 'check-circle' },
  REOPENED: { bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-300', badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800', label: 'Reopened by Citizen', icon: 'refresh' },
  CLOSED: { bg: 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-300', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700', label: 'Closed', icon: 'lock' },
}

export default function GrievanceReview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [grievance, setGrievance] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Action Modals
  const [modalType, setModalType] = useState(null) // 'INFO_REQUEST' | 'PUBLIC_REPLY' | 'INTERNAL_NOTE' | 'ESCALATE' | 'RESOLVE' | 'ASSIGN'
  const [actionInput, setActionInput] = useState('')
  const [extraInput, setExtraInput] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchGrievance = async () => {
    setLoading(true)
    try {
      const [resDetails, resHist] = await Promise.all([
        api.getGrievanceDetails(id),
        api.getGrievanceHistory(id).catch(() => ({ data: { timeline: [] } })),
      ])
      setGrievance(resDetails.data)
      setHistory(resHist.data?.timeline || [])
      setError(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to load grievance record.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGrievance()
  }, [id])

  const handleAction = async (e) => {
    e.preventDefault()
    setActionLoading(true)

    try {
      if (modalType === 'INFO_REQUEST') {
        await api.requestGrievanceInformation(grievance.id, { question_text: actionInput.trim() })
      } else if (modalType === 'PUBLIC_REPLY') {
        await api.respondToGrievance(grievance.id, { message_text: actionInput.trim() })
      } else if (modalType === 'INTERNAL_NOTE') {
        await api.addGrievanceInternalNote(grievance.id, { note_text: actionInput.trim() })
      } else if (modalType === 'ESCALATE') {
        await api.escalateGrievance(grievance.id, { reason: actionInput.trim(), priority: extraInput || 'HIGH' })
      } else if (modalType === 'RESOLVE') {
        await api.resolveGrievance(grievance.id, { resolution_notes: actionInput.trim(), resolution_category: extraInput || 'ISSUE_CLARIFIED' })
      } else if (modalType === 'ASSIGN') {
        await api.assignGrievance(grievance.id, { assigned_officer_name: actionInput.trim() })
      }

      setModalType(null)
      setActionInput('')
      setExtraInput('')
      await fetchGrievance()
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDirectAction = async (actionFn, confirmMsg = null) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return

    try {
      await actionFn(grievance.id)
      await fetchGrievance()
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed.')
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading grievance case review workspace...</p>
      </div>
    )
  }

  if (error || !grievance) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <ErrorState
          title="Error Accessing Grievance"
          description={error || 'Could not load grievance file.'}
          action={
            <Link to="/officer-grievance-queue" className="btn btn-sm btn-secondary">
              <Icon name="arrow-left" size={14} />
              <span>Back to Grievance Queue</span>
            </Link>
          }
        />
      </div>
    )
  }

  const statusStyle = STATUS_CONFIG[grievance.status] || STATUS_CONFIG.OPEN
  const isTerminal = grievance.status === 'CLOSED'

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
          <Link to="/officer-grievance-queue" className="hover:text-teal-600 dark:hover:text-teal-400 font-medium inline-flex items-center gap-1">
            <Icon name="arrow-left" size={12} />
            <span>Officer Grievance Queue</span>
          </Link>
          <span>/</span>
          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{grievance.public_reference}</span>
        </div>
        {grievance.application_id && (
          <Link
            to={`/officer?search=${grievance.application_id}`}
            className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-900 inline-flex items-center gap-1"
          >
            <span>Open Application in Officer Queue</span>
            <Icon name="external-link" size={12} />
          </Link>
        )}
      </div>

      {/* Case Header Banner */}
      <div className={`card p-6 space-y-4 border ${statusStyle.bg}`}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-extrabold text-sm sm:text-base text-teal-950 dark:text-teal-300 bg-white/90 dark:bg-slate-900/90 px-3 py-1 rounded-lg border border-teal-300 dark:border-teal-800 shadow-xs">
                {grievance.public_reference}
              </span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border inline-flex items-center gap-1.5 ${statusStyle.badge}`}>
                <Icon name={statusStyle.icon} size={12} />
                <span>{statusStyle.label}</span>
              </span>
              <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-full uppercase border border-slate-300 dark:border-slate-700">
                Priority: {grievance.priority}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight pt-1">
              {grievance.subject}
            </h1>
          </div>

          <div className="text-right space-y-0.5">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Citizen Applicant</div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{grievance.citizen_name}</div>
            <div className="text-[11px] text-slate-400 font-mono">
              Lodged: {grievance.created_at ? new Date(grievance.created_at).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        {!isTerminal && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {grievance.status === 'OPEN' && (
              <button
                type="button"
                onClick={() => handleDirectAction(api.acknowledgeGrievance)}
                className="btn btn-sm btn-primary"
              >
                <Icon name="check" size={14} />
                <span>Acknowledge Case</span>
              </button>
            )}

            {['OPEN', 'ACKNOWLEDGED'].includes(grievance.status) && (
              <button
                type="button"
                onClick={() => {
                  setModalType('ASSIGN')
                  setActionInput('Current Officer')
                }}
                className="btn btn-sm btn-secondary"
              >
                <Icon name="user" size={14} />
                <span>Assign Officer</span>
              </button>
            )}

            {['ASSIGNED', 'ACKNOWLEDGED'].includes(grievance.status) && (
              <button
                type="button"
                onClick={() => handleDirectAction(api.startGrievanceReview)}
                className="btn btn-sm btn-primary"
              >
                <Icon name="search" size={14} />
                <span>Start Active Review</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setModalType('INFO_REQUEST')
                setActionInput('')
              }}
              className="btn btn-sm btn-secondary"
            >
              <Icon name="help-circle" size={14} />
              <span>Request Clarification</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setModalType('PUBLIC_REPLY')
                setActionInput('')
              }}
              className="btn btn-sm btn-secondary"
            >
              <Icon name="message" size={14} />
              <span>Public Response</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setModalType('INTERNAL_NOTE')
                setActionInput('')
              }}
              className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
            >
              <Icon name="lock" size={14} />
              <span>+ Staff Internal Note</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setModalType('ESCALATE')
                setActionInput('')
                setExtraInput('HIGH')
              }}
              className="btn btn-sm bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
            >
              <Icon name="alert-triangle" size={14} />
              <span>Escalate to Senior Officer</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setModalType('RESOLVE')
                setActionInput('')
                setExtraInput('ISSUE_CLARIFIED')
              }}
              className="btn btn-sm bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700"
            >
              <Icon name="check-circle" size={14} />
              <span>Issue Formal Resolution</span>
            </button>

            <button
              type="button"
              onClick={() => handleDirectAction(api.closeGrievance, 'Close this grievance case file?')}
              className="btn btn-sm btn-ghost"
            >
              <Icon name="lock" size={14} />
              <span>Close Case</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Details + Communication */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Description & Interaction Messages */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submission Details */}
          <div className="card p-6 space-y-3">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Citizen Grievance Statement</h2>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {grievance.description}
            </p>

            {grievance.has_attachment && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Uploaded Evidence Document</div>
                <DocumentCard
                  filename={grievance.attachment_filename || 'Attachment File'}
                  fileUrl={`${API_BASE_URL}/api/grievances/${grievance.id}/attachment`}
                  sizeFormatted="Citizen Attachment"
                  isDownload={true}
                />
              </div>
            )}
          </div>

          {/* Communication Stream */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Icon name="messages" size={16} className="text-teal-600 dark:text-teal-400" />
                <span>Communication & Internal Notes</span>
              </h2>
              <span className="text-[11px] text-slate-400">Includes protected internal staff notes</span>
            </div>

            <div className="space-y-3">
              {(grievance.messages || []).map((m) => {
                const isInternal = m.is_internal
                const isCitizen = m.sender_type === 'citizen'

                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-xl text-xs space-y-1.5 border transition ${
                      isInternal
                        ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                        : isCitizen
                        ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                        : 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        {isInternal ? (
                          <span className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                            Staff Internal Note (Hidden from Citizen)
                          </span>
                        ) : (
                          <span className={isCitizen ? 'text-slate-800 dark:text-slate-200' : 'text-teal-900 dark:text-teal-300 font-bold'}>
                            {isCitizen ? 'Citizen Response' : 'Official Officer Reply'}
                          </span>
                        )}
                        <span className="text-slate-500 font-normal">by {m.sender_name}</span>
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {m.created_at ? new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{m.message_text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Case Metadata & Timeline */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="card p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Case File Metadata</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Grievance ID</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{grievance.public_reference}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Category</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{grievance.category_label || grievance.category}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Priority Level</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{grievance.priority}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Assigned Desk</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{grievance.assigned_officer_name || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">SLA Status</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{grievance.sla_status}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Reopen Count</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{grievance.reopen_count} / 2</span>
              </div>
            </div>
          </div>

          {/* Audit / Timeline Stream */}
          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="clock" size={14} className="text-teal-600" />
              <span>Investigation Audit Log</span>
            </h3>
            <div className="space-y-4 relative pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-teal-200 dark:before:bg-teal-900">
              {history.map((h, idx) => (
                <div key={idx} className="relative space-y-0.5 text-xs">
                  <span className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-teal-600 ring-2 ring-white dark:ring-slate-900" />
                  <div className="font-bold text-slate-800 dark:text-slate-200">{h.title}</div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">{h.description}</p>
                  {h.timestamp && (
                    <div className="text-[10px] text-slate-400 font-mono">{new Date(h.timestamp).toLocaleString()}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Modals */}
      {modalType && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {modalType === 'INFO_REQUEST' && 'Request Citizen Clarification'}
                {modalType === 'PUBLIC_REPLY' && 'Send Public Officer Response'}
                {modalType === 'INTERNAL_NOTE' && 'Add Protected Staff Note'}
                {modalType === 'ESCALATE' && 'Escalate Case to Senior Officer'}
                {modalType === 'RESOLVE' && 'Issue Formal Resolution'}
                {modalType === 'ASSIGN' && 'Assign Officer to Case'}
              </h3>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <form onSubmit={handleAction} className="space-y-4">
              {modalType === 'ESCALATE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Escalation Priority
                  </label>
                  <select
                    value={extraInput}
                    onChange={(e) => setExtraInput(e.target.value)}
                    className="select-field text-xs"
                  >
                    <option value="HIGH">High Priority</option>
                    <option value="CRITICAL">Critical / Urgent Statutory Review</option>
                  </select>
                </div>
              )}

              {modalType === 'RESOLVE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Resolution Category
                  </label>
                  <select
                    value={extraInput}
                    onChange={(e) => setExtraInput(e.target.value)}
                    className="select-field text-xs"
                  >
                    <option value="ISSUE_CLARIFIED">Issue Clarified with Citizen</option>
                    <option value="CORRECTION_GRANTED">Correction / Override Granted</option>
                    <option value="DECISION_UPHELD">Original Decision Formally Upheld</option>
                    <option value="POLICY_EXCEPTION">Policy Exception Documented</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {modalType === 'ASSIGN' ? 'Officer Username / Name' : 'Details / Notes'}
                </label>
                {modalType === 'ASSIGN' ? (
                  <input
                    type="text"
                    value={actionInput}
                    onChange={(e) => setActionInput(e.target.value)}
                    className="input-field text-xs"
                    placeholder="Enter officer username..."
                    required
                  />
                ) : (
                  <textarea
                    rows={4}
                    value={actionInput}
                    onChange={(e) => setActionInput(e.target.value)}
                    className="textarea-field text-xs"
                    placeholder="Enter message or decision notes..."
                    required
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="btn btn-sm btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !actionInput.trim()}
                  className="btn btn-sm btn-primary"
                >
                  {actionLoading ? 'Processing...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
