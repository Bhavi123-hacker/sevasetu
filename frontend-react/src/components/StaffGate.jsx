import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

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
        setError(err.response.data.detail) // "Too many failed attempts. Try again in N seconds."
      } else if (err.response?.status === 401) {
        setError('Incorrect username or password.')
      } else {
        setError('Could not reach SevaSetu\u2019s backend.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!staffUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
        <div className="card" style={{ maxWidth: 420, width: '100%', padding: '28px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, background: 'linear-gradient(135deg, var(--color-primary), #0f766e)',
              borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: 'white', marginBottom: 12, boxShadow: 'var(--shadow-sm)',
            }}>
              🔒
            </div>
            <h2 style={{ fontSize: 22, margin: '0 0 6px' }}>Staff Login</h2>
            <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', margin: 0 }}>
              Authorized government officer and administrator portal. Role permissions are authenticated via server JWT.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="staff-username">Username</label>
              <input
                id="staff-username"
                type="text"
                placeholder="e.g. officer1 or admin1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="staff-password">Password</label>
              <input
                id="staff-password"
                type="password"
                placeholder="Enter account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="status-banner danger" style={{ marginTop: 12 }}>
                <span>⚠️</span>
                <div>{error}</div>
              </div>
            )}

            <button type="submit" className="btn btn-lg" disabled={loading} style={{ width: '100%', marginTop: 16 }}>
              {loading ? 'Authenticating\u2026' : 'Log in to Portal'}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--color-ink-subtle)' }}>
              Demo logins: <code>officer1</code> / <code>admin1</code>
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (requireRole && staffUser.role !== requireRole) {
    return (
      <div className="status-banner warning">
        <span>⚠️</span>
        <div>
          This page is for {requireRole}s. You're logged in as {staffUser.role} — visit the right page for your role instead.
        </div>
      </div>
    )
  }

  return children
}
