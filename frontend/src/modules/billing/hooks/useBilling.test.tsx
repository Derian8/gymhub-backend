import { useEffect, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { billingApi } from '../api/billingApi'
import { useCreateMemberSubscriptionMutation, useMarkPaymentAsPaidMutation } from './useBilling'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { toast } from 'sonner'

vi.mock('../api/billingApi', () => ({
  billingApi: {
    createMemberSubscription: vi.fn(),
    markPaymentAsPaid: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function renderMutation(ui: ReactElement, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  )
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function CreateSubscriptionHarness({ memberId }: { memberId: number }) {
  const mutation = useCreateMemberSubscriptionMutation(memberId)

  useEffect(() => {
    mutation.mutate({
      member: memberId,
      membership_name: 'Mensual personalizada',
      agreed_price: '72.00',
      start_date: '2026-07-13',
    })
  }, [memberId])

  return <div>Crear membresia</div>
}

function MarkPaymentPaidHarness({ memberId }: { memberId: number }) {
  const mutation = useMarkPaymentAsPaidMutation(memberId)

  useEffect(() => {
    mutation.mutate({
      id: 80,
      payload: {
        payment_reference: 'SINPE-1',
        notes: 'Primer cobro',
      },
    })
  }, [])

  return <div>Pagar membresia</div>
}

function expectMembershipInvalidations(invalidateSpy: unknown, memberId: number) {
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.MEMBER_SUBSCRIPTIONS_ALL })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.PAYMENT_SCHEDULES_ALL })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.PAYMENT_RECORDS_ALL })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.MEMBERS })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.TRAINER_OVERVIEW })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.MEMBER_DETAIL(memberId) })
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.MEMBER_DASHBOARD(memberId) })
}

describe('useBilling membership invalidations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refreshes member portfolio and billing views after creating a subscription', async () => {
    vi.mocked(billingApi.createMemberSubscription).mockResolvedValue({ id: 90 } as never)
    const queryClient = makeQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderMutation(<CreateSubscriptionHarness memberId={15} />, queryClient)

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Suscripción y primer cobro creados'))
    expectMembershipInvalidations(invalidateSpy, 15)
  })

  it('refreshes member membership state after marking the first payment as paid', async () => {
    vi.mocked(billingApi.markPaymentAsPaid).mockResolvedValue({ id: 80, status: 'paid' } as never)
    const queryClient = makeQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderMutation(<MarkPaymentPaidHarness memberId={15} />, queryClient)

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pago registrado y recibo emitido'))
    expectMembershipInvalidations(invalidateSpy, 15)
  })
})
