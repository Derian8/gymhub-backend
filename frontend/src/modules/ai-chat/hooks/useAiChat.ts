import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { aiChatApi } from '../api/aiChatApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'

export function useAiChatHistoryQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.AI_CHAT_HISTORY,
    queryFn: aiChatApi.history,
  })
}

export function useAiChatMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: aiChatApi.send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI_CHAT_HISTORY })
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}
