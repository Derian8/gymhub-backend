import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Dumbbell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { progressApi } from '../api/progressApi'
import { EmptyState, PageHeader } from '@/shared/components/UI'
import { useAuthStore } from '@/shared/store/authStore'
import { formatDate } from '@/shared/lib/utils'
import type { WorkoutSession } from '@/shared/types'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function WorkoutHistoryPage() {
  const user = useAuthStore((state) => state.user)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()))
  const key = monthKey(month)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workout-sessions', 'calendar', user?.memberprofile_id, key],
    queryFn: () => progressApi.sessionsForMonth(key),
    enabled: !!user?.memberprofile_id,
  })
  const sessions = data ?? []
  const grouped = useMemo(() => {
    const result = new Map<string, WorkoutSession[]>()
    for (const session of sessions) {
      const date = dateKey(new Date(session.started_at))
      result.set(date, [...(result.get(date) ?? []), session])
    }
    return result
  }, [sessions])

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((mondayOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - mondayOffset + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })
  const selectedSessions = grouped.get(selectedDay) ?? []

  return (
    <div className="page-enter mx-auto max-w-5xl" data-testid="workout-history-page">
      <PageHeader title="Historial" subtitle="Tus entrenamientos organizados por fecha." />
      <section className="card p-4 sm:p-6" aria-label="Calendario de entrenamientos">
        <div className="mb-5 flex items-center justify-between">
          <button type="button" className="btn-secondary !p-2" aria-label="Mes anterior" onClick={() => { const next = new Date(month.getFullYear(), month.getMonth() - 1, 1); setMonth(next); setSelectedDay(dateKey(next)) }}><ChevronLeft size={20} /></button>
          <h2 className="font-heading text-lg font-bold capitalize text-neutral-900 dark:text-white">{new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(month)}</h2>
          <button type="button" className="btn-secondary !p-2" aria-label="Mes siguiente" onClick={() => { const next = new Date(month.getFullYear(), month.getMonth() + 1, 1); setMonth(next); setSelectedDay(dateKey(next)) }}><ChevronRight size={20} /></button>
        </div>
        {isLoading ? <div className="grid grid-cols-7 gap-2" aria-label="Cargando historial">{Array.from({ length: 35 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />)}</div> : isError ? <EmptyState icon={<CalendarDays size={32} />} title="No se pudo cargar el historial" description="Intenta de nuevo más tarde." /> : (
          <>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {DIAS.map((day) => <div key={day} className="py-2 text-center text-xs font-semibold text-neutral-500">{day}</div>)}
              {cells.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} aria-hidden="true" />
                const current = new Date(month.getFullYear(), month.getMonth(), day)
                const id = dateKey(current)
                const daySessions = grouped.get(id) ?? []
                return <button key={id} type="button" onClick={() => setSelectedDay(id)} aria-label={`${day} ${key}${daySessions.length ? `, ${daySessions.length} entrenamientos` : ''}`} aria-pressed={selectedDay === id} className={`flex min-h-14 flex-col items-center justify-center rounded-xl border text-sm ${selectedDay === id ? 'border-primary bg-primary/10 text-primary' : 'border-neutral-200 text-neutral-800 dark:border-neutral-800 dark:text-neutral-200'}`}><span>{day}</span>{daySessions.length > 0 && <span className="mt-1 flex gap-1" aria-label={`${daySessions.length} entrenamientos`}>{daySessions.slice(0, 3).map((session) => <span key={session.id} className={`h-1.5 w-1.5 rounded-full ${session.is_completed ? 'bg-emerald-500' : 'bg-amber-500'}`} />)}</span>}</button>
              })}
            </div>
            <p className="mt-3 text-xs text-neutral-500">Verde: completado · Ámbar: en progreso</p>
          </>
        )}
      </section>
      {!isLoading && !isError && <section className="mt-5" aria-live="polite"><h2 className="mb-3 font-heading text-lg font-bold">Entrenamientos del {formatDate(`${selectedDay}T12:00:00`)}</h2>{selectedSessions.length === 0 ? <EmptyState icon={<Dumbbell size={30} />} title="Sin entrenamientos" description="No hay sesiones registradas para este día." /> : <div className="space-y-3">{selectedSessions.map((session) => <article key={session.id} className="card p-4" data-testid={`history-session-${session.id}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-neutral-900 dark:text-white">{session.workout_day_name || 'Entrenamiento'}</h3><p className="text-sm text-neutral-500">{session.plan_name || 'Plan asignado'} · {formatDate(session.started_at)}</p></div><span className={session.is_completed ? 'text-sm font-medium text-emerald-600' : 'text-sm font-medium text-amber-600'}>{session.is_completed ? 'Completado' : 'En progreso'}</span></div>{session.overall_feeling && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Sensación: {session.overall_feeling}/5</p>}<ul className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">{session.exercise_logs?.map((log) => <li key={log.id}>{log.exercise_name || `Ejercicio ${log.exercise}`} · {log.estado === 'omitido' ? 'Omitido' : 'Realizado'}</li>)}</ul></article>)}</div>}</section>}
    </div>
  )
}
