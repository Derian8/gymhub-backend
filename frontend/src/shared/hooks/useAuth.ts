import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/authStore'
import { authApi } from '@/modules/auth/api/authApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'

export function useAuth() {
  const { user, isAuthenticated, setUser, logout } = useAuthStore()

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.ME,
    queryFn: authApi.me,
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (data) setUser(data)
  }, [data, setUser])

  useEffect(() => {
    if (isError) logout()
  }, [isError, logout])

  // Listen for forced logout from interceptor
  useEffect(() => {
    const handler = () => logout()
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [logout])

  return {
    user: user || data || null,
    isAuthenticated,
    isLoading,
    isTrainer: (user?.role === 'trainer') || user?.is_staff,
    isMember: user?.role === 'member',
    isStaff: user?.is_staff,
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
