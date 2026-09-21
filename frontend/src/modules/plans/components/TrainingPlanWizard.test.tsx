import { renderWithProviders } from '@/test/utils'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrainingPlanWizard } from './TrainingPlanWizard'

const createCompletePlanMutate = vi.fn()
const assignTrainerMutate = vi.fn()

vi.mock('../hooks/usePlans', () => ({
  useCreateCompletePlanMutation: () => ({
    mutate: createCompletePlanMutate,
    isPending: false,
  }),
  useGymMachinesQuery: () => ({
    data: {
      results: [
        { id: 1, name: 'Prensa 45', category: 'Pierna', notes: '', is_active: true },
        { id: 2, name: 'Remo viejo', category: 'Espalda', notes: '', is_active: false },
      ],
    },
    isLoading: false,
  }),
  useTrainingTemplatesQuery: () => ({ data: { results: [] } }),
  useCatalogExercisesQuery: () => ({ data: { results: [{
    id: 20,
    identificador_origen: 'gymhub-base:prensa',
    nombre: 'Prensa',
    categoria: 'fuerza',
    parte_cuerpo: 'Piernas',
    equipo: 'Prensa 45°',
    musculo_objetivo: 'Piernas',
    grupo_muscular: 'Piernas',
    musculos_secundarios: [],
    instrucciones_es: 'Baja con control.',
    pasos_es: [],
    imagen_url: '',
    animacion_url: '',
    atribucion_media: 'Catálogo base GymHub',
    version_origen: 'GymHub/base-1',
    esta_activo: true,
    grupo_muscular_plan: 'quadriceps',
    maquina_recomendada: 1,
  }] }, isLoading: false }),
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMembersQuery: () => ({
    data: {
      count: 2,
      results: [
        {
          id: 10,
          full_name: 'Derian Campos',
          email: 'derian@test.com',
          photo: null,
          trainer_asignado: 9,
          trainer_asignado_nombre: 'Trainer Demo',
          tiene_plan_activo: false,
          estado_prescripcion: 'sin_plan',
          membresia_actual: { status: 'active' },
        },
        {
          id: 11,
          full_name: 'Derian Isaac',
          email: 'derianisaac.ar@gmail.com',
          photo: null,
          trainer_asignado: null,
          trainer_asignado_nombre: null,
          tiene_plan_activo: false,
          estado_prescripcion: 'sin_plan',
          membresia_actual: { status: 'active' },
        },
      ],
    },
    isLoading: false,
  }),
  useAssignTrainerMutation: () => ({
    mutate: assignTrainerMutate,
    isPending: false,
  }),
}))

describe('TrainingPlanWizard', () => {
  beforeEach(() => {
    createCompletePlanMutate.mockReset()
    assignTrainerMutate.mockReset()
  })

  it('allows assigning a gym machine to an exercise from the general plan flow', async () => {
    const user = userEvent.setup()

    renderWithProviders(<TrainingPlanWizard open onClose={vi.fn()} />)

    await user.click(screen.getByTestId('select-plan-member-10'))
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    await user.type(screen.getByTestId('wizard-plan-name'), 'Fuerza piernas')
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    await user.click(screen.getByTestId('wizard-add-day'))
    expect(screen.getByLabelText('Grupo')).toHaveTextContent('Abductores')
    expect(screen.getByLabelText('Grupo')).toHaveTextContent('Aductores')
    await user.type(screen.getByLabelText('Ejercicio'), 'Sentadilla en prensa')
    await user.selectOptions(screen.getByTestId('wizard-exercise-machine-0-0'), '1')
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByText('Con máquina').parentElement).toHaveTextContent('1')

    await user.click(screen.getByRole('button', { name: /guardar como borrador/i }))

    expect(createCompletePlanMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        member: 10,
        name: 'Fuerza piernas',
        status: 'draft',
        days: [
          expect.objectContaining({
            exercises: [
              expect.objectContaining({
                name: 'Sentadilla en prensa',
                machine: 1,
              }),
            ],
          }),
        ],
      }),
      expect.any(Object),
    )
  })

  it('prefills the recommended machine and muscle group from the catalog', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TrainingPlanWizard open onClose={vi.fn()} />)

    await user.click(screen.getByTestId('select-plan-member-10'))
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.type(screen.getByTestId('wizard-plan-name'), 'Piernas')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.click(screen.getByTestId('wizard-add-day'))
    await user.selectOptions(screen.getByLabelText('Catálogo en español'), '20')

    expect(screen.getByLabelText('Ejercicio')).toHaveValue('Prensa')
    expect(screen.getByLabelText('Grupo')).toHaveValue('quadriceps')
    expect(screen.getByTestId('wizard-exercise-machine-0-0')).toHaveValue('1')
  })

  it('requires assigning an unassigned member before continuing', async () => {
    const user = userEvent.setup()

    renderWithProviders(<TrainingPlanWizard open onClose={vi.fn()} />)

    expect(screen.getByText('Miembros sin asignar encontrados')).toBeInTheDocument()

    await user.click(screen.getByTestId('select-plan-member-11'))

    expect(screen.getByText('Primero asigna este miembro para crearle un plan.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^continuar$/i })).toBeDisabled()

    assignTrainerMutate.mockImplementationOnce((_id: number, options: { onSuccess: (member: unknown) => void }) => {
      options.onSuccess({
        id: 11,
        full_name: 'Derian Isaac',
        email: 'derianisaac.ar@gmail.com',
        photo: null,
        trainer_asignado: 9,
        trainer_asignado_nombre: 'Trainer Demo',
        tiene_plan_activo: false,
        estado_prescripcion: 'sin_plan',
        membresia_actual: { status: 'active' },
      })
    })

    await user.click(screen.getByTestId('wizard-assign-and-continue'))

    expect(assignTrainerMutate).toHaveBeenCalledWith(11, expect.any(Object))
    expect(screen.getByTestId('wizard-plan-name')).toBeInTheDocument()
  })
})
