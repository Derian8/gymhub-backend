import apiClient from '@/shared/api/client'
import type {
  TrainingPlan,
  WorkoutDay,
  Exercise,
  PaginatedResponse,
  TodayWorkout,
  WorkoutSession,
  ExerciseLog,
  TrainingPlanPayload,
  TrainingTemplateUpdatePayload,
  WorkoutDayPayload,
  ExercisePayload,
  TrainingTemplate,
} from '@/shared/types'

export const plansApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<TrainingPlan>> => {
    const { data } = await apiClient.get('/api/plans/', { params })
    return data
  },

  detail: async (id: number): Promise<TrainingPlan> => {
    const { data } = await apiClient.get(`/api/plans/${id}/`)
    return data
  },

  todayWorkout: async (planId: number): Promise<TodayWorkout> => {
    const { data } = await apiClient.get(`/api/plans/${planId}/today-workout/`)
    return data
  },

  weeklyView: async (planId: number): Promise<{ week_days: Array<{ date: string; workout_day: WorkoutDay | null }>; workout_days: WorkoutDay[] }> => {
    const { data } = await apiClient.get(`/api/plans/${planId}/weekly-view/`)
    return data
  },

  workoutDays: async (): Promise<PaginatedResponse<WorkoutDay>> => {
    const { data } = await apiClient.get('/api/workout-days/')
    return data
  },

  workoutDaysByPlan: async (planId: number): Promise<PaginatedResponse<WorkoutDay>> => {
    const { data } = await apiClient.get('/api/workout-days/', { params: { plan: planId } })
    return data
  },

  exercises: async (): Promise<PaginatedResponse<Exercise>> => {
    const { data } = await apiClient.get('/api/exercises/')
    return data
  },

  createPlan: async (payload: TrainingPlanPayload): Promise<TrainingPlan> => {
    const { data } = await apiClient.post('/api/plans/', payload)
    return data
  },

  updatePlan: async (id: number, payload: Partial<TrainingPlanPayload>): Promise<TrainingPlan> => {
    const { data } = await apiClient.patch(`/api/plans/${id}/`, payload)
    return data
  },

  deletePlan: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/plans/${id}/`)
  },

  createWorkoutDay: async (payload: WorkoutDayPayload): Promise<WorkoutDay> => {
    const { data } = await apiClient.post('/api/workout-days/', payload)
    return data
  },

  updateWorkoutDay: async (id: number, payload: Partial<WorkoutDayPayload>): Promise<WorkoutDay> => {
    const { data } = await apiClient.patch(`/api/workout-days/${id}/`, payload)
    return data
  },

  deleteWorkoutDay: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/workout-days/${id}/`)
  },

  createExercise: async (payload: ExercisePayload): Promise<Exercise> => {
    const { data } = await apiClient.post('/api/exercises/', payload)
    return data
  },

  updateExercise: async (id: number, payload: Partial<ExercisePayload>): Promise<Exercise> => {
    const { data } = await apiClient.patch(`/api/exercises/${id}/`, payload)
    return data
  },

  deleteExercise: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/exercises/${id}/`)
  },

  trainingTemplates: async (): Promise<PaginatedResponse<TrainingTemplate>> => {
    const { data } = await apiClient.get('/api/plan-templates/')
    return data
  },

  savePlanAsTemplate: async (planId: number, payload?: Record<string, unknown>): Promise<TrainingTemplate> => {
    const { data } = await apiClient.post(`/api/plans/${planId}/save-as-template/`, payload ?? {})
    return data
  },

  applyTrainingTemplate: async (templateId: number, payload: { member_id: number; start_date?: string }): Promise<TrainingPlan> => {
    const { data } = await apiClient.post(`/api/plan-templates/${templateId}/apply/`, payload)
    return data
  },

  updateTrainingTemplate: async (templateId: number, payload: TrainingTemplateUpdatePayload): Promise<TrainingTemplate> => {
    const { data } = await apiClient.patch(`/api/plan-templates/${templateId}/`, payload)
    return data
  },

  deleteTrainingTemplate: async (templateId: number): Promise<void> => {
    await apiClient.delete(`/api/plan-templates/${templateId}/`)
  },

  refreshTrainingTemplateFromPlan: async (templateId: number, payload: { plan_id: number }): Promise<TrainingTemplate> => {
    const { data } = await apiClient.post(`/api/plan-templates/${templateId}/refresh-from-plan/`, payload)
    return data
  },

  createSession: async (payload: { workout_day_id: number; attendance_id?: number }): Promise<WorkoutSession> => {
    const { data } = await apiClient.post('/api/workout-sessions/', payload)
    return data
  },

  completeSession: async (sessionId: number, payload: { overall_feeling?: number; trainer_notes?: string }): Promise<WorkoutSession> => {
    const { data } = await apiClient.patch(`/api/workout-sessions/${sessionId}/complete/`, payload)
    return data
  },

  bulkExerciseLogs: async (payload: {
    session_id: number
    logs: Array<{
      exercise_id: number
      sets_completed: number
      reps_completed: number
      weight_used_kg?: number
      rpe?: number
      notes?: string
    }>
  }): Promise<ExerciseLog[]> => {
    const { data } = await apiClient.post('/api/exercise-logs/bulk/', payload)
    return data
  },
}
