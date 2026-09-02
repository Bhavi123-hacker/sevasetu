import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../context/LanguageContext'
import { AuthProvider } from '../context/AuthContext'
import CitizenHome from '../pages/CitizenHome'
import EligibilityGuidance from '../pages/EligibilityGuidance'
import CitizenProfile from '../pages/CitizenProfile'
import DocumentWallet from '../pages/DocumentWallet'
import VerificationInterview from '../pages/VerificationInterview'
import NotificationCenter from '../pages/NotificationCenter'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  api: {
    getServices: vi.fn(),
    getServiceChecklist: vi.fn(),
    checkEligibility: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    getWallet: vi.fn(),
    uploadWalletDoc: vi.fn(),
    deleteWalletDoc: vi.fn(),
    startInterview: vi.fn(),
    getInterview: vi.fn(),
    answerInterview: vi.fn(),
    completeInterview: vi.fn(),
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
  },
  default: {
    interceptors: { request: { use: vi.fn() } },
  },
}))

function renderWithProviders(ui) {
  return render(
    <LanguageProvider>
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}

describe('SevaSetu v1.0.0 Civic Platform Frontend Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders CitizenHome catalog and filters services', async () => {
    api.getServices.mockResolvedValueOnce({
      data: [
        { id: 'income_certificate', name: 'Income Certificate', department: 'Revenue Department', description: 'Proof of income' },
        { id: 'caste_certificate', name: 'Caste Certificate', department: 'Social Welfare', description: 'Proof of category' },
      ],
    })

    renderWithProviders(<CitizenHome />)
    expect(await screen.findByText('Income Certificate')).toBeInTheDocument()
    expect(screen.getByText('Caste Certificate')).toBeInTheDocument()
  })

  it('renders EligibilityGuidance and computes indicative match', async () => {
    api.getServices.mockResolvedValueOnce({
      data: [{ id: 'income_certificate', name: 'Income Certificate', department: 'Revenue' }],
    })
    api.checkEligibility.mockResolvedValueOnce({
      data: {
        service_type: 'income_certificate',
        guidance_status: 'POTENTIALLY_RELEVANT',
        is_indicatively_matched: true,
        matching_criteria: ['Income within statutory threshold'],
        unmatched_criteria: [],
        guidance_notes: ['Applicant meets preliminary threshold.'],
        provenance_source: 'State Revenue Portal',
        verification_status: 'CONFIGURED_NOT_VERIFIED',
      },
    })

    renderWithProviders(<EligibilityGuidance />)
    expect(await screen.findByText('Indicative Eligibility Guidance')).toBeInTheDocument()
    expect(await screen.findByText('POTENTIALLY_RELEVANT')).toBeInTheDocument()
    expect(screen.getByText('Income within statutory threshold')).toBeInTheDocument()
  })

  it('renders CitizenProfile and saves updated data', async () => {
    api.getProfile.mockResolvedValueOnce({
      data: {
        citizen_name: 'Sunita Verma',
        date_of_birth: '1988-03-22',
        address: '45 Green Park',
        state: 'Gujarat',
      },
    })
    api.updateProfile.mockResolvedValueOnce({ data: { status: 'updated' } })

    renderWithProviders(<CitizenProfile />)
    expect(await screen.findByDisplayValue('Sunita Verma')).toBeInTheDocument()
    const saveBtn = screen.getByText(/Save Profile Data/i)
    fireEvent.click(saveBtn)
    expect(await screen.findByText(/Profile successfully saved/i)).toBeInTheDocument()
  })

  it('renders DocumentWallet and displays pre-verified items', async () => {
    api.getWallet.mockResolvedValueOnce({
      data: [
        {
          id: 'wdoc-1',
          original_filename: 'aadhaar_clean.png',
          doc_type: 'aadhaar',
          type_status: 'DOCUMENT_TYPE_MATCH',
          quality_status: 'GOOD',
          validity_status: 'VALID',
          authenticity_disclaimer: 'Automated pre-verification only.',
        },
      ],
    })

    renderWithProviders(<DocumentWallet />)
    expect(await screen.findByText('aadhaar_clean.png')).toBeInTheDocument()
    expect(screen.getByText('✓ Type Matched')).toBeInTheDocument()
  })

  it('renders VerificationInterview with ethical disclaimer', async () => {
    api.startInterview.mockResolvedValueOnce({
      data: {
        session_id: 'intv-123',
        questions: [
          { id: 'q-1', order_num: 1, category: 'IDENTITY', question_text: 'Please state your full legal name.' },
        ],
      },
    })

    renderWithProviders(<VerificationInterview />)
    expect(await screen.findByText('AI Verification Interview')).toBeInTheDocument()
    expect(screen.getByText(/No lie detection, emotion analysis, or psychological scoring/i)).toBeInTheDocument()
  })

  it('renders NotificationCenter with unread notifications', async () => {
    api.getNotifications.mockResolvedValueOnce({
      data: [
        {
          id: 'notif-1',
          title: 'Document Correction Required',
          message: 'Please upload an updated proof of residence.',
          notification_type: 'CORRECTION_REQUESTED',
          delivery_channel: 'IN_APP',
          delivery_status: 'DELIVERED_IN_APP',
          is_read: false,
        },
      ],
    })

    renderWithProviders(<NotificationCenter />)
    expect(await screen.findByText('Document Correction Required')).toBeInTheDocument()
    expect(screen.getByText('Please upload an updated proof of residence.')).toBeInTheDocument()
  })
})
