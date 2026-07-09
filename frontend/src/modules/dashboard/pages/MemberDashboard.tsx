import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Dumbbell,
  Loader2,
  Play,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/shared/store/authStore'
import { useMemberActivePrescriptionQuery, useMemberDashboardQuery } from '@/modules/members/hooks/useMembers'
import { useWeeklyPlanQuery, useCreateSessionMutation, useCompleteSessionMutation, useBulkExerciseLogsMutation } from '@/modules/plans/hooks/usePlans'
import { Badge, EmptyState, PageHeader } from '@/shared/components/UI'
import { StatCardSkeleton } from '@/shared/components/Skeleton'
import { SymbolFrame } from '@/shared/components/Brand'
import { cn, DAY_OF_WEEK_LABELS, formatDate, MUSCLE_LABELS } from '@/shared/lib/utils'
import type { Exercise, ExerciseLogPayload } from '@/shared/types'

interface ExerciseProgressDraft {
  done: boolean
  weight_used_kg?: number
  rpe?: number
  minutes_completed?: number
}

const weekdayOrder: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
}

function getExercisePrescriptionLabel(exercise: Exercise) {
  if (exercise.exercise_type === 'timed') {
    return `${exercise.target_minutes ?? 0} min`
  }
  return `${exercise.sets ?? 0}x${exercise.reps_range}`
}

export function MemberDashboard() {
  const { user } = useAuthStore()
  const memberId = user?.memberprofile_id || 0
  const { data, isLoading } = useMemberDashboardQuery(memberId)
  const { data: activePrescription } = useMemberActivePrescriptionQuery(memberId)
  const activePlanId = activePrescription?.plan_activo?.id || 0
  const { data: weeklyView } = useWeeklyPlanQuery(activePlanId)

  const todayWorkout = activePrescription?.entrenamiento_hoy ?? null
  const weeklyDays = useMemo(
    () => [...(activePrescription?.dias || [])].sort((a, b) => (weekdayOrder[a.day_of_week] ?? 99) - (weekdayOrder[b.day_of_week] ?? 99) || a.order - b.order),
    [activePrescription?.dias],
  )

  const { mutate: createSession, isPending: isCreatingSession } = useCreateSessionMutation()
  const { mutate: completeSession, isPending: isCompletingSession } = useCompleteSessionMutation()
  const { mutate: bulkLogs, isPending: isSavingLogs } = useBulkExerciseLogsMutation()
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionCompletedToday, setSessionCompletedToday] = useState(false)
  const [overallFeeling, setOverallFeeling] = useState(4)
  const [exerciseDrafts, setExerciseDrafts] = useState<Record<number, ExerciseProgressDraft>>({})

  const initializeDrafts = (workoutDay: { exercises: Exercise[] }) => {
    const nextDrafts: Record<number, ExerciseProgressDraft> = {}
    workoutDay.exercises.forEach((exercise) => {
      nextDrafts[exercise.id] = exercise.exercise_type === 'timed'
        ? {
            done: false,
            minutes_completed: exercise.target_minutes ?? 0,
          }
        : {
            done: false,
            weight_used_kg: exercise.weight_suggestion_kg ?? 0,
            rpe: 7,
          }
    })
    setExerciseDrafts(nextDrafts)
  }

  useEffect(() => {
    if (!todayWorkout?.id) {
      setSessionId(null)
      setSessionStarted(false)
      setSessionCompletedToday(false)
      setExerciseDrafts({})
      return
    }

    if (todayWorkout.today_session_completed) {
      setSessionId(todayWorkout.today_session_id)
      setSessionStarted(false)
      setSessionCompletedToday(true)
      return
    }

    if (todayWorkout.today_session_started && todayWorkout.today_session_id) {
      setSessionId(todayWorkout.today_session_id)
      setSessionStarted(true)
      setSessionCompletedToday(false)
      setExerciseDrafts((current) => {
        if (Object.keys(current).length) {
          return current
        }
        const nextDrafts: Record<number, ExerciseProgressDraft> = {}
        todayWorkout.exercises.forEach((exercise) => {
          nextDrafts[exercise.id] = exercise.exercise_type === 'timed'
            ? { done: false, minutes_completed: exercise.target_minutes ?? 0 }
            : { done: false, weight_used_kg: exercise.weight_suggestion_kg ?? 0, rpe: 7 }
        })
        return nextDrafts
      })
      return
    }

    setSessionCompletedToday(false)
  }, [
    todayWorkout?.id,
    todayWorkout?.today_session_id,
    todayWorkout?.today_session_completed,
    todayWorkout?.today_session_started,
    todayWorkout?.exercises,
  ])

  const handleStartWorkout = () => {
    if (!todayWorkout || sessionCompletedToday) {
      return
    }
    createSession(
      { workout_day_id: todayWorkout.id },
      {
        onSuccess: (session) => {
          setSessionId(session.id)
          setSessionStarted(true)
          setSessionCompletedToday(false)
          initializeDrafts(todayWorkout)
        },
      },
    )
  }

  const updateDraft = (exerciseId: number, patch: Partial<ExerciseProgressDraft>) => {
    setExerciseDrafts((current) => ({
      ...current,
      [exerciseId]: { ...current[exerciseId], ...patch },
    }))
  }

  const handleCompleteWorkout = () => {
    if (!sessionId || !todayWorkout) {
      return
    }

    const logs = todayWorkout.exercises
      .map<ExerciseLogPayload | null>((exercise) => {
        const draft = exerciseDrafts[exercise.id]
        if (!draft?.done) {
          return null
        }
        if (exercise.exercise_type === 'timed') {
          return {
            exercise_id: exercise.id,
            minutes_completed: draft.minutes_completed ?? exercise.target_minutes ?? 0,
          }
        }
        return {
          exercise_id: exercise.id,
          weight_used_kg: draft.weight_used_kg,
          rpe: draft.rpe,
        }
      })
      .filter((item): item is ExerciseLogPayload => item !== null)

    if (!logs.length) {
      toast.error('Marca al menos un ejercicio como realizado antes de cerrar la sesión.')
      return
    }

    bulkLogs(
      { session_id: sessionId, logs },
      {
        onSuccess: () => {
          completeSession(
            { sessionId, payload: { overall_feeling: overallFeeling } },
            {
              onSuccess: () => {
                setSessionStarted(false)
                setSessionCompletedToday(true)
                setExerciseDrafts({})
              },
            },
          )
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="page-enter">
        <PageHeader title="Mi cabina de entrenamiento" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  const membershipBadge = data?.payment_status === 'paid'
    ? { variant: 'success' as const, label: 'Membresía vigente' }
    : data?.payment_status === 'late'
      ? { variant: 'error' as const, label: 'Membresía vencida' }
      : { variant: 'warning' as const, label: 'Pago pendiente' }
  const membershipTone = data?.payment_status === 'paid' ? 'success' : data?.payment_status === 'late' ? 'danger' : 'warning'
  const membershipHelp = data?.payment_status === 'paid'
    ? (data.days_until_due != null ? `${data.days_until_due} día(s) restantes antes del próximo vencimiento.` : 'Tu acceso comercial está al día.')
    : data?.payment_status === 'late'
      ? (data.days_overdue != null ? `${data.days_overdue} día(s) de atraso. Contacta al gym o registra el pago para regularizarla.` : 'Hay un cobro vencido pendiente.')
      : (data?.days_until_due != null ? `${data.days_until_due} día(s) para completar el pago.` : 'Consulta con tu entrenador si necesitas actualizar la membresía.')

  const todayCabin = (
    <div className="card p-6" data-testid="member-today-cabin">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className="label-base">Bloque del día</p>
          <h3 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
            {todayWorkout ? `Hoy toca: ${DAY_OF_WEEK_LABELS[weeklyDays.find((day) => day.id === todayWorkout.id)?.day_of_week || 'mon']} · ${todayWorkout.name}` : 'Hoy no toca bloque activo'}
          </h3>
          <p className="text-sm text-neutral-500 mt-1">
            {todayWorkout
              ? 'Empieza aquí: ejercicios, máquinas, prescripción y registro rápido del entrenamiento específico de hoy.'
              : 'Tu semana sigue visible abajo aunque hoy no tengas un bloque específico asignado.'}
          </p>
        </div>
        {todayWorkout ? (
          <Badge variant={sessionCompletedToday ? 'success' : sessionStarted ? 'success' : 'info'}>
            {sessionCompletedToday ? 'Completado hoy' : sessionStarted ? 'Sesión activa' : 'Listo para entrenar'}
          </Badge>
        ) : null}
      </div>

      {!todayWorkout ? (
        <EmptyState
          icon={<Activity size={32} />}
          title="Sin sesión del día"
          description="Revisa la semana del plan o consulta a tu trainer si necesitas un bloque para hoy."
        />
      ) : (
        <>
          {sessionCompletedToday ? (
            <div className="mb-5 rounded-sm border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
              <p className="text-sm font-semibold">Rutina completada hoy</p>
              <p className="mt-1 text-xs opacity-80">No puedes reiniciar este bloque hasta que vuelva a tocar este día en tu plan semanal.</p>
            </div>
          ) : !sessionStarted ? (
            <button
              type="button"
              className="btn-primary mb-5 flex items-center gap-2"
              onClick={handleStartWorkout}
              disabled={isCreatingSession}
              data-testid="start-session-btn"
            >
              {isCreatingSession ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isCreatingSession ? 'Iniciando...' : 'Registrar entrenamiento'}
            </button>
          ) : null}

          <div className="space-y-3">
            {todayWorkout.exercises.map((exercise) => {
              const draft = exerciseDrafts[exercise.id]
              const isTimed = exercise.exercise_type === 'timed'
              return (
                <div
                  key={exercise.id}
                  className={cn(
                    'rounded-sm border p-4',
                    draft?.done ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/20' : 'border-neutral-200 dark:border-neutral-800',
                  )}
                  data-testid={`today-exercise-${exercise.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-neutral-900 dark:text-white">{exercise.name}</h4>
                        <Badge variant="neutral">{getExercisePrescriptionLabel(exercise)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">
                        {MUSCLE_LABELS[exercise.muscle_group]} · {exercise.machine_detail?.name || 'Ejercicio libre'}
                      </p>
                      {exercise.machine_detail?.category ? (
                        <p className="text-xs text-neutral-400">{exercise.machine_detail.category}</p>
                      ) : null}
                      {exercise.technique_notes ? (
                        <p className="mt-2 text-xs text-neutral-500">{exercise.technique_notes}</p>
                      ) : null}
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={draft?.done || false}
                        disabled={!sessionStarted}
                        onChange={(event) => updateDraft(exercise.id, { done: event.target.checked })}
                      />
                      Hecho
                    </label>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <DashboardMetric
                      label="Máquina"
                      value={exercise.machine_detail?.name || 'Libre'}
                    />
                    <DashboardMetric
                      label="Prescripción"
                      value={isTimed ? `${exercise.target_minutes ?? 0} min` : `${exercise.sets ?? 0}x${exercise.reps_range}`}
                    />
                    <DashboardMetric
                      label="Descanso"
                      value={`${exercise.rest_seconds}s`}
                    />
                    <DashboardMetric
                      label="Peso sugerido"
                      value={exercise.weight_suggestion_kg != null ? `${exercise.weight_suggestion_kg} kg` : 'Libre'}
                    />
                  </div>

                  {sessionStarted ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {isTimed ? (
                        <QuickNumberField
                          label="Minutos realizados"
                          value={draft?.minutes_completed ?? exercise.target_minutes ?? 0}
                          onChange={(value) => updateDraft(exercise.id, { minutes_completed: value })}
                          step={1}
                          testId={`minutes-input-${exercise.id}`}
                        />
                      ) : (
                        <>
                          <QuickNumberField
                            label="Peso usado (kg)"
                            value={draft?.weight_used_kg ?? 0}
                            onChange={(value) => updateDraft(exercise.id, { weight_used_kg: value })}
                            step={2.5}
                            testId={`weight-input-${exercise.id}`}
                          />
                          <QuickNumberField
                            label="RPE"
                            value={draft?.rpe ?? 7}
                            onChange={(value) => updateDraft(exercise.id, { rpe: value })}
                            step={1}
                            min={1}
                            max={10}
                            testId={`rpe-input-${exercise.id}`}
                          />
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {sessionStarted ? (
            <div className="mt-6 rounded-sm border border-neutral-200 p-4 dark:border-neutral-800">
              <label className="label-base block mb-2">
                Sensación general ({overallFeeling}/5)
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={overallFeeling}
                onChange={(event) => setOverallFeeling(Number(event.target.value))}
                className="w-full accent-primary"
                data-testid="feeling-slider"
              />
              <button
                type="button"
                className="btn-primary mt-4 flex items-center gap-2"
                onClick={handleCompleteWorkout}
                disabled={isSavingLogs || isCompletingSession}
                data-testid="complete-session-btn"
              >
                {isSavingLogs || isCompletingSession ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {isSavingLogs || isCompletingSession ? 'Guardando...' : 'Cerrar sesión de hoy'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )

  const weekPlan = (
    <div className="card p-6" data-testid="member-week-plan">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="label-base">Semana del plan</p>
          <h3 className="text-xl font-heading font-bold text-neutral-900 dark:text-white">
            {activePrescription?.plan_activo?.name || 'Sin plan publicado'}
          </h3>
        </div>
        {activePrescription?.plan_activo ? (
          <Link to={`/plans/${activePrescription.plan_activo.id}`} className="btn-secondary" data-testid="member-plan-detail-link">
            Ver plan completo
          </Link>
        ) : null}
      </div>

      {!weeklyDays.length ? (
        <EmptyState
          icon={<Dumbbell size={32} />}
          title="Aún no hay días cargados"
          description="Tu trainer necesita publicar tu semana de entrenamiento para que puedas seguirla desde aquí."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {weeklyDays.map((day) => {
            const completion = weeklyView?.week_days.find((item) => item.workout_day_id === day.id)
            const isToday = todayWorkout?.id === day.id
            return (
              <div
                key={day.id}
                className={cn(
                  'rounded-sm border p-4 transition-colors',
                  isToday ? 'border-primary bg-primary/5' : 'border-neutral-200 dark:border-neutral-800',
                )}
                data-testid={`week-day-${day.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">
                      {day.day_label ? `Día ${day.day_label}` : 'Bloque semanal'}
                    </p>
                    <p className="font-semibold text-neutral-900 dark:text-white">{DAY_OF_WEEK_LABELS[day.day_of_week]} · {day.name}</p>
                  </div>
                  {isToday ? (
                    <Badge variant="info">Hoy</Badge>
                  ) : completion?.is_completed ? (
                    <Badge variant="success">Hecho</Badge>
                  ) : (
                    <Badge variant="neutral">Pendiente</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  {day.exercises.length} ejercicio(s) · {day.exercises.slice(0, 2).map((exercise) => exercise.name).join(' · ') || 'Sin ejercicios'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div data-testid="member-dashboard" className="page-enter space-y-6">
      <PageHeader
        title={`Hola, ${user?.first_name || 'Atleta'}`}
        subtitle="Tu cabina del gym para seguir el plan exactamente como te lo dejó tu trainer."
      />

      {todayCabin}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_0.75fr]" data-testid="member-dashboard-header">
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <SymbolFrame size="md" tone="primary" className="rounded-xl">
                  <UserRound size={18} />
                </SymbolFrame>
                <div>
                  <p className="label-base">Trainer asignado</p>
                  <h2 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
                    {activePrescription?.trainer?.nombre || 'Sin trainer asignado'}
                  </h2>
                  <p className="text-sm text-neutral-500">{activePrescription?.trainer?.correo || 'Cuando se te asigne un trainer aparecerá aquí.'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <MetricPill icon={<Dumbbell size={16} />} label={activePrescription?.plan_activo?.name || 'Sin plan de entrenamiento'} />
                <MetricPill icon={<Activity size={16} />} label={`${data?.weekly_sessions_done || 0} sesiones esta semana`} />
                <MetricPill icon={<CheckCircle2 size={16} />} label={`${data?.cumplimiento_semanal ?? 0}% cumplimiento`} />
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-sm border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Siguiente acción</p>
            <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-white">{data?.siguiente_accion}</p>
            <p className="mt-1 text-sm text-neutral-500">{data?.resumen_hoy}</p>
          </div>
        </div>

        <div
          className={cn(
            'card relative overflow-hidden p-6',
            data?.payment_status === 'paid' && 'border-emerald-400/40 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-950/10',
            data?.payment_status === 'late' && 'border-red-400/50 bg-red-50/50 dark:border-red-500/30 dark:bg-red-950/20',
            data?.payment_status !== 'paid' && data?.payment_status !== 'late' && 'border-amber-400/50 bg-amber-50/50 dark:border-amber-500/25 dark:bg-amber-950/20',
          )}
          data-testid="card-membership"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/40 blur-2xl dark:bg-white/5" />
          <div className="mb-4 flex items-center gap-3">
            <SymbolFrame tone={membershipTone} size="lg" className="rounded-2xl">
              <CalendarClock size={18} />
            </SymbolFrame>
            <div>
              <p className="label-base">Membresía actual</p>
              <h2 className="font-heading text-2xl font-black text-neutral-900 dark:text-white">
                {data?.membership_plan_name || 'Sin plan asignado'}
              </h2>
              <p className="text-xs text-neutral-500">Estado comercial, separado de tu plan de entrenamiento.</p>
            </div>
          </div>
          <div className="mb-4">
            <Badge variant={membershipBadge.variant}>{membershipBadge.label}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DashboardMetric
              label="Vencimiento"
              value={data?.membership_expires_at ? formatDate(data.membership_expires_at) : 'Sin fecha'}
            />
            <DashboardMetric
              label={data?.days_overdue != null ? 'Atraso' : 'Tiempo restante'}
              value={data?.days_overdue != null
                ? `${data.days_overdue} día(s)`
                : data?.days_until_due != null
                  ? `${data.days_until_due} día(s)`
                  : 'Sin dato'}
            />
          </div>
          <p className="mt-4 rounded-sm bg-white/70 p-3 text-sm font-medium text-neutral-700 dark:bg-neutral-950/40 dark:text-neutral-200">
            {membershipHelp}
          </p>
        </div>
      </section>

      {weekPlan}
    </div>
  )
}

function MetricPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-2.5 py-1.5 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300">
      <SymbolFrame tone="primary" size="sm" className="h-7 w-7 rounded-full border-primary/10 bg-primary/10 shadow-none">
        {icon}
      </SymbolFrame>
      <span>{label}</span>
    </div>
  )
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}

function QuickNumberField({
  label,
  value,
  onChange,
  step,
  min = 0,
  max,
  testId,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  step: number
  min?: number
  max?: number
  testId?: string
}) {
  const handleChange = (nextValue: number) => {
    const bounded = Math.max(min, max != null ? Math.min(max, nextValue) : nextValue)
    onChange(bounded)
  }

  return (
    <div className="rounded-sm border border-neutral-200 px-3 py-3 dark:border-neutral-800" data-testid={testId}>
      <label className="label-base block mb-2">{label}</label>
      <div className="flex items-center justify-center gap-2">
        <button type="button" className="btn-secondary" onClick={() => handleChange(value - step)}>-</button>
        <span className="w-16 text-center font-heading text-2xl font-bold text-neutral-900 dark:text-white">
          {Number.isInteger(value) ? value : value.toFixed(1)}
        </span>
        <button type="button" className="btn-secondary" onClick={() => handleChange(value + step)}>+</button>
      </div>
    </div>
  )
}
