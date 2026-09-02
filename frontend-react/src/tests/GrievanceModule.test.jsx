import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from '../context/LanguageContext'
import RaiseGrievanceModal from '../components/RaiseGrievanceModal'
import CitizenGrievances from '../pages/CitizenGrievances'
import GrievanceDetails from '../pages/GrievanceDetails'
import OfficerGrievanceQueue from '../pages/OfficerGrievanceQueue'
import GrievanceReview from '../pages/GrievanceReview'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  API_BASE_URL: 'http://localhost:8000',
  api: {
    createGrievance: vi.fn(),
    listGrievances: vi.fn(),
    getGrievanceDetails: vi.fn(),
    getGrievanceHistory: vi.fn(),
    acknowledgeGrievance: vi.fn(),
    assignGrievance: vi.fn(),
    startGrievanceReview: vi.fn(),
    requestGrievanceInformation: vi.fn(),
    respondToGrievance: vi.fn(),
    addGrievanceInternalNote: vi.fn(),
    escalateGrievance: vi.fn(),
    resolveGrievance: vi.fn(),
    reopenGrievance: vi.fn(),
    closeGrievance: vi.fn(),
    getApplicationGrievances: vi.fn(),
  },
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('Civic Grievance & Escalation Module Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders RaiseGrievanceModal and submits new grievance', async () => {
    api.createGrievance.mockResolvedValueOnce({
      data: {
        grievance_id: 'grv-1234',
        public_reference: 'SS-GRV-2026-0001',
        status: 'OPEN',
        category: 'APPLICATION_DELAYED',
        category_label: 'Application Delayed',
        subject: 'Income certificate delay',
        application_id: 'app-abc',
        sla_deadline: '2026-09-08T00:00:00Z',
      },
    })

    const handleSuccess = vi.fn()
    render(
      <MemoryRouter>
        <LanguageProvider>
          <RaiseGrievanceModal
            isOpen={true}
            onClose={() => {}}
            applicationId="app-abc"
            serviceType="income_certificate"
            onSuccess={handleSuccess}
          />
        </LanguageProvider>
      </MemoryRouter>
    )

    expect(screen.getByText(/Lodge Application Grievance/i)).toBeInTheDocument()
    expect(screen.getByText(/app-abc/i)).toBeInTheDocument()

    // Fill subject and description
    fireEvent.change(screen.getByLabelText(/Subject \/ Summary/i), {
      target: { value: 'Delay in processing' },
    })
    fireEvent.change(screen.getByLabelText(/Detailed Explanation/i), {
      target: { value: 'My application has been pending past the statutory turnaround time.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Submit Grievance/i }))

    await waitFor(() => {
      expect(api.createGrievance).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/Grievance Registered Successfully/i)).toBeInTheDocument()
      expect(screen.getByText(/SS-GRV-2026-0001/i)).toBeInTheDocument()
    })
  })

  it('renders CitizenGrievances page with active and resolved tabs', async () => {
    api.listGrievances.mockResolvedValueOnce({
      data: {
        total: 2,
        page: 1,
        page_size: 20,
        items: [
          {
            id: 'grv-1',
            public_reference: 'SS-GRV-2026-0001',
            category: 'APPLICATION_DELAYED',
            category_label: 'Application Delayed',
            subject: 'Processing delayed beyond SLA',
            status: 'OPEN',
            priority: 'NORMAL',
            sla_status: 'NORMAL',
            application_id: 'app-1',
            created_at: '2026-09-01T00:00:00Z',
          },
          {
            id: 'grv-2',
            public_reference: 'SS-GRV-2026-0002',
            category: 'DOCUMENT_REJECTED',
            category_label: 'Document Rejected',
            subject: 'Aadhaar copy dispute',
            status: 'RESOLVED',
            priority: 'HIGH',
            sla_status: 'MET',
            application_id: 'app-2',
            created_at: '2026-08-28T00:00:00Z',
          },
        ],
      },
    })

    render(
      <MemoryRouter>
        <LanguageProvider>
          <CitizenGrievances />
        </LanguageProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Citizen Grievance Portal/i)).toBeInTheDocument()
      expect(screen.getByText(/SS-GRV-2026-0001/i)).toBeInTheDocument()
      expect(screen.getByText(/SS-GRV-2026-0002/i)).toBeInTheDocument()
    })

    // Click "In Progress" tab
    fireEvent.click(screen.getByRole('button', { name: /In Progress/i }))
    expect(screen.getByText(/SS-GRV-2026-0001/i)).toBeInTheDocument()
    expect(screen.queryByText(/SS-GRV-2026-0002/i)).not.toBeInTheDocument()

    // Click "Resolved" tab
    fireEvent.click(screen.getByRole('button', { name: /Resolved/i }))
    expect(screen.queryByText(/SS-GRV-2026-0001/i)).not.toBeInTheDocument()
    expect(screen.getByText(/SS-GRV-2026-0002/i)).toBeInTheDocument()
  })

  it('renders GrievanceDetails with communication thread and allows citizen response', async () => {
    api.getGrievanceDetails.mockResolvedValueOnce({
      data: {
        id: 'grv-1',
        public_reference: 'SS-GRV-2026-0001',
        category: 'CORRECTION_REQUEST_ISSUE',
        category_label: 'Correction Request Issue',
        subject: 'Clarification regarding electricity bill slot',
        description: 'Officer requested new electricity bill but previous one is within 3 months.',
        status: 'AWAITING_CITIZEN',
        priority: 'NORMAL',
        assigned_officer_name: 'Suresh (Officer)',
        has_attachment: false,
        reopen_count: 0,
        timeline: [
          { step: 'SUBMITTED', title: 'Grievance Lodged', description: 'Grievance registered.', timestamp: '2026-09-01T00:00:00Z', completed: true },
        ],
        messages: [
          {
            id: 'm-1',
            sender_type: 'officer',
            sender_name: 'Suresh (Officer)',
            message_type: 'INFO_REQUEST',
            message_text: 'Please specify the billing cycle date on page 2.',
            is_internal: false,
            created_at: '2026-09-01T01:00:00Z',
          },
        ],
      },
    })
    api.respondToGrievance.mockResolvedValueOnce({ data: { status: 'UNDER_REVIEW' } })

    render(
      <MemoryRouter initialEntries={['/grievances/grv-1']}>
        <LanguageProvider>
          <Routes>
            <Route path="/grievances/:id" element={<GrievanceDetails />} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/SS-GRV-2026-0001/i)[0]).toBeInTheDocument()
      expect(screen.getByText(/Clarification regarding electricity bill slot/i)).toBeInTheDocument()
      expect(screen.getByText(/Please specify the billing cycle date on page 2./i)).toBeInTheDocument()
      expect(screen.getByText(/Officer Requested Clarification/i)).toBeInTheDocument()
    })

    // Submit citizen response
    const input = screen.getByPlaceholderText(/Type your message or response/i)
    fireEvent.change(input, { target: { value: 'The billing cycle date is 15th August 2026.' } })
    fireEvent.click(screen.getByRole('button', { name: /Send Message/i }))

    await waitFor(() => {
      expect(api.respondToGrievance).toHaveBeenCalledWith('grv-1', {
        message_text: 'The billing cycle date is 15th August 2026.',
      })
    })
  })

  it('renders OfficerGrievanceQueue with search and filter controls', async () => {
    api.listGrievances.mockResolvedValueOnce({
      data: {
        total: 1,
        page: 1,
        page_size: 20,
        items: [
          {
            id: 'grv-1',
            public_reference: 'SS-GRV-2026-0001',
            citizen_name: 'Manoj Kumar',
            category: 'APPLICATION_DELAYED',
            category_label: 'Application Delayed',
            subject: 'Processing delayed beyond SLA',
            application_id: 'app-1',
            status: 'OPEN',
            priority: 'NORMAL',
            sla_status: 'NORMAL',
            assigned_officer_name: null,
            created_at: '2026-09-01T00:00:00Z',
          },
        ],
      },
    })

    render(
      <MemoryRouter>
        <LanguageProvider>
          <OfficerGrievanceQueue />
        </LanguageProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Officer Grievance Queue/i)).toBeInTheDocument()
      expect(screen.getByText(/Manoj Kumar/i)).toBeInTheDocument()
      expect(screen.getByText(/SS-GRV-2026-0001/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Review/i })).toBeInTheDocument()
    })
  })

  it('renders GrievanceReview workspace and enables officer actions', async () => {
    api.getGrievanceDetails.mockResolvedValueOnce({
      data: {
        id: 'grv-1',
        public_reference: 'SS-GRV-2026-0001',
        citizen_name: 'Manoj Kumar',
        category: 'DECISION_DISPUTE',
        category_label: 'Decision Dispute',
        subject: 'Income threshold calculation error',
        description: 'Calculation included agricultural non-taxable allowance.',
        status: 'OPEN',
        priority: 'NORMAL',
        assigned_officer_name: null,
        reopen_count: 0,
        has_attachment: false,
        messages: [],
      },
    })
    api.getGrievanceHistory.mockResolvedValueOnce({
      data: { timeline: [] },
    })
    api.acknowledgeGrievance.mockResolvedValueOnce({ data: { status: 'ACKNOWLEDGED' } })

    render(
      <MemoryRouter initialEntries={['/officer/grievances/grv-1']}>
        <LanguageProvider>
          <Routes>
            <Route path="/officer/grievances/:id" element={<GrievanceReview />} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/SS-GRV-2026-0001/i)[0]).toBeInTheDocument()
      expect(screen.getByText(/Manoj Kumar/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Acknowledge Case/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Request Clarification/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /\+ Staff Internal Note/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Issue Formal Resolution/i })).toBeInTheDocument()
    })

    // Click Acknowledge Case
    fireEvent.click(screen.getByRole('button', { name: /Acknowledge Case/i }))
    await waitFor(() => {
      expect(api.acknowledgeGrievance).toHaveBeenCalledWith('grv-1')
    })
  })
})
