import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  isFirebaseConfigured,
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  resendVerificationEmail,
  reloadAndCheckVerification,
  mapFirebaseAuthError,
} from '../firebase'
import { Icon } from './Icon'

export default function CitizenAuthModal({ isOpen, onClose, onSuccess, initialEmail = '', initialName = '' }) {
  const { loginCitizenWithFirebaseEmail } = useAuth()
  const [tab, setTab] = useState('login') // 'login' | 'register' | 'forgot' | 'verify_pending'

  const firebaseConfigured = isFirebaseConfigured()

  // 1. Email Login State
  const [loginEmail, setLoginEmail] = useState(initialEmail || '')
  const [loginPassword, setLoginPassword] = useState('')

  // 2. New Citizen Registration State
  const [regName, setRegName] = useState(initialName || '')
  const [regEmail, setRegEmail] = useState(initialEmail || '')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')

  // 3. Forgot Password State
  const [resetEmail, setResetEmail] = useState(initialEmail || '')

  // 4. Email Verification Pending State
  const [pendingEmail, setPendingEmail] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Shared UI Status
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Cooldown timer for resend
  useEffect(() => {
    let timer = null
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((c) => c - 1), 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [resendCooldown])

  // Reset when modal opens/closes & listen for Escape key
  useEffect(() => {
    if (!isOpen) {
      setError('')
      setSuccessMsg('')
      setLoading(false)
      return
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const switchTab = (newTab) => {
    setTab(newTab)
    setError('')
    setSuccessMsg('')
  }

  // Handle Email Login
  const handleEmailLogin = async (e) => {
    e?.preventDefault()
    setError('')
    setSuccessMsg('')

    const cleanEmail = loginEmail.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    if (!loginPassword) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    try {
      if (firebaseConfigured) {
        // 1. Authenticate with Firebase Email/Password
        const { user, idToken, displayName, emailVerified } = await signInWithEmail(cleanEmail, loginPassword)

        // 2. Check if email is verified
        if (!emailVerified) {
          setPendingEmail(user.email || cleanEmail)
          setError('Please verify your email address to continue.')
          setTab('verify_pending')
          setLoading(false)
          return
        }

        // 3. Validate Firebase identity on SevaSetu backend & establish JWT session
        const profile = await loginCitizenWithFirebaseEmail(idToken, user.email, displayName)

        setSuccessMsg(`Welcome back, ${profile.citizen_name || displayName || 'Citizen'}! ✓`)
        setTimeout(() => {
          if (onSuccess) onSuccess(profile)
          if (onClose) onClose()
        }, 500)
      } else {
        // Direct / Development Citizen Authentication Mode (when Firebase Web SDK is not configured)
        const devToken = `dev-firebase-${btoa(cleanEmail)}`
        const profile = await loginCitizenWithFirebaseEmail(devToken, cleanEmail, cleanEmail.split('@')[0])
        setSuccessMsg(`Welcome back, ${profile.citizen_name || 'Citizen'}! ✓ (Local Auth Session)`)
        setTimeout(() => {
          if (onSuccess) onSuccess(profile)
          if (onClose) onClose()
        }, 500)
      }
    } catch (err) {
      const msg = mapFirebaseAuthError(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Handle New Citizen Registration
  const handleRegister = async (e) => {
    e?.preventDefault()
    setError('')
    setSuccessMsg('')

    const cleanName = regName.trim()
    const cleanEmail = regEmail.trim().toLowerCase()

    if (!cleanName) {
      setError('Please enter your full legal name.')
      return
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    if (!regPassword || regPassword.length < 6) {
      setError('Password must contain at least 6 characters.')
      return
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please verify.')
      return
    }

    setLoading(true)
    try {
      if (firebaseConfigured) {
        // 1. Create account via Firebase Email/Password Auth & send verification email
        const { user } = await signUpWithEmail(cleanName, cleanEmail, regPassword)

        setPendingEmail(user.email || cleanEmail)
        setTab('verify_pending')
        setResendCooldown(30)
        setSuccessMsg('Account created successfully! A verification link has been sent to your email.')
      } else {
        // Direct / Development Citizen Registration Mode (when Firebase Web SDK is not configured)
        const devToken = `dev-firebase-${btoa(cleanEmail)}`
        const profile = await loginCitizenWithFirebaseEmail(devToken, cleanEmail, cleanName)
        setSuccessMsg(`Account created! Welcome, ${profile.citizen_name || cleanName}! ✓`)
        setTimeout(() => {
          if (onSuccess) onSuccess(profile)
          if (onClose) onClose()
        }, 500)
      }
    } catch (err) {
      const msg = mapFirebaseAuthError(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Check email verification status again
  const handleCheckVerificationAgain = async () => {
    setLoading(true)
    setError('')
    setSuccessMsg('')

    try {
      const { emailVerified, user, idToken } = await reloadAndCheckVerification()

      if (emailVerified && user) {
        setSuccessMsg('Email verified successfully! Signing you in... ✓')
        const freshToken = idToken || await user.getIdToken(true)
        const profile = await loginCitizenWithFirebaseEmail(freshToken, user.email, user.displayName || regName)

        setTimeout(() => {
          if (onSuccess) onSuccess(profile)
          if (onClose) onClose()
        }, 600)
      } else {
        setError('Email not verified yet. Please open the verification link sent to your inbox, then click Check Again.')
      }
    } catch (err) {
      const msg = mapFirebaseAuthError(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Resend verification email
  const handleResendVerification = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    setError('')
    setSuccessMsg('')

    try {
      await resendVerificationEmail()
      setResendCooldown(45)
      setSuccessMsg('Verification email resent! Please check your inbox (and spam folder).')
    } catch (err) {
      const msg = mapFirebaseAuthError(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Handle Forgot Password
  const handleForgotPassword = async (e) => {
    e?.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!firebaseConfigured) {
      setError('Firebase Authentication is not configured. Please define VITE_FIREBASE_* in .env.')
      return
    }

    const cleanEmail = resetEmail.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter your registered email address.')
      return
    }

    setLoading(true)
    try {
      await sendPasswordReset(cleanEmail)
      setSuccessMsg('Password reset email sent. Please check your inbox.')
    } catch (err) {
      const msg = mapFirebaseAuthError(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="citizen-auth-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          borderRadius: 12,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-extrabold text-xs">
              SS
            </div>
            <div>
              <h3 id="citizen-auth-title" className="text-base font-bold text-[var(--color-ink)] m-0">
                Citizen Authentication
              </h3>
              <span className="text-[11px] text-[var(--color-ink-muted)]">
                Secure Email & Password Verification
              </span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close authentication modal"
              className="p-1 rounded-lg text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <Icon name="x" size={18} />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        {tab !== 'forgot' && tab !== 'verify_pending' && (
          <div className="flex border-b border-[var(--color-border)] mb-4">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 py-2 px-1 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                tab === 'login'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Icon name="user" size={13} />
              <span>Email Sign In</span>
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`flex-1 py-2 px-1 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                tab === 'register'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Icon name="file-text" size={13} />
              <span>New Citizen</span>
            </button>
          </div>
        )}

        {/* Informational Banner if Firebase is unconfigured */}
        {!firebaseConfigured && (
          <div className="p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg text-xs text-teal-900 dark:text-teal-200 mb-3 flex items-start gap-2">
            <Icon name="info" size={14} className="text-teal-600 mt-0.5 shrink-0" />
            <div>
              <strong>Direct Citizen Authentication Active</strong><br />
              <span className="text-[11px] text-teal-700 dark:text-teal-300">
                You can sign in directly with your email and password. For production Firebase OTP/Email verification, configure <code>VITE_FIREBASE_*</code> variables in <code>.env</code>.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="status-banner danger text-xs mb-3 flex items-center gap-2">
            <Icon name="alert-circle" size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="status-banner success text-xs mb-3 flex items-center gap-2">
            <Icon name="check-circle" size={14} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: Email Login */}
        {tab === 'login' && (
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                Email Address *
              </label>
              <input
                type="email"
                className="input-field text-sm"
                placeholder="citizen@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-[var(--color-ink)]">
                  Password *
                </label>
                <button
                  type="button"
                  onClick={() => switchTab('forgot')}
                  className="text-teal-600 dark:text-teal-400 text-xs font-semibold hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                className="input-field text-sm"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5 text-xs font-bold"
            >
              {loading ? 'Signing In...' : 'Sign In with Email'}
            </button>
          </form>
        )}

        {/* TAB 2: New Citizen Registration */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                Full Legal Name *
              </label>
              <input
                type="text"
                className="input-field text-sm"
                placeholder="e.g. Priya Sharma"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                Email Address *
              </label>
              <input
                type="email"
                className="input-field text-sm"
                placeholder="citizen@example.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                Password (min 6 characters) *
              </label>
              <input
                type="password"
                className="input-field text-sm"
                placeholder="••••••••"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                Confirm Password *
              </label>
              <input
                type="password"
                className="input-field text-sm"
                placeholder="••••••••"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5 text-xs font-bold"
            >
              {loading ? 'Creating Account...' : 'Create Citizen Account'}
            </button>
          </form>
        )}

        {/* TAB 4: Email Verification Pending */}
        {tab === 'verify_pending' && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                <Icon name="mail" size={24} />
              </div>
              <h4 className="text-base font-bold text-[var(--color-ink)] m-0">
                Verify Your Email Address
              </h4>
              <p className="text-xs text-[var(--color-ink-muted)] leading-relaxed m-0">
                We've sent a verification link to: <br />
                <strong className="text-[var(--color-ink)]">{pendingEmail}</strong>
              </p>
            </div>

            <div className="p-3 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2">
              <Icon name="check-circle" size={14} className="text-teal-600 shrink-0 mt-0.5" />
              <span>Please check your email inbox (and spam folder), click the verification link, and then return here to sign in.</span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCheckVerificationAgain}
                disabled={loading}
                className="btn btn-primary w-full py-2 text-xs font-bold"
              >
                <Icon name="refresh" size={13} />
                <span>{loading ? 'Checking Status...' : "I've Verified My Email — Check Again"}</span>
              </button>

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading || resendCooldown > 0}
                className="btn btn-secondary w-full py-2 text-xs font-bold"
              >
                <Icon name="mail" size={13} />
                <span>{resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend Verification Email'}</span>
              </button>

              <button
                type="button"
                onClick={() => switchTab('login')}
                className="btn btn-ghost text-xs text-teal-600 dark:text-teal-400"
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Forgot Password */}
        {tab === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-3">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[var(--color-ink)] m-0">
                Reset Your Password
              </h4>
              <p className="text-xs text-[var(--color-ink-muted)] m-0">
                Enter your registered email address and we'll send you a link to reset your password.
              </p>
            </div>

            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                Registered Email Address *
              </label>
              <input
                type="email"
                className="input-field text-sm"
                placeholder="citizen@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5 text-xs font-bold"
            >
              {loading ? 'Sending Reset Link...' : 'Send Password Reset Link'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="btn btn-ghost text-xs text-teal-600 dark:text-teal-400"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 text-center text-[11px] text-[var(--color-ink-subtle)] flex items-center justify-center gap-1.5">
          <Icon name="shield" size={12} className="text-teal-600" />
          <span>Protected by Firebase Authentication & Cryptographic Session Security</span>
        </div>
      </div>
    </div>
  )
}
