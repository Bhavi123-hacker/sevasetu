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
      <h2>Manage Staff</h2>
      <p style={{ color: 'var(--color-ink-muted)' }}>Create accounts for real team members instead of using the two seeded demo logins.</p>

      <form onSubmit={handleCreate} className="card">
        <h3>New account</h3>
        <div className="field">
          <label htmlFor="new-username">Username</label>
          <input id="new-username" type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="new-display-name">Display name</label>
          <input id="new-display-name" type="text" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="new-password">Password (min 8 characters)</label>
          <input id="new-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="new-role">Role</label>
          <select id="new-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option>Officer</option>
            <option>Administrator</option>
          </select>
        </div>
        {formError && <div className="status-banner danger">{formError}</div>}
        {formSuccess && <div className="status-banner success">{formSuccess}</div>}
        <button type="submit" className="btn">Create account</button>
      </form>

      <div className="card">
        <h3>Existing accounts</h3>
        {users.map((u) => (
          <div key={u.username} className="check-row" style={{ justifyContent: 'space-between' }}>
            <span>
              <strong>{u.display_name}</strong> ({u.username}) — {u.role} — {u.is_active ? 'Active' : 'Deactivated'}
            </span>
            <button className="btn btn-secondary" onClick={() => toggleActive(u)}>
              {u.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
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
