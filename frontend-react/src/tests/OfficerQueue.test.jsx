import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OfficerQueue from '../pages/OfficerQueue'
import { AuthProvider } from '../context/AuthContext'
import client from '../api/client'

vi.mock('../api/client')

async function loginAsOfficer(user) {
  client.post.mockResolvedValueOnce({ data: { access_token: 'tok', name: 'Suresh', role: 'Officer' } })
  await user.type(screen.getByLabelText('Your name'), 'Suresh')
  await user.type(screen.getByLabelText('Password'), 'seva123')
  await user.click(screen.getByRole('button', { name: /log in/i }))
}

const baseDetail = {
  id: 'app1', status: 'submitted', resolved_by: null,
  score_reasoning: [{ points: 100, label: 'Base score (all requirements met)' }, { points: -25, label: 'Test penalty' }],
  average_ocr_confidence: 94.5,
  field_checks: [{ field: 'address', status: 'fail', detail: 'Mismatch found' }],
  missing_documents: [], estimated_delay_days: '3-5', recommendation: 'Fix the address.',
}

describe('OfficerQueue', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('is gated behind login', () => {
    render(<AuthProvider><OfficerQueue /></AuthProvider>)
    expect(screen.getByText('Staff Login')).toBeInTheDocument()
  })

  it('loads and displays real applications after login', async () => {
    const user = userEvent.setup()
    client.get.mockResolvedValueOnce({
      data: [
        { id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'submitted' },
      ],
    })

    render(<AuthProvider><OfficerQueue /></AuthProvider>)
    await loginAsOfficer(user)

    expect(await screen.findByText(/rahul kumar/i)).toBeInTheDocument()
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })

  it('expands a row to show detail (including score reasoning and audit trail) and can resolve it', async () => {
    const user = userEvent.setup()
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'submitted' }],
    })
    client.get.mockResolvedValueOnce({ data: baseDetail }) // detail
    client.get.mockResolvedValueOnce({ data: [{ event_type: 'Uploaded', detail: '3 documents', created_at: '2026-08-03T10:10:00' }] }) // audit

    render(<AuthProvider><OfficerQueue /></AuthProvider>)
    await loginAsOfficer(user)
    await user.click(await screen.findByText(/rahul kumar/i))

    expect(await screen.findByText(/fix the address/i)).toBeInTheDocument()
    expect(screen.getByText('Test penalty')).toBeInTheDocument()
    expect(screen.getByText(/94.5%/)).toBeInTheDocument()
    expect(screen.getByText(/uploaded/i)).toBeInTheDocument()

    client.post.mockResolvedValueOnce({ data: { id: 'app1', status: 'resolved' } })
    // After resolving, the row drops out of view by default (showResolved
    // is off, same as the Streamlit original) — check the box first, same
    // as a real user would, to actually see the updated state.
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'resolved' }],
    })
    client.get.mockResolvedValueOnce({ data: { ...baseDetail, status: 'resolved', resolved_by: 'Suresh' } })

    await user.click(screen.getByRole('button', { name: /mark as reviewed/i }))
    expect(client.post).toHaveBeenCalledWith('/api/applications/app1/resolve')

    await user.click(screen.getByLabelText(/show resolved/i))
    expect(await screen.findByText(/resolved by suresh/i)).toBeInTheDocument()
  })

  it('an Administrator does not see the resolve button', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({ data: { access_token: 'tok', name: 'Priya', role: 'Administrator' } })
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'submitted' }],
    })
    client.get.mockResolvedValueOnce({ data: baseDetail })
    client.get.mockResolvedValueOnce({ data: [] }) // audit

    render(<AuthProvider><OfficerQueue /></AuthProvider>)
    await user.type(screen.getByLabelText('Your name'), 'Priya')
    await user.click(screen.getByText('Administrator'))
    await user.type(screen.getByLabelText('Password'), 'seva123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await user.click(await screen.findByText(/rahul kumar/i))
    await waitFor(() => expect(screen.queryByRole('button', { name: /mark as reviewed/i })).not.toBeInTheDocument())
  })
})
