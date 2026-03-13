import { Link } from 'react-router-dom'
import { Dumbbell, ChevronRight } from 'lucide-react'
import { usePlansQuery } from '../hooks/usePlans'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { formatDate, GOAL_LABELS } from '@/shared/lib/utils'
import type { TrainingPlan } from '@/shared/types'

export function PlansPage() {
  const { data, isLoading } = usePlansQuery()

  return (
    <div data-testid="plans-page" className="page-enter">
      <PageHeader title="Planes de Entrenamiento" subtitle={`${data?.count || 0} planes`} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} lines={4} />)}
        </div>
      ) : !data?.results.length ? (
        <EmptyState
          icon={<Dumbbell size={48} />}
          title="Sin planes de entrenamiento"
          description="No hay planes disponibles en este momento."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.results.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan }: { plan: TrainingPlan }) {
  return (
    <Link
      to={`/plans/${plan.id}`}
      data-testid={`plan-card-${plan.id}`}
      className="card p-6 hover:border-primary/50 transition-all duration-300 hover:-translate-y-0.5 block group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-primary/10 text-primary rounded-sm">
          <Dumbbell size={20} />
        </div>
        {plan.is_active ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="neutral">Inactivo</Badge>
        )}
      </div>
      <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-1 group-hover:text-primary transition-colors">
        {plan.name}
      </h3>
      <Badge variant="info" className="mb-3">{GOAL_LABELS[plan.goal] || plan.goal}</Badge>
      <div className="space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
        <p>{plan.days_per_week} días/semana · {plan.weeks_duration} semanas</p>
        <p>Inicio: {formatDate(plan.start_date)}</p>
        {plan.end_date && <p>Fin: {formatDate(plan.end_date)}</p>}
      </div>
      <div className="flex items-center justify-end mt-4 text-primary text-sm font-medium group-hover:gap-2 gap-1 transition-all">
        Ver plan <ChevronRight size={14} />
      </div>
    </Link>
  )
}
