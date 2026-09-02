import React from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'

/**
 * Standardized Civic Application Lifecycle Tracker for SevaSetu.
 * Unifies the 6-stage lifecycle visualization across Check Status and Verification Results.
 */

const STAGES = [
  { id: 'SUBMITTED', label: '1. Submitted', short: 'Submitted' },
  { id: 'AUTO_VERIFICATION', label: '2. Auto Pre-Verification', short: 'Pre-Verification' },
  { id: 'OFFICER_REVIEW', label: '3. Officer Document Review', short: 'Officer Review' },
  { id: 'INTERVIEW', label: '4. Verification Interview', short: 'AI Interview' },
  { id: 'FINAL_REVIEW', label: '5. Final Officer Review', short: 'Final Review' },
  { id: 'DECISION', label: '6. Decision', short: 'Decision' },
]

export function getLifecycleStageIndex(status) {
  switch (status) {
    case 'DRAFT':
    case 'SUBMITTED':
      return 0
    case 'PROCESSING':
    case 'AUTO_VERIFICATION':
      return 1
    case 'NEEDS_CORRECTION':
    case 'RESUBMITTED':
    case 'READY_FOR_REVIEW':
      return 2
    case 'INTERVIEW_ELIGIBLE':
    case 'INTERVIEW_IN_PROGRESS':
      return 3
    case 'INTERVIEW_COMPLETED':
    case 'FINAL_OFFICER_REVIEW':
      return 4
    case 'APPROVED':
    case 'REJECTED':
      return 5
    default:
      return 2
  }
}

export default function ApplicationLifecycleView({
  status = 'READY_FOR_REVIEW',
  applicationId,
  trackingToken,
  serviceName = 'Civic Application',
  citizenName,
  readinessScore,
  riskLevel,
  correctionReason,
  correctionDetails,
  resolvedBy,
  showActionCard = true,
  onStartInterview,
}) {
  const currentStageIndex = getLifecycleStageIndex(status)
  const isApproved = status === 'APPROVED'
  const isRejected = status === 'REJECTED'
  const isNeedsCorrection = status === 'NEEDS_CORRECTION'
  const isInterviewEligible = status === 'INTERVIEW_ELIGIBLE'
  const isInterviewInProgress = status === 'INTERVIEW_IN_PROGRESS'
  const isFinalReview = status === 'FINAL_OFFICER_REVIEW' || status === 'INTERVIEW_COMPLETED'
  const isReadyForReview = status === 'READY_FOR_REVIEW'

  return (
    <div className="space-y-4">
      {/* 6-Stage Horizontal Step Bar */}
      <div className="card p-4 sm:p-5">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex || (idx === 5 && (isApproved || isRejected))
            const isCurrent = idx === currentStageIndex && !(idx === 5 && (isApproved || isRejected))

            let badgeBg = 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
            let iconName = 'clock'

            if (isCompleted) {
              badgeBg = isRejected && idx === 5
                ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              iconName = isRejected && idx === 5 ? 'x' : 'check'
            } else if (isCurrent) {
              badgeBg = isNeedsCorrection
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-700 ring-2 ring-amber-200 dark:ring-amber-900/50'
                : 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-400 dark:border-teal-700 ring-2 ring-teal-200 dark:ring-teal-900/50'
              iconName = isNeedsCorrection ? 'alert-triangle' : 'activity'
            }

            return (
              <div
                key={stage.id}
                className={`flex flex-col items-center p-2 rounded-xl border transition ${
                  isCurrent ? 'bg-teal-50/50 dark:bg-teal-950/20' : 'border-transparent'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full border mb-1 shadow-xs ${badgeBg}`}
                >
                  <Icon name={iconName} size={12} />
                </span>
                <span
                  className={`text-[11px] leading-tight ${
                    isCurrent
                      ? 'font-bold text-teal-900 dark:text-teal-300'
                      : isCompleted
                      ? 'font-semibold text-slate-800 dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {stage.short}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Visually Prominent Current Stage Card */}
      {showActionCard && (
        <div
          className={`card p-5 sm:p-6 transition ${
            isApproved
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
              : isRejected
              ? 'border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20'
              : isNeedsCorrection
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'
              : isInterviewEligible || isInterviewInProgress
              ? 'border-teal-300 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20'
              : ''
          }`}
        >
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div className="flex-1 min-w-[260px] space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[11px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border ${
                    isApproved
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      : isRejected
                      ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                      : isNeedsCorrection
                      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                      : isInterviewEligible || isInterviewInProgress
                      ? 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                      : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  }`}
                >
                  Stage: {STAGES[currentStageIndex]?.short}
                </span>
                {readinessScore != null && (
                  <span className="badge badge-neutral text-[11px]">
                    Readiness: {readinessScore}%
                  </span>
                )}
                {riskLevel && (
                  <span className={`badge text-[11px] ${riskLevel === 'HIGH' ? 'badge-danger' : riskLevel === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>
                    Risk: {riskLevel}
                  </span>
                )}
              </div>

              {/* Status Specific Explanations */}
              {isReadyForReview && (
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Icon name="clock" size={16} className="text-teal-600 dark:text-teal-400" />
                    <span>Officer Document Review in Progress</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Your documents have passed automated pre-verification and are in queue for statutory review by an authorized verification officer.
                  </p>
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold pt-1">
                    Status: No action is required from you right now. You will be notified when your verification interview is unlocked.
                  </div>
                </div>
              )}

              {isNeedsCorrection && (
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                    <Icon name="alert-triangle" size={16} className="text-amber-600" />
                    <span>Action Required: Document Correction</span>
                  </h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    {correctionReason || 'A document slot mismatch or quality issue was detected during automated pre-verification.'}
                  </p>
                  {correctionDetails && (
                    <div className="text-xs text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 p-2 rounded-lg font-mono">
                      {correctionDetails}
                    </div>
                  )}
                  <div className="text-xs text-amber-800 dark:text-amber-400 font-semibold pt-1">
                    Next Step: Please attach the corrected replacement document below to advance to Officer Review.
                  </div>
                </div>
              )}

              {isInterviewEligible && (
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-teal-900 dark:text-teal-300 flex items-center gap-2">
                    <Icon name="mic" size={16} className="text-teal-600 dark:text-teal-400" />
                    <span>Action Required: Complete Verification Interview</span>
                  </h3>
                  <p className="text-xs text-teal-800 dark:text-teal-300 leading-relaxed">
                    An authorized officer has reviewed your submitted documents. Your verification interview is now ready.
                  </p>
                  <div className="text-xs text-teal-700 dark:text-teal-400 font-semibold pt-1">
                    Next Step: Click the button below to start your factual verification interview (5 quick confirmation questions).
                  </div>
                </div>
              )}

              {isInterviewInProgress && (
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-teal-900 dark:text-teal-300 flex items-center gap-2">
                    <Icon name="activity" size={16} className="text-teal-600 dark:text-teal-400" />
                    <span>Verification Interview in Progress</span>
                  </h3>
                  <p className="text-xs text-teal-800 dark:text-teal-300 leading-relaxed">
                    You have an active verification interview session for this application.
                  </p>
                  <div className="text-xs text-teal-700 dark:text-teal-400 font-semibold pt-1">
                    Next Step: Resume and complete the remaining interview questions.
                  </div>
                </div>
              )}

              {isFinalReview && (
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Icon name="shield" size={16} className="text-teal-600 dark:text-teal-400" />
                    <span>Final Officer Statutory Review</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Your verification interview has been completed and cross-examined against your document evidence.
                  </p>
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold pt-1">
                    Status: Awaiting final statutory decision from the authorized officer. No further citizen action required.
                  </div>
                </div>
              )}

              {isApproved && (
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                    <Icon name="check-circle" size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Application Approved</span>
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    Your application for <strong>{serviceName}</strong> has been officially approved by {resolvedBy ? `Officer ${resolvedBy}` : 'the authorized statutory officer'}.
                  </p>
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold pt-1">
                    Official statutory certificate has been granted.
                  </div>
                </div>
              )}

              {isRejected && (
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                    <Icon name="alert-circle" size={16} className="text-red-600 dark:text-red-400" />
                    <span>Application Decision: Not Approved</span>
                  </h3>
                  <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
                    Your application was reviewed and rejected. You may submit a new application with corrected details or lodge a grievance.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="shrink-0">
              {isInterviewEligible && (
                <Link
                  to={`/verification-interview?application_id=${applicationId}${trackingToken ? `&token=${trackingToken}` : ''}`}
                  className="btn btn-primary btn-sm"
                >
                  <Icon name="camera" size={14} />
                  <span>Start Verification Interview →</span>
                </Link>
              )}

              {isInterviewInProgress && (
                <Link
                  to={`/verification-interview?application_id=${applicationId}${trackingToken ? `&token=${trackingToken}` : ''}`}
                  className="btn btn-primary btn-sm"
                >
                  <Icon name="camera" size={14} />
                  <span>Continue Interview →</span>
                </Link>
              )}

              {isReadyForReview && (
                <Link
                  to={`/status?id=${applicationId}${trackingToken ? `&token=${trackingToken}` : ''}`}
                  className="btn btn-secondary btn-sm"
                >
                  <Icon name="search" size={14} />
                  <span>Track Application</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
