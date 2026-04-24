import apiClient from '@/shared/api/client'
import type { User, LoginCredentials, RegisterData, UpdateProfileData } from '@/shared/types'

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ user: User; message: string }> => {
    const { data } = await apiClient.post('/auth/login/', credentials)
    return data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout/')
  },

  register: async (data: RegisterData): Promise<{ user: User; message: string }> => {
    const { data: res } = await apiClient.post('/auth/register/', data)
    return res
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get('/auth/me/')
    return data
  },

  updateMe: async (payload: UpdateProfileData): Promise<User> => {
    const { data } = await apiClient.patch('/auth/me/', payload)
    return data
  },

  refreshToken: async (): Promise<void> => {
    await apiClient.post('/auth/token/refresh/')
  },
}
