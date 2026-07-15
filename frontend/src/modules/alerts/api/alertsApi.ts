import apiClient from '@/shared/api/client'
import type {
  InactivityAlert,
  InactivityAlertContact,
  InactivityAlertSummary,
  MemberWithoutInactivityAlert,
  Notification,
  PaginatedResponse,
} from '@/shared/types'

export interface AlertContactPayload {
  method: InactivityAlertContact['method']
  result: string
  note?: string
  next_follow_up_date?: string
}

export const alertsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<InactivityAlert>> => {
    const { data } = await apiClient.get('/api/trainer/inactivity-alerts/', { params })
    return data
  },

  summary: async (): Promise<InactivityAlertSummary> => {
    const { data } = await apiClient.get('/api/trainer/inactivity-alerts/summary/')
    return data
  },

  membersWithoutAlerts: async (): Promise<{ results: MemberWithoutInactivityAlert[] }> => {
    const { data } = await apiClient.get('/api/trainer/members-without-alerts/')
    return data
  },

  startFollowUp: async (id: number): Promise<InactivityAlert> => {
    const { data } = await apiClient.post(`/api/trainer/inactivity-alerts/${id}/start-follow-up/`)
    return data
  },

  resolve: async (id: number): Promise<InactivityAlert> => {
    const { data } = await apiClient.post(`/api/trainer/inactivity-alerts/${id}/resolve/`)
    return data
  },

  dismiss: async ({ id, reason }: { id: number; reason: string }): Promise<InactivityAlert> => {
    const { data } = await apiClient.post(`/api/trainer/inactivity-alerts/${id}/dismiss/`, { reason })
    return data
  },

  reopen: async (id: number): Promise<InactivityAlert> => {
    const { data } = await apiClient.post(`/api/trainer/inactivity-alerts/${id}/reopen/`)
    return data
  },

  contacts: async (id: number): Promise<InactivityAlertContact[]> => {
    const { data } = await apiClient.get(`/api/trainer/inactivity-alerts/${id}/contacts/`)
    return data
  },

  createContact: async ({ id, payload }: { id: number; payload: AlertContactPayload }): Promise<InactivityAlertContact> => {
    const { data } = await apiClient.post(`/api/trainer/inactivity-alerts/${id}/contacts/`, payload)
    return data
  },

  notifications: async (params?: Record<string, string>): Promise<PaginatedResponse<Notification>> => {
    const { data } = await apiClient.get('/api/notifications/', { params })
    return data
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.post('/api/notifications/mark-all-read/')
  },

  markRead: async (id: number): Promise<Notification> => {
    const { data } = await apiClient.patch(`/api/notifications/${id}/read/`)
    return data
  },
}
