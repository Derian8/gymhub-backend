import { Link, useSearchParams } from 'react-router-dom'
import { Dumbbell, ChevronRight, Calendar, NotebookTabs, Target, UserRound } from 'lucide-react'
import { usePlansQuery } from '../hooks/usePlans'
import { useMemberActivePrescriptionQuery, useMemberDashboardQuery } from '@/modules/members/hooks/useMembers'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { DAY_OF_WEEK_LABELS, formatDate, GOAL_LABELS } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { SymbolFrame } from '@/shared/components/Brand'
import type { ActivePrescription, MemberDashboardSummary, TrainingPlan } from '@/shared/types'

export function PlansPage() {
  const [searchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const { user } = useAuthStore()
  const isMemberView = user?.role === 'member' && !memberId
  const filtros = memberId ? { member: memberId } : undefined
  const { data, isLoading } = usePlansQuery(filtros)
  const memberProfileId = isMemberView ? user?.memberprofile_id || 0 : 0
  const { data: activePrescription } = useMemberActivePrescriptionQuery(memberProfileId)
  const { data: dashboardSummary } = useMemberDashboardQuery(memberProfileId)

  if (isMemberView) {
    const activePlan = activePrescription?.plan_activo

    return (
      <div data-testid="plans-page" className="page-enter">
        <PageHeader
          title="Mi Programa"
          subtitle={activePlan ? 'Vista secundaria para revisar la estructura semanal completa y el contexto del plan que te publicó tu trainer.' : 'Tu trainer todavía no ha publicado una rutina activa completa para ti.'}
        />

        {!activePlan ? (
          <EmptyState
            icon={<Dumbbell size={48} />}
            title="Tu programa aún no está publicado"
            description="Cuando tu trainer termine de publicar tu plan activo, su estructura, nutrición y guías aparecerán aquí."
          />
        ) : (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
              <div className="card p-6" data-testid="member-program-hero">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="label-base mb-2">Programa activo</p>
                    <h2 className="font-heading text-2xl font-bold text-neutral-900 dark:text-white">{activePlan.name}</h2>
                    <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
                      {dashboardSummary?.resumen_hoy || 'Tu trainer estructuró este programa para que sepas exactamente qué hacer y cómo avanzar esta semana.'}
                    </p>
                  </div>
                  <Badge variant={activePrescription?.estado_prescripcion.esta_lista_para_member ? 'success' : 'warning'}>
                    {activePrescription?.estado_prescripcion.esta_lista_para_member ? 'Publicado para ti' : 'Publicación incompleta'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <ProgramStat
                    icon={<Target size={18} />}
                    label="Objetivo"
                    value={GOAL_LABELS[activePlan.goal] || activePlan.goal}
                  />
                  <ProgramStat
                    icon={<Calendar size={18} />}
                    label="Frecuencia"
                    value={`${activePlan.days_per_week} días / semana`}
                  />
                  <ProgramStat
                    icon={<UserRound size={18} />}
                    label="Trainer"
                    value={activePrescription?.trainer?.nombre || 'Asignado'}
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to={`/plans/${activePlan.id}/today`}
                    className="btn-secondary"
                    data-testid="active-plan-today-link"
                  >
                    Volver a entrenamiento
                  </Link>
                  <Link
                    to={`/plans/${activePlan.id}`}
                    className="btn-secondary"
                    data-testid="active-plan-detail-link"
                  >
                    Ver plan completo
                  </Link>
                </div>
              </div>

              <div className="card p-6" data-testid="active-prescription-status">
                <h2 className="mb-3 font-heading text-xl font-bold text-neutral-900 dark:text-white">Qué preparó tu trainer</h2>
                <div className="space-y-2 text-sm">
                  <StatusRow label="Estructura semanal cargada" ready={!!activePrescription?.estado_prescripcion.tiene_dias} />
                  <StatusRow label="Ejercicios listos para ejecutar" ready={!!activePrescription?.estado_prescripcion.tiene_ejercicios} />
                  <StatusRow label="Nutrición asociada" ready={!!activePrescription?.estado_prescripcion.tiene_nutricion} />
                  <StatusRow label="Guías vinculadas" ready={!!activePrescription?.estado_prescripcion.tiene_guias} />
                </div>
                <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">Siguiente acción</p>
                  <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-white">
                    {dashboardSummary?.siguiente_accion || 'Revisa tu programa y sigue la guía publicada por tu trainer.'}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="card p-6" data-testid="program-week-overview">
                <div className="mb-4 flex items-center gap-3">
                  <SymbolFrame size="sm" tone="primary" className="rounded-xl">
                    <NotebookTabs size={18} />
                  </SymbolFrame>
                  <div>
                    <h3 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">Vista ordenada de tu semana</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Estos son los bloques del plan tal como fueron publicados por tu trainer.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {(activePrescription?.dias || []).map((day) => (
                    <div
                      key={day.id}
                      className="rounded-2xl border border-neutral-200 bg-white/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/50"
                      data-testid={`program-day-${day.id}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
                            {day.day_label}
                          </span>
                          <div>
                            <h4 className="font-semibold text-neutral-900 dark:text-white">{day.name}</h4>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {DAY_OF_WEEK_LABELS[day.day_of_week]} · {day.exercises.length} ejercicio(s) cargados
                            </p>
                          </div>
                        </div>
                        {activePrescription?.entrenamiento_hoy?.id === day.id ? (
                          <Badge variant="info">Hoy</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-300">
                        {day.exercises.slice(0, 3).map((exercise) => exercise.name).join(' · ') || 'Este bloque todavía no tiene ejercicios visibles.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <ProgramSidebar
                activePrescription={activePrescription}
                dashboardSummary={dashboardSummary}
              />
            </section>
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
    <div className="flex items-center justify-between rounded-2xl border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
      <Badge variant={ready ? 'success' : 'warning'}>{ready ? 'OK' : 'Pendiente'}</Badge>
    </div>
  )
}

function ProgramStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="mb-3 flex items-center gap-3">
        <SymbolFrame size="sm" tone="primary" className="rounded-xl">
          {icon}
        </SymbolFrame>
        <span className="label-base">{label}</span>
      </div>
      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}

function ProgramSidebar({
  activePrescription,
  dashboardSummary,
}: {
  activePrescription: ActivePrescription | undefined
  dashboardSummary: MemberDashboardSummary | undefined
}) {
  const todayWorkout = activePrescription?.entrenamiento_hoy

  return (
    <div className="space-y-4">
      <div className="card p-6" data-testid="program-today-card">
        <h3 className="font-heading text-lg font-bold text-neutral-900 dark:text-white">Referencia de hoy</h3>
        {todayWorkout ? (
          <>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">La ejecución principal ocurre en la página Entrenamiento; esto queda aquí solo como referencia rápida.</p>
            <p className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">
              Día {todayWorkout.day_label}: {todayWorkout.name}
            </p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {todayWorkout.exercises.length} ejercicio(s) listos para registrar.
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Hoy no tienes un bloque puntual cargado, pero tu programa sigue visible para revisar y mantener contexto.</p>
          </>
        )}
      </div>

      <div className="card p-6" data-testid="program-support-card">
        <h3 className="font-heading text-lg font-bold text-neutral-900 dark:text-white">Apoyo del programa</h3>
        <div className="mt-3 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
          <p>Nutrición asociada: <span className="font-semibold text-neutral-900 dark:text-white">{activePrescription?.perfil_nutricional ? 'Sí' : 'Pendiente'}</span></p>
          <p>Guías del trainer: <span className="font-semibold text-neutral-900 dark:text-white">{activePrescription?.guias_vinculadas.length || 0}</span></p>
          <p>Estado operativo: <span className="font-semibold text-neutral-900 dark:text-white">{dashboardSummary?.payment_status ? 'Activo en seguimiento' : 'Sin registros de pago todavía'}</span></p>
        </div>
      </div>
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
