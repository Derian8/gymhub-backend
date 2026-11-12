import apiClient from '@/shared/api/client'
import type { ActivePrescription, Attendance, PaginatedResponse } from '@/shared/types'

export const attendanceApi = {
  memberQrToken: async (): Promise<{ token: string; expires_at: string; expires_in_seconds: number }> => {
    const { data } = await apiClient.get('/api/attendance/qr-token/')
    return data
  },
  openRoutine: async (): Promise<{ attendance: Attendance; attendance_created: boolean; prescription: ActivePrescription }> => {
    const { data } = await apiClient.post('/api/member/ver-rutina/')
    return data
  },
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Attendance>> => {
    const { data } = await apiClient.get('/api/attendance/', { params })
    return data
  },

  checkIn: async (payload?: { notes?: string; member_id?: number; qr_token?: string; override_reason?: string; trainer_override?: boolean }): Promise<Attendance> => {
    const { data } = await apiClient.post('/api/attendance/check-in/', payload ?? {})
    return data
  },

  checkOut: async (attendanceId: number): Promise<Attendance> => {
    const { data } = await apiClient.post(`/api/attendance/${attendanceId}/check-out/`)
    return data
  },
}
