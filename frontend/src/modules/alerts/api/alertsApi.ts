import apiClient from '@/shared/api/client'
import type { InactivityAlert, Notification, PaginatedResponse } from '@/shared/types'

export const alertsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<InactivityAlert>> => {
    const { data } = await apiClient.get('/api/alerts/', { params })
    return data
  },

  resolve: async (id: number): Promise<InactivityAlert> => {
    const { data } = await apiClient.post(`/api/alerts/${id}/resolve/`)
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
