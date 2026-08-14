import apiClient, { BASE_URL } from '@/shared/api/client'
import type { AdminDashboardOverview, AdminReportOverview, User } from '@/shared/types'

export interface ReportFilters {
  fecha_inicio: string
  fecha_fin: string
}

export const adminApi = {
  dashboard: async (): Promise<AdminDashboardOverview> => {
    const { data } = await apiClient.get('/api/admin/dashboard/')
    return data
  },
  users: async (): Promise<User[]> => {
    const { data } = await apiClient.get('/api/admin/users/')
    return data
  },
  enableClientProfile: async (trainerId: number, payload: {
    entrenador_asignado: number
    telefono?: string
    plan_membresia: number
    tipo_membresia: 'catalogo'
    precio_acordado?: string
    renovacion_automatica: boolean
    metodo_pago: 'cash' | 'sinpe' | 'transfer' | 'other'
    referencia_pago?: string
  }) => {
    const { data } = await apiClient.post(`/api/trainers/${trainerId}/enable-client-profile/`, payload)
    return data
  },
  report: async (filters: ReportFilters): Promise<AdminReportOverview> => {
    const { data } = await apiClient.get('/api/admin/reports/overview/', { params: filters })
    return data
  },
  saveCollectionFollowUp: async (payload: {
    id: number | null
    cliente: number
    estado: 'nuevo' | 'en_seguimiento' | 'resuelto' | 'baja'
    nota?: string
  }) => {
    const body = { cliente: payload.cliente, estado: payload.estado, nota: payload.nota || '' }
    const { data } = payload.id
      ? await apiClient.patch(`/api/collection-follow-ups/${payload.id}/`, body)
      : await apiClient.post('/api/collection-follow-ups/', body)
    return data
  },
  exportUrl: (filters: ReportFilters, formato: 'pdf' | 'csv', seccion?: 'pagos' | 'accesos') => {
    const params = new URLSearchParams({ ...filters, formato })
    if (seccion) params.set('seccion', seccion)
    return `${BASE_URL}/api/admin/reports/export/?${params.toString()}`
  },
}
