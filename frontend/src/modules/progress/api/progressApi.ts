import apiClient from '@/shared/api/client'
import type { MemberPhysicalSummary, ProgressLog, WorkoutSession, PaginatedResponse } from '@/shared/types'

export const progressApi = {
  logs: async (memberId?: number): Promise<PaginatedResponse<ProgressLog>> => {
    const { data } = await apiClient.get('/api/progress-logs/', {
      params: memberId ? { member_id: memberId } : undefined,
    })
    return data
  },

  createLog: async (payload: Partial<ProgressLog>): Promise<ProgressLog> => {
    const { data } = await apiClient.post('/api/progress-logs/', payload)
    return data
  },

  updateLog: async (id: number, payload: Partial<ProgressLog>): Promise<ProgressLog> => {
    const { data } = await apiClient.patch(`/api/progress-logs/${id}/`, payload)
    return data
  },

  sessions: async (): Promise<PaginatedResponse<WorkoutSession>> => {
    const { data } = await apiClient.get('/api/workout-sessions/')
    return data
  },

  memberSummary: async (memberId: number): Promise<MemberPhysicalSummary> => {
    const { data } = await apiClient.get(`/api/members/${memberId}/physical-summary/`)
    return data
  },

  summary: async (memberId?: number): Promise<MemberPhysicalSummary> => {
    const { data } = await apiClient.get('/api/progress-logs/member-summary/', {
      params: memberId ? { member_id: memberId } : undefined,
    })
    return data
  },
}
