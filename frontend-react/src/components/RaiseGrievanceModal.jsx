import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Icon } from './Icon'

const GRIEVANCE_CATEGORIES = [
  { value: 'APPLICATION_DELAYED', label: 'Application Delayed / SLA Exceeded' },
  { value: 'DOCUMENT_REJECTED', label: 'Document Rejected / Format Dispute' },
  { value: 'CORRECTION_REQUEST_ISSUE', label: 'Correction Request Unclear' },
  { value: 'INTERVIEW_ISSUE', label: 'Verification Interview Issue' },
  { value: 'DECISION_DISPUTE', label: 'Decision Dispute / Calculation Error' },
  { value: 'TECHNICAL_PROBLEM', label: 'Technical Problem / Portal Error' },
  { value: 'NOTIFICATION_PROBLEM', label: 'Notification / Communication Issue' },
  { value: 'OTHER', label: 'Other Civic Grievance / General Inquiry' },
]

export default function RaiseGrievanceModal({ isOpen, onClose, applicationId = null, serviceType = null, onSuccess = null }) {
  const [category, setCategory] = useState('APPLICATION_DELAYED')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successData, setSuccessData] = useState(null)

  if (!isOpen) return null

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File exceeds maximum size of 10MB.')
        return
      }
      setAttachment(file)
      setError(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!subject.trim() || subject.trim().length < 3) {
      setError('Please provide a subject (minimum 3 characters).')
      return
    }

    if (!description.trim() || description.trim().length < 10) {
      setError('Please provide detailed grievance description (minimum 10 characters).')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('subject', subject.trim())
      formData.append('description', description.trim())
      formData.append('category', category)
      if (applicationId) {
        formData.append('application_id', applicationId)
      }
      if (attachment) {
        formData.append('attachment', attachment)
      }

      const res = await api.createGrievance(formData)
      setSuccessData(res.data)
      if (onSuccess) {
        onSuccess(res.data)
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to lodge grievance. Please check your inputs.'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  const handleResetAndClose = () => {
    setSubject('')
    setDescription('')
    setAttachment(null)
    setError(null)
    setSuccessData(null)
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="raise-grievance-title"
    >
      <div className="modal-content max-w-lg">
        {/* Header */}
        <div className="modal-header bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Icon name="grievance" size={18} className="text-teal-400" />
            <h2 id="raise-grievance-title" className="text-base font-bold text-white">
              {applicationId ? 'Lodge Application Grievance' : 'Lodge Civic Grievance'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
            aria-label="Close dialog"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="modal-body space-y-4">
          {successData ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Icon name="check" size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Grievance Registered Successfully</h3>
              <div className="card p-4 text-left space-y-2 bg-slate-50 dark:bg-slate-800/40">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Reference Number:</span>
                  <span className="font-mono font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                    {successData.public_reference}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Category:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{successData.category_label || successData.category}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Status:</span>
                  <span className="bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded-full font-bold">
                    {successData.status}
                  </span>
                </div>
                {successData.sla_deadline && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">SLA Target:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {new Date(successData.sla_deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                A verification officer has been assigned to examine your submission. You can track progress and respond to inquiries anytime.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Link
                  to={`/grievances/${successData.grievance_id || successData.id}`}
                  onClick={handleResetAndClose}
                  className="btn btn-primary btn-sm"
                >
                  <span>Track Grievance →</span>
                </Link>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="btn btn-secondary btn-sm"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {applicationId && (
                <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl p-3 flex items-center justify-between text-xs">
                  <span className="text-teal-900 dark:text-teal-300 font-semibold">Linked Application:</span>
                  <span className="font-mono font-bold text-teal-800 dark:text-teal-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                    {applicationId} {serviceType ? `(${serviceType})` : ''}
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-start gap-2">
                  <Icon name="alert-circle" size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="grievance-category" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Grievance Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="grievance-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="select-field text-xs"
                  required
                >
                  {GRIEVANCE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="grievance-subject" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Subject / Summary <span className="text-red-500">*</span>
                </label>
                <input
                  id="grievance-subject"
                  type="text"
                  placeholder="e.g. Document rejected despite matching original requirements"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input-field text-xs"
                  maxLength={250}
                  required
                />
              </div>

              <div>
                <label htmlFor="grievance-description" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Detailed Explanation <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="grievance-description"
                  rows={4}
                  placeholder="Provide full details of your issue, dates, reasons, or specific officer feedback you are disputing..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="textarea-field text-xs"
                  required
                />
              </div>

              <div>
                <label htmlFor="grievance-attachment" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Supporting Document / Evidence (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="grievance-attachment"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileChange}
                    className="text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 cursor-pointer"
                  />
                  {attachment && (
                    <span className="text-xs text-teal-700 dark:text-teal-400 font-medium truncate max-w-[150px]">
                      {attachment.name}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">PDF, PNG, JPG, or WEBP up to 10MB.</p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-sm"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Grievance</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
