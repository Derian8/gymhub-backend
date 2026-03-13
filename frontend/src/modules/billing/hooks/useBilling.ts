import { useQuery } from '@tanstack/react-query'
import { billingApi } from '../api/billingApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'

export function useMembershipPlansQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.MEMBERSHIP_PLANS,
    queryFn: billingApi.membershipPlans,
  })
}

export function usePaymentRecordsQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.PAYMENT_RECORDS,
    queryFn: () => billingApi.paymentRecords(params),
  })
}

export function usePaymentSchedulesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.PAYMENT_SCHEDULES,
    queryFn: billingApi.paymentSchedules,
  })
}
