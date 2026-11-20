import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { WorkoutHistoryPage } from './WorkoutHistoryPage'
import { progressApi } from '../api/progressApi'
import type { WorkoutSession } from '@/shared/types'

vi.mock('../api/progressApi', () => ({ progressApi: { sessionsForMonth: vi.fn() } }))
vi.mock('@/shared/store/authStore', () => ({ useAuthStore: (selector: (estado: unknown) => unknown) => selector({ user: { memberprofile_id: 7 } }) }))

describe('Historial de ejecución por series', () => {
  it('muestra rutina libre y conserva el detalle de las series parciales', async () => {
    vi.mocked(progressApi.sessionsForMonth).mockResolvedValue([{
      id: 5, member: 7, workout_day: null, attendance: 1, origen: 'libre',
      started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      is_completed: true, motivo_cierre: 'anticipada', overall_feeling: null, trainer_notes: '',
      workout_day_name: 'Fuerza libre', plan_name: 'Biblioteca', exercise_logs: [],
      detalle_iniciado: { ejercicios: [{ id: 12, nombre: 'Sentadilla', series: 3, repeticiones: '10', tipo: 'strength' }] },
      progreso_guiado: { revision: 4, indice: 0, fase: 'terminado', registros: { '12': ['realizado', 'omitido', 'omitido'] },
        restante: 0, fin_fase: null, pausado: false, ultima_accion: null },
    } satisfies WorkoutSession])
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={cache}><MemoryRouter><WorkoutHistoryPage /></MemoryRouter></QueryClientProvider>)
    const tarjeta = await screen.findByTestId('history-session-5')
    expect(tarjeta).toHaveTextContent('Rutina libre · 0 realizados · 0 omitidos · 1 parciales')
    expect(tarjeta).toHaveTextContent('Sentadilla · Parcial')
    expect(tarjeta).toHaveTextContent('1/3 series realizadas')
  })
})
