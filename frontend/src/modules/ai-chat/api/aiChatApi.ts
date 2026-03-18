import apiClient from '@/shared/api/client'
import type { AIChatMessage, AIChatRequest, AIChatResponse } from '@/shared/types'

export const aiChatApi = {
  send: async (payload: AIChatRequest): Promise<AIChatResponse> => {
    const { data } = await apiClient.post('/api/ai-chat/', payload)
    return data
  },

  history: async (): Promise<AIChatMessage[]> => {
    const { data } = await apiClient.get('/api/ai-chat/history/')
    return data
  },
}
