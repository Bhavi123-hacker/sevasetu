import axios from 'axios'

// Vite exposes env vars prefixed VITE_ to the browser bundle.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const client = axios.create({ baseURL: API_BASE_URL, timeout: 15000 })

// Every request automatically gets the staff token if one's stored —
// citizen-facing calls just won't have one set, which is fine, those
// routes don't require it.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('sevasetu_staff_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default client
