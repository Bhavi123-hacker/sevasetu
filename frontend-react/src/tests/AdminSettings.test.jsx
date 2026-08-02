import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminSettings from '../pages/AdminSettings'
import { AuthProvider } from '../context/AuthContext'
import client from '../api/client'

vi.mock('../api/client')

describe('AdminSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('blocks an Officer from this page even though they are logged in', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({ data: { access_token: 'tok', name: 'Suresh', role: 'Officer' } })

    render(<AuthProvider><AdminSettings /></AuthProvider>)
    await user.type(screen.getByLabelText('Your name'), 'Suresh')
    await user.type(screen.getByLabelText('Password'), 'seva123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/this page is for administrators/i)).toBeInTheDocument()
    expect(screen.queryByText('Income Certificate')).not.toBeInTheDocument()
  })

  it('lets an Administrator load, edit, and save the checklist', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({ data: { access_token: 'tok', name: 'Priya', role: 'Administrator' } })
    client.get.mockResolvedValueOnce({
      data: { income_certificate: ['aadhaar', 'ration_card', 'electricity_bill', 'residence_proof'] },
    })

    render(<AuthProvider><AdminSettings /></AuthProvider>)
    await user.type(screen.getByLabelText('Your name'), 'Priya')
    await user.click(screen.getByText('Administrator'))
    await user.type(screen.getByLabelText('Password'), 'seva123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Income Certificate')).toBeInTheDocument()
    const incomeCard = screen.getByText('Income Certificate').closest('.card')
    const electricityCheckbox = within(incomeCard).getByLabelText('electricity bill')
    expect(electricityCheckbox).toBeChecked()

    client.put.mockResolvedValueOnce({ data: {} })
    await user.click(electricityCheckbox) // uncheck it
    await user.click(within(incomeCard).getByRole('button', { name: /save income certificate/i }))

    expect(client.put).toHaveBeenCalledWith('/api/service-requirements/income_certificate', {
      document_types: ['aadhaar', 'ration_card', 'residence_proof'],
    })
    expect(await within(incomeCard).findByText('Saved.')).toBeInTheDocument()
  })
})
