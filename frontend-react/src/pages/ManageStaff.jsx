import { useState, useEffect } from 'react'
import client from '../api/client'
import StaffGate from '../components/StaffGate'
import { Icon } from '../components/Icon'

function ManageStaffContent() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'Officer' })
  const [formError, setFormError] = useState(null)
  const [formSuccess, setFormSuccess] = useState(null)

  // Reset password modal state
  const [resetModalUser, setResetModalUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetSuccess, setResetSuccess] = useState(null)
  const [resetError, setResetError] = useState(null)

  function loadUsers() {
    client
      .get('/api/staff/users')
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load staff users.'))
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreate(event) {
    event.preventDefault()
    setFormError(null)
    setFormSuccess(null)
    try {
      await client.post('/api/staff/users', form)
      setFormSuccess(`Account "${form.username}" created successfully.`)
      setForm({ username: '', password: '', display_name: '', role: 'Officer' })
      loadUsers()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Could not create account.')
    }
  }

  async function handleRoleChange(user, newRole) {
    if (user.role === newRole) return
    setError(null)
    try {
      await client.patch(`/api/staff/users/${user.username}/role`, { role: newRole })
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update user role.')
    }
  }

  async function toggleActive(user) {
    const action = user.is_active ? 'deactivate' : 'activate'
    setError(null)
    try {
      await client.patch(`/api/staff/users/${user.username}/${action}`)
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update account status.')
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    setResetError(null)
    setResetSuccess(null)
    if (!newPassword || newPassword.length < 8) {
      setResetError('New password must be at least 8 characters.')
      return
    }
    try {
      await client.post(`/api/staff/users/${resetModalUser.username}/reset-password`, {
        new_password: newPassword,
      })
      setResetSuccess(`Password for "${resetModalUser.username}" reset successfully.`)
      setNewPassword('')
      setTimeout(() => {
        setResetModalUser(null)
        setResetSuccess(null)
      }, 1500)
    } catch (err) {
      setResetError(err.response?.data?.detail || 'Could not reset password.')
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
                <option>Senior Officer</option>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {users.map((u) => (
            <div
              key={u.username}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                padding: '14px 16px',
                background: u.is_active ? 'var(--color-surface)' : 'var(--color-surface-muted)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--color-border)',
                opacity: u.is_active ? 1 : 0.75,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary-light)',
                  color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16,
                }}>
                  {u.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {u.display_name} <span style={{ color: 'var(--color-ink-muted)', fontWeight: 400, fontSize: 13 }}>({u.username})</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="badge badge-info">{u.role}</span>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-ink-muted)' }}>
                      Processed: <strong>{u.applications_processed || 0}</strong> apps
                    </span>
                    {u.last_login && (
                      <span style={{ fontSize: 11, color: 'var(--color-ink-subtle)' }}>
                        Last login: {new Date(u.last_login).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u, e.target.value)}
                  style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-ink)',
                    fontWeight: 600,
                  }}
                  title="Change staff role (creates audit log event)"
                >
                  <option value="Officer">Officer</option>
                  <option value="Senior Officer">Senior Officer</option>
                  <option value="Administrator">Administrator</option>
                </select>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setResetModalUser(u)
                    setNewPassword('')
                    setResetError(null)
                    setResetSuccess(null)
                  }}
                >
                  <Icon name="lock" size={13} />
                  <span>Reset Password</span>
                </button>
                <button
                  className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn'}`}
                  onClick={() => toggleActive(u)}
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Password Reset Modal */}
      {resetModalUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>Reset Password: {resetModalUser.display_name}</h3>
              <button
                onClick={() => setResetModalUser(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--color-ink-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', margin: '0 0 12px' }}>
                  Assign a temporary new password for username: <strong>{resetModalUser.username}</strong>
                </p>

                <div className="field">
                  <label htmlFor="modal-new-pwd">New Password (minimum 8 characters)</label>
                  <input
                    id="modal-new-pwd"
                    type="password"
                    placeholder="Enter new secure password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                </div>

                {resetError && (
                  <div className="status-banner danger" style={{ marginTop: 8 }}>
                    <span>⚠️</span>
                    <div>{resetError}</div>
                  </div>
                )}
                {resetSuccess && (
                  <div className="status-banner success" style={{ marginTop: 8 }}>
                    <span>✓</span>
                    <div>{resetSuccess}</div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setResetModalUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
