import { act, fireEvent, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { TrainerProgramPage } from './TrainerProgramPage'

const deletePlanMutate = vi.fn()
const deleteDayMutate = vi.fn()
const deleteExerciseMutate = vi.fn()
const createDayMutate = vi.fn()
const createExerciseMutate = vi.fn()
const updateDayMutate = vi.fn()
const updateExerciseMutate = vi.fn()
const updateTrainingTemplateMutate = vi.fn()
const deleteTrainingTemplateMutate = vi.fn()
const refreshTrainingTemplateMutate = vi.fn()
const createGymMachineMutate = vi.fn()
const updateGymMachineMutate = vi.fn()
const deleteGymMachineMutate = vi.fn()

const memberData = {
  id: 15,
  email: 'maria@gymhub.com',
  full_name: 'Maria Perez',
  membership_plan: 2,
  phone: '',
  birth_date: null,
  emergency_contact: '',
  join_date: '2026-01-15',
  is_active: true,
  photo: null,
  trainer_asignado: 9,
  trainer_asignado_nombre: 'Trainer Demo',
  user: {
    id: 15,
    email: 'maria@gymhub.com',
    username: 'maria',
    first_name: 'Maria',
    last_name: 'Perez',
    role: 'member',
    is_staff: false,
    memberprofile_id: 15,
    trainerprofile_id: null,
  },
}

const prescriptionSummary = {
  situacion_prescriptiva: 'construccion_de_consistencia',
  riesgo_adherencia: 61,
  nivel_riesgo: 'medium',
  motivos_riesgo: ['Inasistencia reciente', 'Sin progreso reciente'],
  recommended_goal: 'fat_loss',
  recommended_days_per_week: 3,
  recommended_calories: {
    min: 1700,
    max: 2100,
  },
  recomendaciones: [
    'Usa progresion moderada y manten el plan facil de seguir semana a semana.',
  ],
  advertencias: [
    'Falta progreso reciente; registra mediciones antes de subir carga o calorias.',
  ],
  active_plan_id: 101,
  active_nutrition_profile_id: null,
}

const plansResponse = {
  results: [
    {
      id: 101,
      member: 15,
      trainer: 9,
      name: 'Plan recomposicion',
      goal: 'fat_loss',
      start_date: '2026-03-01',
      end_date: '2026-05-01',
      weeks_duration: 8,
      days_per_week: 4,
      is_active: true,
    },
  ],
}

const workoutDaysResponse = {
  results: [
    {
      id: 301,
      plan: 101,
      name: 'Pierna y core',
      day_label: 'A',
      day_of_week: 'mon',
      order: 0,
      exercises: [
        {
          id: 401,
          workout_day: 301,
          name: 'Sentadilla',
          muscle_group: 'legs',
          exercise_type: 'strength',
          sets: 4,
          reps_range: '8-10',
          target_minutes: null,
          machine: 1,
          machine_detail: { id: 1, name: 'Prensa 45', category: 'Pierna', notes: '', is_active: true },
          weight_suggestion_kg: 60,
          rest_seconds: 90,
          technique_notes: '',
          order: 0,
        },
        {
          id: 402,
          workout_day: 301,
          name: 'Peso muerto rumano',
          muscle_group: 'glutes',
          exercise_type: 'strength',
          sets: 3,
          reps_range: '10-12',
          target_minutes: null,
          machine: null,
          weight_suggestion_kg: 45,
          rest_seconds: 75,
          technique_notes: 'Controla la bajada',
          order: 1,
        },
      ],
    },
    {
      id: 302,
      plan: 101,
      name: 'Empuje superior',
      day_label: 'B',
      day_of_week: 'wed',
      order: 1,
      exercises: [],
    },
  ],
}

const gymMachinesResponse = {
  results: [
    { id: 1, name: 'Prensa 45', category: 'Pierna', notes: '', is_active: true },
    { id: 2, name: 'Polea alta', category: 'Espalda', notes: '', is_active: true },
  ],
}

const trainingTemplatesResponse = {
  results: [
    {
      id: 801,
      trainer: 9,
      trainer_nombre: 'Trainer Demo',
      nombre: 'Base adherencia media',
      descripcion: 'Plantilla simple de 3 dias para retomar consistencia.',
      objetivo: 'fat_loss',
      nivel_adherencia_recomendado: 'medium',
      dias_por_semana_sugeridos: 3,
      esta_activa: true,
      creada_en: '2026-03-20T12:00:00Z',
      dias: [
        {
          id: 1001,
          plantilla: 801,
          nombre: 'Full body base',
          etiqueta_dia: 'A',
          orden: 0,
          ejercicios: [
            {
              id: 1101,
              dia: 1001,
              nombre: 'Sentadilla goblet',
              grupo_muscular: 'legs',
              tipo_ejercicio: 'strength',
              series: 3,
              rango_repeticiones: '10-12',
              minutos_objetivo: null,
              peso_sugerido_kg: null,
              descanso_segundos: 75,
              notas_tecnicas: '',
              orden: 0,
            },
          ],
        },
      ],
    },
  ],
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useParams: () => ({ id: '15' }),
  }
})

vi.mock('../hooks/useMembers', () => ({
  useMembersQuery: () => ({
    data: { count: 1, results: [memberData] },
    isLoading: false,
  }),
  useMemberDetailQuery: () => ({
    data: memberData,
    isLoading: false,
  }),
  useMemberPrescriptionQuery: () => ({
    data: prescriptionSummary,
    isLoading: false,
  }),
  useMemberActivePrescriptionQuery: () => ({
    data: {
      trainer: {
        id: 9,
        nombre: 'Trainer Demo',
        correo: 'trainer@gymhub.com',
      },
      estado_prescripcion: {
        tiene_plan_activo: true,
        tiene_dias: true,
        tiene_ejercicios: true,
        tiene_nutricion: false,
        tiene_guias: false,
        esta_lista_para_member: true,
      },
    },
    isLoading: false,
  }),
  useAssignTrainerMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('@/modules/plans/hooks/usePlans', () => ({
  usePlansQuery: () => ({
    data: plansResponse,
    isLoading: false,
  }),
  useWorkoutDaysByPlanQuery: () => ({
    data: workoutDaysResponse,
    isLoading: false,
  }),
  useGymMachinesQuery: () => ({
    data: gymMachinesResponse,
  }),
  useTrainingTemplatesQuery: () => ({
    data: trainingTemplatesResponse,
  }),
  useCreateCompletePlanMutation: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false }),
  useCreatePlanMutation: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false }),
  useUpdatePlanMutation: () => ({ mutate: vi.fn(), isPending: false, isSuccess: true }),
  useDeletePlanMutation: () => ({ mutate: deletePlanMutate, isPending: false, isSuccess: false }),
  useCreateWorkoutDayMutation: () => ({ mutate: createDayMutate, isPending: false, isSuccess: false }),
  useUpdateWorkoutDayMutation: () => ({ mutate: updateDayMutate, isPending: false, isSuccess: false }),
  useDeleteWorkoutDayMutation: () => ({ mutate: deleteDayMutate, isPending: false, isSuccess: false }),
  useCreateExerciseMutation: () => ({ mutate: createExerciseMutate, isPending: false, isSuccess: false }),
  useUpdateExerciseMutation: () => ({ mutate: updateExerciseMutate, isPending: false, isSuccess: false }),
  useDeleteExerciseMutation: () => ({ mutate: deleteExerciseMutate, isPending: false, isSuccess: false }),
  useCreateGymMachineMutation: () => ({ mutate: createGymMachineMutate, isPending: false, isSuccess: false }),
  useUpdateGymMachineMutation: () => ({ mutate: updateGymMachineMutate, isPending: false, isSuccess: false }),
  useDeleteGymMachineMutation: () => ({ mutate: deleteGymMachineMutate, isPending: false, isSuccess: false }),
  useSavePlanAsTemplateMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useApplyTrainingTemplateMutation: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false }),
  useUpdateTrainingTemplateMutation: () => ({ mutate: updateTrainingTemplateMutate, isPending: false, isSuccess: false }),
  useDeleteTrainingTemplateMutation: () => ({ mutate: deleteTrainingTemplateMutate, isPending: false, isSuccess: false }),
  useRefreshTrainingTemplateMutation: () => ({ mutate: refreshTrainingTemplateMutate, isPending: false, isSuccess: false }),
  useDuplicatePlanMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useFinishPlanMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useArchivePlanMutation: () => ({ mutate: vi.fn(), isPending: false }),
}))

describe('TrainerProgramPage', () => {
  beforeEach(() => {
    deletePlanMutate.mockReset()
    deleteDayMutate.mockReset()
    deleteExerciseMutate.mockReset()
    createDayMutate.mockReset()
    createExerciseMutate.mockReset()
    updateDayMutate.mockReset()
    updateExerciseMutate.mockReset()
    updateTrainingTemplateMutate.mockReset()
    deleteTrainingTemplateMutate.mockReset()
    refreshTrainingTemplateMutate.mockReset()
    createGymMachineMutate.mockReset()
    updateGymMachineMutate.mockReset()
    deleteGymMachineMutate.mockReset()
    localStorage.clear()
    localStorage.setItem(
      'gymhub:prescription-publication:15',
      JSON.stringify({ memberId: 15, tipo: 'plan', fechaIso: '2026-03-26T11:45:00.000Z' }),
    )
    useAuthStore.setState({
      user: {
        id: 2,
        email: 'trainer@gymhub.com',
        username: 'trainer',
        first_name: 'Trainer',
        last_name: 'Demo',
        role: 'trainer',
        is_staff: false,
        memberprofile_id: null,
        trainerprofile_id: 9,
      },
      isAuthenticated: true,
      authResolved: true,
      theme: 'dark',
    })
  })

  it('renders prescription summary, templates and program details', () => {
    const { getAllByText, getByDisplayValue, getByTestId, getByText, queryByText } = renderWithProviders(<TrainerProgramPage />, {
      route: '/members/15/program',
      path: '/members/:id/program',
    })

    expect(getByTestId('trainer-program-page')).toBeInTheDocument()
    expect(getByTestId('assignment-flow-card')).toBeInTheDocument()
    expect(getByTestId('last-publication-card')).toHaveTextContent('Plan activo')
    expect(getByTestId('publication-banner')).toHaveTextContent('Cambios del plan publicados para este member.')
    expect(getByTestId('prescription-summary-card')).toBeInTheDocument()
    expect(getByTestId('prescription-status-card')).toBeInTheDocument()
    expect(getByTestId('machine-catalog-card')).toBeInTheDocument()
    expect(getByText('Asignacion para Maria Perez')).toBeInTheDocument()
    expect(getByText('Resumen prescriptivo')).toBeInTheDocument()
    expect(getByTestId('training-template-preview')).toBeInTheDocument()
    expect(getByTestId('training-template-preview')).toHaveTextContent('Base adherencia media')
    expect(getByText('1 dia y 1 ejercicios base')).toBeInTheDocument()
    expect(getByText('Sin progreso reciente')).toBeInTheDocument()
    expect(getByDisplayValue('Plan recomposicion')).toBeInTheDocument()
    expect(getByText(/Sentadilla · 4x8-10 · descanso 90s/)).toBeInTheDocument()
    expect(getAllByText('Prensa 45').length).toBeGreaterThan(0)
    expect(getByText(/Peso muerto rumano · 3x10-12 · descanso 75s/)).toBeInTheDocument()
    expect(queryByText(/nutric/i)).not.toBeInTheDocument()
  })

  it('opens a strong confirmation modal before deleting the active plan', () => {
    const { getByTestId, getByText } = renderWithProviders(<TrainerProgramPage />, {
      route: '/members/15/program',
      path: '/members/:id/program',
    })

    fireEvent.click(getByTestId('delete-plan-button'))

    expect(getByTestId('delete-confirm-dialog')).toBeInTheDocument()
    expect(getByText(/Se eliminara el plan completo "Plan recomposicion"/)).toBeInTheDocument()

    fireEvent.click(getByText('Borrar plan'))

    expect(deletePlanMutate).toHaveBeenCalledWith(
      { id: 101, memberId: 15 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('lets the trainer edit and delete the selected training template', () => {
    const { getByDisplayValue, getByTestId, getByText } = renderWithProviders(<TrainerProgramPage />, {
      route: '/members/15/program',
      path: '/members/:id/program',
    })

    fireEvent.change(getByTestId('training-template-name-input'), { target: { value: 'Base ajustada para reenganche' } })
    fireEvent.change(getByTestId('training-template-description-input'), { target: { value: 'Version mas clara para members con adherencia media.' } })
    fireEvent.click(getByText('Guardar cambios de la base'))

    expect(updateTrainingTemplateMutate).toHaveBeenCalledWith({
      templateId: 801,
      payload: expect.objectContaining({
        nombre: 'Base ajustada para reenganche',
        descripcion: 'Version mas clara para members con adherencia media.',
        objetivo: 'fat_loss',
        dias_por_semana_sugeridos: 3,
        esta_activa: true,
      }),
    })

    expect(getByDisplayValue('Base ajustada para reenganche')).toBeInTheDocument()

    fireEvent.click(getByTestId('delete-training-template-button'))

    expect(getByTestId('delete-confirm-dialog')).toBeInTheDocument()
    expect(getByText(/solo borra la base reutilizable del trainer/i)).toBeInTheDocument()

    fireEvent.click(getByText('Borrar plantilla'))

    expect(deleteTrainingTemplateMutate).toHaveBeenCalledWith(
      { templateId: 801 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('confirms before refreshing a training template from the active plan', () => {
    const { getByTestId, getByText } = renderWithProviders(<TrainerProgramPage />, {
      route: '/members/15/program',
      path: '/members/:id/program',
    })

    fireEvent.click(getByTestId('refresh-training-template-button'))

    expect(getByText(/reemplazara los dias y ejercicios guardados/i)).toBeInTheDocument()

    fireEvent.click(getByText('Actualizar plantilla'))

    expect(refreshTrainingTemplateMutate).toHaveBeenCalledWith(
      {
        templateId: 801,
        payload: { plan_id: 101 },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('lets the trainer edit an exercise inline and reorder workout days', () => {
    const { getByDisplayValue, getByTestId, getByText } = renderWithProviders(<TrainerProgramPage />, {
      route: '/members/15/program',
      path: '/members/:id/program',
    })

    fireEvent.click(getByTestId('edit-exercise-401'))
    fireEvent.change(getByDisplayValue('Sentadilla'), { target: { value: 'Sentadilla frontal' } })
    fireEvent.click(getByText('Guardar ejercicio'))

    expect(updateExerciseMutate).toHaveBeenCalledWith(
      {
        id: 401,
        payload: expect.objectContaining({
          workout_day: 301,
          name: 'Sentadilla frontal',
          order: 0,
        }),
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )

    fireEvent.click(getByTestId('move-day-down-301'))

    expect(updateDayMutate).toHaveBeenCalledTimes(2)
    expect(updateDayMutate).toHaveBeenNthCalledWith(
      1,
      {
        id: 301,
        payload: expect.objectContaining({
          plan: 101,
          order: 1,
        }),
        silent: true,
      },
    )
  })

  it('lets the trainer duplicate an exercise and a full workout day', () => {
    const { getByTestId } = renderWithProviders(<TrainerProgramPage />, {
      route: '/members/15/program',
      path: '/members/:id/program',
    })

    fireEvent.click(getByTestId('duplicate-exercise-401'))

    expect(createExerciseMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        workout_day: 301,
        name: 'Sentadilla (copia)',
        order: 2,
      }),
    )

    fireEvent.click(getByTestId('duplicate-day-301'))

    expect(createDayMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 101,
        name: 'Pierna y core (copia)',
        order: 2,
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )

    const createDayOnSuccess = createDayMutate.mock.calls[0][1].onSuccess as (day: { id: number }) => void
    act(() => {
      createDayOnSuccess({ id: 999 })
    })

    expect(createExerciseMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        workout_day: 999,
        name: 'Sentadilla (copia)',
        order: 0,
      }),
    )
    expect(createExerciseMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        workout_day: 999,
        name: 'Peso muerto rumano (copia)',
        order: 1,
      }),
    )
  })

  it('switches cardio exercises to minutes automatically when creating a new exercise', () => {
    const { getByTestId, getByText, queryByDisplayValue } = renderWithProviders(<TrainerProgramPage />, {
      route: '/members/15/program',
      path: '/members/:id/program',
    })

    const addExerciseButton = getByTestId('add-exercise-inline-button')
    const addExerciseForm = addExerciseButton.closest('form')
    expect(addExerciseForm).not.toBeNull()
    const formScope = within(addExerciseForm as HTMLFormElement)
    expect(getByTestId('muscle-group-options')).toHaveTextContent('Abductores')
    expect(getByTestId('muscle-group-options')).toHaveTextContent('Aductores')

    fireEvent.click(within(getByTestId('muscle-group-options')).getByText('Cardio'))

    expect(getByText(/Cardio se carga por minutos objetivo/i)).toBeInTheDocument()
    expect(queryByDisplayValue('8-12')).not.toBeInTheDocument()

    fireEvent.change(formScope.getAllByRole('textbox')[0], { target: { value: 'Bici estatica' } })
    fireEvent.change(formScope.getByDisplayValue('10'), { target: { value: '20' } })
    fireEvent.click(addExerciseButton)

    expect(createExerciseMutate).toHaveBeenCalledWith({
      workout_day: 301,
      name: 'Bici estatica',
      muscle_group: 'cardio',
      exercise_type: 'timed',
      sets: null,
      reps_range: '',
      target_minutes: 20,
      machine: null,
      weight_suggestion_kg: null,
      rest_seconds: 60,
      technique_notes: '',
      order: 2,
    })
  })
})
