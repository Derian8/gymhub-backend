import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { adminApi, type ReportFilters } from '../api/adminApi'

export function useAdminReport(filters: ReportFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.ADMIN_REPORT(filters as unknown as Record<string, string>),
    queryFn: () => adminApi.report(filters),
    refetchInterval: 60_000,
  })
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: QUERY_KEYS.ADMIN_DASHBOARD,
    queryFn: adminApi.dashboard,
    refetchInterval: 60_000,
  })
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminApi.users,
  })
}

export function useEnableClientProfileMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ trainerId, payload }: {
      trainerId: number
      payload: Parameters<typeof adminApi.enableClientProfile>[1]
    }) => adminApi.enableClientProfile(trainerId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success('Perfil de cliente habilitado')
    },
    onError: () => toast.error('No se pudo habilitar el perfil de cliente'),
  })
}

export function useCollectionFollowUpMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminApi.saveCollectionFollowUp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'report'] })
      toast.success('Seguimiento de cobro actualizado')
    },
    onError: () => toast.error('No se pudo actualizar el seguimiento'),
  })
}
