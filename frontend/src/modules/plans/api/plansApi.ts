import apiClient from '@/shared/api/client'
import type { TrainingPlan, WorkoutDay, Exercise, PaginatedResponse } from '@/shared/types'

export const plansApi = {
  list: async (): Promise<PaginatedResponse<TrainingPlan>> => {
    const { data } = await apiClient.get('/api/plans/')
    return data
  },

  detail: async (id: number): Promise<TrainingPlan> => {
    const { data } = await apiClient.get(`/api/plans/${id}/`)
    return data
  },

  todayWorkout: async (planId: number) => {
    const { data } = await apiClient.get(`/api/plans/${planId}/today-workout/`)
    return data
  },

  weeklyView: async (planId: number) => {
    const { data } = await apiClient.get(`/api/plans/${planId}/weekly-view/`)
    return data
  },

  workoutDays: async (): Promise<PaginatedResponse<WorkoutDay>> => {
    const { data } = await apiClient.get('/api/workout-days/')
    return data
  },

  exercises: async (): Promise<PaginatedResponse<Exercise>> => {
    const { data } = await apiClient.get('/api/exercises/')
    return data
  },

  createSession: async (payload: { workout_day_id: number; attendance_id?: number }) => {
    const { data } = await apiClient.post('/api/workout-sessions/', payload)
    return data
  },

  completeSession: async (sessionId: number, payload: { overall_feeling?: number; trainer_notes?: string }) => {
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
  }) => {
    const { data } = await apiClient.post('/api/exercise-logs/bulk/', payload)
    return data
  },
}
