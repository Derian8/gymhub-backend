import apiClient from '@/shared/api/client'
import type { MemberMembership, MemberSubscription, MembershipPlan, PaymentRecord, PaymentSchedule, PaymentMethod, PaginatedResponse } from '@/shared/types'

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

  markPaymentAsPaid: async (
    id: number,
    payload: Pick<PaymentRecord, 'payment_reference' | 'notes'>,
  ): Promise<PaymentRecord> => {
    const { data } = await apiClient.post(`/api/payment-records/${id}/mark-paid/`, payload)
    return data
  },

  memberSubscriptions: async (params?: Record<string, string>): Promise<PaginatedResponse<MemberSubscription>> => {
    const { data } = await apiClient.get('/api/member-subscriptions/', { params })
    return data
  },

  createMemberSubscription: async (payload: Partial<MemberSubscription>): Promise<MemberSubscription> => {
    const { data } = await apiClient.post('/api/member-subscriptions/', payload)
    return data
  },

  updateMemberSubscription: async (id: number, payload: Partial<MemberSubscription>): Promise<MemberSubscription> => {
    const { data } = await apiClient.patch(`/api/member-subscriptions/${id}/`, payload)
    return data
  },

  memberMemberships: async (params?: Record<string, string>): Promise<PaginatedResponse<MemberMembership>> => {
    const { data } = await apiClient.get('/api/member-memberships/', { params })
    return data
  },

  createMemberMembership: async (payload: Partial<MemberMembership>): Promise<MemberMembership> => {
    const { data } = await apiClient.post('/api/member-memberships/', payload)
    return data
  },

  renewMemberMembership: async (id: number): Promise<MemberMembership> => {
    const { data } = await apiClient.post(`/api/member-memberships/${id}/renew/`)
    return data
  },

  suspendMemberMembership: async (id: number, reason = ''): Promise<MemberMembership> => {
    const { data } = await apiClient.post(`/api/member-memberships/${id}/suspend/`, { reason })
    return data
  },

  cancelMemberMembership: async (id: number, reason = ''): Promise<MemberMembership> => {
    const { data } = await apiClient.post(`/api/member-memberships/${id}/cancel/`, { reason })
    return data
  },
}
