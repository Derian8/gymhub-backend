import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronRight } from 'lucide-react'
import { usePlanDetailQuery, useTodayWorkoutQuery, useWeeklyPlanQuery } from '../hooks/usePlans'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { GOAL_LABELS, MUSCLE_LABELS } from '@/shared/lib/utils'
import type { WorkoutDay, Exercise } from '@/shared/types'

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const planId = parseInt(id || '0')
  const { data: plan, isLoading } = usePlanDetailQuery(planId)
  const { data: weeklyView } = useWeeklyPlanQuery(planId)
  const { data: todayWorkout } = useTodayWorkoutQuery(planId)

  if (isLoading) {
    return (
      <div className="page-enter space-y-4">
        <div className="h-8 w-32 skeleton rounded mb-6" />
        <CardSkeleton lines={5} />
        <CardSkeleton lines={8} />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="text-center py-16">
        <p className="text-neutral-500">Plan no encontrado</p>
        <Link to="/plans" className="text-primary mt-2 block">← Volver a planes</Link>
      </div>
    )
  }

  return (
    <div data-testid="plan-detail-page" className="page-enter">
      <Link to="/plans" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-primary mb-6 transition-colors">
        <ArrowLeft size={16} />
        Volver a planes
      </Link>

      <PageHeader
        title={plan.name}
        subtitle={GOAL_LABELS[plan.goal] || plan.goal}
        action={
          <Link
            to={`/plans/${plan.id}/today`}
            className="btn-primary"
            data-testid="today-workout-btn"
          >
            Entrenamiento de hoy
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan info */}
        <div className="card p-6 space-y-4">
          <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white">Información</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Objetivo</span>
              <Badge variant="info">{GOAL_LABELS[plan.goal] || plan.goal}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Días/semana</span>
              <span className="font-medium text-neutral-900 dark:text-white">{plan.days_per_week}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Duración</span>
              <span className="font-medium text-neutral-900 dark:text-white">{plan.weeks_duration} semanas</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Estado</span>
              <Badge variant={plan.is_active ? 'success' : 'neutral'}>
                {plan.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>

          {todayWorkout && (
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <p className="label-base mb-2">Hoy: Día {todayWorkout.workout_day?.day_label}</p>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">{todayWorkout.workout_day?.name}</p>
            </div>
          )}
        </div>

        {/* Weekly view */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">
            Vista semanal
          </h3>
          {weeklyView?.workout_days ? (
            <div className="space-y-3">
              {weeklyView.workout_days.map((day: WorkoutDay) => (
                <WorkoutDayCard key={day.id} day={day} planId={planId} />
              ))}
            </div>
          ) : plan.workout_days ? (
            <div className="space-y-3">
              {plan.workout_days.map((day) => (
                <WorkoutDayCard key={day.id} day={day} planId={planId} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Calendar size={32} />}
              title="Sin días de entrenamiento"
              description="Este plan no tiene días configurados"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function WorkoutDayCard({ day, planId }: { day: WorkoutDay; planId: number }) {
  return (
    <div className="card p-5" data-testid={`workout-day-${day.id}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-sm bg-primary text-white text-sm font-bold flex items-center justify-center font-heading">
            {day.day_label}
          </span>
          <h4 className="font-semibold text-neutral-900 dark:text-white">{day.name}</h4>
        </div>
        <span className="text-xs text-neutral-400">{day.exercises?.length || 0} ejercicios</span>
      </div>
      {day.exercises && (
        <div className="space-y-1">
          {day.exercises.slice(0, 4).map((ex) => (
            <ExerciseRow key={ex.id} exercise={ex} />
          ))}
          {day.exercises.length > 4 && (
            <p className="text-xs text-neutral-400 pt-1">
              +{day.exercises.length - 4} más
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ExerciseRow({ exercise }: { exercise: Exercise }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800/50 last:border-0">
      <div>
        <span className="text-sm text-neutral-700 dark:text-neutral-300">{exercise.name}</span>
        <span className="ml-2 text-xs text-neutral-400">{MUSCLE_LABELS[exercise.muscle_group]}</span>
      </div>
      <span className="text-xs font-mono text-neutral-500">
        {exercise.sets}×{exercise.reps_range}
        {exercise.weight_suggestion_kg && ` @${exercise.weight_suggestion_kg}kg`}
      </span>
    </div>
  )
}
