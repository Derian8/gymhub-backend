import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import { QuickRoutineAssignmentModal } from './QuickRoutineAssignmentModal'

const mutate = vi.fn()

vi.mock('../hooks/usePlans', () => ({
  useTrainingTemplatesQuery: () => ({ data: { results: [{ id: 12, nombre: 'Base sencilla', dias: [{ id: 1, nombre: 'Día A', ejercicios: [{ id: 1, nombre: 'Sentadilla' }] }] }] } }),
  useQuickRoutineAssignmentMutation: () => ({ mutate, isPending: false }),
}))

vi.mock('@/modules/members/hooks/useMembers', () => ({
  useTrainersQuery: () => ({ data: [{ id: 3, user: { first_name: 'Laura', last_name: 'Trainer', email: 'laura@test.com' } }] }),
}))

afterEach(() => { cleanup(); mutate.mockReset() })

describe('QuickRoutineAssignmentModal', () => {
  it('previews and submits the selected template', async () => {
    const onClose = vi.fn()
    const view = renderWithProviders(
      <QuickRoutineAssignmentModal
        client={{ member_id: 7, member_name: 'Carlos Cliente', trainer_id: 3, trainer_name: 'Laura Trainer', can_publish: true }}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(view.getByTestId('quick-routine-template')).toHaveValue('12'))
    fireEvent.click(view.getByRole('button', { name: 'Revisar rutina' }))
    expect(view.getByTestId('quick-routine-preview')).toHaveTextContent('Base sencilla')
    fireEvent.click(view.getByTestId('quick-routine-confirm'))

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      member_id: 7,
      trainer_id: 3,
      template_id: 12,
      weeks_duration: 8,
    }), expect.objectContaining({ onSuccess: onClose }))
  })
})
