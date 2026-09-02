import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StaffGate from '../components/StaffGate'
import { AuthProvider } from '../context/AuthContext'
import client from '../api/client'

vi.mock('../api/client')

function renderGated(props = {}) {
  return render(
    <AuthProvider>
      <StaffGate {...props}>
        <div>Protected content</div>
      </StaffGate>
    </AuthProvider>
  )
}

describe('StaffGate', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows the login form and hides protected content when logged out', () => {
    renderGated()
    expect(screen.getByText('Staff Login')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('logs in with username/password and reveals protected content', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({
      data: { access_token: 'fake.jwt.token', name: 'Suresh', role: 'Officer' },
    })

    renderGated()
    await user.type(screen.getByLabelText('Username'), 'officer1')
    await user.type(screen.getByLabelText('Password'), 'officer-demo-pass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Protected content')).toBeInTheDocument()
    expect(client.post).toHaveBeenCalledWith('/api/auth/login', { username: 'officer1', password: 'officer-demo-pass' })
    expect(localStorage.getItem('sevasetu_staff_token')).toBe('fake.jwt.token')
  })

  it('shows a clear error on wrong credentials without revealing content', async () => {
    const user = userEvent.setup()
    client.post.mockRejectedValueOnce({ response: { status: 401 } })

    renderGated()
    await user.type(screen.getByLabelText('Username'), 'officer1')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Incorrect username or password.')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('shows the rate-limit message on a 429', async () => {
    const user = userEvent.setup()
    client.post.mockRejectedValueOnce({
      response: { status: 429, data: { detail: 'Too many failed attempts. Try again in 60 seconds.' } },
    })

    renderGated()
    await user.type(screen.getByLabelText('Username'), 'officer1')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Too many failed attempts. Try again in 60 seconds.')).toBeInTheDocument()
  })

  it('enforces requireRole: an Officer is blocked from an Administrator-only gate', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({
      data: { access_token: 'fake.jwt.token', name: 'Suresh', role: 'Officer' },
    })

    renderGated({ requireRole: 'Administrator' })
    await user.type(screen.getByLabelText('Username'), 'officer1')
    await user.type(screen.getByLabelText('Password'), 'officer-demo-pass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => expect(screen.queryByText('Staff Login')).not.toBeInTheDocument())
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.getByText(/this page is for administrators/i)).toBeInTheDocument()
  })
})
