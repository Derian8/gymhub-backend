import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { nutritionApi } from '../api/nutritionApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'

export function useNutritionProfilesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.NUTRITION_PROFILES,
    queryFn: nutritionApi.profiles,
  })
}

export function useNutritionGuidelinesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.NUTRITION_GUIDELINES,
    queryFn: nutritionApi.guidelines,
  })
}

export function useCreateNutritionProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: nutritionApi.createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NUTRITION_PROFILES })
      toast.success('Perfil nutricional creado')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}
