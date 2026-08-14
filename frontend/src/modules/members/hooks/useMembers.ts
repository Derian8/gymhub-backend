import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { membersApi } from '../api/membersApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'
import { progressApi } from '@/modules/progress/api/progressApi'

interface MembersParams {
  assignment?: 'mine' | 'unassigned' | 'available'
  search?: string
  payment_status?: string
  commercial_status?: string
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

export function useCreateMemberMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: membersApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS }),
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useRegisterClientWithPaymentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: membersApi.registerWithPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERSHIP_PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENT_RECORDS_ALL })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
      toast.success('Cliente registrado, pago confirmado y acceso activado')
    },
    onError: (error) => toast.error(extractApiError(error)),
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

export function useTrainersQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.TRAINERS,
    queryFn: membersApi.trainers,
    enabled,
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

export function useMemberActivePrescriptionQuery(id: number, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(id),
    queryFn: () => membersApi.activePrescription(id),
    enabled: !!id && enabled,
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
