import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { attendanceApi } from '../api/attendanceApi'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'
import { extractApiError } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'

export function useAttendanceQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: QUERY_KEYS.ATTENDANCE_LIST(params),
    queryFn: () => attendanceApi.list(params),
  })
}

export function getTodayAttendanceDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

export function useMemberAttendanceToday(enabled = true) {
  const usuarioId = useAuthStore((state) => state.user?.id)
  const [date, establecerFecha] = useState(getTodayAttendanceDate)

  useEffect(() => {
    const actualizarFecha = () => establecerFecha(getTodayAttendanceDate())
    const proximaMedianoche = Date.parse(`${date}T00:00:00-06:00`) + 86_400_000
    const temporizador = window.setTimeout(actualizarFecha, Math.max(0, proximaMedianoche - Date.now()) + 25)
    window.addEventListener('focus', actualizarFecha)
    document.addEventListener('visibilitychange', actualizarFecha)
    return () => {
      window.clearTimeout(temporizador)
      window.removeEventListener('focus', actualizarFecha)
      document.removeEventListener('visibilitychange', actualizarFecha)
    }
  }, [date])

  const consulta = useQuery({
    queryKey: [...QUERY_KEYS.ATTENDANCE, 'entrada-del-dia', usuarioId, date],
    queryFn: () => attendanceApi.list({ date }),
    enabled: enabled && Boolean(usuarioId),
    staleTime: (query) => query.state.data?.results.some((marca) => marca.attendance_date === date) ? Infinity : 15_000,
    refetchInterval: (query) => enabled && !query.state.data?.results.some((marca) => marca.attendance_date === date) ? 30_000 : false,
    refetchOnWindowFocus: (query) => !query.state.data?.results.some((marca) => marca.attendance_date === date),
  })

  return {
    ...consulta,
    hasCheckedInToday: consulta.data?.results.some((marca) => marca.attendance_date === date) ?? false,
  }
}

export function useCheckInMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload?: { notes?: string; member_id?: number; qr_token?: string; override_reason?: string; trainer_override?: boolean }) => attendanceApi.checkIn(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTENDANCE })
      toast.success('Asistencia registrada. El cliente ya puede abrir su rutina de hoy.')
    },
    onError: (error) => {
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
