import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Icon, EmptyState } from '../components/Icon'

export default function NotificationCenter() {
  const { citizenUser, activeRole } = useAuth()
  const { t } = useLanguage()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('ALL') // ALL | UNREAD

  const profileId = citizenUser?.profile_id || citizenUser?.id
  const recipientRole = activeRole === 'staff' ? 'staff' : 'citizen'

  const loadNotifications = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getNotifications(recipientRole, profileId)
      const raw = res.data
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.notifications) ? raw.notifications : [])
      setNotifications(list)
      window.dispatchEvent(new Event('sevasetu_notifications_updated'))
    } catch (err) {
      console.error('Failed to load notifications:', err)
      setError('Unable to retrieve notifications at this time.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [profileId, recipientRole])

  const handleMarkRead = async (notifId, e) => {
    e.stopPropagation()
    try {
      await api.markNotificationRead(notifId)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      )
      window.dispatchEvent(new Event('sevasetu_notifications_updated'))
    } catch (err) {
      console.error('Failed to mark read:', err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      if (profileId) {
        await api.markAllNotificationsRead(recipientRole, profileId)
      } else {
        await api.markAllNotificationsRead(recipientRole)
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      window.dispatchEvent(new Event('sevasetu_notifications_updated'))
    } catch (err) {
      console.error('Failed to mark all read:', err)
    }
  }

  const filteredNotifications = (Array.isArray(notifications) ? notifications : []).filter((n) => {
    if (filter === 'UNREAD') return !n.is_read
    return true
  })

  const unreadCount = (Array.isArray(notifications) ? notifications : []).filter((n) => !n.is_read).length

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="card p-6 sm:p-8 space-y-3 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white border-teal-800/40 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-extrabold uppercase tracking-wider">
              <Icon name="bell" size={13} />
              <span>Civic Notification Service</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight m-0">
              Notification Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 m-0">
              Real-time administrative case updates, interview requests, and decision alerts.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="btn btn-secondary btn-sm text-white border-white/20 hover:bg-white/10 text-xs font-bold shrink-0 self-start sm:self-center"
            >
              <Icon name="check-circle" size={14} />
              <span>✓ Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex justify-between items-center flex-wrap gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`btn btn-sm text-xs font-bold rounded-xl ${filter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('UNREAD')}
            className={`btn btn-sm text-xs font-bold rounded-xl ${filter === 'UNREAD' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Real-time In-App Dispatch Active</span>
        </div>
      </div>

      {error && (
        <div className="card p-4 text-xs font-bold text-red-700 dark:text-red-300 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 text-center">
          {error}
        </div>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading notifications...
          </p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No Notifications Found"
          description={filter === 'UNREAD' ? 'You have read all your notifications.' : 'Notifications for submitted applications and grievances will appear here.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((n) => {
            const isUnread = !n.is_read
            const isCorrection = n.notification_type === 'CORRECTION_REQUESTED'
            const isApproved = n.notification_type === 'APPLICATION_APPROVED'
            const isRejected = n.notification_type === 'APPLICATION_REJECTED'

            let iconName = 'bell'
            let borderClass = 'border-l-teal-600'
            if (isCorrection) {
              borderClass = 'border-l-amber-500'
              iconName = 'alert-circle'
            } else if (isApproved) {
              borderClass = 'border-l-emerald-500'
              iconName = 'check-circle'
            } else if (isRejected) {
              borderClass = 'border-l-red-500'
              iconName = 'alert-circle'
            } else if (n.notification_type === 'PHONE_VERIFIED') {
              borderClass = 'border-l-teal-500'
              iconName = 'shield'
            }

            return (
              <div
                key={n.id}
                className={`card p-5 space-y-3 border-l-4 ${borderClass} transition ${
                  isUnread ? 'bg-teal-50/20 dark:bg-teal-950/10 shadow-sm' : ''
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                      <Icon name={iconName} size={18} />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 m-0">
                          {n.title || 'Notification'}
                        </h4>
                        {isUnread && (
                          <span className="bg-teal-700 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-md">
                            NEW
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          • {n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed m-0">
                        {n.message}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Delivery Channel and Actions */}
                <div className="flex justify-between items-center flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="badge badge-neutral text-[10px]">
                      {n.delivery_channel || n.channel || 'IN_APP'}
                    </span>
                    <span>
                      {n.delivery_status === 'DELIVERED_IN_APP' || n.status === 'DELIVERED_IN_APP' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ In-App Record Delivered</span>
                      ) : n.delivery_status === 'SENT' || n.status === 'SENT' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Email Dispatched</span>
                      ) : n.delivery_status === 'NOT_CONFIGURED' || n.status === 'NOT_CONFIGURED' ? (
                        <span className="text-slate-400">In-App Guaranteed (Email unconfigured)</span>
                      ) : (
                        <span>Status: {n.delivery_status || n.status}</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {n.action_link && (
                      <Link
                        to={n.action_link}
                        className="btn btn-primary btn-sm text-[11px] font-bold py-1 px-2.5"
                      >
                        <span>View Details →</span>
                      </Link>
                    )}
                    {isUnread && (
                      <button
                        onClick={(e) => handleMarkRead(n.id, e)}
                        className="btn btn-ghost btn-sm text-[11px] text-slate-400 hover:text-slate-600 py-1 px-2"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
