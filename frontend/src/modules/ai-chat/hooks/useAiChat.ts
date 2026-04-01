import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { aiChatApi } from '../api/aiChatApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'
import type { AIChatRequest, AIChatSendMessageRequest } from '@/shared/types'

export function useAiChatContextQuery(memberId?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.AI_CHAT_CONTEXT(memberId),
    queryFn: () => aiChatApi.context(memberId),
    retry: false,
  })
}

export function useAiChatHistoryQuery(memberId?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.AI_CHAT_HISTORY_BY_MEMBER(memberId),
    queryFn: () => aiChatApi.history(memberId),
    retry: false,
  })
}

export function useAiChatMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AIChatRequest) => aiChatApi.send(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI_CHAT_HISTORY_BY_MEMBER(variables.member_id) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI_CHAT_CONTEXT(variables.member_id) })
      if (!variables.member_id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI_CHAT_HISTORY })
      }
    },
    onError: (error) => {
      toast.error(extractApiError(error))
    },
  })
}

export function useAiChatSendMessageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AIChatSendMessageRequest) => aiChatApi.sendTrainerMessage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS })
      toast.success('Mensaje enviado al member')
    },
    onError: (error) => {
      toast.error(extractApiError(error))
    },
  })
}
