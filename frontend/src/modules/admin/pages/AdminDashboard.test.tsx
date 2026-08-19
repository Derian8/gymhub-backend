import { cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import { AdminDashboard } from './AdminDashboard'

vi.mock('../hooks/useAdminReport', () => ({
  useAdminDashboard: () => ({
    isLoading: false,
    data: {
      generated_at: '2026-08-14T10:00:00Z',
      commercial: {
        current_clients: 18,
        current_clients_pct: 75,
        active_clients: 24,
        collected_this_month: '425000',
        due_soon_count: 2,
        due_soon_amount: '50000',
        overdue_count: 1,
        overdue_amount: '25000',
      },
      payments: {
        overdue: [{ payment_id: 8, member_id: 4, member_name: 'Ana Mora', amount: '25000', due_date: '2026-08-10', days_overdue: 4, days_until_due: 0 }],
        due_soon: [{ payment_id: 9, member_id: 5, member_name: 'Luis Próximo', amount: '25000', due_date: '2026-08-16', days_overdue: 0, days_until_due: 2 }],
        current: [{ member_id: 6, member_name: 'Marta Al Día', access_allowed: true }],
      },
      training: {
        without_routine_count: 1,
        without_routine: [{ member_id: 7, member_name: 'Carlos Sin Rutina', trainer_id: 3, trainer_name: 'Trainer Uno', can_publish: true }],
        ending_soon_count: 1,
        ending_soon: [{ member_id: 8, member_name: 'Sofía Renovación', trainer_id: 3, trainer_name: 'Trainer Uno', can_publish: true, plan_id: 10, plan_name: 'Base', end_date: '2026-08-20', days_until_end: 6 }],
      },
    },
  }),
}))

vi.mock('@/modules/plans/components/QuickRoutineAssignmentModal', () => ({
  QuickRoutineAssignmentModal: ({ client }: { client: { member_name: string } | null }) => client ? <div data-testid="routine-modal">{client.member_name}</div> : null,
}))

afterEach(cleanup)

describe('AdminDashboard', () => {
  it('prioritizes current clients and payment queues', () => {
    const view = renderWithProviders(<AdminDashboard />)

    expect(view.getByText('Clientes activos')).toBeInTheDocument()
    expect(view.getByText('24')).toBeInTheDocument()
    expect(view.getByText('Clientes al día')).toBeInTheDocument()
    expect(view.getByText('18')).toBeInTheDocument()
    expect(view.getByText('Pendientes por cobrar')).toBeInTheDocument()
    expect(view.getByText('Cobros vencidos')).toBeInTheDocument()
    expect(view.getByText('Cobrado este mes')).toBeInTheDocument()
    expect(view.getByTestId('admin-register-and-charge')).toHaveClass('w-full', 'flex')
    expect(view.getByRole('link', { name: 'Clientes activos: 24' })).toHaveAttribute('href', '/members')
    expect(view.getByRole('link', { name: 'Clientes al día: 18' })).toHaveAttribute('href', '/members?commercial_status=al_dia')
    expect(view.getByRole('link', { name: 'Pendientes por cobrar: 2' })).toHaveAttribute('href', '/members?payment_status=pending')
    expect(view.getByRole('link', { name: 'Cobros vencidos: 1' })).toHaveAttribute('href', '/members?payment_status=late')
    expect(view.getAllByText('Ver detalle →')).toHaveLength(4)
    expect(view.queryByText('Pantallas activas')).not.toBeInTheDocument()
    expect(view.queryByRole('link', { name: /Gestionar clientes/ })).not.toBeInTheDocument()
    expect(view.queryByRole('link', { name: /Cartera y cobros/ })).not.toBeInTheDocument()
    expect(view.queryByRole('link', { name: /Entradas al gym/ })).not.toBeInTheDocument()
    expect(view.getByText('Ana Mora')).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Registrar pago' })).toHaveAttribute('href', '/billing?member=4')

    fireEvent.click(view.getByRole('tab', { name: /Próximos/ }))
    expect(view.getByText('Luis Próximo')).toBeInTheDocument()

    fireEvent.click(view.getByRole('tab', { name: /Al día/ }))
    expect(view.getByText('Marta Al Día')).toBeInTheDocument()
  })

  it('opens quick routine assignment from both technical queues', () => {
    const view = renderWithProviders(<AdminDashboard />)

    fireEvent.click(view.getByRole('button', { name: 'Asignar rutina' }))
    expect(view.getByTestId('routine-modal')).toHaveTextContent('Carlos Sin Rutina')
  })
})
