import apiClient from '@/shared/api/client'
import type { Attendance, PaginatedResponse } from '@/shared/types'

export const attendanceApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Attendance>> => {
    const { data } = await apiClient.get('/api/attendance/', { params })
    return data
  },

  checkIn: async (payload?: { notes?: string; member_id?: number; override_reason?: string }): Promise<Attendance> => {
    const { data } = await apiClient.post('/api/attendance/check-in/', payload ?? {})
    return data
  },

  checkOut: async (attendanceId: number): Promise<Attendance> => {
    const { data } = await apiClient.post(`/api/attendance/${attendanceId}/check-out/`)
    return data
  },
}
