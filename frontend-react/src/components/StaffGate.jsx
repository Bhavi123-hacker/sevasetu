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
      <div className="card" style={{ maxWidth: 360 }}>
        <h2>Staff Login</h2>
        <p style={{ fontSize: 14, color: 'var(--color-ink-muted)' }}>
          Individual accounts now — role comes from the account, not from anything picked at login.
        </p>
        <form onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="staff-username">Username</label>
            <input id="staff-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="staff-password">Password</label>
            <input id="staff-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="status-banner danger">{error}</div>}
          <button type="submit" className="btn" disabled={loading}>{loading ? 'Logging in\u2026' : 'Log in'}</button>
        </form>
      </div>
    )
  }

  if (requireRole && staffUser.role !== requireRole) {
    return (
      <div className="status-banner warning">
        This page is for {requireRole}s. You're logged in as {staffUser.role} — visit the right page for your role instead.
      </div>
    )
  }

  return children
}
