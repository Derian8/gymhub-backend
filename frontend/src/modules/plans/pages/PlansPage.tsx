import { Link, useSearchParams } from 'react-router-dom'
import { Dumbbell, ChevronRight } from 'lucide-react'
import { usePlansQuery } from '../hooks/usePlans'
import { useMemberActivePrescriptionQuery } from '@/modules/members/hooks/useMembers'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { formatDate, GOAL_LABELS } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import type { TrainingPlan } from '@/shared/types'

export function PlansPage() {
  const [searchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const { user } = useAuthStore()
  const isMemberView = user?.role === 'member' && !memberId
  const filtros = memberId ? { member: memberId } : undefined
  const { data, isLoading } = usePlansQuery(filtros)
  const { data: activePrescription } = useMemberActivePrescriptionQuery(isMemberView ? user?.memberprofile_id || 0 : 0)

  if (isMemberView) {
    const activePlan = activePrescription?.plan_activo

    return (
      <div data-testid="plans-page" className="page-enter">
        <PageHeader
          title="Mi Plan"
          subtitle={activePlan ? 'Esta es la rutina activa definida por tu trainer.' : 'Tu trainer aun no ha publicado una rutina activa completa.'}
        />

        {!activePlan ? (
          <EmptyState
            icon={<Dumbbell size={48} />}
            title="Sin rutina activa"
            description="Cuando tu trainer publique tu plan activo, lo verás aquí."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <PlanCard plan={activePlan} />
            <div className="card p-6" data-testid="active-prescription-status">
              <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-3">Estado de la prescripción</h2>
              <div className="space-y-2 text-sm">
                <StatusRow label="Días cargados" ready={!!activePrescription?.estado_prescripcion.tiene_dias} />
                <StatusRow label="Ejercicios listos" ready={!!activePrescription?.estado_prescripcion.tiene_ejercicios} />
                <StatusRow label="Nutrición asociada" ready={!!activePrescription?.estado_prescripcion.tiene_nutricion} />
                <StatusRow label="Guías vinculadas" ready={!!activePrescription?.estado_prescripcion.tiene_guias} />
              </div>
              <Link
                to={`/plans/${activePlan.id}/today`}
                className="btn-primary mt-5 w-full text-center"
                data-testid="active-plan-today-link"
              >
                Ver entrenamiento de hoy
              </Link>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div data-testid="plans-page" className="page-enter">
      <PageHeader
        title={memberId ? 'Planes Del Miembro' : 'Planes de Entrenamiento'}
        subtitle={memberId ? `Mostrando ${data?.count || 0} plan(es) del miembro seleccionado` : `${data?.count || 0} planes`}
      />

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

function StatusRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
      <Badge variant={ready ? 'success' : 'warning'}>{ready ? 'OK' : 'Pendiente'}</Badge>
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
