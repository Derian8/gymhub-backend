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
    mutationFn: (payload?: { notes?: string; member_id?: number; override_reason?: string; trainer_override?: boolean }) => attendanceApi.checkIn(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTENDANCE })
      toast.success('Check-in registrado exitosamente')
    },
    onError: (error) => {
      const data = (error as { response?: { data?: unknown } })?.response?.data as { blocked?: boolean } | undefined
      if (data?.blocked) {
        return
      }
      toast.error(extractApiError(error))
    },
  })
}

export function useOpenRoutineMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: attendanceApi.openRoutine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTENDANCE })
      toast.success('Entrada registrada. Tu rutina está disponible.')
    },
  })
}

export function useCheckOutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (attendanceId: number) => attendanceApi.checkOut(attendanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTENDANCE })
      toast.success('Salida registrada exitosamente')
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
}
