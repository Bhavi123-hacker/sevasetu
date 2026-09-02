import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AskQuestion from '../pages/AskQuestion'
import Feedback from '../pages/Feedback'
import CheckStatus from '../pages/CheckStatus'
import client from '../api/client'

vi.mock('../api/client')

beforeEach(() => vi.clearAllMocks())

describe('AskQuestion', () => {
  it('sends the question and renders the real matched passage', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({
      data: {
        question: 'is there a fee',
        matches: [{ id: 'fees', text: 'There is no application fee for a first-time income certificate application.', relevance: 0.48 }],
        generated_answer: null,
      },
    })

    render(
      <MemoryRouter>
        <AskQuestion />
      </MemoryRouter>
    )
    await user.type(screen.getByLabelText(/what do you want to know/i), 'is there a fee')
    await user.click(screen.getByRole('button', { name: 'Ask' }))

    expect(client.post).toHaveBeenCalledWith('/api/ask', { question: 'is there a fee' })
    expect(await screen.findByText('High match')).toBeInTheDocument()
    expect(screen.getByText(/no application fee/i)).toBeInTheDocument()
    expect(screen.getByText(/no generated answer available/i)).toBeInTheDocument()
  })

  it('shows the generated answer when present, without hiding the source passage', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({
      data: {
        question: 'is there a fee',
        matches: [{ id: 'fees', text: 'There is no application fee.', relevance: 0.48 }],
        generated_answer: 'No, first-time applications are free.',
      },
    })
    render(
      <MemoryRouter>
        <AskQuestion />
      </MemoryRouter>
    )
    await user.type(screen.getByLabelText(/what do you want to know/i), 'is there a fee')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('No, first-time applications are free.')).toBeInTheDocument()
    expect(screen.getByText('There is no application fee.')).toBeInTheDocument()
  })
})

describe('Feedback', () => {
  it('requires text before submitting', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    )
    await user.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(await screen.findByText(/please provide feedback details/i)).toBeInTheDocument()
    expect(client.post).not.toHaveBeenCalled()
  })

  it('submits with optional fields correctly nulled when blank', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({ data: { id: 'fb1', sentiment_label: 'positive', sentiment_score: 0.7, message: 'Feedback recorded successfully.' } })
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    )
    await user.type(screen.getByLabelText(/your comments/i), 'Great experience!')
    await user.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(client.post).toHaveBeenCalledWith('/api/feedback', {
      text: 'Great experience!',
      rating: 5,
      category: 'EASE_OF_APPLICATION',
      citizen_name: null,
      application_id: null,
      grievance_id: null,
    })
    expect(await screen.findByText(/feedback recorded successfully/i)).toBeInTheDocument()
  })
})

describe('CheckStatus', () => {
  it('shows a clear error for an unknown application ID', async () => {
    const user = userEvent.setup()
    client.get.mockRejectedValueOnce({ response: { status: 404 } })
    render(
      <MemoryRouter>
        <CheckStatus />
      </MemoryRouter>
    )
    await user.type(screen.getByLabelText(/application reference id/i), 'doesnotexist')
    await user.click(screen.getByRole('button', { name: /check status/i }))
    expect(await screen.findByText(/no application found/i)).toBeInTheDocument()
  })

  it('renders real status data and 6-stage timeline for a valid ID', async () => {
    const user = userEvent.setup()
    client.get.mockResolvedValueOnce({
      data: {
        id: 'f9a6d523', citizen_name: 'Rahul Kumar', service_type: 'income_certificate',
        readiness_score: 90, status: 'READY_FOR_REVIEW',
        average_ocr_confidence: 95,
        estimated_delay_days: '2-3',
        missing_documents: ['residence_proof'],
        field_checks: [{ field: 'name', status: 'pass', detail: 'Matches across documents' }],
      },
    })
    render(
      <MemoryRouter>
        <CheckStatus />
      </MemoryRouter>
    )
    await user.type(screen.getByLabelText(/application reference id/i), 'f9a6d523')
    await user.click(screen.getByRole('button', { name: /check status/i }))
    expect(await screen.findByText('90%')).toBeInTheDocument()
    expect(screen.getByText(/residence proof/i)).toBeInTheDocument()
    expect(screen.getByText('Submitted')).toBeInTheDocument()
    expect(screen.getByText('Officer Review')).toBeInTheDocument()
  })

  it('displays correction details and resubmission form when status is NEEDS_CORRECTION', async () => {
    const user = userEvent.setup()
    client.get.mockResolvedValueOnce({
      data: {
        id: 'corr123', citizen_name: 'Rahul Kumar', service_type: 'income_certificate',
        readiness_score: 55, status: 'NEEDS_CORRECTION',
        average_ocr_confidence: 88,
        estimated_delay_days: '4-5',
        correction_reason: 'Address Mismatch',
        correction_details: 'Electricity bill address does not match Aadhaar.',
        missing_documents: [],
        field_checks: [{ field: 'address', status: 'fail', detail: 'Mismatch' }],
      },
    })
    render(
      <MemoryRouter>
        <CheckStatus />
      </MemoryRouter>
    )
    await user.type(screen.getByLabelText(/application reference id/i), 'corr123')
    await user.click(screen.getByRole('button', { name: /check status/i }))
    const mismatchElements = await screen.findAllByText(/Address Mismatch/i)
    expect(mismatchElements.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Electricity bill address does not match Aadhaar/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /submit corrected documents/i })).toBeInTheDocument()
  })
})
