import apiClient from '@/shared/api/client'
import type {
  AIChatContext,
  AIChatMessage,
  AIChatRequest,
  AIChatResponse,
  AIChatSendMessageRequest,
  AIChatSendMessageResponse,
} from '@/shared/types'

export const aiChatApi = {
  send: async (payload: AIChatRequest): Promise<AIChatResponse> => {
    const { data } = await apiClient.post('/api/ai-chat/', payload)
    return data
  },

  history: async (memberId?: number): Promise<AIChatMessage[]> => {
    const { data } = await apiClient.get('/api/ai-chat/history/', {
      params: memberId ? { member_id: memberId } : undefined,
    })
    return data
  },

  context: async (memberId?: number): Promise<AIChatContext> => {
    const { data } = await apiClient.get('/api/ai-chat/context/', {
      params: memberId ? { member_id: memberId } : undefined,
    })
    return data
  },

  sendTrainerMessage: async (payload: AIChatSendMessageRequest): Promise<AIChatSendMessageResponse> => {
    const { data } = await apiClient.post('/api/ai-chat/send-message/', payload)
    return data
  },
}
