import { useState, useEffect } from 'react'
import client from '../api/client'
import { Icon } from './Icon'

export default function CitizenApplicationTimeline({ applicationId, trackingToken, currentStatus, refreshTrigger }) {
  const [timelineData, setTimelineData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!applicationId) return
    let isMounted = true
    setLoading(true)
    setError(null)

    const tokenQuery = trackingToken ? `?token=${encodeURIComponent(trackingToken)}` : ''
    try {
      const req = client?.get ? client.get(`/api/applications/${applicationId}/history${tokenQuery}`) : null
      if (req && typeof req.then === 'function') {
        req
          .then((res) => {
            if (isMounted && res?.data) {
              setTimelineData(res.data)
            }
          })
          .catch((err) => {
            if (isMounted) {
              console.warn('Could not load application history timeline:', err)
              setError('Timeline details temporarily unavailable.')
            }
          })
          .finally(() => {
            if (isMounted) setLoading(false)
          })
      } else {
        setLoading(false)
      }
    } catch {
      if (isMounted) setLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [applicationId, trackingToken, refreshTrigger])

  if (loading) {
    return (
      <div className="py-4 text-center text-xs font-semibold text-slate-400">
        Loading milestone timeline…
      </div>
    )
  }

  if (error || !timelineData || !timelineData.timeline || timelineData.timeline.length === 0) {
    return null
  }

  const events = timelineData.timeline

  return (
    <div className="card p-6 mb-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h4 className="m-0 text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
          <Icon name="clock" size={16} className="text-teal-600 dark:text-teal-400" />
          <span>Application Processing Timeline</span>
        </h4>
        <span className="badge badge-neutral text-[11px] uppercase tracking-wider">
          {events.length} Recorded Milestones
        </span>
      </div>

      <div className="relative pl-6 ml-2">
        {/* Timeline connector track */}
        <div className="absolute top-2.5 bottom-2.5 left-1.5 w-0.5 bg-slate-200 dark:bg-slate-700 z-0" />

        {events.map((ev, index) => {
          const isLast = index === events.length - 1
          const act = (ev.action || '').toUpperCase()
          const isSuccess = act.includes('APPROVED') || act.includes('PASSED') || act.includes('COMPLETED')
          const isWarning = act.includes('CORRECTION') || act.includes('DISCREPANCY')
          const isDanger = act.includes('REJECTED')
          
          let bulletBg = 'bg-teal-600 dark:bg-teal-500'
          if (isSuccess) bulletBg = 'bg-emerald-600 dark:bg-emerald-500'
          if (isWarning) bulletBg = 'bg-amber-500 dark:bg-amber-400'
          if (isDanger) bulletBg = 'bg-red-600 dark:bg-red-500'

          const formattedDate = ev.timestamp
            ? new Date(ev.timestamp).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : null

          const formattedTime = ev.timestamp
            ? new Date(ev.timestamp).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : null

          return (
            <div
              key={ev.id || index}
              className={`relative z-10 ${isLast ? 'mb-0' : 'mb-5'}`}
            >
              {/* Bullet Node */}
              <div
                className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full ${bulletBg} ring-4 ring-white dark:ring-slate-900 shadow-xs`}
              />

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                    {ev.title}
                  </span>
                  {formattedDate && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formattedDate} • {formattedTime}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {ev.description}
                </div>

                {ev.actor && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono pt-1">
                    Actor: {ev.actor}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
