import apiClient from '@/shared/api/client'
import type { ProgressLog, WorkoutSession, PaginatedResponse } from '@/shared/types'

export const progressApi = {
  logs: async (): Promise<PaginatedResponse<ProgressLog>> => {
    const { data } = await apiClient.get('/api/progress-logs/')
    return data
  },

  createLog: async (payload: Partial<ProgressLog>): Promise<ProgressLog> => {
    const { data } = await apiClient.post('/api/progress-logs/', payload)
    return data
  },

  sessions: async (): Promise<PaginatedResponse<WorkoutSession>> => {
    const { data } = await apiClient.get('/api/workout-sessions/')
    return data
  },
}
