import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { attendanceApi } from '../api/attendanceApi'
import { MemberQrCode } from './MemberQrCode'

vi.mock('../api/attendanceApi', () => ({ attendanceApi: { memberQrToken: vi.fn() } }))
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (selector: (estado: { user: { id: number } }) => unknown) => selector({ user: { id: 42 } }),
}))

afterEach(() => { cleanup(); vi.useRealTimers() })

it('mantiene visible el QR sin caducidad y sin renovarlo cada 45 segundos', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(attendanceApi.memberQrToken).mockResolvedValue({
    token: 'd6d5e805-0b7d-4ca3-8cd4-33280a113c46', expires_at: null, expires_in_seconds: null,
  })
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  render(<QueryClientProvider client={cliente}><MemberQrCode /></QueryClientProvider>)
  await waitFor(() => expect(screen.getByRole('img', { name: 'QR de entrada' })).toBeInTheDocument())
  await act(() => vi.advanceTimersByTimeAsync(180_000))
  expect(screen.getByRole('img', { name: 'QR de entrada' })).toBeInTheDocument()
  expect(attendanceApi.memberQrToken).toHaveBeenCalledTimes(1)
  cliente.clear()
})
