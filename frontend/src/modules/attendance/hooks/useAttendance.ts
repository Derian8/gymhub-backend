import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { attendanceApi } from '../api/attendanceApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'

export function useAttendanceQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.ATTENDANCE_LIST(params),
    queryFn: () => attendanceApi.list(params),
  })
}

export function useCheckInMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notes?: string) => attendanceApi.checkIn(notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTENDANCE })
      toast.success('Check-in registrado exitosamente')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}
