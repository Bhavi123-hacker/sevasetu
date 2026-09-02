import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ApplicationBuilder from '../pages/ApplicationBuilder'
import { AuthProvider } from '../context/AuthContext'
import { LanguageProvider } from '../context/LanguageContext'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: null }),
    post: vi.fn().mockResolvedValue({ data: null }),
    put: vi.fn().mockResolvedValue({ data: null }),
    delete: vi.fn().mockResolvedValue({ data: null }),
    interceptors: { request: { use: vi.fn() } },
  },
  api: {
    getServices: vi.fn(),
    getServiceChecklist: vi.fn(),
    getProfile: vi.fn(),
    submitApplication: vi.fn(),
    resubmitApplication: vi.fn(),
    citizenSendOtp: vi.fn(),
    citizenVerifyOtp: vi.fn(),
    citizenLogin: vi.fn(),
    citizenRegister: vi.fn(),
  },
}))

vi.mock('../firebase', () => ({
  isFirebaseConfigured: vi.fn().mockReturnValue(true),
  signInWithEmail: vi.fn().mockResolvedValue({
    user: { email: 'bhavygarg7636@gmail.com', displayName: 'Bhavy Garg' },
    idToken: 'mock-firebase-id-token',
    displayName: 'Bhavy Garg',
    emailVerified: true,
  }),
  signUpWithEmail: vi.fn(),
  sendPasswordReset: vi.fn(),
  resendVerificationEmail: vi.fn(),
  reloadAndCheckVerification: vi.fn(),
  mapFirebaseAuthError: vi.fn((err) => err.message || 'Auth error'),
}))

function renderComponent() {
  return render(
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <ApplicationBuilder />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}

describe('ApplicationBuilder Authentication & Gating Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    api.getServices.mockResolvedValue({
      data: [
        { id: 'income_certificate', name: 'Income Certificate', department: 'Revenue', jurisdiction: 'All Districts' },
        { id: 'passport', name: 'Passport', department: 'MEA', jurisdiction: 'National' },
      ],
    })
    api.getServiceChecklist.mockResolvedValue({
      data: {
        required_documents: ['aadhaar', 'income_proof'],
      },
    })
  })

  it('renders Step 1 with empty applicant defaults', async () => {
    renderComponent()
    expect(await screen.findByText('Step 1: Select Government Service')).toBeInTheDocument()
    expect(screen.getByText('Income Certificate')).toBeInTheDocument()

    // Advance to Step 2
    fireEvent.click(screen.getByText(/Next: Applicant Information/i))
    expect(await screen.findByText('Step 2: Applicant Information')).toBeInTheDocument()

    // Verify fields are blank by default
    const nameInput = screen.getByPlaceholderText(/Ramesh Kumar Patel/i)
    expect(nameInput.value).toBe('')
    expect(screen.getByPlaceholderText('+919876543210').value).toBe('')
  })

  it('shows sign-in required banner when unauthenticated', async () => {
    renderComponent()
    expect(await screen.findByText(/Sign In Required/i)).toBeInTheDocument()
    expect(screen.getByText(/Citizen Sign In \/ Register/i)).toBeInTheDocument()
  })

  it('blocks unauthenticated submission and prompts Citizen Auth Modal', async () => {
    renderComponent()
    // Go to Step 2
    fireEvent.click(await screen.findByText(/Next: Applicant Information/i))
    // Fill name
    const nameInput = screen.getByPlaceholderText(/Ramesh Kumar Patel/i)
    fireEvent.change(nameInput, { target: { value: 'Bhavy Garg' } })
    // Go to Step 3
    fireEvent.click(screen.getByText(/Next: Attach Documents/i))
    // Upload files for required slots
    const fileInputs = document.querySelectorAll('input[type="file"]')
    fileInputs.forEach((input) => {
      const dummyFile = new File(['dummy content'], 'doc.pdf', { type: 'application/pdf' })
      fireEvent.change(input, { target: { files: [dummyFile] } })
    })

    // Go to Step 4
    fireEvent.click(await screen.findByText(/Next: Statutory Declaration/i))

    expect(await screen.findByText('Step 4: Statutory Citizen Declaration')).toBeInTheDocument()
    expect(screen.getByText(/Applicant Name:/i)).toBeInTheDocument()
    expect(screen.getByText(/Bhavy Garg/i)).toBeInTheDocument()

    // Check declaration checkbox
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    // Click submit
    const submitBtn = screen.getByText(/Submit for Automated Pre-Verification/i)
    fireEvent.click(submitBtn)

    // Verify Citizen Authentication modal popped up
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Citizen Authentication/i })).toBeInTheDocument()
  })

  it('handles 401 response cleanly without getting stuck in pre-verification state', async () => {
    // Pretend token existed initially
    localStorage.setItem('sevasetu_citizen_token', 'expired-test-token')
    api.submitApplication.mockRejectedValue({
      response: {
        status: 401,
        data: { detail: 'Citizen authentication required to submit application.' },
      },
    })

    renderComponent()
    // Step 2
    fireEvent.click(await screen.findByText(/Next: Applicant Information/i))
    fireEvent.change(screen.getByPlaceholderText(/Ramesh Kumar Patel/i), { target: { value: 'Ramesh Kumar' } })
    // Step 3
    fireEvent.click(screen.getByText(/Next: Attach Documents/i))
    const fileInputs = document.querySelectorAll('input[type="file"]')
    fileInputs.forEach((input) => {
      const dummyFile = new File(['dummy content'], 'doc.pdf', { type: 'application/pdf' })
      fireEvent.change(input, { target: { files: [dummyFile] } })
    })

    // Step 4
    fireEvent.click(await screen.findByText(/Next: Statutory Declaration/i))
    fireEvent.click(screen.getByRole('checkbox'))

    // Submit
    fireEvent.click(screen.getByText(/Submit for Automated Pre-Verification/i))

    // Verify error is shown and modal is opened
    await waitFor(() => {
      expect(screen.getByText(/Submission Error:/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Citizen authentication required or session expired/i)).toBeInTheDocument()
    // Token was removed from localStorage
    expect(localStorage.getItem('sevasetu_citizen_token')).toBeNull()
  })

  it('renders Step 4 statutory declaration with scoped class and clear readable structure', async () => {
    renderComponent()
    // Step 2
    fireEvent.click(await screen.findByText(/Next: Applicant Information/i))
    fireEvent.change(screen.getByPlaceholderText(/Ramesh Kumar Patel/i), { target: { value: 'Priya Sharma' } })
    // Step 3
    fireEvent.click(screen.getByText(/Next: Attach Documents/i))
    const fileInputs = document.querySelectorAll('input[type="file"]')
    fileInputs.forEach((input) => {
      const dummyFile = new File(['dummy content'], 'doc.pdf', { type: 'application/pdf' })
      fireEvent.change(input, { target: { files: [dummyFile] } })
    })
    // Step 4
    fireEvent.click(await screen.findByText(/Next: Statutory Declaration/i))
    expect(await screen.findByText('Step 4: Statutory Citizen Declaration')).toBeInTheDocument()

    // Verify scoped container class exists
    const declarationCard = document.querySelector('.statutory-declaration-card')
    expect(declarationCard).toBeInTheDocument()

    // Verify all key statutory texts exist within the declaration card
    expect(declarationCard.querySelector('.declaration-title')).toHaveTextContent('Statutory Citizen Declaration:')
    expect(declarationCard.querySelector('.declaration-service-name')).toHaveTextContent('INCOME CERTIFICATE')
    expect(declarationCard.querySelector('.declaration-warning')).toHaveTextContent('misrepresentation of facts may lead to statutory cancellation')

    // Checkbox is accessible and unchecked by default
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('authenticates citizen via CitizenAuthModal with email and password without modal disappearing', async () => {
    const client = (await import('../api/client')).default
    client.post.mockResolvedValueOnce({
      data: {
        access_token: 'fake-jwt-token-123',
        profile: {
          id: 'prof-test-123',
          citizen_name: 'Bhavy Garg',
          email: 'bhavygarg7636@gmail.com',
          phone_number: '+91 98765 43210',
        },
      },
    })

    renderComponent()

    // Click "Citizen Sign In / Register"
    const signInBtn = await screen.findByText(/Citizen Sign In \/ Register/i)
    fireEvent.click(signInBtn)

    // Modal should be visible
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    // Enter email and password
    const emailInput = screen.getByPlaceholderText('citizen@example.com')
    const passwordInput = screen.getByPlaceholderText('••••••••')
    fireEvent.change(emailInput, { target: { value: 'bhavygarg7636@gmail.com' } })
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } })

    // Click "Sign In with Email"
    const submitBtn = screen.getByRole('button', { name: /Sign In with Email/i })
    fireEvent.click(submitBtn)

    // Verify token was stored and authenticated banner appears
    await waitFor(() => {
      expect(localStorage.getItem('sevasetu_citizen_token')).toBe('fake-jwt-token-123')
    })
    expect(await screen.findByText(/Authenticated Citizen:/i)).toBeInTheDocument()
  })
})
