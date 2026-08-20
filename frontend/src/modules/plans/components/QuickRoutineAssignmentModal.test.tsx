import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import { QuickRoutineAssignmentModal } from './QuickRoutineAssignmentModal'

const mutate = vi.fn()
let draftResults: Array<Record<string, unknown>> = []
let draftDetail: Record<string, unknown> | undefined

vi.mock('../hooks/usePlans', () => ({
  useTrainingTemplatesQuery: () => ({ data: { results: [{ id: 12, nombre: 'Base sencilla', dias: [{ id: 1, nombre: 'Día A', ejercicios: [{ id: 1, nombre: 'Sentadilla' }] }] }] } }),
  usePlansQuery: () => ({ data: { results: draftResults } }),
  usePlanDetailQuery: () => ({ data: draftDetail }),
  useQuickRoutineAssignmentMutation: () => ({ mutate, isPending: false }),
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useMemberDetailQuery: () => ({ data: { id: 7, full_name: 'Carlos Cliente', user: {}, trainer_asignado: 3 }, isLoading: false }),
  useTrainersQuery: () => ({ data: [{ id: 3, user: { first_name: 'Laura', last_name: 'Trainer', email: 'laura@test.com' } }] }),
}))

vi.mock('./TrainingPlanWizard', () => ({
  TrainingPlanWizard: () => <div data-testid="training-plan-wizard" />,
}))

afterEach(() => { cleanup(); mutate.mockReset(); draftResults = []; draftDetail = undefined })

describe('QuickRoutineAssignmentModal', () => {
  it('previews and submits the selected template', async () => {
    const onClose = vi.fn()
    const view = renderWithProviders(
      <QuickRoutineAssignmentModal
        client={{ member_id: 7, member_name: 'Carlos Cliente', trainer_id: 3, trainer_name: 'Laura Trainer', can_publish: true }}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(view.getByTestId('quick-routine-template')).toHaveValue('template:12'))
    fireEvent.click(view.getByRole('button', { name: 'Revisar rutina' }))
    expect(view.getByTestId('quick-routine-preview')).toHaveTextContent('Base sencilla')
    fireEvent.click(view.getByTestId('quick-routine-confirm'))

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      member_id: 7,
      trainer_id: 3,
      source_type: 'template',
      template_id: 12,
      weeks_duration: 8,
    }), expect.objectContaining({ onSuccess: onClose }))
  })

  it('allows selecting and publishing a client draft without replacing its content', async () => {
    const onClose = vi.fn()
    draftResults = [{
      id: 44,
      member: 7,
      trainer: 3,
      name: 'Plan fuerza de agosto',
      status: 'draft',
      start_date: '2026-08-19',
      end_date: '2026-10-14',
      weeks_duration: 8,
      workout_days: [{ id: 9, name: 'Día A', exercises: [{ id: 10, name: 'Sentadilla' }] }],
    }]
    draftDetail = draftResults[0]

    const view = renderWithProviders(
      <QuickRoutineAssignmentModal
        client={{ member_id: 7, member_name: 'Carlos Cliente', trainer_id: 3, trainer_name: 'Laura Trainer', can_publish: true }}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(view.getByTestId('quick-routine-template')).toHaveValue('draft:44'))
    fireEvent.click(view.getByRole('button', { name: 'Revisar rutina' }))
    expect(view.getByTestId('quick-routine-preview')).toHaveTextContent('Plan fuerza de agosto')
    fireEvent.click(view.getByTestId('quick-routine-confirm'))

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      member_id: 7,
      source_type: 'draft',
      plan_id: 44,
      start_date: '2026-08-19',
      weeks_duration: 8,
    }), expect.objectContaining({ onSuccess: onClose }))
  })

  it('shows historical plans as reusable copies', async () => {
    const onClose = vi.fn()
    draftResults = [{
      id: 55,
      member: 7,
      trainer: 3,
      name: 'Plan finalizado',
      status: 'finished',
      start_date: '2026-06-19',
      end_date: '2026-08-14',
      weeks_duration: 8,
    }]

    const view = renderWithProviders(
      <QuickRoutineAssignmentModal
        client={{ member_id: 7, member_name: 'Carlos Cliente', trainer_id: 3, trainer_name: 'Laura Trainer', can_publish: true }}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(view.getByTestId('quick-routine-template')).toHaveValue('plan:55'))
    fireEvent.click(view.getByRole('button', { name: 'Revisar rutina' }))
    fireEvent.click(view.getByTestId('quick-routine-confirm'))

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      source_type: 'plan',
      plan_id: 55,
    }), expect.objectContaining({ onSuccess: onClose }))
  })

  it('opens the complete wizard for a plan created from scratch', () => {
    const view = renderWithProviders(
      <QuickRoutineAssignmentModal
        client={{ member_id: 7, member_name: 'Carlos Cliente', trainer_id: 3, trainer_name: 'Laura Trainer', can_publish: true }}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(view.getByTestId('quick-routine-create-from-scratch'))
    expect(view.getByTestId('training-plan-wizard')).toBeInTheDocument()
  })
})
