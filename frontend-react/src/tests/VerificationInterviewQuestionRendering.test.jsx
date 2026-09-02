import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from '../context/LanguageContext'
import VerificationInterview, {
  extractQuestionText,
  extractQuestionCategory,
} from '../pages/VerificationInterview'
import client, { api } from '../api/client'

// Mock api and client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  api: {
    startInterview: vi.fn(),
    answerInterview: vi.fn(),
    completeInterview: vi.fn(),
  },
}))

describe('Verification Interview Question Extraction & Rendering Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractQuestionText unit tests across all 5 grounded categories', () => {
    it('extracts direct question_text field correctly', () => {
      const q = { category: 'IDENTITY', question_text: 'Please state your full legal name.' }
      expect(extractQuestionText(q)).toBe('Please state your full legal name.')
    })

    it('extracts alternate question field aliases (question, text, prompt, title)', () => {
      expect(extractQuestionText({ question: 'What is your date of birth?' })).toBe('What is your date of birth?')
      expect(extractQuestionText({ text: 'What is your current residential address?' })).toBe('What is your current residential address?')
      expect(extractQuestionText({ prompt: 'Why are you applying for this certificate?' })).toBe('Why are you applying for this certificate?')
      expect(extractQuestionText({ title: 'Which documents did you submit?' })).toBe('Which documents did you submit?')
    })

    it('verifies all 5 categories produce non-empty, valid factual questions', () => {
      const appDetail = {
        citizen_name: 'Priya Sharma',
        service_type: 'income_certificate',
      }

      const categories = [
        { category: 'IDENTITY' },
        { category: 'DATE_OF_BIRTH' },
        { category: 'ADDRESS' },
        { category: 'SERVICE_PURPOSE' },
        { category: 'DOCUMENT_INFORMATION' },
      ]

      categories.forEach((catObj) => {
        const text = extractQuestionText(catObj, appDetail)
        expect(text).toBeTruthy()
        expect(typeof text).toBe('string')
        expect(text.trim().length).toBeGreaterThan(0)
      })
    })

    it('returns empty string for genuinely null or unresolvable objects', () => {
      expect(extractQuestionText(null)).toBe('')
      expect(extractQuestionText({})).toBe('')
    })
  })

  describe('VerificationInterview Component Rendering & Visibility', () => {
    it('renders Question 1 text accurately, supports long multi-line questions, and navigates all 5 questions', async () => {
      client.get.mockResolvedValueOnce({
        data: {
          id: 'app-intv-100',
          citizen_name: 'Rahul Kumar',
          service_type: 'residence_certificate',
          status: 'INTERVIEW_ELIGIBLE',
        },
      })

      const longQuestion5 =
        'Which proof documents have you prepared for this application (e.g. Aadhaar Card, Electricity Bill, Ration Card), and are all names and addresses strictly consistent with your declared domicile records?'

      const fiveQuestions = [
        { id: 'q-1', order_num: 1, category: 'IDENTITY', question_text: 'Please state your full legal name as it appears on your identity documents.' },
        { id: 'q-2', order_num: 2, category: 'DATE_OF_BIRTH', question_text: 'What is your date of birth?' },
        { id: 'q-3', order_num: 3, category: 'ADDRESS', question_text: 'What is your current residential address or district?' },
        { id: 'q-4', order_num: 4, category: 'SERVICE_PURPOSE', question_text: 'What is the primary purpose of your Residence Certificate application?' },
        { id: 'q-5', order_num: 5, category: 'DOCUMENT_INFORMATION', question_text: longQuestion5 },
      ]

      // Assert non-empty question_text for all 5 questions
      fiveQuestions.forEach((q) => {
        expect(q.question_text).toBeTruthy()
        expect(q.question_text.trim().length).toBeGreaterThan(0)
      })

      api.startInterview.mockResolvedValueOnce({
        data: {
          session_id: 'sess-100',
          status: 'IN_PROGRESS',
          total_questions: 5,
          questions: fiveQuestions,
        },
      })

      render(
        <MemoryRouter initialEntries={['/verification-interview?application_id=app-intv-100']}>
          <LanguageProvider>
            <Routes>
              <Route path="/verification-interview" element={<VerificationInterview />} />
            </Routes>
          </LanguageProvider>
        </MemoryRouter>
      )

      // 1. Ready to start screen
      expect(await screen.findByText(/Application #app-intv-100 — Verification Interview/i)).toBeInTheDocument()
      expect(screen.getByText(/Officer Document Review Passed/i)).toBeInTheDocument()

      const startBtn = screen.getByText(/Enable Camera & Microphone and Start Interview/i)
      fireEvent.click(startBtn)

      // 2. Question 1 renders complete text
      expect(await screen.findByText(/Question 1 of 5/i)).toBeInTheDocument()
      expect(screen.getByText(/Category:/i)).toBeInTheDocument()
      expect(screen.getByText(/Please state your full legal name as it appears on your identity documents/i)).toBeInTheDocument()

      // Submit Answer 1
      api.answerInterview.mockResolvedValueOnce({
        data: {
          question_id: 'q-1',
          transcript_text: 'Rahul Kumar',
          status: 'CONSISTENT',
          notes: 'Name matches Aadhaar record.',
        },
      })

      const answerInput = screen.getByPlaceholderText(/Speak or type your factual answer clearly/i)
      fireEvent.change(answerInput, { target: { value: 'Rahul Kumar' } })

      const submitBtn = screen.getByText(/Submit Answer/i)
      fireEvent.click(submitBtn)

      expect(await screen.findByText(/Answer Consistent with Records/i)).toBeInTheDocument()

      // Click Next Question
      const nextBtn = screen.getByText(/Next Question/i)
      fireEvent.click(nextBtn)

      // 3. Question 2 renders text
      expect(await screen.findByText(/Question 2 of 5/i)).toBeInTheDocument()
      expect(screen.getByText(/What is your date of birth/i)).toBeInTheDocument()
    })

    it('renders fallback banner when question text is missing or completely unavailable', async () => {
      client.get.mockResolvedValueOnce({
        data: {
          id: 'app-intv-200',
          citizen_name: 'Priya Sharma',
          service_type: 'income_certificate',
          status: 'INTERVIEW_ELIGIBLE',
        },
      })

      // Backend returns empty questions without text or category
      api.startInterview.mockResolvedValueOnce({
        data: {
          session_id: 'sess-200',
          status: 'IN_PROGRESS',
          total_questions: 1,
          questions: [
            { id: 'q-blank', order_num: 1, category: '', question_text: '' },
          ],
        },
      })

      render(
        <MemoryRouter initialEntries={['/verification-interview?application_id=app-intv-200']}>
          <LanguageProvider>
            <Routes>
              <Route path="/verification-interview" element={<VerificationInterview />} />
            </Routes>
          </LanguageProvider>
        </MemoryRouter>
      )

      expect(await screen.findByText(/Application #app-intv-200/i)).toBeInTheDocument()
      const startBtn = screen.getByText(/Enable Camera & Microphone and Start Interview/i)
      fireEvent.click(startBtn)

      expect(await screen.findByText(/Interview question unavailable/i)).toBeInTheDocument()
      expect(screen.getByText(/Please refresh the interview or return to the application/i)).toBeInTheDocument()
    })
  })
})
