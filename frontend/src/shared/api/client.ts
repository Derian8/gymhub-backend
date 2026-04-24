import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { classifyBackendIssue } from './backendStatus'
import { useBackendStatusStore } from '@/shared/store/backendStatusStore'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000)
const TOKEN_REFRESH_PATH = '/auth/token/refresh/'
const LOGIN_PATH = '/auth/login/'
const LOGOUT_PATH = '/auth/logout/'
const REGISTER_PATH = '/auth/register/'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT_MS,
  withCredentials: true, // Required for httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

// Request interceptor — attach CSRF if present
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const csrfToken = getCookie('csrftoken')
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken
    }
    return config
  },
  (error) => Promise.reject(error),
)

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

function processQueue(error: unknown) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

// Response interceptor — handle 401 and token refresh
apiClient.interceptors.response.use(
  (response) => {
    useBackendStatusStore.getState().clearIssue()
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const requestPath = originalRequest?.url ?? ''
    const shouldSkipRefresh =
      requestPath.includes(TOKEN_REFRESH_PATH)
      || requestPath.includes(LOGIN_PATH)
      || requestPath.includes(REGISTER_PATH)
      || requestPath.includes(LOGOUT_PATH)

    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkipRefresh) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await apiClient.post('/auth/token/refresh/')
        processQueue(null)
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        if ((refreshError as AxiosError).response?.status === 401) {
          useBackendStatusStore.getState().clearIssue()
          window.dispatchEvent(new CustomEvent('auth:logout'))
        } else {
          const issue = classifyBackendIssue(refreshError as AxiosError, BASE_URL)
          if (issue) {
            useBackendStatusStore.getState().setIssue(issue)
          }
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    const issue = classifyBackendIssue(error, BASE_URL)
    if (issue) {
      useBackendStatusStore.getState().setIssue(issue)
    } else if (error.response) {
      useBackendStatusStore.getState().clearIssue()
    }

    if (!error.response) {
      toast.error('No se pudo conectar con el servidor. Verifica backend y red.')
      return Promise.reject(error)
    }

    if (
      error.response?.status === 403
      && !requestPath.includes(LOGIN_PATH)
      && !requestPath.includes(TOKEN_REFRESH_PATH)
    ) {
      toast.error('No tienes permisos para realizar esta acción')
    }

    if (error.response?.status === 500) {
      toast.error('Error interno del servidor. Intenta de nuevo.')
    }

    return Promise.reject(error)
  },
)

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? match[2] : null
}

export default apiClient
