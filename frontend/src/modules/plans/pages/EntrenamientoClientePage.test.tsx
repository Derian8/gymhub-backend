import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { EntrenamientoClientePage } from './EntrenamientoClientePage'
import { entrenamientoApi, type EntradaEntrenamiento } from '../api/entrenamientoApi'
import type { Exercise, WorkoutSession } from '@/shared/types'

vi.mock('../api/entrenamientoApi', () => ({ entrenamientoApi: { entrada: vi.fn(), iniciar: vi.fn(), accion: vi.fn() } }))
vi.mock('../components/ExerciseVideo', () => ({ ExerciseVideo: () => <div title="Video agregado" /> }))
vi.mock('@/shared/store/authStore', () => ({ useAuthStore: (selector: (estado: unknown) => unknown) => selector({ user: { id: 7 } }) }))

const ejercicio = {
  id: 11, name: 'Press de pecho', exercise_type: 'strength', sets: 3, reps_range: '10',
  rest_seconds: 60, imagen_visual_url: 'https://example.com/press.gif',
  video_url: 'https://youtu.be/abcdefghijk', technique_notes: 'Controla el movimiento.',
} as Exercise
const opcion = { id: 4, nombre: 'Fuerza', bloque: 'Pecho', ejercicios: [ejercicio] }
const entrada = (): EntradaEntrenamiento => ({ asistencia_activa: true, plan: opcion, rutinas: [opcion], sesion: null })
const sesion = (): WorkoutSession => ({
  id: 10, member: 7, workout_day: 4, attendance: 1, started_at: new Date().toISOString(),
  completed_at: null, is_completed: false, overall_feeling: null, trainer_notes: '', origen: 'plan',
  detalle_iniciado: { prescripcion: [ejercicio] },
  progreso_guiado: { revision: 0, indice: 0, fase: 'previa', registros: {}, restante: 0,
    fin_fase: null, pausado: false, ultima_accion: null },
})

function montar() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={cache}><MemoryRouter><EntrenamientoClientePage /></MemoryRouter></QueryClientProvider>)
}

async function abrirPlan() {
  montar()
  fireEvent.click(await screen.findByRole('button', { name: /Seguir mi plan/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar rutina' }))
  await screen.findByRole('button', { name: 'Comenzar ejercicio' })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(entrenamientoApi.entrada).mockResolvedValue(entrada())
  vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(sesion())
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Ejecución del cliente', () => {
  it('bloquea el inicio cuando no hay asistencia abierta', async () => {
    vi.mocked(entrenamientoApi.entrada).mockResolvedValue({ ...entrada(), asistencia_activa: false })
    montar()
    expect(await screen.findByText('Confirma tu entrada para entrenar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar rutina' })).not.toBeInTheDocument()
    expect(entrenamientoApi.iniciar).not.toHaveBeenCalled()
  })

  it('permite elegir rutina libre sin plan y muestra la demostración antes de comenzar', async () => {
    vi.mocked(entrenamientoApi.entrada).mockResolvedValue({ ...entrada(), plan: null })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Realizar rutina libre/ }))
    fireEvent.click(screen.getByRole('button', { name: /Fuerza/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar rutina' }))
    await screen.findByRole('button', { name: 'Comenzar ejercicio' })
    expect(entrenamientoApi.iniciar).toHaveBeenCalledWith({ plantilla_dia_id: 4 })
    expect(screen.getByAltText('Demostración de Press de pecho')).toBeInTheDocument()
    expect(screen.getByTitle('Video agregado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Serie completada' })).not.toBeInTheDocument()
  })

  it('confirma una serie de fuerza y muestra el descanso prescrito', async () => {
    const trabajo = sesion()
    trabajo.progreso_guiado = { ...trabajo.progreso_guiado!, revision: 1, fase: 'trabajo' }
    const descanso = sesion()
    descanso.progreso_guiado = { ...descanso.progreso_guiado!, revision: 2, fase: 'descanso',
      registros: { '11': ['realizado'] }, restante: 60, fin_fase: new Date(Date.now() + 60_000).toISOString() }
    vi.mocked(entrenamientoApi.accion).mockResolvedValueOnce(trabajo).mockResolvedValue(descanso)
    await abrirPlan()
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ejercicio' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Serie completada' }))
    expect(await screen.findByText('Descansa')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('01:00')
    expect(entrenamientoApi.accion).toHaveBeenLastCalledWith(10, expect.objectContaining({ accion: 'confirmar_serie', revision: 1 }))
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('reintenta una respuesta perdida con el mismo identificador', async () => {
    vi.mocked(entrenamientoApi.accion).mockRejectedValueOnce(new Error('Conexión interrumpida'))
      .mockResolvedValue({ ...sesion(), progreso_guiado: { ...sesion().progreso_guiado!, revision: 1, fase: 'trabajo' } })
    await abrirPlan()
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ejercicio' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar guardar' }))
    await screen.findByRole('button', { name: 'Serie completada' })
    const llamadas = vi.mocked(entrenamientoApi.accion).mock.calls
    expect(llamadas[1][1]).toEqual(llamadas[0][1])
  })

  it('al recuperar una sesión con reloj la pausa antes de mostrarla', async () => {
    const activa = sesion()
    activa.progreso_guiado = { ...activa.progreso_guiado!, fase: 'descanso', restante: 40,
      fin_fase: new Date(Date.now() + 40_000).toISOString() }
    vi.mocked(entrenamientoApi.entrada).mockResolvedValue({ ...entrada(), sesion: activa })
    vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(activa)
    vi.mocked(entrenamientoApi.accion).mockResolvedValue({ ...activa, progreso_guiado: {
      ...activa.progreso_guiado!, pausado: true, fin_fase: null, revision: 1,
    } })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar entrenamiento' }))
    expect(await screen.findByRole('button', { name: 'Reanudar' })).toBeInTheDocument()
    expect(entrenamientoApi.accion).toHaveBeenCalledWith(10, expect.objectContaining({ accion: 'pausar' }))
  })

  it('el reloj termina una sola fase y espera la respuesta antes de avanzar', async () => {
    const tiempo = sesion()
    tiempo.detalle_iniciado = { prescripcion: [{ ...ejercicio, exercise_type: 'timed', duracion_trabajo_segundos: 20 }] }
    vi.mocked(entrenamientoApi.iniciar).mockResolvedValue(tiempo)
    await abrirPlan()
    const trabajo = { ...tiempo, progreso_guiado: { ...tiempo.progreso_guiado!, fase: 'trabajo' as const,
      revision: 1, fin_fase: new Date(Date.now() - 1000).toISOString(), restante: 0 } }
    vi.mocked(entrenamientoApi.accion).mockResolvedValueOnce(trabajo)
      .mockImplementation(() => new Promise(() => {}))
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ejercicio' }))
    await waitFor(() => expect(screen.getByRole('timer')).toBeInTheDocument())
    await waitFor(() => expect(entrenamientoApi.accion).toHaveBeenCalledTimes(2))
    expect(entrenamientoApi.accion).toHaveBeenLastCalledWith(10, expect.objectContaining({ accion: 'intervalo_terminado' }))
  })

  it('pausa el entrenamiento al ocultar la página', async () => {
    const trabajo = sesion()
    trabajo.progreso_guiado = { ...trabajo.progreso_guiado!, fase: 'trabajo', revision: 1 }
    vi.mocked(entrenamientoApi.accion).mockResolvedValueOnce(trabajo).mockResolvedValue({
      ...trabajo, progreso_guiado: { ...trabajo.progreso_guiado!, pausado: true, revision: 2 },
    })
    await abrirPlan()
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ejercicio' }))
    await screen.findByRole('button', { name: 'Serie completada' })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    await screen.findByRole('button', { name: 'Reanudar' })
    expect(entrenamientoApi.accion).toHaveBeenLastCalledWith(10, expect.objectContaining({ accion: 'pausar' }))
  })
})
