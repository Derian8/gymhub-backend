import { fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { NewMemberPage } from './NewMemberPage'

const registerMock = vi.fn()

vi.mock('../hooks/useMembers', () => ({
  useRegisterClientWithPaymentMutation: () => ({
    mutate: registerMock,
    isPending: false,
  }),
  useTrainersQuery: () => ({
    data: [{
      id: 4,
      user: { id: 4, email: 'trainer@test.com', username: 'trainer', first_name: 'Carlos', last_name: 'Mora', role: 'trainer', is_staff: false, memberprofile_id: null, trainerprofile_id: 4 },
      specialization: '', bio: '', certification: '',
    }],
    isLoading: false,
  }),
}))

vi.mock('@/modules/billing/hooks/useBilling', () => ({
  useMembershipPlansQuery: () => ({
    data: {
      results: [{
        id: 8,
        name: 'Mensual',
        description: '',
        price: '25000.00',
        recurrence_type: 'monthly',
        grace_period_days: 7,
        features: '',
        is_active: true,
      }],
    },
    isLoading: false,
  }),
}))

describe('NewMemberPage', () => {
  beforeEach(() => registerMock.mockReset())

  it('envía cliente, membresía de catálogo y pago en una sola operación', () => {
    const view = renderWithProviders(<NewMemberPage />)

    fireEvent.change(view.getByLabelText(/Nombres/), { target: { value: 'Ana' } })
    fireEvent.change(view.getByLabelText(/Apellidos/), { target: { value: 'Solano' } })
    fireEvent.change(view.getByLabelText(/Correo electrónico/), { target: { value: 'ana@test.com' } })
    fireEvent.change(view.getByLabelText(/Teléfono/), { target: { value: '8888-0000' } })
    fireEvent.change(view.getByTestId('assigned-trainer'), { target: { value: '4' } })
    fireEvent.change(view.getByTestId('membership-plan'), { target: { value: '8' } })
    fireEvent.change(view.getByTestId('payment-method'), { target: { value: 'sinpe' } })
    fireEvent.change(view.getByTestId('payment-reference'), { target: { value: 'SINPE-100' } })
    fireEvent.click(view.getByTestId('register-and-pay'))

    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nombres: 'Ana',
        apellidos: 'Solano',
        correo_electronico: 'ana@test.com',
        entrenador: 4,
        tipo_membresia: 'catalogo',
        plan_membresia: 8,
        metodo_pago: 'sinpe',
        referencia_pago: 'SINPE-100',
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('muestra campos comerciales al elegir membresía personalizada', () => {
    const view = renderWithProviders(<NewMemberPage />)

    fireEvent.click(view.getByTestId('membership-custom'))

    expect(view.getByTestId('custom-membership-name')).toBeInTheDocument()
    expect(view.getByTestId('agreed-price')).toBeInTheDocument()
    expect(view.queryByTestId('membership-plan')).not.toBeInTheDocument()
  })
})
