import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { alertsApi } from '../api/alertsApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'

export function useAlertsQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.ALERTS_LIST(params),
    queryFn: () => alertsApi.list(params),
  })
}

export function useResolveAlertMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => alertsApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ALERTS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
      toast.success('Alerta resuelta correctamente')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useNotificationsQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS_LIST(params),
    queryFn: () => alertsApi.notifications(params),
    refetchInterval: 30_000,
  })
}

export function useMarkAllReadMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: alertsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] })
    },
  })
}

export function useMarkReadMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => alertsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] })
    },
  })
}
