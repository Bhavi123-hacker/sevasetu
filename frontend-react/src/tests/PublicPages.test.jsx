import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

    render(<AskQuestion />)
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
    render(<AskQuestion />)
    await user.type(screen.getByLabelText(/what do you want to know/i), 'is there a fee')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('No, first-time applications are free.')).toBeInTheDocument()
    expect(screen.getByText('There is no application fee.')).toBeInTheDocument()
  })
})

describe('Feedback', () => {
  it('requires text before submitting', async () => {
    const user = userEvent.setup()
    render(<Feedback />)
    await user.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(await screen.findByText(/please write something/i)).toBeInTheDocument()
    expect(client.post).not.toHaveBeenCalled()
  })

  it('submits with optional fields correctly nulled when blank', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({ data: { id: 'fb1', sentiment_label: 'positive', sentiment_score: 0.7 } })
    render(<Feedback />)
    await user.type(screen.getByLabelText(/your feedback/i), 'Great experience!')
    await user.click(screen.getByRole('button', { name: /submit feedback/i }))
    expect(client.post).toHaveBeenCalledWith('/api/feedback', { text: 'Great experience!', citizen_name: null, application_id: null })
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument()
  })
})

describe('CheckStatus', () => {
  it('shows a clear error for an unknown application ID', async () => {
    const user = userEvent.setup()
    client.get.mockRejectedValueOnce({ response: { status: 404 } })
    render(<CheckStatus />)
    await user.type(screen.getByLabelText(/application id/i), 'doesnotexist')
    await user.click(screen.getByRole('button', { name: /check status/i }))
    expect(await screen.findByText(/no application found/i)).toBeInTheDocument()
  })

  it('renders real status data for a valid ID', async () => {
    const user = userEvent.setup()
    client.get.mockResolvedValueOnce({
      data: {
        id: 'f9a6d523', readiness_score: 90, status: 'submitted',
        missing_documents: ['residence_proof'],
        field_checks: [{ field: 'name', status: 'pass', detail: 'Matches across documents' }],
      },
    })
    render(<CheckStatus />)
    await user.type(screen.getByLabelText(/application id/i), 'f9a6d523')
    await user.click(screen.getByRole('button', { name: /check status/i }))
    expect(await screen.findByText('90%')).toBeInTheDocument()
    expect(screen.getByText(/residence proof/i)).toBeInTheDocument()
  })
})
