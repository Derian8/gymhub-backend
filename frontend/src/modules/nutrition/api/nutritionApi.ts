import apiClient from '@/shared/api/client'
import type {
  NutritionProfile,
  NutritionGuideline,
  PaginatedResponse,
  NutritionProfilePayload,
  PlanNutritionLink,
  PlanNutritionLinkPayload,
  NutritionTemplate,
} from '@/shared/types'

export const nutritionApi = {
  profiles: async (params?: Record<string, string>): Promise<PaginatedResponse<NutritionProfile>> => {
    const { data } = await apiClient.get('/api/nutrition-profiles/', { params })
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

  planLinks: async (params?: Record<string, string>): Promise<PaginatedResponse<PlanNutritionLink>> => {
    const { data } = await apiClient.get('/api/plan-nutrition-links/', { params })
    return data
  },

  createProfile: async (payload: NutritionProfilePayload): Promise<NutritionProfile> => {
    const { data } = await apiClient.post('/api/nutrition-profiles/', payload)
    return data
  },

  updateProfile: async (id: number, payload: Partial<NutritionProfilePayload>): Promise<NutritionProfile> => {
    const { data } = await apiClient.patch(`/api/nutrition-profiles/${id}/`, payload)
    return data
  },

  createPlanLink: async (payload: PlanNutritionLinkPayload): Promise<PlanNutritionLink> => {
    const { data } = await apiClient.post('/api/plan-nutrition-links/', payload)
    return data
  },

  nutritionTemplates: async (): Promise<PaginatedResponse<NutritionTemplate>> => {
    const { data } = await apiClient.get('/api/nutrition-templates/')
    return data
  },

  saveProfileAsTemplate: async (profileId: number, payload?: Record<string, unknown>): Promise<NutritionTemplate> => {
    const { data } = await apiClient.post(`/api/nutrition-profiles/${profileId}/save-as-template/`, payload ?? {})
    return data
  },

  applyNutritionTemplate: async (templateId: number, payload: { training_plan_id: number }): Promise<NutritionProfile> => {
    const { data } = await apiClient.post(`/api/nutrition-templates/${templateId}/apply/`, payload)
    return data
  },

  deleteNutritionTemplate: async (templateId: number): Promise<void> => {
    await apiClient.delete(`/api/nutrition-templates/${templateId}/`)
  },
}
