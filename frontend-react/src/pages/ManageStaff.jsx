import { useState, useEffect } from 'react'
import client from '../api/client'
import StaffGate from '../components/StaffGate'

function ManageStaffContent() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'Officer' })
  const [formError, setFormError] = useState(null)
  const [formSuccess, setFormSuccess] = useState(null)

  function loadUsers() {
    client.get('/api/staff/users').then((r) => setUsers(r.data)).catch(() => setError('Could not reach SevaSetu\u2019s backend.'))
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreate(event) {
    event.preventDefault()
    setFormError(null)
    setFormSuccess(null)
    try {
      await client.post('/api/staff/users', form)
      setFormSuccess(`Account "${form.username}" created.`)
      setForm({ username: '', password: '', display_name: '', role: 'Officer' })
      loadUsers()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Could not create account.')
    }
  }

  async function toggleActive(user) {
    const action = user.is_active ? 'deactivate' : 'activate'
    try {
      await client.patch(`/api/staff/users/${user.username}/${action}`)
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update account.')
    }
  }

  if (error) return <div className="status-banner danger">{error}</div>

  return (
    <div>
      <div className="page-header">
        <h2>Staff Account Management</h2>
        <p>Provision and manage officer and administrator accounts for your department.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Create New Staff Account</h3>
          <span className="badge badge-info">RBAC Auth</span>
        </div>

        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="field">
              <label htmlFor="new-username">Username</label>
              <input
                id="new-username"
                type="text"
                placeholder="e.g. officer_ravi"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="new-display-name">Display name</label>
              <input
                id="new-display-name"
                type="text"
                placeholder="e.g. Ravi Shankar"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="new-password">Password (min 8 characters)</label>
              <input
                id="new-password"
                type="password"
                placeholder="Secure password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="new-role">Role</label>
              <select id="new-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option>Officer</option>
                <option>Administrator</option>
              </select>
            </div>
          </div>

          {formError && (
            <div className="status-banner danger" style={{ marginTop: 8 }}>
              <span>⚠️</span>
              <div>{formError}</div>
            </div>
          )}
          {formSuccess && (
            <div className="status-banner success" style={{ marginTop: 8 }}>
              <span>✓</span>
              <div>{formSuccess}</div>
            </div>
          )}

          <button type="submit" className="btn btn-sm" style={{ marginTop: 12 }}>
            + Create account
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Existing Staff Directory</h3>
          <span className="badge badge-neutral">{users.length} Total Accounts</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((u) => (
            <div
              key={u.username}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: u.is_active ? 'var(--color-surface)' : 'var(--color-surface-muted)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--color-border)',
                opacity: u.is_active ? 1 : 0.7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary-light)',
                  color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14,
                }}>
                  {u.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    <strong>{u.display_name}</strong> <span style={{ color: 'var(--color-ink-muted)', fontWeight: 400 }}>({u.username})</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <span className="badge badge-info">{u.role}</span>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn'}`}
                onClick={() => toggleActive(u)}
              >
                {u.is_active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ManageStaff() {
  return (
    <StaffGate requireRole="Administrator">
      <ManageStaffContent />
    </StaffGate>
  )
}
