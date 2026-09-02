import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Icon } from '../components/Icon'

export default function PrivacyConsentCenter() {
  const { user, isStaff } = useAuth()
  const { t } = useLanguage()
  const [policy, setPolicy] = useState(null)
  const [consents, setConsents] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const policyRes = await api.getPrivacyPolicy()
      setPolicy(policyRes.data)

      if (user && !isStaff) {
        try {
          const consentRes = await api.getMyConsents()
          setConsents(consentRes.data.consents || [])
        } catch {
          // If unauthenticated or token expired, ignore
        }
      }
    } catch (err) {
      setError('Could not load privacy policy data.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleConsent = async (purpose, currentStatus, isRequired) => {
    if (isRequired) return
    setActionLoading(purpose)
    setMessage(null)
    setError(null)
    try {
      if (currentStatus) {
        await api.withdrawConsent({ purpose })
        setMessage(`Consent for optional purpose '${purpose}' has been safely withdrawn.`)
      } else {
        await api.recordConsent({ purpose, is_granted: true })
        setMessage(`Consent for optional purpose '${purpose}' has been recorded.`)
      }
      const consentRes = await api.getMyConsents()
      setConsents(consentRes.data.consents || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update consent preference.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="card p-6 sm:p-8 space-y-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white border-teal-900/40 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-800/80 text-teal-300 flex items-center justify-center font-bold">
            <Icon name="shield" size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight m-0">
              {t('privacy_title', 'Privacy & Citizen Data Governance')}
            </h1>
            <span className="text-xs text-teal-300">Statutory Purpose-Bound Processing</span>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed m-0">
          {t('privacy_subtitle', 'Complete transparency into data collection, purpose-bound access, retention limits, and AI safety boundaries.')}
        </p>
        <div className="p-3 bg-teal-900/60 border border-teal-500/30 rounded-xl text-xs font-semibold text-teal-200 flex items-center gap-2">
          <Icon name="check-circle" size={16} className="text-teal-400 shrink-0" />
          <span>{t('statutory_principle', 'AI assists verification. Final statutory decisions remain with authorized officers.')}</span>
        </div>
      </div>

      {message && (
        <div className="status-banner success text-xs sm:text-sm flex items-center gap-2">
          <Icon name="check-circle" size={16} className="text-emerald-600" />
          <div>{message}</div>
        </div>
      )}

      {error && (
        <div className="status-banner warning text-xs sm:text-sm flex items-center gap-2">
          <Icon name="alert-triangle" size={16} className="text-amber-600" />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-44 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Consents Manager (if logged in citizen) */}
          {user && !isStaff && (
            <div className="card p-6 space-y-4">
              <div className="border-b border-[var(--color-border-subtle)] pb-3">
                <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2 m-0">
                  <Icon name="file-text" size={16} className="text-teal-600" />
                  <span>{t('consent_manager_title', 'Active Consents & Processing Authorizations')}</span>
                </h2>
                <p className="text-xs text-[var(--color-ink-muted)] mt-1 mb-0">
                  Policy Version: <strong>{policy?.policy_version || '2026.1'}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {consents.map((c) => (
                  <div
                    key={c.purpose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--color-border)',
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-ink)' }}>{c.title}</span>
                        {c.is_required ? (
                          <span className="badge badge-info" style={{ fontSize: 10 }}>
                            {t('consent_required_badge', 'Statutory Requirement')}
                          </span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                            {t('consent_optional_badge', 'Optional Feature')}
                          </span>
                        )}
                        <span className={`badge ${c.is_granted ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                          {c.is_granted ? t('consent_granted', 'Active') : t('consent_withdrawn', 'Withdrawn')}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
                        {c.description}
                      </p>
                    </div>

                    {!c.is_required && (
                      <button
                        type="button"
                        onClick={() => handleToggleConsent(c.purpose, c.is_granted, c.is_required)}
                        disabled={actionLoading === c.purpose}
                        className={`btn ${c.is_granted ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                        style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                      >
                        {actionLoading === c.purpose
                          ? 'Updating...'
                          : c.is_granted
                          ? t('withdraw_btn', 'Withdraw Consent')
                          : t('grant_btn', 'Grant Permission')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Policy Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* What We Collect */}
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2 m-0">
                <Icon name="file-text" size={16} className="text-teal-600" />
                <span>{t('what_we_collect_title', 'What We Collect')}</span>
              </h2>
              <div className="space-y-2.5">
                {policy?.what_we_collect?.map((grp) => (
                  <div key={grp.category} className="text-xs">
                    <strong className="text-[var(--color-ink)] block mb-1">{grp.category}:</strong>
                    <ul className="m-0 pl-4 text-[var(--color-ink-muted)] space-y-0.5">
                      {grp.items?.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Why We Collect It */}
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2 m-0">
                <Icon name="check-circle" size={16} className="text-teal-600" />
                <span>{t('why_we_collect_title', 'Why We Collect It')}</span>
              </h2>
              <ul className="m-0 pl-4 text-[var(--color-ink-muted)] text-xs space-y-1.5 leading-relaxed">
                {policy?.why_we_collect?.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>

            {/* Who Can Access */}
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2 m-0">
                <Icon name="user" size={16} className="text-teal-600" />
                <span>{t('who_can_access_title', 'Who Can Access Your Data')}</span>
              </h2>
              <ul className="m-0 pl-4 text-[var(--color-ink-muted)] text-xs space-y-1.5 leading-relaxed">
                {policy?.who_can_access?.map((entity) => (
                  <li key={entity}>{entity}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* AI Scope & Boundaries */}
          <div className="card p-6 border-l-4 border-l-teal-600 space-y-4">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2 m-0">
              <Icon name="shield" size={18} className="text-teal-600" />
              <span>{t('ai_scope_title', 'AI Scope & Statutory Boundaries')}</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <h3 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 m-0 flex items-center gap-1.5">
                  <Icon name="check" size={14} className="text-emerald-600" />
                  <span>What AI Does:</span>
                </h3>
                <ul className="m-0 pl-4 text-xs text-emerald-800 dark:text-emerald-300 space-y-1 leading-relaxed">
                  {policy?.ai_scope_and_boundaries?.what_ai_does?.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-2">
                <h3 className="text-xs font-bold text-red-900 dark:text-red-200 m-0 flex items-center gap-1.5">
                  <Icon name="x" size={14} className="text-red-600" />
                  <span>What AI Never Does:</span>
                </h3>
                <ul className="m-0 pl-4 text-xs text-red-800 dark:text-red-300 space-y-1 leading-relaxed">
                  {policy?.ai_scope_and_boundaries?.what_ai_never_does?.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
