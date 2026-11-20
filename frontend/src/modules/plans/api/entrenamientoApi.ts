import apiClient from '@/shared/api/client'
import type { Exercise, WorkoutSession } from '@/shared/types'

export interface OpcionEntrenamiento {
  id: number
  nombre: string
  bloque: string
  descripcion?: string
  ejercicios: Exercise[]
}

export interface EntradaEntrenamiento {
  asistencia_activa: boolean
  sesion: WorkoutSession | null
  plan: OpcionEntrenamiento | null
  rutinas: OpcionEntrenamiento[]
}

export type AccionEntrenamiento = 'comenzar' | 'confirmar_serie' | 'intervalo_terminado' |
  'saltar_descanso' | 'omitir_serie' | 'omitir_ejercicio' | 'pausar' | 'reanudar' | 'finalizar'

export const entrenamientoApi = {
  entrada: async (): Promise<EntradaEntrenamiento> => (await apiClient.get('/api/entrenamiento-cliente/')).data,
  iniciar: async (payload: { workout_day_id: number } | { plantilla_dia_id: number }): Promise<WorkoutSession> =>
    (await apiClient.post('/api/entrenamiento-cliente/', payload)).data,
  accion: async (id: number, payload: { accion: AccionEntrenamiento; revision: number; identificador: string }): Promise<WorkoutSession> =>
    (await apiClient.post(`/api/entrenamiento-cliente/${id}/accion/`, payload)).data,
}
