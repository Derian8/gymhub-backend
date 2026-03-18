import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { plansApi } from '../api/plansApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'

export function usePlansQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.PLANS_LIST,
    queryFn: plansApi.list,
  })
}

export function usePlanDetailQuery(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.PLAN_DETAIL(id),
    queryFn: () => plansApi.detail(id),
    enabled: !!id,
  })
}

export function useTodayWorkoutQuery(planId: number) {
  return useQuery({
    queryKey: QUERY_KEYS.PLAN_TODAY(planId),
    queryFn: () => plansApi.todayWorkout(planId),
    enabled: !!planId,
  })
}

export function useWeeklyPlanQuery(planId: number) {
  return useQuery({
    queryKey: QUERY_KEYS.PLAN_WEEKLY(planId),
    queryFn: () => plansApi.weeklyView(planId),
    enabled: !!planId,
  })
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: plansApi.createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_SESSIONS })
      toast.success('Sesión de entrenamiento iniciada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCompleteSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: number; payload: { overall_feeling?: number; trainer_notes?: string } }) =>
      plansApi.completeSession(sessionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_SESSIONS })
      toast.success('¡Sesión completada! Excelente trabajo')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useBulkExerciseLogsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: plansApi.bulkExerciseLogs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_SESSIONS })
      toast.success('Ejercicios registrados correctamente')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}
