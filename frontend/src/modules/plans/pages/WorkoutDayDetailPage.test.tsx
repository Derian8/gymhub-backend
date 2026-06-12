import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { WorkoutDayDetailPage } from './WorkoutDayDetailPage'
import type { TrainingPlan, WorkoutDay } from '@/shared/types'

const mockPlan: TrainingPlan = {
  id: 12,
  member: 15,
  trainer: 9,
  name: 'Hipertrofia base',
  goal: 'muscle_gain',
  start_date: '2026-03-01',
  end_date: '2026-05-01',
  weeks_duration: 8,
  days_per_week: 4,
  is_active: true,
}

const mockWorkoutDay: WorkoutDay = {
  id: 101,
  plan: 12,
  day_label: 'A',
  day_of_week: 'mon',
  order: 0,
  name: 'Torso',
  exercises: [
    {
      id: 501,
      workout_day: 101,
      name: 'Press banca',
      muscle_group: 'chest',
      exercise_type: 'strength',
      sets: 4,
      reps_range: '8-10',
      target_minutes: null,
      machine: 1,
      machine_detail: { id: 1, name: 'Smith', category: 'Pecho', notes: '', is_active: true },
      weight_suggestion_kg: 60,
      rest_seconds: 90,
      technique_notes: 'Mantener escapulas retraidas.',
      order: 0,
    },
    {
      id: 502,
      workout_day: 101,
      name: 'Bici estatica',
      muscle_group: 'cardio',
      exercise_type: 'timed',
      sets: null,
      reps_range: '',
      target_minutes: 20,
      machine: null,
      weight_suggestion_kg: null,
      rest_seconds: 30,
      technique_notes: 'Ritmo constante.',
      order: 1,
    },
  ],
}

let planData: TrainingPlan | undefined = mockPlan
let dayData: WorkoutDay | undefined = mockWorkoutDay
let dayError = false

afterEach(() => {
  cleanup()
})

vi.mock('../hooks/usePlans', () => ({
  usePlanDetailQuery: () => ({
    data: planData,
    isLoading: false,
  }),
  useWorkoutDayDetailQuery: () => ({
    data: dayData,
    isLoading: false,
    isError: dayError,
  }),
}))

describe('WorkoutDayDetailPage', () => {
  beforeEach(() => {
    planData = mockPlan
    dayData = mockWorkoutDay
    dayError = false
  })

  it('shows the exact day plan with exercises and analysis', () => {
    const { getByTestId, getByText } = renderWithProviders(<WorkoutDayDetailPage />, {
      route: '/plans/12/days/101',
      path: '/plans/:planId/days/:dayId',
    })

    expect(getByTestId('workout-day-detail-page')).toBeInTheDocument()
    expect(getByText('Lunes · Torso')).toBeInTheDocument()
    expect(getByText('Plan: Hipertrofia base')).toBeInTheDocument()
    expect(getByText('Plan del día exacto')).toBeInTheDocument()
    expect(getByText('Press banca')).toBeInTheDocument()
    expect(getByText('Bici estatica')).toBeInTheDocument()
    expect(getByText('4×8-10 @60kg')).toBeInTheDocument()
    expect(getByText('20 min')).toBeInTheDocument()
    expect(getByText('90s')).toBeInTheDocument()
    expect(getByText('Pecho · Smith')).toBeInTheDocument()
    expect(getByText('Mantener escapulas retraidas.')).toBeInTheDocument()
    expect(getByTestId('workout-day-analysis')).toHaveTextContent('Fuerza:')
    expect(getByText('Volver al plan')).toHaveAttribute('href', '/plans/12')
  })

  it('shows an empty state when the day does not belong to the selected plan', () => {
    dayData = { ...mockWorkoutDay, plan: 99 }

    const { getByText } = renderWithProviders(<WorkoutDayDetailPage />, {
      route: '/plans/12/days/101',
      path: '/plans/:planId/days/:dayId',
    })

    expect(getByText('Día no encontrado')).toBeInTheDocument()
    expect(getByText('Volver al plan')).toHaveAttribute('href', '/plans/12')
  })
})
