import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon } from './Icon'

export default function StaffGate({ children, requireRole = null }) {
  const { staffUser, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(event) {
    event.preventDefault()
    setError(null)
    if (!username.trim()) {
      setError('Enter your username.')
      return
    }
    setLoading(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      if (err.response?.status === 429) {
        setError(err.response.data.detail || 'Too many failed attempts. Please try again later.')
      } else if (err.response?.status === 401) {
        setError(err.response.data?.detail || 'Incorrect username or password.')
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError('Could not reach SevaSetu\u2019s backend.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!staffUser) {
    return (
      <div className="flex justify-center py-6 px-4">
        <div className="card max-w-md w-full p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-teal-700 text-white flex items-center justify-center mx-auto shadow-sm">
              <Icon name="shield" size={24} />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] m-0">Staff Login</h2>
            <p className="text-xs text-[var(--color-ink-muted)] m-0 leading-relaxed">
              Authorized government officer and administrator portal. Role permissions are authenticated via server JWT.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="field">
              <label htmlFor="staff-username" className="text-xs font-bold text-[var(--color-ink)] block mb-1">Username</label>
              <input
                id="staff-username"
                type="text"
                className="input-field text-sm"
                placeholder="e.g. officer1 or admin1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="staff-password" className="text-xs font-bold text-[var(--color-ink)] block mb-1">Password</label>
              <input
                id="staff-password"
                type="password"
                className="input-field text-sm"
                placeholder="Enter account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="status-banner danger text-xs flex items-center gap-2">
                <Icon name="alert-circle" size={16} className="text-red-600 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full py-2.5 font-bold text-sm" disabled={loading}>
              {loading ? 'Authenticating\u2026' : 'Log in to Portal'}
            </button>
          </form>

          <div className="pt-3 border-t border-[var(--color-border-subtle)] space-y-2">
            <div className="text-[11px] font-bold text-center text-[var(--color-ink-muted)]">Instant Quick Login:</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  setLoading(true)
                  setError(null)
                  try {
                    await login('officer1', 'seva123')
                  } catch (e1) {
                    try {
                      await login('officer1', 'officer-demo-pass')
                    } catch (e2) {
                      setError('Officer login failed')
                    }
                  } finally {
                    setLoading(false)
                  }
                }}
                className="btn btn-secondary py-2 text-xs font-bold"
              >
                Officer (officer1)
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLoading(true)
                  setError(null)
                  try {
                    await login('admin1', 'admin-demo-pass')
                  } catch (e) {
                    setError('Admin login failed')
                  } finally {
                    setLoading(false)
                  }
                }}
                className="btn btn-secondary py-2 text-xs font-bold"
              >
                Admin (admin1)
              </button>
            </div>
            <div className="text-[10px] text-center text-[var(--color-ink-subtle)] pt-1">
              Passwords: <code>seva123</code> / <code>officer-demo-pass</code> / <code>admin-demo-pass</code>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (requireRole && staffUser.role !== requireRole) {
    return (
      <div className="status-banner warning flex items-center gap-2 text-xs sm:text-sm">
        <Icon name="alert-triangle" size={18} className="text-amber-600 shrink-0" />
        <div>
          This page is for {requireRole}s. You're logged in as {staffUser.role} — visit the right page for your role instead.
        </div>
      </div>
    )
  }

  return children
}
