import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { membersApi } from '../api/membersApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'

interface MembersParams {
  search?: string
  payment_status?: string
  inactivity?: string
  page?: number
}

export function useMembersQuery(params?: MembersParams) {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBERS_LIST(params as Record<string, string>),
    queryFn: () => membersApi.list(params),
  })
}

export function useMemberDetailQuery(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBER_DETAIL(id),
    queryFn: () => membersApi.detail(id),
    enabled: !!id,
  })
}

export function useMemberDashboardQuery(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBER_DASHBOARD(id),
    queryFn: () => membersApi.dashboardSummary(id),
    enabled: !!id,
  })
}

export function useTrainerOverviewQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.TRAINER_OVERVIEW,
    queryFn: membersApi.trainerOverview,
    refetchInterval: 60_000,
  })
}

export function useActivateMemberMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, membershipPlanId }: { id: number; membershipPlanId?: number }) =>
      membersApi.activate(id, membershipPlanId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DETAIL(data.member.id) })
      toast.success('Miembro activado correctamente')
    },
    onError: (error) => {
      toast.error(extractApiError(error))
    },
  })
}

export function useProgressByExerciseQuery(memberId: number, exerciseId: number) {
  return useQuery({
    queryKey: QUERY_KEYS.PROGRESS_BY_EXERCISE(memberId, exerciseId),
    queryFn: () => membersApi.progressByExercise(memberId, exerciseId),
    enabled: !!memberId && !!exerciseId,
  })
}
