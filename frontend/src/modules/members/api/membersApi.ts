import apiClient from '@/shared/api/client'
import type {
  ActivePrescription,
  MemberProfile,
  MemberDashboardSummary,
  PrescriptionSummary,
  TrainerOverview,
  PaginatedResponse,
} from '@/shared/types'

interface MembersParams {
  assignment?: 'mine' | 'unassigned' | 'available'
  search?: string
  payment_status?: string
  inactivity?: string
  risk_level?: string
  prescription_status?: string
  ordering?: string
  page?: number
}

export const membersApi = {
  create: async (payload: {
    nombres: string
    apellidos: string
    correo_electronico: string
    telefono: string
    fecha_nacimiento?: string
    contacto_emergencia?: string
  }): Promise<{ member: MemberProfile; contrasena_temporal: string; message: string }> => {
    const { data } = await apiClient.post('/api/members/', payload)
    return data
  },

  temporaryPassword: async (id: number): Promise<{ contrasena_temporal: string; message: string }> => {
    const { data } = await apiClient.post(`/api/members/${id}/temporary-password/`)
    return data
  },

  deactivate: async (id: number, reason: string): Promise<MemberProfile> => {
    const { data } = await apiClient.post(`/api/members/${id}/deactivate/`, { reason })
    return data
  },

  reactivate: async (id: number): Promise<MemberProfile> => {
    const { data } = await apiClient.post(`/api/members/${id}/reactivate/`)
    return data
  },
  list: async (params?: MembersParams): Promise<PaginatedResponse<MemberProfile>> => {
    const { data } = await apiClient.get('/api/members/', { params })
    return data
  },

  detail: async (id: number): Promise<MemberProfile> => {
    const { data } = await apiClient.get(`/api/members/${id}/`)
    return data
  },

  dashboardSummary: async (id: number): Promise<MemberDashboardSummary> => {
    const { data } = await apiClient.get(`/api/members/${id}/dashboard-summary/`)
    return data
  },

  prescriptionSummary: async (id: number): Promise<PrescriptionSummary> => {
    const { data } = await apiClient.get(`/api/members/${id}/prescription-summary/`)
    return data
  },

  activePrescription: async (id: number): Promise<ActivePrescription> => {
    const { data } = await apiClient.get(`/api/members/${id}/active-prescription/`)
    return data
  },

  activate: async (id: number): Promise<{ message: string; member: MemberProfile }> => {
    const { data } = await apiClient.post(`/api/members/${id}/activate/`)
    return data
  },

  assignTrainer: async (id: number): Promise<MemberProfile> => {
    const { data } = await apiClient.post(`/api/members/${id}/assign-trainer/`)
    return data
  },

  progressByExercise: async (memberId: number, exerciseId: number) => {
    const { data } = await apiClient.get(`/api/members/${memberId}/progress-by-exercise/${exerciseId}/`)
    return data
  },

  trainerOverview: async (): Promise<TrainerOverview> => {
    const { data } = await apiClient.get('/api/trainer/gym-overview/')
    return data
  },

  update: async (id: number, payload: Partial<MemberProfile>): Promise<MemberProfile> => {
    const { data } = await apiClient.patch(`/api/members/${id}/`, payload)
    return data
  },
}
