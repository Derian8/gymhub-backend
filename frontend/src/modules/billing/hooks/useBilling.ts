import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { billingApi } from '../api/billingApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'

export function useMembershipPlansQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBERSHIP_PLANS,
    queryFn: billingApi.membershipPlans,
  })
}

export function usePaymentRecordsQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.PAYMENT_RECORDS(params),
    queryFn: () => billingApi.paymentRecords(params),
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

export function useCreateMembershipPlanMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: billingApi.createMembershipPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERSHIP_PLANS })
      toast.success('Plan configurable guardado')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useUpdateMembershipPlanMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => billingApi.updateMembershipPlan(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERSHIP_PLANS })
      toast.success('Plan configurable actualizado')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCreateMemberSubscriptionMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: billingApi.createMemberSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_SUBSCRIPTIONS(memberId ? { member: String(memberId) } : undefined) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENT_SCHEDULES(memberId ? { member: String(memberId) } : undefined) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENT_RECORDS(memberId ? { member: String(memberId) } : undefined) })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DETAIL(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DASHBOARD(memberId) })
      }
      toast.success('Suscripción y primer cobro creados')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useUpdateMemberSubscriptionMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => billingApi.updateMemberSubscription(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_SUBSCRIPTIONS(memberId ? { member: String(memberId) } : undefined) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENT_SCHEDULES(memberId ? { member: String(memberId) } : undefined) })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DETAIL(memberId) })
      }
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENT_RECORDS(memberId ? { member: String(memberId) } : undefined) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_SUBSCRIPTIONS(memberId ? { member: String(memberId) } : undefined) })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DETAIL(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DASHBOARD(memberId) })
      }
      toast.success('Pago registrado y recibo emitido')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}
