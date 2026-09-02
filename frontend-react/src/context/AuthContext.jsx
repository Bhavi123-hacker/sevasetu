import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

function isTokenExpired(token) {
  if (!token) return true
  const payload = parseJwt(token)
  if (!payload || !payload.exp) return true
  return Date.now() >= payload.exp * 1000
}

export function AuthProvider({ children }) {
  // Authoritative single session state
  const [activeRole, setActiveRole] = useState(() => {
    const staffTok = localStorage.getItem('sevasetu_staff_token')
    if (staffTok && !isTokenExpired(staffTok)) return 'staff'
    const citizenTok = localStorage.getItem('sevasetu_citizen_token')
    if (citizenTok && !isTokenExpired(citizenTok)) return 'citizen'
    return null
  })

  const [staffUser, setStaffUser] = useState(() => {
    const staffTok = localStorage.getItem('sevasetu_staff_token')
    if (!staffTok || isTokenExpired(staffTok)) {
      localStorage.removeItem('sevasetu_staff_token')
      localStorage.removeItem('sevasetu_staff_user')
      return null
    }
    const stored = localStorage.getItem('sevasetu_staff_user')
    return stored ? JSON.parse(stored) : null
  })

  const [citizenUser, setCitizenUser] = useState(() => {
    const citizenTok = localStorage.getItem('sevasetu_citizen_token')
    if (!citizenTok || isTokenExpired(citizenTok)) {
      localStorage.removeItem('sevasetu_citizen_token')
      localStorage.removeItem('sevasetu_citizen_user')
      return null
    }
    const stored = localStorage.getItem('sevasetu_citizen_user')
    return stored ? JSON.parse(stored) : null
  })

  // Validate citizen token on boot
  useEffect(() => {
    const citizenTok = localStorage.getItem('sevasetu_citizen_token')
    if (citizenTok) {
      if (isTokenExpired(citizenTok)) {
        logoutCitizen()
        return
      }
      client.get('/api/auth/citizen/me')
        .then((res) => {
          if (res.data) {
            setCitizenUser(res.data)
            setActiveRole('citizen')
            localStorage.setItem('sevasetu_citizen_user', JSON.stringify(res.data))
          }
        })
        .catch((err) => {
          if (err.response?.status === 401) {
            logoutCitizen()
          }
        })
    }
  }, [])

  // Staff Login
  const login = useCallback(async (username, password) => {
    localStorage.removeItem('sevasetu_citizen_token')
    localStorage.removeItem('sevasetu_citizen_user')
    setCitizenUser(null)

    const response = await client.post('/api/auth/login', { username, password })
    const { access_token, name, display_name, role, username: resUser } = response.data
    localStorage.setItem('sevasetu_staff_token', access_token)
    localStorage.setItem('sevasetu_active_role', 'staff')
    const user = { name: name || display_name || resUser, role, username: resUser }
    localStorage.setItem('sevasetu_staff_user', JSON.stringify(user))
    setStaffUser(user)
    setActiveRole('staff')
    return user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sevasetu_staff_token')
    localStorage.removeItem('sevasetu_staff_user')
    localStorage.removeItem('sevasetu_active_role')
    setStaffUser(null)
    setActiveRole(null)
  }, [])

  // Citizen Firebase Email Login / Registration
  const loginCitizenWithFirebaseEmail = useCallback(async (firebaseIdToken, email = null, citizenName = null) => {
    localStorage.removeItem('sevasetu_staff_token')
    localStorage.removeItem('sevasetu_staff_user')
    setStaffUser(null)

    const response = await client.post('/api/auth/firebase-email', {
      id_token: firebaseIdToken,
      email: email,
      citizen_name: citizenName,
    })
    const { access_token, profile } = response.data
    localStorage.setItem('sevasetu_citizen_token', access_token)
    localStorage.setItem('sevasetu_active_role', 'citizen')
    localStorage.setItem('sevasetu_citizen_user', JSON.stringify(profile))
    setCitizenUser(profile)
    setActiveRole('citizen')
    return profile
  }, [])

  const loginCitizenWithPassword = useCallback(async (identifier, password) => {
    localStorage.removeItem('sevasetu_staff_token')
    localStorage.removeItem('sevasetu_staff_user')
    setStaffUser(null)

    const response = await client.post('/api/auth/citizen/login', {
      phone_number: identifier,
      email: identifier.includes('@') ? identifier : undefined,
      password: password,
    })
    const { access_token, profile } = response.data
    localStorage.setItem('sevasetu_citizen_token', access_token)
    localStorage.setItem('sevasetu_active_role', 'citizen')
    localStorage.setItem('sevasetu_citizen_user', JSON.stringify(profile))
    setCitizenUser(profile)
    setActiveRole('citizen')
    return profile
  }, [])

  const registerCitizen = useCallback(async (data) => {
    localStorage.removeItem('sevasetu_staff_token')
    localStorage.removeItem('sevasetu_staff_user')
    setStaffUser(null)

    const response = await client.post('/api/auth/citizen/register', data)
    const { access_token, profile } = response.data
    localStorage.setItem('sevasetu_citizen_token', access_token)
    localStorage.setItem('sevasetu_active_role', 'citizen')
    localStorage.setItem('sevasetu_citizen_user', JSON.stringify(profile))
    setCitizenUser(profile)
    setActiveRole('citizen')
    return profile
  }, [])

  const logoutCitizen = useCallback(async () => {
    try {
      const { signOutFirebase } = await import('../firebase')
      await signOutFirebase()
    } catch {}
    localStorage.removeItem('sevasetu_citizen_token')
    localStorage.removeItem('sevasetu_citizen_user')
    localStorage.removeItem('sevasetu_active_role')
    setCitizenUser(null)
    setActiveRole(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        activeRole,
        staffUser,
        login,
        logout,
        citizenUser,
        setCitizenUser,
        loginCitizenWithFirebaseEmail,
        loginCitizenWithPassword,
        registerCitizen,
        logoutCitizen,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    return {
      activeRole: null,
      staffUser: null,
      citizenUser: null,
      setCitizenUser: () => {},
      login: async () => {},
      logout: () => {},
      loginCitizenWithFirebaseEmail: async () => {},
      loginCitizenWithPassword: async () => {},
      registerCitizen: async () => {},
      logoutCitizen: () => {},
    }
  }
  return context
}
