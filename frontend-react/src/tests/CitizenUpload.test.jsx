import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CitizenUpload from '../pages/CitizenUpload'
import client from '../api/client'

vi.mock('../api/client')

describe('CitizenUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the form with all 4 required documents for the default service', () => {
    render(<CitizenUpload />)
    expect(screen.getByLabelText('Your full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Aadhaar card')).toBeInTheDocument()
    expect(screen.getByLabelText('Ration card')).toBeInTheDocument()
    expect(screen.getByLabelText('Electricity bill')).toBeInTheDocument()
    expect(screen.getByLabelText('Residence proof')).toBeInTheDocument()
  })

  it('shows a validation error instead of submitting when name is empty', async () => {
    const user = userEvent.setup()
    render(<CitizenUpload />)
    await user.click(screen.getByRole('button', { name: /check my application/i }))
    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument()
    expect(client.post).not.toHaveBeenCalled()
  })

  it('shows a validation error when no documents are attached', async () => {
    const user = userEvent.setup()
    render(<CitizenUpload />)
    await user.type(screen.getByLabelText('Your full name'), 'Rahul Kumar')
    await user.click(screen.getByRole('button', { name: /check my application/i }))
    expect(await screen.findByText(/please upload at least one document/i)).toBeInTheDocument()
    expect(client.post).not.toHaveBeenCalled()
  })

  it('submits multipart form data and renders the real readiness result', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({
      data: {
        application_id: 'test1234',
        citizen_name: 'Rahul Kumar',
        service_type: 'income_certificate',
        readiness_score: 75,
        field_checks: [
          { field: 'name', status: 'pass', detail: 'Matches across documents' },
          { field: 'address', status: 'fail', detail: 'Aadhaar lists "12 MG Road"; Electricity Bill lists "14 MG Road"' },
        ],
        missing_documents: ['residence_proof'],
        duplicate_suspected: false,
        estimated_delay_days: '3-5',
        recommendation: 'Upload an updated Aadhaar or a matching residence proof before resubmitting.',
      },
    })

    render(<CitizenUpload />)
    await user.type(screen.getByLabelText('Your full name'), 'Rahul Kumar')

    const fakeFile = new File(['fake-image-content'], 'aadhaar.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Aadhaar card'), fakeFile)

    await user.click(screen.getByRole('button', { name: /check my application/i }))

    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(1))

    // Verify the call actually used multipart form data with the right fields
    const [url, formData, options] = client.post.mock.calls[0]
    expect(url).toBe('/api/applications')
    expect(formData.get('citizen_name')).toBe('Rahul Kumar')
    expect(formData.get('service_type')).toBe('income_certificate')
    expect(formData.get('aadhaar')).toBeTruthy()
    expect(options.headers['Content-Type']).toBe('multipart/form-data')

    // Verify the real response renders correctly
    expect(await screen.findByText('75%')).toBeInTheDocument()
    expect(screen.getByText(/needs attention/i)).toBeInTheDocument()
    expect(screen.getByText(/aadhaar lists "12 mg road"/i)).toBeInTheDocument()
    expect(screen.getByText('3-5 days')).toBeInTheDocument()
    expect(screen.getByText('test1234')).toBeInTheDocument()
  })

  it('shows the backend error message when the request fails', async () => {
    const user = userEvent.setup()
    client.post.mockRejectedValueOnce({ response: { data: { detail: 'At least one document must be uploaded' } } })

    render(<CitizenUpload />)
    await user.type(screen.getByLabelText('Your full name'), 'Rahul Kumar')
    const fakeFile = new File(['x'], 'aadhaar.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Aadhaar card'), fakeFile)
    await user.click(screen.getByRole('button', { name: /check my application/i }))

    expect(await screen.findByText('At least one document must be uploaded')).toBeInTheDocument()
  })
})
