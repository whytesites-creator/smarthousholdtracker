import axios from 'axios'
import { supabase } from './supabase'

const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
  : '/api/v1'

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // 30 s — prevents silent hangs on slow Worker cold-starts
})

apiClient.interceptors.request.use(async (config) => {
  // Always fetch the freshest session (auto-refreshed by Supabase)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    // Only force-sign-out on an explicit 401 from our API.
    // Do NOT sign out on timeout (ECONNABORTED) or network errors.
    if (error.response?.status === 401) {
      supabase.auth.signOut()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)