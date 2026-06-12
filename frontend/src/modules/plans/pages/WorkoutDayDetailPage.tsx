import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Dumbbell, NotebookTabs, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import { usePlanDetailQuery, useWorkoutDayDetailQuery } from '../hooks/usePlans'
import { Badge, EmptyState, PageHeader } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { SymbolFrame } from '@/shared/components/Brand'
import { DAY_OF_WEEK_LABELS, MUSCLE_LABELS } from '@/shared/lib/utils'
import type { Exercise, WorkoutDay } from '@/shared/types'

function formatExercisePrescription(exercise: Exercise) {
  if (exercise.exercise_type === 'timed') {
    return `${exercise.target_minutes ?? 0} min`
  }

  const weightLabel = exercise.weight_suggestion_kg ? ` @${exercise.weight_suggestion_kg}kg` : ''
  return `${exercise.sets ?? 0}×${exercise.reps_range}${weightLabel}`
}

function buildDayAnalysis(day: WorkoutDay) {
  const exercises = day.exercises || []
  const strengthExercises = exercises.filter((exercise) => exercise.exercise_type === 'strength')
  const timedExercises = exercises.filter((exercise) => exercise.exercise_type === 'timed')
  const totalSets = strengthExercises.reduce((total, exercise) => total + (exercise.sets ?? 0), 0)
  const totalMinutes = timedExercises.reduce((total, exercise) => total + (exercise.target_minutes ?? 0), 0)
  const restMinutes = Math.round(
    exercises.reduce((total, exercise) => total + (exercise.rest_seconds ?? 0), 0) / 60,
  )
  const muscleGroups = Array.from(new Set(exercises.map((exercise) => exercise.muscle_group)))

  return {
    totalExercises: exercises.length,
    strengthCount: strengthExercises.length,
    timedCount: timedExercises.length,
    totalSets,
    totalMinutes,
    restMinutes,
    muscleGroups,
    estimatedMinutes: totalMinutes + restMinutes + totalSets * 2,
  }
}

export function WorkoutDayDetailPage() {
  const { planId: planIdParam, dayId: dayIdParam } = useParams<{ planId: string; dayId: string }>()
  const planId = Number(planIdParam || 0)
  const dayId = Number(dayIdParam || 0)
  const { data: plan, isLoading: isPlanLoading } = usePlanDetailQuery(planId)
  const { data: day, isLoading: isDayLoading, isError } = useWorkoutDayDetailQuery(dayId)

  if (isPlanLoading || isDayLoading) {
    return (
      <div className="page-enter space-y-4">
        <div className="h-8 w-36 skeleton rounded" />
        <CardSkeleton lines={5} />
        <CardSkeleton lines={8} />
      </div>
    )
  }

  if (!day || isError || (plan && day.plan !== plan.id)) {
    return (
      <div className="page-enter">
        <Link to={planId ? `/plans/${planId}` : '/plans'} className="mb-6 flex items-center gap-2 text-sm text-neutral-500 hover:text-primary">
          <ArrowLeft size={16} />
          Volver al plan
        </Link>
        <EmptyState
          icon={<NotebookTabs size={42} />}
          title="Día no encontrado"
          description="No pudimos abrir este bloque del plan o no pertenece al plan seleccionado."
        />
      </div>
    )
  }

  const analysis = buildDayAnalysis(day)

  return (
    <div className="page-enter" data-testid="workout-day-detail-page">
      <Link to={`/plans/${day.plan}`} className="mb-6 flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-primary">
        <ArrowLeft size={16} />
        Volver al plan
      </Link>

      <PageHeader
        title={`${DAY_OF_WEEK_LABELS[day.day_of_week]} · ${day.name}`}
        subtitle={plan ? `Plan: ${plan.name}` : `Día ${day.day_label}`}
        action={<Badge variant="info">Día {day.day_label}</Badge>}
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalysisCard icon={<Dumbbell size={18} />} label="Ejercicios" value={`${analysis.totalExercises}`} />
        <AnalysisCard icon={<Target size={18} />} label="Series fuerza" value={`${analysis.totalSets}`} />
        <AnalysisCard icon={<Clock size={18} />} label="Minutos cardio/tiempo" value={`${analysis.totalMinutes}`} />
        <AnalysisCard icon={<NotebookTabs size={18} />} label="Duración estimada" value={`${analysis.estimatedMinutes} min`} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="label-base">Plan del día exacto</p>
              <h2 className="font-heading text-2xl font-bold text-neutral-900 dark:text-white">{day.name}</h2>
            </div>
            <Badge variant="neutral">{analysis.totalExercises} ejercicio(s)</Badge>
          </div>

          {day.exercises.length ? (
            <div className="space-y-3">
              {day.exercises.map((exercise, index) => (
                <ExerciseDetailCard key={exercise.id} exercise={exercise} index={index + 1} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Dumbbell size={32} />}
              title="Sin ejercicios cargados"
              description="Este bloque todavía no tiene ejercicios configurados."
            />
          )}
        </section>

        <aside className="space-y-4">
          <section className="card p-6" data-testid="workout-day-analysis">
            <p className="label-base mb-3">Análisis del bloque</p>
            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <p>
                Fuerza: <span className="font-semibold text-neutral-900 dark:text-white">{analysis.strengthCount}</span> ejercicio(s)
              </p>
              <p>
                Por tiempo: <span className="font-semibold text-neutral-900 dark:text-white">{analysis.timedCount}</span> ejercicio(s)
              </p>
              <p>
                Descanso estimado: <span className="font-semibold text-neutral-900 dark:text-white">{analysis.restMinutes} min</span>
              </p>
            </div>
          </section>

          <section className="card p-6">
            <p className="label-base mb-3">Músculos trabajados</p>
            <div className="flex flex-wrap gap-2">
              {analysis.muscleGroups.length ? analysis.muscleGroups.map((group) => (
                <Badge key={group} variant="info">{MUSCLE_LABELS[group]}</Badge>
              )) : (
                <span className="text-sm text-neutral-500">Sin grupos registrados</span>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function AnalysisCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-3">
        <SymbolFrame size="sm" tone="primary" className="rounded-xl">
          {icon}
        </SymbolFrame>
        <p className="label-base">{label}</p>
      </div>
      <p className="font-heading text-3xl font-bold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}

function ExerciseDetailCard({ exercise, index }: { exercise: Exercise; index: number }) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/50" data-testid={`day-exercise-${exercise.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
            {index}
          </span>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-white">{exercise.name}</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {MUSCLE_LABELS[exercise.muscle_group]}{exercise.machine_detail?.name ? ` · ${exercise.machine_detail.name}` : ''}
            </p>
          </div>
        </div>
        <Badge variant={exercise.exercise_type === 'timed' ? 'warning' : 'success'}>
          {exercise.exercise_type === 'timed' ? 'Por tiempo' : 'Fuerza'}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ExerciseMetric label="Prescripción" value={formatExercisePrescription(exercise)} />
        <ExerciseMetric label="Descanso" value={`${exercise.rest_seconds}s`} />
        <ExerciseMetric label="Orden" value={`#${exercise.order + 1}`} />
      </div>

      {exercise.technique_notes ? (
        <p className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-950/50 dark:text-neutral-300">
          {exercise.technique_notes}
        </p>
      ) : null}
    </article>
  )
}

function ExerciseMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}
