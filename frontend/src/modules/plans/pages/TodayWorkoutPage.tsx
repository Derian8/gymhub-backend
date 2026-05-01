import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, CreditCard, Dumbbell, Flame, Loader2, MessageSquareMore, Play, Scale, Sparkles, Target, Utensils } from 'lucide-react'

import { useTodayWorkoutQuery, useCreateSessionMutation, useCompleteSessionMutation, useBulkExerciseLogsMutation } from '../hooks/usePlans'
import { EmptyState, Badge } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { SymbolFrame } from '@/shared/components/Brand'
import { GOAL_LABELS, MUSCLE_LABELS, cn } from '@/shared/lib/utils'
import type { Exercise, ExerciseLogPayload } from '@/shared/types'
import { useAuthStore } from '@/shared/store/authStore'
import { useMemberActivePrescriptionQuery, useMemberDashboardQuery, useMemberPhysicalSummaryQuery } from '@/modules/members/hooks/useMembers'
import { useNotificationsQuery } from '@/modules/alerts/hooks/useAlerts'

interface ExerciseLogEntry {
  exercise_id: number
  sets_completed?: number
  reps_completed?: number
  minutes_completed?: number
  weight_used_kg?: number
  rpe?: number
  notes?: string
}

function getExercisePrescriptionLabel(exercise: Exercise) {
  if (exercise.exercise_type === 'timed') {
    return `${exercise.target_minutes ?? 0} min`
  }
  return `${exercise.sets ?? 0}×${exercise.reps_range}`
}

export function TodayWorkoutPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const requestedPlanId = parseInt(id || '0')
  const { user } = useAuthStore()
  const isMember = user?.role === 'member'
  const memberId = user?.memberprofile_id || 0
  const { data: activePrescription } = useMemberActivePrescriptionQuery(isMember ? memberId : 0)
  const planId = requestedPlanId || activePrescription?.plan_activo?.id || 0
  const { data, isLoading } = useTodayWorkoutQuery(planId)
  const { data: dashboardSummary } = useMemberDashboardQuery(isMember ? memberId : 0)
  const { data: physicalSummary } = useMemberPhysicalSummaryQuery(isMember ? memberId : 0)
  const { data: notifications } = useNotificationsQuery()
  const { mutate: createSession, isPending: isCreating } = useCreateSessionMutation()
  const { mutate: completeSession, isPending: isCompleting } = useCompleteSessionMutation()
  const { mutate: bulkLogs, isPending: isSaving } = useBulkExerciseLogsMutation()

  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [logs, setLogs] = useState<Record<number, ExerciseLogEntry>>({})
  const [overallFeeling, setOverallFeeling] = useState(4)
  const unreadTrainerMessages =
    notifications?.results?.filter((message) => message.type === 'trainer_message' && !message.read).length || 0

  const workoutDay = useMemo(() => {
    if (data?.id) {
      return data
    }
    return activePrescription?.entrenamiento_hoy ?? null
  }, [activePrescription?.entrenamiento_hoy, data])

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (isMember && !requestedPlanId && !workoutDay?.id) {
      navigate('/dashboard/member', { replace: true })
    }
  }, [isLoading, isMember, navigate, requestedPlanId, workoutDay?.id])

  const handleStartSession = () => {
    if (!workoutDay) return
    createSession(
      { workout_day_id: workoutDay.id },
      {
        onSuccess: (session) => {
          setSessionId(session.id)
          setSessionStarted(true)
          const initialLogs: Record<number, ExerciseLogEntry> = {}
          workoutDay.exercises?.forEach((exercise) => {
            if (exercise.exercise_type === 'timed') {
              initialLogs[exercise.id] = {
                exercise_id: exercise.id,
                minutes_completed: exercise.target_minutes || undefined,
              }
              return
            }

            initialLogs[exercise.id] = {
              exercise_id: exercise.id,
              sets_completed: exercise.sets || undefined,
              reps_completed: parseInt(exercise.reps_range.split('-')[0]) || 10,
              weight_used_kg: exercise.weight_suggestion_kg || undefined,
              rpe: 7,
            }
          })
          setLogs(initialLogs)
        },
      },
    )
  }

  const handleCompleteSession = () => {
    if (!sessionId) return

    const logsArray = Object.values(logs).map<ExerciseLogPayload>((log) => {
      const exercise = workoutDay?.exercises?.find((item) => item.id === log.exercise_id)

      if (exercise?.exercise_type === 'timed') {
        return {
          exercise_id: log.exercise_id,
          minutes_completed: log.minutes_completed,
          notes: log.notes,
        }
      }

      if (isMember) {
        return {
          exercise_id: log.exercise_id,
          weight_used_kg: log.weight_used_kg,
          rpe: log.rpe,
          notes: log.notes,
        }
      }

      return {
        exercise_id: log.exercise_id,
        sets_completed: log.sets_completed,
        reps_completed: log.reps_completed,
        weight_used_kg: log.weight_used_kg,
        rpe: log.rpe,
        notes: log.notes,
      }
    })

    bulkLogs(
      { session_id: sessionId, logs: logsArray },
      {
        onSuccess: () => {
          completeSession(
            { sessionId, payload: { overall_feeling: overallFeeling } },
            {
              onSuccess: () => {
                setSessionStarted(false)
                setSessionId(null)
              },
            },
          )
        },
      },
    )
  }

  const updateLog = (exerciseId: number, field: keyof ExerciseLogEntry, value: number) => {
    setLogs((prev) => ({
      ...prev,
      [exerciseId]: { ...prev[exerciseId], [field]: value },
    }))
  }

  if (isLoading) {
    return (
      <div className="page-enter space-y-4">
        <div className="h-8 w-32 skeleton rounded mb-6" />
        <CardSkeleton lines={8} />
      </div>
    )
  }

  if (!workoutDay?.id) {
    return (
      <div data-testid="no-workout-today" className="page-enter">
        <Link to={isMember ? '/dashboard/member' : `/plans/${planId}`} className="mb-6 flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-primary">
          <ArrowLeft size={16} />
          {isMember ? 'Volver al resumen' : 'Volver al plan'}
        </Link>
        <EmptyState
          icon={<CheckCircle size={48} className="text-green-400" />}
          title="Sin entrenamiento hoy"
          description="No hay sesión programada para hoy en este plan."
        />
      </div>
    )
  }

  const ejercicios = workoutDay.exercises?.length || 0

  return (
    <div data-testid="today-workout-page" className="page-enter mx-auto max-w-4xl space-y-6">
      {!isMember ? (
        <Link to={`/plans/${planId}`} className="flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-primary">
          <ArrowLeft size={16} />
          Volver al plan
        </Link>
      ) : null}

      <section
        data-testid="workout-primary"
        className="rounded-[1.75rem] border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label-base">Rutina del día</p>
            <h1 className="text-3xl font-heading font-black text-neutral-900 dark:text-white">
              Día {workoutDay.day_label} · {workoutDay.name}
            </h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Entra, sigue este bloque y marca lo que realmente hiciste durante la sesión.
            </p>
          </div>
          <Badge variant={sessionStarted ? 'success' : 'info'}>
            {sessionStarted ? 'Sesión activa' : 'Bloque listo'}
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Plan activo</p>
            <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-white">
              {activePrescription?.plan_activo?.name || 'Programa activo'}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Trainer</p>
            <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-white">
              {activePrescription?.trainer?.nombre || 'Trainer no asignado'}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Formato de registro</p>
            <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-white">
              Peso, RPE o minutos
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <InlinePill icon={<Dumbbell size={14} />} label={`${ejercicios} ejercicios hoy`} />
          <InlinePill icon={<Target size={14} />} label="Orden ya definido" />
          <InlinePill icon={<Flame size={14} />} label="Carga sugerida visible" />
        </div>

        <div className="mt-6">
          {!sessionStarted ? (
            <button
              onClick={handleStartSession}
              disabled={isCreating}
              className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-base"
              data-testid="start-session-btn"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isCreating ? 'Iniciando...' : 'INICIAR SESIÓN'}
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              <SymbolFrame size="sm" tone="success">
                <CheckCircle size={16} />
              </SymbolFrame>
              <div>
                <p className="text-sm font-semibold">Sesión activa</p>
                <p className="text-xs opacity-80">Marca la carga usada o los minutos completados mientras avanzas por la rutina.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4" data-testid="exercise-checklist">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-base">Lo que haces hoy</p>
            <h2 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">
              Checklist del entrenamiento
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Cada ejercicio ya trae máquina, prescripción, descanso y peso sugerido para que no tengas que salir de esta pantalla.
            </p>
          </div>
          {isMember ? (
            <Link
              to="/dashboard/member"
              className="text-sm font-medium text-neutral-500 transition-colors hover:text-primary"
            >
              Ir al resumen
            </Link>
          ) : null}
        </div>

        <div className="space-y-4">
          {workoutDay.exercises?.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              log={logs[exercise.id]}
              active={sessionStarted}
              onUpdate={(field, value) => updateLog(exercise.id, field as keyof ExerciseLogEntry, value)}
            />
          ))}
        </div>
      </section>

        {sessionStarted ? (
          <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <h3 className="font-heading text-lg font-bold text-neutral-900 dark:text-white">Finalizar sesión</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Cierra el bloque con una percepción general para que el progreso quede mejor registrado.
            </p>
            <div className="mt-4">
              <label className="label-base mb-2 block">
                ¿Cómo te sentiste? ({overallFeeling}/5)
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={overallFeeling}
                onChange={(e) => setOverallFeeling(parseInt(e.target.value))}
                className="w-full accent-primary"
                data-testid="feeling-slider"
              />
              <div className="mt-1 flex justify-between text-xs text-neutral-400">
                <span>Muy difícil</span>
                <span>Excelente</span>
              </div>
            </div>
            <button
              onClick={handleCompleteSession}
              disabled={isCompleting || isSaving}
              className="btn-primary mt-5 flex w-full items-center justify-center gap-2"
              data-testid="complete-session-btn"
            >
              {isCompleting || isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              {isCompleting || isSaving ? 'Guardando...' : 'COMPLETAR SESIÓN'}
            </button>
          </div>
        ) : null}

        {isMember ? (
          <section className="space-y-4 border-t border-neutral-200 pt-8 dark:border-neutral-800" data-testid="secondary-support">
            <div>
              <p className="label-base">Soporte secundario</p>
              <h2 className="text-xl font-heading font-bold text-neutral-900 dark:text-white">
                Lo demás sigue disponible sin quitarle el foco a tu rutina
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Úsalo cuando necesites contexto adicional, pero el entrenamiento del día sigue siendo la página principal.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SupportCard
                title="Mensajes del trainer"
                icon={<MessageSquareMore size={18} className="text-primary" />}
                to="/messages"
                testId="card-messages"
              >
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {unreadTrainerMessages > 0 ? `${unreadTrainerMessages} sin leer` : 'Sin mensajes pendientes'}
                </p>
                <p className="text-xs text-neutral-500">Mantén visibles los ajustes o avisos que te dejó tu trainer.</p>
              </SupportCard>

              <SupportCard
                title="Físico actual"
                icon={<Scale size={18} className="text-primary" />}
                to="/progress"
                testId="card-physical"
              >
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {physicalSummary?.current_weight_kg == null ? 'Peso sin dato' : `${physicalSummary.current_weight_kg} kg`}
                </p>
                <p className="text-xs text-neutral-500">
                  {physicalSummary?.height_cm == null ? 'Estatura sin dato' : `${physicalSummary.height_cm} cm`} · IMC {physicalSummary?.bmi ?? '—'}
                </p>
              </SupportCard>

              <SupportCard
                title="Nutrición"
                icon={<Utensils size={18} className="text-primary" />}
                to="/nutrition"
                testId="card-nutrition"
              >
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {activePrescription?.perfil_nutricional?.goal_type
                    ? GOAL_LABELS[activePrescription.perfil_nutricional.goal_type] || activePrescription.perfil_nutricional.goal_type
                    : 'Sin perfil nutricional'}
                </p>
                <p className="text-xs text-neutral-500">Tu guía nutricional sigue disponible sin sacarte del bloque principal.</p>
              </SupportCard>

              <SupportCard
                title="Cobros y avisos"
                icon={<CreditCard size={18} className="text-primary" />}
                to="/billing"
                testId="card-billing"
              >
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {dashboardSummary?.payment_status === 'late'
                    ? 'Tienes mora activa'
                    : dashboardSummary?.days_until_due != null
                      ? `Próximo cobro en ${dashboardSummary.days_until_due} día(s)`
                      : 'Sin alertas de pago'}
                </p>
                <p className="text-xs text-neutral-500">El entrenamiento sigue al frente, pero los cobros no quedan ocultos.</p>
              </SupportCard>

              <SupportCard
                title="Asistente IA"
                icon={<Sparkles size={18} className="text-primary" />}
                to="/ai-chat"
                testId="card-ai"
              >
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">Consulta rápida durante el entrenamiento</p>
                <p className="text-xs text-neutral-500">Úsalo como apoyo para dudas de ejecución o contexto del plan.</p>
              </SupportCard>
            </div>
          </section>
        ) : null}
    </div>
  )
}

function InlinePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/85 px-3 py-1.5 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-200">
      {icon}
      <span>{label}</span>
    </div>
  )
}

function SupportCard({
  title,
  icon,
  to,
  testId,
  children,
}: {
  title: string
  icon: React.ReactNode
  to: string
  testId: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="block rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-primary/30 dark:border-neutral-800 dark:bg-neutral-950"
      data-testid={testId}
    >
      <div className="mb-3 flex items-center gap-3">
        <SymbolFrame size="sm" tone="default" className="rounded-xl">
          {icon}
        </SymbolFrame>
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</p>
      </div>
      {children}
    </Link>
  )
}

interface ExerciseCardProps {
  exercise: Exercise
  log?: ExerciseLogEntry
  active: boolean
  onUpdate: (field: string, value: number) => void
}

function ExerciseCard({ exercise, log, active, onUpdate }: ExerciseCardProps) {
  const isTimed = exercise.exercise_type === 'timed'

  return (
    <div
      className={cn(
        'rounded-[1.6rem] border border-neutral-200 bg-white p-5 shadow-sm transition-all dark:border-neutral-800 dark:bg-neutral-950',
        active && 'border-primary/30',
      )}
      data-testid={`exercise-card-${exercise.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-neutral-900 dark:text-white">{exercise.name}</h4>
          <span className="text-xs text-neutral-400">{MUSCLE_LABELS[exercise.muscle_group]}</span>
        </div>
        <Badge variant="info">{getExercisePrescriptionLabel(exercise)}</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Prescripción del trainer</p>
          {isTimed ? (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <StaticMetric label="Duración objetivo" value={`${exercise.target_minutes ?? 0} min`} />
              <StaticMetric label="Máquina" value={exercise.machine_detail?.name || 'Libre'} />
              <StaticMetric label="Descanso" value={`${exercise.rest_seconds}s`} />
              <StaticMetric label="Tipo" value="Cardio por tiempo" />
              <StaticMetric label="Carga" value="No aplica" />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <StaticMetric label="Series" value={String(exercise.sets ?? 0)} />
              <StaticMetric label="Repeticiones" value={exercise.reps_range} />
              <StaticMetric label="Máquina" value={exercise.machine_detail?.name || 'Libre'} />
              <StaticMetric label="Descanso" value={`${exercise.rest_seconds}s`} />
              <StaticMetric label="Peso sugerido" value={exercise.weight_suggestion_kg ? `${exercise.weight_suggestion_kg}kg` : 'Libre'} />
            </div>
          )}
          {exercise.technique_notes ? (
            <p className="mt-3 text-xs italic text-neutral-500 dark:text-neutral-400">{exercise.technique_notes}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Tu registro</p>
          {!active || !log ? (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              {isTimed
                ? 'Inicia la sesión para registrar los minutos que realmente completaste.'
                : 'Inicia la sesión para registrar tu peso usado y percepción de esfuerzo.'}
            </p>
          ) : (
            isTimed ? (
              <div className="mt-3 grid grid-cols-1 gap-3">
                <LogStepper
                  label="Minutos realizados"
                  value={log.minutes_completed || exercise.target_minutes || 0}
                  onChange={(value) => onUpdate('minutes_completed', value)}
                  step={1}
                  min={0}
                  testId={`minutes-input-${exercise.id}`}
                />
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <LogStepper
                  label="Peso (kg)"
                  value={log.weight_used_kg || 0}
                  onChange={(value) => onUpdate('weight_used_kg', value)}
                  step={2.5}
                  testId={`weight-input-${exercise.id}`}
                />
                <LogStepper
                  label="RPE"
                  value={log.rpe || 7}
                  onChange={(value) => onUpdate('rpe', value)}
                  step={1}
                  min={1}
                  max={10}
                  testId={`rpe-input-${exercise.id}`}
                />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function StaticMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">{value}</p>
    </div>
  )
}

function LogStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  testId,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  testId?: string
}) {
  const handleChange = (nextValue: number) => {
    const bounded = Math.max(min, max != null ? Math.min(max, nextValue) : nextValue)
    onChange(bounded)
  }

  return (
    <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-center dark:bg-neutral-900/70" data-testid={testId}>
      <label className="label-base mb-2 block">{label}</label>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => handleChange(value - step)}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition-colors hover:border-primary/40 hover:text-primary dark:border-neutral-700"
        >
          -
        </button>
        <span className="w-14 text-center font-heading text-xl font-bold text-neutral-900 dark:text-white">
          {Number.isInteger(value) ? value : value.toFixed(1)}
        </span>
        <button
          type="button"
          onClick={() => handleChange(value + step)}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition-colors hover:border-primary/40 hover:text-primary dark:border-neutral-700"
        >
          +
        </button>
      </div>
    </div>
  )
}
