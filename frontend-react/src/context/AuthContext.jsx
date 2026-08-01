import { createContext, useContext, useState } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [staffUser, setStaffUser] = useState(() => {
    const stored = localStorage.getItem('sevasetu_staff_user')
    return stored ? JSON.parse(stored) : null
  })

  async function login(name, role, password) {
    const response = await client.post('/api/auth/login', { name, role, password })
    const { access_token, name: confirmedName, role: confirmedRole } = response.data
    localStorage.setItem('sevasetu_staff_token', access_token)
    const user = { name: confirmedName, role: confirmedRole }
    localStorage.setItem('sevasetu_staff_user', JSON.stringify(user))
    setStaffUser(user)
    return user
  }

  function logout() {
    localStorage.removeItem('sevasetu_staff_token')
    localStorage.removeItem('sevasetu_staff_user')
    setStaffUser(null)
  }

  return (
    <AuthContext.Provider value={{ staffUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
