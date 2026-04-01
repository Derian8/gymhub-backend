import apiClient from '@/shared/api/client'
import type { ChartsOverview } from '@/shared/types'

export type ChartType = 'attendance_monthly' | 'retention_rate' | 'payment_status' | 'physical_progress' | 'exercise_progression'

export const chartsApi = {
  get: async (
    chartType: ChartType,
    params?: Record<string, string | number>,
  ): Promise<{ chart_url: string; chart_type: string; generated_at: string; cached: boolean }> => {
    const { data } = await apiClient.get(`/api/charts/${chartType}/`, { params })
    return data
  },

  getOverview: async (): Promise<ChartsOverview> => {
    const { data } = await apiClient.get('/api/charts/overview/')
    return data
  },
}
