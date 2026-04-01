import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/authStore'
import { authApi } from '@/modules/auth/api/authApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'

export function useAuth() {
  const { user, isAuthenticated, authResolved, setUser, setAuthResolved, logout } = useAuthStore()

  const { data, isLoading, isError, isFetched } = useQuery({
    queryKey: QUERY_KEYS.ME,
    queryFn: authApi.me,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (data) {
      setUser(data)
      setAuthResolved(true)
    }
  }, [data, setUser, setAuthResolved])

  useEffect(() => {
    if (isError) {
      logout()
      setAuthResolved(true)
    }
  }, [isError, logout, setAuthResolved])

  useEffect(() => {
    if (isFetched && !data && !isError) {
      setAuthResolved(true)
    }
  }, [data, isError, isFetched, setAuthResolved])

  // Listen for forced logout from interceptor
  useEffect(() => {
    const handler = () => {
      logout()
      setAuthResolved(true)
    }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [logout, setAuthResolved])

  const currentUser = user || data || null

  return {
    user: currentUser,
    isAuthenticated: !!currentUser || isAuthenticated,
    isLoading: isLoading || !authResolved,
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
