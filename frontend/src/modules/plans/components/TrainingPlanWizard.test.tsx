import { renderWithProviders } from '@/test/utils'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrainingPlanWizard } from './TrainingPlanWizard'

const createCompletePlanMutate = vi.fn()

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
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMembersQuery: () => ({
    data: {
      count: 1,
      results: [
        {
          id: 10,
          full_name: 'Derian Campos',
          email: 'derian@test.com',
          photo: null,
          tiene_plan_activo: false,
          estado_prescripcion: 'sin_plan',
          membresia_actual: { status: 'active' },
        },
      ],
    },
    isLoading: false,
  }),
}))

describe('TrainingPlanWizard', () => {
  beforeEach(() => {
    createCompletePlanMutate.mockReset()
  })

  it('allows assigning a gym machine to an exercise from the general plan flow', async () => {
    const user = userEvent.setup()

    renderWithProviders(<TrainingPlanWizard open onClose={vi.fn()} />)

    await user.click(screen.getByTestId('select-plan-member-10'))
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    await user.type(screen.getByTestId('wizard-plan-name'), 'Fuerza piernas')
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    await user.click(screen.getByTestId('wizard-add-day'))
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
})
