import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { auth, isFirebaseConfigured, resendVerificationEmail, reloadAndCheckVerification } from '../firebase'
import { Icon } from '../components/Icon'

export default function CitizenProfile() {
  const { t } = useLanguage()
  const firebaseConfigured = isFirebaseConfigured()
  const [profile, setProfile] = useState({
    id: '',
    citizen_name: '',
    date_of_birth: '',
    gender: 'Male',
    address: '',
    district: '',
    state: 'Gujarat',
    pincode: '',
    phone: '',
    phone_number: '',
    email: '',
    category: 'General',
    annual_income: 0,
    is_student: false,
    has_disability: false,
    preferences: { language: 'en' },
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Email Verification State
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [verifLoading, setVerifLoading] = useState(false)
  const [verifNotice, setVerifNotice] = useState('')
  const [verifError, setVerifError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Notification Preferences State
  const [preferences, setPreferences] = useState({
    application_updates: true,
    correction_requests: true,
    decision_alerts: true,
    interview_reminders: true,
    security_alerts: true,
    email_enabled: true,
  })
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefSaveSuccess, setPrefSaveSuccess] = useState(false)

  useEffect(() => {
    loadProfileAndPrefs()
  }, [])

  useEffect(() => {
    let timer = null
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((c) => c - 1), 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [resendCooldown])

  async function loadProfileAndPrefs() {
    try {
      const profRes = await api.getProfile().catch(() => null)
      if (profRes?.data) {
        setProfile(profRes.data)
      }
      // Check Firebase email verification status
      if (auth?.currentUser) {
        setIsEmailVerified(Boolean(auth.currentUser.emailVerified))
      } else if (profRes?.data?.email_verified) {
        setIsEmailVerified(true)
      }

      const prefRes = api.getNotificationPreferences ? await api.getNotificationPreferences().catch(() => null) : null
      if (prefRes?.data?.preferences) {
        setPreferences(prefRes.data.preferences)
      }
    } catch (err) {
      console.error('Failed to load profile data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshVerification = async () => {
    if (!firebaseConfigured) {
      setVerifNotice('Live email verification status requires VITE_FIREBASE_* in .env.')
      return
    }
    setVerifLoading(true)
    setVerifNotice('')
    setVerifError('')
    try {
      const { emailVerified } = await reloadAndCheckVerification()
      setIsEmailVerified(emailVerified)
      if (emailVerified) {
        setVerifNotice('✓ Email is verified!')
      } else {
        setVerifNotice('Email is not verified yet. Please check your inbox and click the verification link.')
      }
    } catch (err) {
      setVerifError('Could not refresh verification status.')
    } finally {
      setVerifLoading(false)
    }
  }

  const handleSendVerificationEmail = async () => {
    if (!firebaseConfigured) {
      setVerifNotice('Live email verification link delivery requires VITE_FIREBASE_* in .env.')
      return
    }
    if (resendCooldown > 0) return
    setVerifLoading(true)
    setVerifNotice('')
    setVerifError('')
    try {
      await resendVerificationEmail()
      setResendCooldown(45)
      setVerifNotice('Verification email sent! Please check your inbox.')
    } catch (err) {
      setVerifError(err.message || 'Could not send verification email.')
    } finally {
      setVerifLoading(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveSuccess(false)
    try {
      await api.updateProfile(profile)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      console.error('Failed to update profile:', err)
      alert('Error updating profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    setSavingPrefs(true)
    setPrefSaveSuccess(false)
    try {
      await api.updateNotificationPreferences({
        profile_id: profile.id,
        preferences,
      })
      setPrefSaveSuccess(true)
      setTimeout(() => setPrefSaveSuccess(false), 4000)
    } catch (err) {
      console.error('Failed to save notification preferences:', err)
    } finally {
      setSavingPrefs(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}>Loading citizen profile...</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Account & Email Verification Card */}
      <div className="card p-6 sm:p-8 space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Icon name="shield" size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--color-ink)] m-0">Account & Email Verification</h3>
              <span className="text-xs text-[var(--color-ink-muted)]">
                {firebaseConfigured ? 'Firebase Authentication Identity' : 'SevaSetu Citizen Identity (Local Development Session)'}
              </span>
            </div>
          </div>
          {isEmailVerified ? (
            <span className="badge badge-success flex items-center gap-1.5 py-1 px-3">
              <Icon name="check" size={12} />
              <span>Email Verified</span>
            </span>
          ) : (
            <span className="badge badge-warning flex items-center gap-1.5 py-1 px-3">
              <Icon name="alert-triangle" size={12} />
              <span>Email Not Verified</span>
            </span>
          )}
        </div>

        <div className="p-4 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-xl space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <div className="text-[10px] text-[var(--color-ink-muted)] uppercase font-bold tracking-wider">REGISTERED EMAIL</div>
              <div className="text-sm font-bold text-[var(--color-ink)] mt-0.5">
                {profile.email || auth?.currentUser?.email || 'citizen@sevasetu.gov.in'}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {firebaseConfigured ? (
                <>
                  {!isEmailVerified && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleSendVerificationEmail}
                      disabled={verifLoading || resendCooldown > 0}
                    >
                      <Icon name="mail" size={14} />
                      <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Send Verification Email'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={handleRefreshVerification}
                    disabled={verifLoading}
                  >
                    <Icon name="refresh" size={14} />
                    <span>Refresh Status</span>
                  </button>
                </>
              ) : (
                <div className="text-xs text-[var(--color-ink-muted)] italic self-center">
                  Direct citizen authentication active. Configure <code>VITE_FIREBASE_*</code> for live OTP/link delivery.
                </div>
              )}
            </div>
          </div>

          {verifNotice && (
            <div className="text-xs text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-1.5">
              <Icon name="check-circle" size={14} />
              <span>{verifNotice}</span>
            </div>
          )}
          {verifError && (
            <div className="text-xs text-red-600 font-semibold flex items-center gap-1.5">
              <Icon name="alert-circle" size={14} />
              <span>{verifError}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Demographic Information Form */}
      <div className="card p-6 sm:p-8 space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3 pb-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-[var(--color-ink)] flex items-center justify-center">
              <Icon name="user" size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] m-0">Demographic Profile</h2>
              <p className="text-xs text-[var(--color-ink-muted)] m-0 mt-0.5">
                Manage your self-declared demographic information to pre-fill statutory applications.
              </p>
            </div>
          </div>
          <span className="badge badge-info text-xs">Citizen Controlled</span>
        </div>

        {saveSuccess && (
          <div
            style={{
              padding: 12,
              background: '#ecfdf5',
              border: '1px solid #10b981',
              borderRadius: 6,
              color: '#065f46',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>✅</span>
            <span>Profile successfully saved!</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Full Legal Name (as on Identity Card): *
              </label>
              <input
                type="text"
                className="input-field"
                required
                value={profile.citizen_name}
                onChange={(e) => setProfile({ ...profile, citizen_name: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date of Birth:</label>
              <input
                type="date"
                className="input-field"
                value={profile.date_of_birth || ''}
                onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Gender:</label>
              <select
                className="input-field"
                value={profile.gender || 'Male'}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Transgender / Other">Transgender / Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Contact Mobile Number:
              </label>
              <input
                type="tel"
                className="input-field"
                placeholder="+91 98765 43210"
                value={profile.phone_number || profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone_number: e.target.value, phone: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Social Category:</label>
              <select
                className="input-field"
                value={profile.category || 'General'}
                onChange={(e) => setProfile({ ...profile, category: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
              >
                <option value="General">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="EWS">EWS</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Residential Address:</label>
              <textarea
                className="input-field"
                rows={2}
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>District:</label>
              <input
                type="text"
                className="input-field"
                value={profile.district || ''}
                onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>State:</label>
              <input
                type="text"
                className="input-field"
                value={profile.state || 'Gujarat'}
                onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Pincode:</label>
              <input
                type="text"
                className="input-field"
                maxLength={6}
                value={profile.pincode || ''}
                onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn btn-primary font-bold text-xs py-2 px-4" disabled={saving}>
              <Icon name="check-circle" size={14} />
              <span>{saving ? 'Saving...' : 'Save Profile Data'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Notification Preferences Card */}
      <div className="card p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Icon name="bell" size={20} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--color-ink)] m-0">Notification Preferences</h3>
            <p className="text-xs text-[var(--color-ink-muted)] m-0 mt-0.5">
              Configure in-app and email communication preferences for statutory applications.
            </p>
          </div>
        </div>

        {prefSaveSuccess && (
          <div className="status-banner success text-xs flex items-center gap-1.5">
            <Icon name="check-circle" size={14} className="text-emerald-600" />
            <span>Notification preferences saved.</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.application_updates}
              onChange={(e) => setPreferences({ ...preferences, application_updates: e.target.checked })}
            />
            <span><strong>Application Lifecycle Updates:</strong> Submission, automated check, and processing stage updates.</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.correction_requests}
              onChange={(e) => setPreferences({ ...preferences, correction_requests: e.target.checked })}
            />
            <span><strong>Document Correction Requests:</strong> Immediate notices when an officer requests replacement evidence.</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.decision_alerts}
              onChange={(e) => setPreferences({ ...preferences, decision_alerts: e.target.checked })}
            />
            <span><strong>Statutory Decision Notifications:</strong> Official approval or rejection decision alerts.</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.interview_reminders}
              onChange={(e) => setPreferences({ ...preferences, interview_reminders: e.target.checked })}
            />
            <span><strong>AI Verification Interview:</strong> Availability and completion summary notices.</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.email_enabled !== false}
              onChange={(e) => setPreferences({ ...preferences, email_enabled: e.target.checked })}
            />
            <span><strong>Email Notifications (Resend):</strong> Receive transactional email updates on lifecycle transitions.</span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" onClick={handleSavePreferences} disabled={savingPrefs}>
            {savingPrefs ? 'Saving Preferences...' : 'Save Notification Preferences'}
          </button>
        </div>
      </div>
    </div>
  )
}
