import apiClient from '@/shared/api/client'
import type { NutritionProfile, NutritionGuideline, PaginatedResponse } from '@/shared/types'

export const nutritionApi = {
  profiles: async (): Promise<PaginatedResponse<NutritionProfile>> => {
    const { data } = await apiClient.get('/api/nutrition-profiles/')
    return data
  },

  profile: async (id: number): Promise<NutritionProfile> => {
    const { data } = await apiClient.get(`/api/nutrition-profiles/${id}/`)
    return data
  },

  guidelines: async (): Promise<PaginatedResponse<NutritionGuideline>> => {
    const { data } = await apiClient.get('/api/nutrition-guidelines/')
    return data
  },

  createProfile: async (payload: Partial<NutritionProfile>): Promise<NutritionProfile> => {
    const { data } = await apiClient.post('/api/nutrition-profiles/', payload)
    return data
  },

  updateProfile: async (id: number, payload: Partial<NutritionProfile>): Promise<NutritionProfile> => {
    const { data } = await apiClient.patch(`/api/nutrition-profiles/${id}/`, payload)
    return data
  },
}
