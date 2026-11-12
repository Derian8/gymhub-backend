import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { attendanceApi } from '../api/attendanceApi'
import { useMemberAttendanceToday } from './useAttendance'

vi.mock('../api/attendanceApi', () => ({ attendanceApi: { list: vi.fn() } }))
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: number } }) => unknown) => selector({ user: { id: 42 } }),
}))

const marca = { count: 1, next: null, previous: null, results: [{ id: 7, attendance_date: '2026-11-12' }] }
const vacio = { count: 0, next: null, previous: null, results: [] }

function prepararConsulta(cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })) {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  return { cliente, ...renderHook(() => useMemberAttendanceToday(), { wrapper }) }
}

describe('Entrada confirmada durante el día', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-12T18:00:00Z'))
    vi.mocked(attendanceApi.list).mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('conserva la marca al volver a montar y deja de consultar cada 30 segundos', async () => {
    vi.mocked(attendanceApi.list).mockResolvedValue(marca as never)
    const primera = prepararConsulta()
    await waitFor(() => expect(primera.result.current.hasCheckedInToday).toBe(true))
    primera.unmount()
    const segunda = prepararConsulta(primera.cliente)
    expect(segunda.result.current.hasCheckedInToday).toBe(true)
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(attendanceApi.list).toHaveBeenCalledTimes(1)
    segunda.unmount()
  })

  it('recupera la misma marca desde el servidor después de una recarga completa', async () => {
    vi.mocked(attendanceApi.list).mockResolvedValue(marca as never)
    const primera = prepararConsulta()
    await waitFor(() => expect(primera.result.current.hasCheckedInToday).toBe(true))
    primera.unmount()
    const recarga = prepararConsulta()
    await waitFor(() => expect(recarga.result.current.hasCheckedInToday).toBe(true))
    expect(attendanceApi.list).toHaveBeenCalledTimes(2)
    expect(attendanceApi.list).toHaveBeenLastCalledWith({ date: '2026-11-12' })
    recarga.unmount()
  })

  it('no pierde una marca confirmada ante un error posterior de red', async () => {
    vi.mocked(attendanceApi.list).mockResolvedValueOnce(marca as never).mockRejectedValueOnce(new Error('Sin conexión'))
    const consulta = prepararConsulta()
    await waitFor(() => expect(consulta.result.current.hasCheckedInToday).toBe(true))
    await act(async () => { await consulta.result.current.refetch() })
    await waitFor(() => expect(consulta.result.current.isError).toBe(true))
    expect(consulta.result.current.hasCheckedInToday).toBe(true)
    consulta.unmount()
  })

  it('cambia de fecha a medianoche de Costa Rica y no reutiliza la marca de ayer', async () => {
    vi.setSystemTime(new Date('2026-11-13T05:59:59.500Z'))
    vi.mocked(attendanceApi.list).mockResolvedValueOnce(marca as never).mockResolvedValue(vacio as never)
    const consulta = prepararConsulta()
    await waitFor(() => expect(consulta.result.current.hasCheckedInToday).toBe(true))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    await waitFor(() => expect(attendanceApi.list).toHaveBeenLastCalledWith({ date: '2026-11-13' }))
    expect(consulta.result.current.hasCheckedInToday).toBe(false)
    consulta.unmount()
  })
})
