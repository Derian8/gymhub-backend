import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { nutritionApi } from '../api/nutritionApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'

export function useNutritionProfilesQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.NUTRITION_PROFILES(params),
    queryFn: () => nutritionApi.profiles(params),
  })
}

export function useNutritionGuidelinesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.NUTRITION_GUIDELINES,
    queryFn: nutritionApi.guidelines,
  })
}

export function useNutritionTemplatesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.NUTRITION_TEMPLATES,
    queryFn: nutritionApi.nutritionTemplates,
  })
}

export function usePlanNutritionLinksQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.PLAN_NUTRITION_LINKS(params),
    queryFn: () => nutritionApi.planLinks(params),
    enabled: !params || Object.keys(params).length > 0,
  })
}

export function useCreateNutritionProfileMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: nutritionApi.createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-profiles'] })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
      }
      toast.success('Nutrición publicada al member')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useUpdateNutritionProfileMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => nutritionApi.updateProfile(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-profiles'] })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
      }
      toast.success('Cambios de nutrición publicados al member')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCreatePlanNutritionLinkMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: nutritionApi.createPlanLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-nutrition-links'] })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
      }
      toast.success('Guía nutricional vinculada al plan del member')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useSaveNutritionTemplateMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ profileId, payload }: { profileId: number; payload?: Record<string, unknown> }) =>
      nutritionApi.saveProfileAsTemplate(profileId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NUTRITION_TEMPLATES })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
      }
      toast.success('Plantilla nutricional guardada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useApplyNutritionTemplateMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: number; payload: { training_plan_id: number } }) =>
      nutritionApi.applyNutritionTemplate(templateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-profiles'] })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NUTRITION_TEMPLATES })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PRESCRIPTION(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
      }
      toast.success('Base nutricional publicada al member')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useDeleteNutritionTemplateMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId }: { templateId: number }) => nutritionApi.deleteNutritionTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NUTRITION_TEMPLATES })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(memberId) })
      }
      toast.success('Plantilla nutricional eliminada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}
