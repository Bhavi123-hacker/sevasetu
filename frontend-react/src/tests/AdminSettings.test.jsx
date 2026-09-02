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
    await user.type(screen.getByLabelText('Username'), 'officer1')
    await user.type(screen.getByLabelText('Password'), 'officer-demo-pass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/this page is for administrators/i)).toBeInTheDocument()
    expect(screen.queryByText('Income Certificate')).not.toBeInTheDocument()
  })

  it('lets an Administrator load, edit, and save the checklist', async () => {
    const user = userEvent.setup()
    client.post.mockResolvedValueOnce({ data: { access_token: 'tok', name: 'Priya', role: 'Administrator' } })
    client.get.mockImplementation((url) => {
      if (url === '/api/admin/services') {
        return Promise.resolve({
          data: [
            {
              id: 'income_certificate',
              name: 'Income Certificate',
              is_active: true,
              required_documents: [{ key: 'aadhaar' }, { key: 'ration_card' }, { key: 'electricity_bill' }, { key: 'residence_proof' }],
            },
          ],
        })
      }
      return Promise.resolve({
        data: { income_certificate: ['aadhaar', 'ration_card', 'electricity_bill', 'residence_proof'] },
      })
    })

    render(<AuthProvider><AdminSettings /></AuthProvider>)
    await user.type(screen.getByLabelText('Username'), 'admin1')
    await user.type(screen.getByLabelText('Password'), 'admin-demo-pass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Income Certificate')).toBeInTheDocument()
    const incomeCard = screen.getByText('Income Certificate').closest('.card')
    const electricityCheckbox = within(incomeCard).getByLabelText(/Electricity Bill/i)
    expect(electricityCheckbox).toBeChecked()

    client.put.mockResolvedValueOnce({ data: {} })
    await user.click(electricityCheckbox) // uncheck it
    await user.click(within(incomeCard).getByRole('button', { name: /save requirements for income certificate/i }))

    expect(client.put).toHaveBeenCalledWith('/api/service-requirements/income_certificate', {
      document_types: ['aadhaar', 'ration_card', 'residence_proof'],
    })
    expect(await within(incomeCard).findByText(/saved successfully/i)).toBeInTheDocument()
  })
})
