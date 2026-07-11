import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { membersApi } from '../api/membersApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'
import { progressApi } from '@/modules/progress/api/progressApi'

interface MembersParams {
  search?: string
  payment_status?: string
  inactivity?: string
  risk_level?: string
  prescription_status?: string
  ordering?: string
  page?: number
}

export function useMembersQuery(params?: MembersParams, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBERS_LIST(params as Record<string, string>),
    queryFn: () => membersApi.list(params),
    enabled,
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
    mutationFn: ({ id }: { id: number }) => membersApi.activate(id),
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

export function useMemberPhysicalSummaryQuery(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBER_PHYSICAL_SUMMARY(id),
    queryFn: () => progressApi.memberSummary(id),
    enabled: !!id,
  })
}

export function useMemberPrescriptionQuery(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBER_PRESCRIPTION(id),
    queryFn: () => membersApi.prescriptionSummary(id),
    enabled: !!id,
  })
}

export function useMemberActivePrescriptionQuery(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(id),
    queryFn: () => membersApi.activePrescription(id),
    enabled: !!id,
  })
}

export function useAssignTrainerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => membersApi.assignTrainer(id),
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DETAIL(member.id) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
      toast.success('Cliente asignado correctamente')
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
