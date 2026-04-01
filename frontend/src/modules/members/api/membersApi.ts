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
  search?: string
  payment_status?: string
  inactivity?: string
  risk_level?: string
  prescription_status?: string
  ordering?: string
  page?: number
}

export const membersApi = {
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

  activate: async (id: number, payload?: { plan_id?: number; agreed_price?: number }): Promise<{ message: string; member: MemberProfile }> => {
    const { data } = await apiClient.post(`/api/members/${id}/activate/`, {
      membership_plan_id: payload?.plan_id,
      plan_id: payload?.plan_id,
      agreed_price: payload?.agreed_price,
    })
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
