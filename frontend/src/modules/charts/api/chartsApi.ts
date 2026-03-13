import apiClient from '@/shared/api/client'

export type ChartType = 'attendance_monthly' | 'retention_rate' | 'payment_status' | 'physical_progress' | 'exercise_progression'

export const chartsApi = {
  get: async (chartType: ChartType, params?: Record<string, string | number>): Promise<{ url: string; chart_type: string }> => {
    const { data } = await apiClient.get(`/api/charts/${chartType}/`, { params })
    return data
  },
}
