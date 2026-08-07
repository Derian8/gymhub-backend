import { renderWithProviders } from '@/test/utils'
import { PlanEditorPage } from './PlanEditorPage'

vi.mock('@/modules/members/pages/TrainerProgramPage', () => ({
  TrainerProgramPage: ({ memberIdOverride, planIdOverride, plansContext }: {
    memberIdOverride: number
    planIdOverride: number
    plansContext: boolean
  }) => (
    <div
      data-testid="plan-editor"
      data-member-id={memberIdOverride}
      data-plan-id={planIdOverride}
      data-plans-context={String(plansContext)}
    />
  ),
}))

vi.mock('../hooks/usePlans', () => ({
  usePlanDetailQuery: () => ({
    data: {
      id: 12,
      member: 15,
      trainer: 3,
      name: 'Fuerza base',
      goal: 'muscle_gain',
      start_date: '2026-07-01',
      end_date: '2026-08-26',
      weeks_duration: 8,
      days_per_week: 4,
      is_active: false,
      status: 'draft',
    },
    isLoading: false,
  }),
  usePlansQuery: () => ({ data: { results: [] }, isLoading: false }),
}))

describe('PlanEditorPage', () => {
  it('opens the requested plan in the canonical plans editor', () => {
    const { getByTestId } = renderWithProviders(<PlanEditorPage />, {
      route: '/plans/12/edit',
      path: '/plans/:id/edit',
    })

    expect(getByTestId('plan-editor')).toHaveAttribute('data-plan-id', '12')
    expect(getByTestId('plan-editor')).toHaveAttribute('data-member-id', '15')
    expect(getByTestId('plan-editor')).toHaveAttribute('data-plans-context', 'true')
  })
})
