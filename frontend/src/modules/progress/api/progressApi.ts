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

  sessions: async (memberId?: number, month?: string): Promise<PaginatedResponse<WorkoutSession>> => {
    const { data } = await apiClient.get('/api/workout-sessions/', {
      params: { ...(memberId ? { member_id: memberId } : {}), ...(month ? { month } : {}) },
    })
    return data
  },

  sessionsForMonth: async (month: string): Promise<WorkoutSession[]> => {
    const sessions: WorkoutSession[] = []
    let page = 1
    let hasNext = true
    while (hasNext) {
      const { data } = await apiClient.get<PaginatedResponse<WorkoutSession>>('/api/workout-sessions/', {
        params: { month, page },
      })
      sessions.push(...data.results)
      hasNext = Boolean(data.next)
      page += 1
    }
    return sessions
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
