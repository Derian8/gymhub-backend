import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronRight, NotebookTabs, UserRound } from 'lucide-react'
import { useDeletePlanMutation, usePlanDetailQuery, useTodayWorkoutQuery } from '../hooks/usePlans'
import { Badge, ConfirmDialog, PageHeader, EmptyState } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { DAY_OF_WEEK_LABELS, GOAL_LABELS, MUSCLE_LABELS } from '@/shared/lib/utils'
import type { WorkoutDay, Exercise } from '@/shared/types'
import { useAuthStore } from '@/shared/store/authStore'
import { useMemberActivePrescriptionQuery, useMemberDashboardQuery } from '@/modules/members/hooks/useMembers'
import { SymbolFrame } from '@/shared/components/Brand'

function formatExercisePrescription(exercise: Exercise) {
  if (exercise.exercise_type === 'timed') {
    return `${exercise.target_minutes ?? 0} min`
  }

  const weightLabel = exercise.weight_suggestion_kg ? ` @${exercise.weight_suggestion_kg}kg` : ''
  return `${exercise.sets ?? 0}×${exercise.reps_range}${weightLabel}`
}

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const planId = parseInt(id || '0')
  const { user } = useAuthStore()
  const isMember = user?.role === 'member'
  const { data: plan, isLoading } = usePlanDetailQuery(planId)
  const { data: todayWorkout } = useTodayWorkoutQuery(planId)
  const { data: activePrescription } = useMemberActivePrescriptionQuery(isMember ? user?.memberprofile_id || 0 : 0)
  const { data: dashboardSummary } = useMemberDashboardQuery(isMember ? user?.memberprofile_id || 0 : 0)
  const deletePlan = useDeletePlanMutation()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const canDelete = !!user && (user.role === 'trainer' || user.is_staff)

  useEffect(() => {
    if (deletePlan.isSuccess) {
      navigate('/plans')
    }
  }, [deletePlan.isSuccess, navigate])

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
      <Link to={isMember ? '/plans/my' : '/plans'} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-primary mb-6 transition-colors">
        <ArrowLeft size={16} />
        {isMember ? 'Volver a mi programa' : 'Volver a planes'}
      </Link>

      <PageHeader
        title={plan.name}
        subtitle={isMember ? 'Así se ve el plan completo que tu trainer publicó para ti.' : GOAL_LABELS[plan.goal] || plan.goal}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {canDelete && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="open-delete-plan-dialog"
              >
                Borrar plan
              </button>
            )}
            <Link
              to={`/plans/${plan.id}/today`}
              className="btn-primary"
              data-testid="today-workout-btn"
            >
              Entrenamiento de hoy
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          {todayWorkout?.id && (
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <p className="label-base mb-2">Hoy: Día {todayWorkout.day_label}</p>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">{todayWorkout.name}</p>
            </div>
          )}

          {isMember && activePrescription?.trainer && (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="mb-3 flex items-center gap-3">
                <SymbolFrame size="sm" tone="primary" className="rounded-xl">
                  <UserRound size={16} />
                </SymbolFrame>
                <div>
                  <p className="label-base">Publicado por</p>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{activePrescription.trainer.nombre}</p>
                </div>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {dashboardSummary?.siguiente_accion || 'Sigue la estructura del trainer y usa esta vista para entender mejor tu semana.'}
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <SymbolFrame size="sm" tone="primary" className="rounded-xl">
              <NotebookTabs size={18} />
            </SymbolFrame>
            <div>
              <h3 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">
                Vista semanal
              </h3>
              {isMember ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Aquí ves la organización exacta del plan que tu trainer dejó publicada para ti.
                </p>
              ) : null}
            </div>
          </div>
          {plan.workout_days ? (
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

      <ConfirmDialog
        open={showDeleteDialog}
        title="Borrar plan completo"
        description={`Se eliminara el plan completo "${plan.name}" y todos sus dias y ejercicios. Esta accion no se puede deshacer.${plan.is_active ? ' El member se quedara sin este plan activo.' : ''}`}
        confirmLabel="Confirmar borrado"
        isPending={deletePlan.isPending}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={() => deletePlan.mutate({ id: plan.id, memberId: plan.member })}
        data-testid="plan-detail-delete-dialog"
      />
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
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white">{day.name}</h4>
            <p className="text-xs text-neutral-500">{DAY_OF_WEEK_LABELS[day.day_of_week]}</p>
          </div>
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
        {exercise.machine_detail?.name ? (
          <span className="ml-2 text-xs text-primary">{exercise.machine_detail.name}</span>
        ) : null}
      </div>
      <span className="text-xs font-mono text-neutral-500">
        {formatExercisePrescription(exercise)}
      </span>
    </div>
  )
}
