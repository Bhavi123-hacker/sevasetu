import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function StaffGate({ children, requireRole = null }) {
  const { staffUser, login } = useAuth()
  const [name, setName] = useState('')
  const [role, setRole] = useState('Officer')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(event) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Enter your name — it\u2019s used to attribute resolved applications.')
      return
    }
    setLoading(true)
    try {
      await login(name.trim(), role, password)
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Incorrect password.')
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
          Real JWT auth — one shared demo password per role, not per-user accounts yet.
        </p>
        <form onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="staff-name">Your name</label>
            <input id="staff-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Role</label>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ fontWeight: 400 }}>
                <input type="radio" name="role" value="Officer" checked={role === 'Officer'} onChange={() => setRole('Officer')} /> Officer
              </label>
              <label style={{ fontWeight: 400 }}>
                <input type="radio" name="role" value="Administrator" checked={role === 'Administrator'} onChange={() => setRole('Administrator')} /> Administrator
              </label>
            </div>
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
