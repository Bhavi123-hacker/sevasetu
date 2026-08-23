import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OfficerQueue from '../pages/OfficerQueue'
import { AuthProvider } from '../context/AuthContext'
import client from '../api/client'

vi.mock('../api/client')

async function loginAsOfficer(user) {
  client.post.mockResolvedValueOnce({ data: { access_token: 'tok', name: 'Suresh', role: 'Officer' } })
  await user.type(screen.getByLabelText('Username'), 'officer1')
  await user.type(screen.getByLabelText('Password'), 'officer-demo-pass')
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

  it('expands a row to show detail (including score reasoning and audit trail) and can approve it', async () => {
    const user = userEvent.setup()
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'READY_FOR_REVIEW' }],
    })
    client.get.mockResolvedValueOnce({ data: baseDetail }) // detail
    client.get.mockResolvedValueOnce({ data: [{ event_type: 'Uploaded', detail: '3 documents', created_at: '2026-08-03T10:10:00' }] }) // audit

    render(<AuthProvider><OfficerQueue /></AuthProvider>)
    await loginAsOfficer(user)
    await user.click(await screen.findByText(/rahul kumar/i))

    expect(await screen.findByText('Extracted Field Verification & Coherence Matrix:')).toBeInTheDocument()
    expect(screen.getByText('Test penalty')).toBeInTheDocument()
    expect(screen.getAllByText(/94.5%/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/uploaded/i)).toBeInTheDocument()

    client.post.mockResolvedValueOnce({ data: { id: 'app1', status: 'APPROVED', resolved_by: 'Suresh' } })
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'APPROVED' }],
    })
    client.get.mockResolvedValueOnce({ data: { ...baseDetail, status: 'APPROVED', resolved_by: 'Suresh' } })

    await user.click(screen.getByRole('button', { name: /approve application/i }))
    expect(client.post).toHaveBeenCalledWith('/api/applications/app1/approve', { notes: 'Approved by statutory review.' })
    expect(await screen.findByText(/authorized by suresh/i)).toBeInTheDocument()
  })

  it('an Administrator does not see officer action buttons', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({ data: { access_token: 'tok', name: 'Priya', role: 'Administrator' } })
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'READY_FOR_REVIEW' }],
    })
    client.get.mockResolvedValueOnce({ data: baseDetail })
    client.get.mockResolvedValueOnce({ data: [] }) // audit

    render(<AuthProvider><OfficerQueue /></AuthProvider>)
    await user.type(screen.getByLabelText('Username'), 'admin1')
    await user.type(screen.getByLabelText('Password'), 'admin-demo-pass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await user.click(await screen.findByText(/rahul kumar/i))
    await waitFor(() => expect(screen.queryByRole('button', { name: /approve application/i })).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /request correction/i })).not.toBeInTheDocument()
  })
})
