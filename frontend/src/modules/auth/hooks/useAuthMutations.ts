import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { authApi } from '../api/authApi'
import { useAuthStore } from '@/shared/store/authStore'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'

export function useLoginMutation() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const setAuthResolved = useAuthStore((s) => s.setAuthResolved)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setUser(data.user)
      setAuthResolved(true)
      queryClient.setQueryData(QUERY_KEYS.ME, data.user)
      toast.success('¡Bienvenido de vuelta!')
      const role = data.user.role
      if (role === 'trainer' || data.user.is_staff) {
        navigate('/dashboard/trainer')
      } else {
        navigate('/today')
      }
    },
    onError: (error) => {
      toast.error(extractApiError(error))
    },
  })
}

export function useRegisterMutation() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const setAuthResolved = useAuthStore((s) => s.setAuthResolved)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setUser(data.user)
      setAuthResolved(true)
      queryClient.setQueryData(QUERY_KEYS.ME, data.user)
      toast.success('Cuenta creada correctamente')
      if (data.user.role === 'trainer' || data.user.is_staff) {
        navigate('/dashboard/trainer')
      } else {
        navigate('/today')
      }
    },
    onError: (error) => {
      toast.error(extractApiError(error))
    },
  })
}

export function useUpdateMeMutation() {
  const setUser = useAuthStore((s) => s.setUser)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (user) => {
      setUser(user)
      queryClient.setQueryData(QUERY_KEYS.ME, user)
      toast.success('Perfil actualizado correctamente')
    },
    onError: (error) => {
      toast.error(extractApiError(error))
    },
  })
}

export function useLogoutMutation() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const setAuthResolved = useAuthStore((s) => s.setAuthResolved)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      logout()
      setAuthResolved(true)
      queryClient.clear()
      navigate('/login', { replace: true })
      toast.success('Sesión cerrada correctamente')
    },
    onError: () => {
      logout()
      setAuthResolved(true)
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })
}

export function useMeQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.ME,
    queryFn: authApi.me,
    retry: false,
  })
}
