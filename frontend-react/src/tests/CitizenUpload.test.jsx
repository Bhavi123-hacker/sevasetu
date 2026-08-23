import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CitizenUpload from '../pages/CitizenUpload'
import client from '../api/client'

vi.mock('../api/client')

describe('CitizenUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.get.mockResolvedValue({
      data: [
        {
          id: 'income_certificate',
          name: 'Income Certificate',
          category: 'Revenue & Welfare',
          description: 'Proof of family annual income',
          required_documents: [
            { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
            { key: 'ration_card', label: 'Ration Card', is_required: true },
            { key: 'electricity_bill', label: 'Electricity Bill', is_required: true },
            { key: 'residence_proof', label: 'Residence Proof', is_required: true },
          ],
        },
        {
          id: 'domicile_certificate',
          name: 'Domicile Certificate',
          category: 'Citizenship & Residence',
          description: 'Proof of permanent state residency',
          required_documents: [
            { key: 'aadhaar', label: 'Aadhaar Card', is_required: true },
            { key: 'residence_proof', label: 'Residence Proof', is_required: true },
            { key: 'birth_certificate', label: 'Birth Certificate', is_required: true },
          ],
        },
      ],
    })
  })

  it('renders the service catalog selector and required documents for the default service', async () => {
    render(<CitizenUpload />)
    expect(await screen.findByText('1. Select Government Service')).toBeInTheDocument()
    expect(screen.getByText('Income Certificate')).toBeInTheDocument()
    expect(screen.getByText('Domicile Certificate')).toBeInTheDocument()
    expect(screen.getByLabelText(/Your Full Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Aadhaar Card/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Ration Card/i)).toBeInTheDocument()
  })

  it('filters services when typing in search box', async () => {
    const user = userEvent.setup()
    render(<CitizenUpload />)
    const searchInput = screen.getByPlaceholderText(/Search services/i)
    await user.type(searchInput, 'Domicile')
    expect(screen.getByText('Domicile Certificate')).toBeInTheDocument()
  })

  it('changes required documents when selecting another service', async () => {
    const user = userEvent.setup()
    render(<CitizenUpload />)
    const domicileCard = screen.getByText('Domicile Certificate')
    await user.click(domicileCard)
    expect(await screen.findByLabelText(/Birth Certificate/i)).toBeInTheDocument()
  })

  it('shows a validation error instead of submitting when name is empty', async () => {
    const user = userEvent.setup()
    render(<CitizenUpload />)
    await user.click(screen.getByRole('button', { name: /check my/i }))
    expect(await screen.findByText(/please enter your full name/i)).toBeInTheDocument()
    expect(client.post).not.toHaveBeenCalled()
  })

  it('shows a validation error when no documents are attached', async () => {
    const user = userEvent.setup()
    render(<CitizenUpload />)
    await user.type(screen.getByLabelText(/Your Full Name/i), 'Rahul Kumar')
    await user.click(screen.getByRole('button', { name: /check my/i }))
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
        score_reasoning: [
          { points: 100, label: 'Base score (all requirements met)' },
          { points: -15, label: 'Address mismatch' },
          { points: -10, label: 'Missing residence proof' },
        ],
        field_checks: [
          { field: 'name', status: 'pass', detail: 'Matches across documents' },
          { field: 'address', status: 'fail', detail: 'Aadhaar lists "12 MG Road"; Electricity Bill lists "14 MG Road"' },
        ],
        missing_documents: ['residence_proof'],
        duplicate_suspected: false,
        estimated_delay_days: '3-5',
        recommendation: 'Upload an updated Aadhaar or a matching residence proof before resubmitting.',
        average_ocr_confidence: 94.8,
      },
    })

    render(<CitizenUpload />)
    await user.type(screen.getByLabelText(/Your Full Name/i), 'Rahul Kumar')

    const fakeFile = new File(['fake-image-content'], 'aadhaar.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText(/Aadhaar Card/i)
    fireEvent.change(fileInput, { target: { files: [fakeFile] } })

    await user.click(screen.getByRole('button', { name: /check my/i }))

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
    expect(screen.getAllByText(/aadhaar lists "12 mg road"/i)[0]).toBeInTheDocument()
    expect(screen.getByText('3-5 days')).toBeInTheDocument()
    expect(screen.getByText('test1234')).toBeInTheDocument()
  })

  it('shows the backend error message when the request fails with 400', async () => {
    const user = userEvent.setup()
    client.post.mockRejectedValueOnce({ response: { data: { detail: 'Residence proof is required.' } } })

    render(<CitizenUpload />)
    await user.type(screen.getByLabelText(/Your Full Name/i), 'Rahul Kumar')
    const fakeFile = new File(['x'], 'aadhaar.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText(/Aadhaar Card/i)
    fireEvent.change(fileInput, { target: { files: [fakeFile] } })
    await user.click(screen.getByRole('button', { name: /check my/i }))

    expect(await screen.findByText('Residence proof is required.')).toBeInTheDocument()
  })

  it('supports PDF upload and displays PDF document badge', async () => {
    render(<CitizenUpload />)
    const fakePdf = new File(['%PDF-1.4 sample content'], 'aadhaar.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByLabelText(/Aadhaar Card/i)
    fireEvent.change(fileInput, { target: { files: [fakePdf] } })

    expect(await screen.findByText('PDF DOCUMENT')).toBeInTheDocument()
    expect(screen.getByText(/Multi-page supported/i)).toBeInTheDocument()
  })

  it('rejects unsupported file formats before submission', async () => {
    render(<CitizenUpload />)

    const invalidFile = new File(['binary'], 'virus.exe', { type: 'application/x-msdownload' })
    const fileInput = screen.getByLabelText(/Aadhaar Card/i)
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    expect(await screen.findByText(/invalid file format/i)).toBeInTheDocument()
    expect(client.post).not.toHaveBeenCalled()
  })
})
