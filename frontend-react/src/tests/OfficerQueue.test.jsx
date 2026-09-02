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

  it('renders Pass Document Review for READY_FOR_REVIEW and gates Approve until FINAL_OFFICER_REVIEW', async () => {
    const user = userEvent.setup()
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'READY_FOR_REVIEW' }],
    })
    client.get.mockResolvedValueOnce({ data: { ...baseDetail, status: 'READY_FOR_REVIEW' } }) // detail
    client.get.mockResolvedValueOnce({ data: [{ event_type: 'Uploaded', detail: '3 documents', created_at: '2026-08-03T10:10:00' }] }) // audit

    render(<AuthProvider><OfficerQueue /></AuthProvider>)
    await loginAsOfficer(user)
    await user.click(await screen.findByText(/rahul kumar/i))

    expect(await screen.findByText(/cross-document field verification/i)).toBeInTheDocument()
    expect(screen.getByText('Test penalty')).toBeInTheDocument()
    expect(screen.getAllByText(/94.5%/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/uploaded/i).length).toBeGreaterThanOrEqual(1)

    // Pass Document Review button MUST be visible on READY_FOR_REVIEW
    const passDocBtn = screen.getByRole('button', { name: /pass document review/i })
    expect(passDocBtn).toBeInTheDocument()

    // Approve button MUST NOT be visible on READY_FOR_REVIEW
    expect(screen.queryByRole('button', { name: /approve application/i })).not.toBeInTheDocument()

    // Pass Document Review action
    client.post.mockResolvedValueOnce({ data: { id: 'app1', status: 'INTERVIEW_ELIGIBLE' } })
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'INTERVIEW_ELIGIBLE' }],
    })
    client.get.mockResolvedValueOnce({ data: { ...baseDetail, status: 'INTERVIEW_ELIGIBLE' } })

    await user.click(passDocBtn)
    expect(client.post).toHaveBeenCalledWith('/api/applications/app1/document-review-pass', {
      notes: expect.stringContaining('passed'),
    })
  })

  it('allows final statutory approval once application is in FINAL_OFFICER_REVIEW', async () => {
    const user = userEvent.setup()
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'FINAL_OFFICER_REVIEW' }],
    })
    client.get.mockResolvedValueOnce({
      data: {
        ...baseDetail,
        status: 'FINAL_OFFICER_REVIEW',
        interview_consistency: 'CONSISTENT',
        interview_summary: { overall_consistency: 'CONSISTENT', summary_notes: 'All answers matched document records.' },
      },
    })
    client.get.mockResolvedValueOnce({ data: [] }) // audit

    render(<AuthProvider><OfficerQueue /></AuthProvider>)
    await loginAsOfficer(user)
    await user.click(await screen.findByText(/rahul kumar/i))

    // Approve Application button is now available
    const approveBtn = await screen.findByRole('button', { name: /approve application/i })
    expect(approveBtn).toBeInTheDocument()

    client.post.mockResolvedValueOnce({ data: { id: 'app1', status: 'APPROVED', resolved_by: 'Suresh' } })
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app1', citizen_name: 'Rahul Kumar', service_type: 'income_certificate', readiness_score: 75, duplicate_suspected: false, status: 'APPROVED' }],
    })
    client.get.mockResolvedValueOnce({ data: { ...baseDetail, status: 'APPROVED', resolved_by: 'Suresh' } })

    // Open statutory approval confirmation modal
    await user.click(approveBtn)
    // Check confirmation checkbox
    await user.click(screen.getByRole('checkbox'))
    // Click confirm approval button
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(client.post).toHaveBeenCalledWith('/api/applications/app1/approve', { notes: 'All statutory requirements verified.' })
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

  it('safely renders application details when field_checks is undefined or missing without crashing', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({ data: { access_token: 'tok', name: 'Suresh', role: 'Officer' } })
    client.get.mockResolvedValueOnce({
      data: [{ id: 'app-bug', citizen_name: 'Bhavy Garg', service_type: 'passport', readiness_score: 80, status: 'READY_FOR_REVIEW' }],
    })
    // Simulate real backend response where field_checks was omitted and field_mismatches was provided
    client.get.mockResolvedValueOnce({
      data: {
        id: 'app-bug',
        citizen_name: 'Bhavy Garg',
        service_type: 'passport',
        status: 'READY_FOR_REVIEW',
        readiness_score: 80,
        risk_level: 'LOW',
        // Omit field_checks to test defense against "Cannot read properties of undefined (reading 'find')"
        field_mismatches: [{ field: 'name', status: 'pass', detail: 'Matches' }],
        documents: [],
        document_verifications: [],
        score_reasoning: undefined,
        missing_documents: undefined,
      },
    })
    client.get.mockResolvedValueOnce({ data: [] }) // audit

    render(<AuthProvider><OfficerQueue /></AuthProvider>)
    await user.type(screen.getByLabelText('Username'), 'officer1')
    await user.type(screen.getByLabelText('Password'), 'officer-demo-pass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    // Expand application
    await user.click(await screen.findByText(/bhavy garg/i))

    // Verify it renders safely without throwing any find error
    expect(await screen.findByText(/Cross-Document Field Verification:/i)).toBeInTheDocument()
    expect(screen.getByText(/Full Name/i)).toBeInTheDocument()
    expect(screen.getByText(/Residential Address/i)).toBeInTheDocument()
  })

  it('renders empty state cleanly when no applications exist', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({ data: { access_token: 'tok', name: 'Suresh', role: 'Officer' } })
    client.get.mockResolvedValueOnce({ data: [] })

    render(<AuthProvider><OfficerQueue /></AuthProvider>)
    await user.type(screen.getByLabelText('Username'), 'officer1')
    await user.type(screen.getByLabelText('Password'), 'officer-demo-pass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/No applications match the selected criteria/i)).toBeInTheDocument()
  })
})
