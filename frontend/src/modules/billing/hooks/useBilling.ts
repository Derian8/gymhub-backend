import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { billingApi } from '../api/billingApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'

function invalidateMembershipViews(queryClient: ReturnType<typeof useQueryClient>, memberId?: number) {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_SUBSCRIPTIONS_ALL })
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_MEMBERSHIPS_ALL })
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENT_SCHEDULES_ALL })
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENT_RECORDS_ALL })
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
  if (memberId) {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DETAIL(memberId) })
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DASHBOARD(memberId) })
  }
}

export function usePaymentRecordsQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.PAYMENT_RECORDS(params),
    queryFn: () => billingApi.paymentRecords(params),
  })
}

export function useMembershipPlansQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBERSHIP_PLANS,
    queryFn: billingApi.membershipPlans,
  })
}

export function usePaymentSchedulesQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.PAYMENT_SCHEDULES(params),
    queryFn: () => billingApi.paymentSchedules(params),
  })
}

export function useMemberSubscriptionsQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBER_SUBSCRIPTIONS(params),
    queryFn: () => billingApi.memberSubscriptions(params),
  })
}

export function useMemberMembershipsQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBER_MEMBERSHIPS(params),
    queryFn: () => billingApi.memberMemberships(params),
  })
}

export function useCreateMemberSubscriptionMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: billingApi.createMemberSubscription,
    onSuccess: () => {
      invalidateMembershipViews(queryClient, memberId)
      toast.success('Suscripción y primer cobro creados')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCreateMemberMembershipMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: billingApi.createMemberMembership,
    onSuccess: () => {
      invalidateMembershipViews(queryClient, memberId)
      toast.success('Membresía asignada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useRenewMemberMembershipMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: billingApi.renewMemberMembership,
    onSuccess: () => {
      invalidateMembershipViews(queryClient, memberId)
      toast.success('Membresía renovada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useSuspendMemberMembershipMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => billingApi.suspendMemberMembership(id, reason),
    onSuccess: () => {
      invalidateMembershipViews(queryClient, memberId)
      toast.success('Membresía suspendida')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCancelMemberMembershipMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => billingApi.cancelMemberMembership(id, reason),
    onSuccess: () => {
      invalidateMembershipViews(queryClient, memberId)
      toast.success('Membresía cancelada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useUpdateMemberSubscriptionMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => billingApi.updateMemberSubscription(id, payload),
    onSuccess: () => {
      invalidateMembershipViews(queryClient, memberId)
      toast.success('Suscripción actualizada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useMarkPaymentAsPaidMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { payment_reference: string; notes: string } }) =>
      billingApi.markPaymentAsPaid(id, payload),
    onSuccess: () => {
      invalidateMembershipViews(queryClient, memberId)
      toast.success('Pago registrado y recibo emitido')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}
