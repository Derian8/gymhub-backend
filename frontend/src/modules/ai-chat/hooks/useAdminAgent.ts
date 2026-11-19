import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { aiChatApi } from '../api/aiChatApi'
import { extractApiError } from '@/shared/lib/utils'
import type { AgenteAdministracionRequest } from '@/shared/types'

export function useAdminAgentMutation() {
  return useMutation({
    mutationFn: (payload: AgenteAdministracionRequest) => aiChatApi.adminAgent(payload),
    onError: (error) => toast.error(extractApiError(error)),
  })
}
