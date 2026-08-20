import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { plansApi } from '../api/plansApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'
import type { CompleteTrainingPlanPayload, CompleteWorkoutSessionPayload, ExerciseProgressPayload, QuickRoutineAssignmentPayload } from '@/shared/types'
import type { ExercisePayload, TrainingPlanPayload, TrainingTemplateUpdatePayload, WorkoutDayPayload } from '@/shared/types'

export function usePlansQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.PLANS_LIST(params),
    queryFn: () => plansApi.list(params),
  })
}

export function useReusablePlanSourcesQuery(enabled = true) {
  return useInfiniteQuery({
    queryKey: [...QUERY_KEYS.PLANS, 'reusable-sources'],
    queryFn: ({ pageParam }) => plansApi.reusableSources(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return undefined
      const page = lastPage.next.match(/[?&]page=(\d+)/)?.[1]
      return page ? Number(page) : undefined
    },
    enabled,
  })
}

export function usePlanDetailQuery(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.PLAN_DETAIL(id),
    queryFn: () => plansApi.detail(id),
    enabled: !!id,
  })
}

export function useTodayWorkoutQuery(planId: number, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.PLAN_TODAY(planId),
    queryFn: () => plansApi.todayWorkout(planId),
    enabled: !!planId && enabled,
  })
}

export function useWeeklyPlanQuery(planId: number, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.PLAN_WEEKLY(planId),
    queryFn: () => plansApi.weeklyView(planId),
    enabled: !!planId && enabled,
  })
}

export function usePlansSummaryQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.PLANS_SUMMARY,
    queryFn: plansApi.summary,
    enabled,
  })
}

export function useWorkoutDaysByPlanQuery(planId: number) {
  return useQuery({
    queryKey: QUERY_KEYS.WORKOUT_DAYS_BY_PLAN(planId),
    queryFn: () => plansApi.workoutDaysByPlan(planId),
    enabled: !!planId,
  })
}

export function useWorkoutDayDetailQuery(dayId: number) {
  return useQuery({
    queryKey: QUERY_KEYS.WORKOUT_DAY_DETAIL(dayId),
    queryFn: () => plansApi.workoutDayDetail(dayId),
    enabled: !!dayId,
  })
}

export function useGymMachinesQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.GYM_MACHINES,
    queryFn: plansApi.gymMachines,
    enabled,
  })
}

export function useCatalogExercisesQuery(params?: Record<string, string>, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.CATALOGO_EJERCICIOS(params),
    queryFn: () => plansApi.catalogExercises(params),
    enabled,
  })
}

export function useTrainingTemplatesQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.PLAN_TEMPLATES,
    queryFn: plansApi.trainingTemplates,
    enabled,
  })
}

export function useCreatePlanMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: plansApi.createPlan,
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(plan.member) })
      toast.success('Plan publicado al member')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCreateCompletePlanMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CompleteTrainingPlanPayload) => plansApi.createCompletePlan(payload),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS_SUMMARY })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
      toast.success(plan.status === 'draft' ? 'Plan guardado como borrador' : 'Plan creado correctamente')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useQuickRoutineAssignmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: QuickRoutineAssignmentPayload) => plansApi.assignTemplateQuickly(payload),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_DASHBOARD })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS_SUMMARY })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DETAIL(plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(plan.member) })
      toast.success(plan.status === 'scheduled' ? 'Rutina programada correctamente' : 'Rutina publicada correctamente')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useUpdatePlanMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TrainingPlanPayload> }) => plansApi.updatePlan(id, payload),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_DETAIL(plan.id) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(plan.member) })
      toast.success('Cambios del plan publicados al member')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCreatePlanRevisionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: plansApi.createRevision,
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      toast.success('Revisión creada como borrador')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function usePublishPlanMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: plansApi.publishPlan,
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_DETAIL(plan.id) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_DETAIL(plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PRESCRIPTION(plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
      toast.success(`Versión ${plan.numero_version ?? 1} publicada para el miembro`)
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useDeletePlanMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: number; memberId: number }) => plansApi.deletePlan(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_DETAIL(variables.id) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(variables.memberId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PRESCRIPTION(variables.memberId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(variables.memberId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
      toast.success('Plan y contenido eliminados')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useDuplicatePlanMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload?: { name?: string; status?: string; start_date?: string } }) =>
      plansApi.duplicatePlan(id, payload),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS_SUMMARY })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(plan.member) })
      toast.success('Plan duplicado como copia independiente')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useFinishPlanMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: number }) => plansApi.finishPlan(id),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS_SUMMARY })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_DETAIL(plan.id) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(plan.member) })
      toast.success('Plan finalizado')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useArchivePlanMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: number }) => plansApi.archivePlan(id),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS_SUMMARY })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_DETAIL(plan.id) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(plan.member) })
      toast.success('Plan archivado')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCreateWorkoutDayMutation(planId?: number, memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: plansApi.createWorkoutDay,
    onSuccess: (day) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS_BY_PLAN(day.plan) })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
      }
      if (planId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_DETAIL(planId) })
      }
      toast.success('Día agregado al plan activo del member')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useUpdateWorkoutDayMutation(planId?: number, memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<WorkoutDayPayload>; silent?: boolean }) =>
      plansApi.updateWorkoutDay(id, payload),
    onSuccess: (day, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS_BY_PLAN(day.plan) })
      if (planId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_DETAIL(planId) })
      }
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
      }
      if (!variables.silent) {
        toast.success('Dia actualizado en el plan del member')
      }
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useDeleteWorkoutDayMutation(planId?: number, memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: number }) => plansApi.deleteWorkoutDay(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS_BY_PLAN(planId ?? 0) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXERCISES })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXERCISES_BY_DAY(variables.id) })
      if (planId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_DETAIL(planId) })
      }
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PRESCRIPTION(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
      }
      toast.success('Dia eliminado del plan')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCreateExerciseMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: plansApi.createExercise,
    onSuccess: (exercise) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXERCISES })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXERCISES_BY_DAY(exercise.workout_day) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
      }
      toast.success('Ejercicio publicado en la rutina del member')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useUpdateExerciseMutation(planId?: number, memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ExercisePayload>; silent?: boolean }) =>
      plansApi.updateExercise(id, payload),
    onSuccess: (exercise, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXERCISES })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXERCISES_BY_DAY(exercise.workout_day) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS })
      if (planId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS_BY_PLAN(planId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_DETAIL(planId) })
      }
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
      }
      if (!variables.silent) {
        toast.success('Ejercicio actualizado en la rutina del member')
      }
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useDeleteExerciseMutation(planId?: number, memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: number; workoutDayId: number }) => plansApi.deleteExercise(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXERCISES })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXERCISES_BY_DAY(variables.workoutDayId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS_BY_PLAN(planId ?? 0) })
      if (planId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_DETAIL(planId) })
      }
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PRESCRIPTION(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
      }
      toast.success('Ejercicio eliminado de la rutina')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCreateGymMachineMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: plansApi.createGymMachine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GYM_MACHINES })
      toast.success('Máquina agregada al catálogo del gym')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useUpdateGymMachineMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      plansApi.updateGymMachine(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GYM_MACHINES })
      toast.success('Máquina actualizada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useDeleteGymMachineMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: number }) => plansApi.deleteGymMachine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GYM_MACHINES })
      toast.success('Máquina eliminada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useSavePlanAsTemplateMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ planId, payload }: { planId: number; payload?: Record<string, unknown> }) => plansApi.savePlanAsTemplate(planId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_TEMPLATES })
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(memberId) })
      }
      toast.success('Plantilla de entrenamiento guardada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useApplyTrainingTemplateMutation(memberId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: number; payload: { member_id: number; start_date?: string } }) =>
      plansApi.applyTrainingTemplate(templateId, payload),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_TEMPLATES })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PROGRAM(memberId || plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_PRESCRIPTION(memberId || plan.member) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBER_ACTIVE_PRESCRIPTION(memberId || plan.member) })
      toast.success('Base de entrenamiento publicada al member')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useUpdateTrainingTemplateMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: number; payload: TrainingTemplateUpdatePayload }) =>
      plansApi.updateTrainingTemplate(templateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_TEMPLATES })
      toast.success('Plantilla de entrenamiento actualizada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useDeleteTrainingTemplateMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId }: { templateId: number }) => plansApi.deleteTrainingTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_TEMPLATES })
      toast.success('Plantilla de entrenamiento eliminada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useRefreshTrainingTemplateMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: number; payload: { plan_id: number } }) =>
      plansApi.refreshTrainingTemplateFromPlan(templateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_TEMPLATES })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_DAYS })
      toast.success('Plantilla sincronizada desde el plan activo')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: plansApi.createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_SESSIONS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
      toast.success('Sesión de entrenamiento iniciada')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}

export function useCompleteSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: number; payload: CompleteWorkoutSessionPayload }) =>
      plansApi.completeSession(sessionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_SESSIONS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEMBERS })
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

export function useRegisterExerciseProgressMutation(planId?: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: number; payload: ExerciseProgressPayload }) =>
      plansApi.registerExerciseProgress(sessionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKOUT_SESSIONS })
      if (planId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLAN_TODAY(planId) })
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}
