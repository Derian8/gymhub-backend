import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { alertsApi } from '../api/alertsApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'
import type { AlertContactPayload } from '../api/alertsApi'

export function useAlertsQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.ALERTS_LIST(params),
    queryFn: () => alertsApi.list(params),
  })
}

export function useAlertsSummaryQuery() {
  return useQuery({
    queryKey: [...QUERY_KEYS.ALERTS, 'summary'],
    queryFn: alertsApi.summary,
  })
}

export function useMembersWithoutAlertsQuery(enabled: boolean) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ALERTS, 'members-without-alerts'],
    queryFn: alertsApi.membersWithoutAlerts,
    enabled,
  })
}

function invalidateAlerts(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ALERTS })
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
}

export function useStartFollowUpMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => alertsApi.startFollowUp(id),
    onSuccess: () => {
      invalidateAlerts(queryClient)
      toast.success('Alerta marcada en seguimiento')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useResolveAlertMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => alertsApi.resolve(id),
    onSuccess: () => {
      invalidateAlerts(queryClient)
      toast.success('Alerta resuelta correctamente')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useDismissAlertMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: alertsApi.dismiss,
    onSuccess: () => {
      invalidateAlerts(queryClient)
      toast.success('Alerta descartada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useReopenAlertMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => alertsApi.reopen(id),
    onSuccess: () => {
      invalidateAlerts(queryClient)
      toast.success('Alerta reabierta')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCreateAlertContactMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AlertContactPayload }) => alertsApi.createContact({ id, payload }),
    onSuccess: () => {
      invalidateAlerts(queryClient)
      toast.success('Contacto registrado')
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
