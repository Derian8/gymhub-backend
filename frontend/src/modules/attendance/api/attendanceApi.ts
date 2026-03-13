import apiClient from '@/shared/api/client'
import type { Attendance, PaginatedResponse } from '@/shared/types'

export const attendanceApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Attendance>> => {
    const { data } = await apiClient.get('/api/attendance/', { params })
    return data
  },

  checkIn: async (notes?: string): Promise<Attendance> => {
    const { data } = await apiClient.post('/api/attendance/check-in/', { notes })
    return data
  },
}
