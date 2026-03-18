import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Play, CheckCircle, Plus, Minus, Loader2 } from 'lucide-react'
import { useTodayWorkoutQuery, useCreateSessionMutation, useCompleteSessionMutation, useBulkExerciseLogsMutation } from '../hooks/usePlans'
import { PageHeader, EmptyState } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { MUSCLE_LABELS } from '@/shared/lib/utils'
import type { Exercise } from '@/shared/types'
import { toast } from 'sonner'

interface ExerciseLogEntry {
  exercise_id: number
  sets_completed: number
  reps_completed: number
  weight_used_kg?: number
  rpe?: number
}

export function TodayWorkoutPage() {
  const { id } = useParams<{ id: string }>()
  const planId = parseInt(id || '0')
  const { data, isLoading } = useTodayWorkoutQuery(planId)
  const { mutate: createSession, isPending: isCreating } = useCreateSessionMutation()
  const { mutate: completeSession, isPending: isCompleting } = useCompleteSessionMutation()
  const { mutate: bulkLogs, isPending: isSaving } = useBulkExerciseLogsMutation()

  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [logs, setLogs] = useState<Record<number, ExerciseLogEntry>>({})
  const [overallFeeling, setOverallFeeling] = useState(4)

  const handleStartSession = () => {
    if (!data) return
    createSession(
      { workout_day_id: data.id },
      {
        onSuccess: (session) => {
          setSessionId(session.id)
          setSessionStarted(true)
          // Initialize log entries from exercises
          const initialLogs: Record<number, ExerciseLogEntry> = {}
          data.exercises?.forEach((ex) => {
            initialLogs[ex.id] = {
              exercise_id: ex.id,
              sets_completed: ex.sets,
              reps_completed: parseInt(ex.reps_range.split('-')[0]) || 10,
              weight_used_kg: ex.weight_suggestion_kg || undefined,
            }
          })
          setLogs(initialLogs)
        },
      },
    )
  }

  const handleCompleteSession = () => {
    if (!sessionId) return
    const logsArray = Object.values(logs)
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

  if (!data?.id) {
    return (
      <div data-testid="no-workout-today" className="page-enter">
        <Link to={`/plans/${planId}`} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-primary mb-6">
          <ArrowLeft size={16} />
          Volver al plan
        </Link>
        <EmptyState
          icon={<CheckCircle size={48} className="text-green-400" />}
          title="Sin entrenamiento hoy"
          description="No hay sesión programada para hoy en este plan."
        />
      </div>
    )
  }

  const workoutDay = data

  return (
    <div data-testid="today-workout-page" className="page-enter max-w-2xl mx-auto">
      <Link to={`/plans/${planId}`} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-primary mb-6 transition-colors">
        <ArrowLeft size={16} />
        Volver al plan
      </Link>

        <PageHeader
        title={`Día ${workoutDay.day_label}: ${workoutDay.name}`}
        subtitle={`${workoutDay.exercises?.length || 0} ejercicios`}
      />

      {!sessionStarted ? (
        <button
          onClick={handleStartSession}
          disabled={isCreating}
          className="btn-primary w-full flex items-center justify-center gap-2 mb-6"
          data-testid="start-session-btn"
        >
          {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {isCreating ? 'Iniciando...' : 'INICIAR SESIÓN'}
        </button>
      ) : (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-sm">
          <CheckCircle size={16} className="text-green-500" />
          <span className="text-sm text-green-700 dark:text-green-400 font-medium">Sesión activa</span>
        </div>
      )}

      {/* Exercise list */}
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

      {/* Complete session */}
      {sessionStarted && (
        <div className="mt-6 card p-5 space-y-4">
          <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white">
            Finalizar sesión
          </h3>
          <div>
            <label className="label-base block mb-2">
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
            <div className="flex justify-between text-xs text-neutral-400 mt-1">
              <span>Muy difícil</span>
              <span>Excelente</span>
            </div>
          </div>
          <button
            onClick={handleCompleteSession}
            disabled={isCompleting || isSaving}
            className="btn-primary w-full flex items-center justify-center gap-2"
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
      )}
    </div>
  )
}

interface ExerciseCardProps {
  exercise: Exercise
  log?: ExerciseLogEntry
  active: boolean
  onUpdate: (field: string, value: number) => void
}

function ExerciseCard({ exercise, log, active, onUpdate }: ExerciseCardProps) {
  return (
    <div
      className={`card p-5 transition-all ${active ? 'border-primary/30' : ''}`}
      data-testid={`exercise-card-${exercise.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-neutral-900 dark:text-white">{exercise.name}</h4>
          <span className="text-xs text-neutral-400">{MUSCLE_LABELS[exercise.muscle_group]}</span>
        </div>
        <span className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-sm text-neutral-600 dark:text-neutral-400">
          {exercise.sets}×{exercise.reps_range}
        </span>
      </div>

      {exercise.technique_notes && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3 italic">
          {exercise.technique_notes}
        </p>
      )}

      {active && log && (
        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <LogInput
            label="Series"
            value={log.sets_completed}
            onChange={(v) => onUpdate('sets_completed', v)}
          />
          <LogInput
            label="Reps"
            value={log.reps_completed}
            onChange={(v) => onUpdate('reps_completed', v)}
          />
          <LogInput
            label="Peso (kg)"
            value={log.weight_used_kg || 0}
            onChange={(v) => onUpdate('weight_used_kg', v)}
            step={2.5}
          />
        </div>
      )}

      {!active && exercise.weight_suggestion_kg && (
        <p className="text-xs text-neutral-400 mt-2">
          Sugerido: {exercise.weight_suggestion_kg}kg · Descanso: {exercise.rest_seconds}s
        </p>
      )}
    </div>
  )
}

function LogInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div className="text-center">
      <label className="label-base block mb-1">{label}</label>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - step))}
          className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
        >
          <Minus size={12} />
        </button>
        <span className="text-lg font-heading font-bold text-neutral-900 dark:text-white w-10 text-center">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}
