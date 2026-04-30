import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/authStore'
import { authApi } from '@/modules/auth/api/authApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { useBackendStatusStore } from '@/shared/store/backendStatusStore'
import { diagnoseBackendIssue } from '@/shared/api/backendStatus'
import { BASE_URL } from '@/shared/api/client'
import type { AxiosError } from 'axios'

export function useAuth(enabled = true) {
  const { user, isAuthenticated, authResolved, setUser, setAuthResolved, logout } = useAuthStore()
  const setBackendIssue = useBackendStatusStore((s) => s.setIssue)
  const clearBackendIssue = useBackendStatusStore((s) => s.clearIssue)

  const { data, isLoading, isError, isFetched, error } = useQuery({
    queryKey: QUERY_KEYS.ME,
    queryFn: authApi.me,
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (data) {
      clearBackendIssue()
      setUser(data)
      setAuthResolved(true)
    }
  }, [clearBackendIssue, data, setUser, setAuthResolved])

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (!isError) {
      return
    }

    const authError = error as AxiosError | null

    void (async () => {
      const issue = authError ? await diagnoseBackendIssue(authError, BASE_URL) : null

      if (issue) {
        setBackendIssue(issue)
        setAuthResolved(true)
        return
      }

      if (authError?.response?.status === 401) {
        clearBackendIssue()
        logout()
        setAuthResolved(true)
        return
      }

      setAuthResolved(true)
    })()
  }, [clearBackendIssue, enabled, error, isError, logout, setAuthResolved, setBackendIssue])

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (isFetched && !data && !isError) {
      setAuthResolved(true)
    }
  }, [data, enabled, isError, isFetched, setAuthResolved])

  // Listen for forced logout from interceptor
  useEffect(() => {
    const handler = () => {
      logout()
      setAuthResolved(true)
      clearBackendIssue()
    }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [clearBackendIssue, logout, setAuthResolved])

  const currentUser = user || data || null

  return {
    user: currentUser,
    isAuthenticated: !!currentUser || isAuthenticated,
    isLoading: (enabled && isLoading) || !authResolved,
    authResolved,
    isTrainer: currentUser?.role === 'trainer' || !!currentUser?.is_staff,
    isMember: currentUser?.role === 'member',
    isStaff: !!currentUser?.is_staff,
  }
}

export function useRequireAuth(redirectTo = '/login') {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(redirectTo, { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo])

  return { isAuthenticated, isLoading }
}
