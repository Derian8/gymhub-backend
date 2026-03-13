import apiClient from '@/shared/api/client'
import type { MembershipPlan, PaymentRecord, PaymentSchedule, PaymentMethod, PaginatedResponse } from '@/shared/types'

export const billingApi = {
  membershipPlans: async (): Promise<PaginatedResponse<MembershipPlan>> => {
    const { data } = await apiClient.get('/api/membership-plans/')
    return data
  },

  paymentSchedules: async (params?: Record<string, string>): Promise<PaginatedResponse<PaymentSchedule>> => {
    const { data } = await apiClient.get('/api/payment-schedules/', { params })
    return data
  },

  paymentRecords: async (params?: Record<string, string>): Promise<PaginatedResponse<PaymentRecord>> => {
    const { data } = await apiClient.get('/api/payment-records/', { params })
    return data
  },

  paymentMethods: async (): Promise<PaginatedResponse<PaymentMethod>> => {
    const { data } = await apiClient.get('/api/payment-methods/')
    return data
  },

  updatePaymentRecord: async (id: number, payload: Partial<PaymentRecord>): Promise<PaymentRecord> => {
    const { data } = await apiClient.patch(`/api/payment-records/${id}/`, payload)
    return data
  },
}
