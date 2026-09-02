import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, API_BASE_URL } from '../api/client'
import { Icon, DocumentCard, ErrorState } from '../components/Icon'

const STATUS_CONFIG = {
  OPEN: { bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800', label: 'Lodged / Open', icon: 'inbox' },
  ACKNOWLEDGED: { bg: 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50 text-sky-900 dark:text-sky-300', badge: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800', label: 'Acknowledged by Desk', icon: 'file-text' },
  ASSIGNED: { bg: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-300', badge: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800', label: 'Officer Assigned', icon: 'user' },
  UNDER_REVIEW: { bg: 'bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/50 text-teal-900 dark:text-teal-300', badge: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800', label: 'Under Active Examination', icon: 'search' },
  AWAITING_CITIZEN: { bg: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50 text-purple-900 dark:text-purple-300', badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800', label: 'Action Required: Clarification Requested', icon: 'alert-triangle' },
  ESCALATED: { bg: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50 text-orange-900 dark:text-orange-300', badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800', label: 'Escalated', icon: 'alert-triangle' },
  SENIOR_REVIEW: { bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-red-900 dark:text-red-300', badge: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800', label: 'Senior Officer Investigation', icon: 'shield' },
  RESOLVED: { bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-300', badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', label: 'Resolved', icon: 'check-circle' },
  REOPENED: { bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-300', badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800', label: 'Reopened (Reconsideration Request)', icon: 'refresh' },
  CLOSED: { bg: 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-300', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700', label: 'Closed', icon: 'lock' },
}

export default function GrievanceDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [grievance, setGrievance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Citizen Response Form state
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  // Reopen Modal state
  const [showReopenModal, setShowReopenModal] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [submittingReopen, setSubmittingReopen] = useState(false)

  // Close Action state
  const [closing, setClosing] = useState(false)

  const fetchDetails = async () => {
    setLoading(true)
    try {
      const res = await api.getGrievanceDetails(id)
      setGrievance(res.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to load grievance details. You may not have permission to view this.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetails()
  }, [id])

  const handleSendReply = async (e) => {
    e.preventDefault()
    if (!replyText.trim()) return

    setSubmittingReply(true)
    try {
      await api.respondToGrievance(grievance.id, { message_text: replyText.trim() })
      setReplyText('')
      await fetchDetails()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit response.')
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleReopen = async (e) => {
    e.preventDefault()
    if (!reopenReason.trim()) return

    setSubmittingReopen(true)
    try {
      await api.reopenGrievance(grievance.id, { reopen_reason: reopenReason.trim() })
      setShowReopenModal(false)
      setReopenReason('')
      await fetchDetails()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reopen grievance.')
    } finally {
      setSubmittingReopen(false)
    }
  }

  const handleCloseGrievance = async () => {
    if (!window.confirm('Are you sure you want to mark this grievance as CLOSED? This confirms your issue has been settled.')) {
      return
    }

    setClosing(true)
    try {
      await api.closeGrievance(grievance.id, { feedback: 'Closed by citizen.' })
      await fetchDetails()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to close grievance.')
    } finally {
      setClosing(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading grievance case file...</p>
      </div>
    )
  }

  if (error || !grievance) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <ErrorState
          title="Grievance Access Restricted / Not Found"
          description={error || 'The requested grievance record could not be found or access is not authorized.'}
          action={
            <Link to="/grievances" className="btn btn-sm btn-secondary">
              <Icon name="arrow-left" size={14} />
              <span>Back to My Grievances</span>
            </Link>
          }
        />
      </div>
    )
  }

  const statusStyle = STATUS_CONFIG[grievance.status] || STATUS_CONFIG.OPEN
  const isTerminal = grievance.status === 'CLOSED'
  const isResolved = grievance.status === 'RESOLVED'
  const canReopen = isResolved && grievance.reopen_count < 2

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/grievances" className="hover:text-teal-600 dark:hover:text-teal-400 font-medium inline-flex items-center gap-1">
          <Icon name="arrow-left" size={12} />
          <span>My Grievances</span>
        </Link>
        <span>/</span>
        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{grievance.public_reference}</span>
      </div>

      {/* Case Header Card */}
      <div className={`card p-6 space-y-4 border ${statusStyle.bg}`}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/5 dark:border-white/5 pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-extrabold text-sm sm:text-base text-teal-900 dark:text-teal-300 bg-white/90 dark:bg-slate-900/90 px-3 py-1 rounded-lg border border-teal-300 dark:border-teal-800 shadow-xs">
                {grievance.public_reference}
              </span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border inline-flex items-center gap-1.5 ${statusStyle.badge}`}>
                <Icon name={statusStyle.icon} size={12} />
                <span>{statusStyle.label}</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight pt-1">
              {grievance.subject}
            </h1>
          </div>

          <div className="text-right space-y-0.5">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Lodged On</div>
            <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
              {grievance.created_at ? new Date(grievance.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[11px] uppercase tracking-wider mb-0.5">Category</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{grievance.category_label || grievance.category}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[11px] uppercase tracking-wider mb-0.5">Linked Application</span>
            {grievance.application_id ? (
              <Link to={`/status?id=${grievance.application_id}`} className="font-mono font-bold text-teal-700 dark:text-teal-400 hover:underline">
                {grievance.application_id}
              </Link>
            ) : (
              <span className="text-slate-500">General Redressal</span>
            )}
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[11px] uppercase tracking-wider mb-0.5">Assigned Officer</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{grievance.assigned_officer_name || 'Desk Queue'}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[11px] uppercase tracking-wider mb-0.5">SLA Target</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {grievance.sla_deadline ? new Date(grievance.sla_deadline).toLocaleDateString() : '7 Business Days'}
            </span>
          </div>
        </div>

        {/* Action required alert for citizen */}
        {grievance.status === 'AWAITING_CITIZEN' && (
          <div className="bg-purple-100 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 rounded-xl p-4 text-purple-900 dark:text-purple-300 text-xs sm:text-sm flex items-start gap-3">
            <Icon name="alert-triangle" size={18} className="text-purple-700 dark:text-purple-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Officer Requested Clarification</span>
              <span>Please review the inquiry below and submit your response to proceed with the examination.</span>
            </div>
          </div>
        )}

        {/* Official Resolution Banner */}
        {grievance.resolution_notes && (
          <div className="bg-emerald-100/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4 text-emerald-950 dark:text-emerald-200 text-xs sm:text-sm space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-300">
              <Icon name="check-circle" size={18} className="text-emerald-700 dark:text-emerald-400" />
              <span>Official Grievance Resolution</span>
            </div>
            <p className="text-xs sm:text-sm pl-6 text-emerald-900 dark:text-emerald-300 leading-relaxed font-medium">
              {grievance.resolution_notes}
            </p>
          </div>
        )}
      </div>

      {/* Case Description & Original Attachment Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Icon name="file-text" size={16} className="text-teal-600 dark:text-teal-400" />
          <span>Original Grievance Submission</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {grievance.description}
        </p>

        {grievance.has_attachment && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Attached Evidence</div>
            <DocumentCard
              filename={grievance.attachment_filename || 'Evidence File'}
              fileUrl={`${API_BASE_URL}/api/grievances/${grievance.id}/attachment`}
              sizeFormatted="Uploaded Evidence"
            />
          </div>
        )}
      </div>

      {/* Statutory Investigation Timeline */}
      <div className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Icon name="clock" size={16} className="text-teal-600 dark:text-teal-400" />
          <span>Progress & Investigation Timeline</span>
        </h2>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-teal-200 dark:before:bg-teal-900">
          {(grievance.timeline || []).map((t, idx) => (
            <div key={idx} className="relative space-y-1">
              <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-teal-600 dark:bg-teal-400 ring-4 ring-teal-50 dark:ring-teal-950" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{t.title}</span>
                {t.timestamp && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(t.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Communication Thread (Chat Style Cards) */}
      <div className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Icon name="message-square" size={16} className="text-teal-600 dark:text-teal-400" />
          <span>Communication & Clarification History</span>
        </h2>

        <div className="space-y-3">
          {(grievance.messages || []).map((m) => {
            const isCitizen = m.sender_type === 'citizen'
            return (
              <div
                key={m.id}
                className={`p-4 rounded-xl text-xs space-y-1.5 border transition ${
                  isCitizen
                    ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 ml-4 sm:ml-8'
                    : 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/60 mr-4 sm:mr-8'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className={`inline-flex items-center gap-1.5 ${isCitizen ? 'text-slate-800 dark:text-slate-200' : 'text-teal-900 dark:text-teal-300 font-bold'}`}>
                    <Icon name={isCitizen ? 'user' : 'shield'} size={12} />
                    <span>{isCitizen ? 'You (Citizen)' : m.sender_name || 'Verification Desk Officer'}</span>
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                    {m.created_at ? new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{m.message_text}</p>
              </div>
            )
          })}
        </div>

        {/* Reply form if active */}
        {!isTerminal && (
          <form onSubmit={handleSendReply} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <label htmlFor="reply-text" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Send Clarification / Message
            </label>
            <textarea
              id="reply-text"
              rows={3}
              placeholder="Type your message or response here..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="textarea-field"
              required
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingReply || !replyText.trim()}
                className="btn btn-primary btn-sm"
              >
                {submittingReply ? (
                  <span>Sending...</span>
                ) : (
                  <>
                    <Icon name="send" size={14} />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Citizen Action Footer */}
      {!isTerminal && (
        <div className="card p-5 flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/40">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Satisfied with the resolution?</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">You can mark this case closed, or request formal reconsideration if unresolved.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {canReopen && (
              <button
                type="button"
                onClick={() => setShowReopenModal(true)}
                className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
              >
                <Icon name="refresh" size={14} />
                <span>Request Reconsideration ({2 - grievance.reopen_count} remaining)</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCloseGrievance}
              disabled={closing}
              className="btn btn-sm btn-secondary"
            >
              <Icon name="lock" size={14} />
              <span>{closing ? 'Closing...' : 'Close Grievance'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Reconsideration Modal */}
      {showReopenModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Icon name="alert-triangle" size={20} />
              <h3 className="text-base font-bold">Request Reconsideration</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              If the resolution did not address your grievance or there are remaining factual disputes, explain below for senior officer review.
            </p>
            <form onSubmit={handleReopen} className="space-y-3">
              <textarea
                rows={4}
                placeholder="Explain why the resolution is insufficient or what additional action is required..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="textarea-field"
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="btn btn-sm btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReopen || !reopenReason.trim()}
                  className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                >
                  {submittingReopen ? 'Submitting...' : 'Submit Reconsideration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
