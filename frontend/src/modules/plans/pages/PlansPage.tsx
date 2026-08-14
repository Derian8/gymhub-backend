import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Dumbbell, ChevronRight, Calendar, NotebookTabs, Target, UserRound, Plus, Archive, Copy, CheckCircle } from 'lucide-react'
import { useArchivePlanMutation, useCreatePlanRevisionMutation, useDuplicatePlanMutation, useFinishPlanMutation, usePlansQuery, usePlansSummaryQuery, usePublishPlanMutation } from '../hooks/usePlans'
import { useMemberActivePrescriptionQuery, useMemberDashboardQuery, useMembersQuery } from '@/modules/members/hooks/useMembers'
import { Badge, PageHeader, EmptyState, StatCard } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { DAY_OF_WEEK_LABELS, formatDate, GOAL_LABELS } from '@/shared/lib/utils'
import { getResolvedContext, useAuthStore } from '@/shared/store/authStore'
import { SymbolFrame } from '@/shared/components/Brand'
import { TrainingPlanWizard } from '../components/TrainingPlanWizard'
import type { ActivePrescription, MemberDashboardSummary, TrainingPlan, TrainingPlanStatus } from '@/shared/types'

const PLAN_STATUS_LABELS: Record<TrainingPlanStatus | 'all' | 'templates', string> = {
  all: 'Todos',
  active: 'Activo',
  draft: 'Borrador',
  scheduled: 'Programado',
  finished: 'Finalizado',
  archived: 'Archivado',
  templates: 'Plantillas',
}

const PLAN_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  active: 'success',
  draft: 'warning',
  scheduled: 'info',
  finished: 'neutral',
  archived: 'neutral',
}

export function PlansPage() {
  const [searchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const { user, activeContext } = useAuthStore()
  const currentContext = getResolvedContext(user, activeContext)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TrainingPlanStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const isMemberView = currentContext === 'cliente' && !memberId
  const filtros = useMemo(() => {
    const params: Record<string, string> = {}
    if (memberId) params.member = memberId
    if (statusFilter !== 'all') params.status = statusFilter
    if (search.trim()) params.search = search.trim()
    return Object.keys(params).length ? params : undefined
  }, [memberId, search, statusFilter])
  const { data, isLoading } = usePlansQuery(filtros)
  const { data: summary } = usePlansSummaryQuery(!isMemberView)
  const { data: unassignedMembers } = useMembersQuery({ assignment: 'unassigned', page: 1 }, !isMemberView)
  const memberProfileId = isMemberView ? user?.memberprofile_id || 0 : 0
  const { data: activePrescription } = useMemberActivePrescriptionQuery(memberProfileId)
  const { data: dashboardSummary } = useMemberDashboardQuery(memberProfileId)

  useEffect(() => {
    if (!isMemberView && searchParams.get('create') === '1') {
      setWizardOpen(true)
    }
  }, [isMemberView, searchParams])

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
            description="Cuando tu trainer publique tu plan activo, su estructura semanal y sus ejercicios aparecerán aquí."
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
                            <h4 className="font-semibold text-neutral-900 dark:text-white">
                              {DAY_OF_WEEK_LABELS[day.day_of_week]} · {day.name}
                            </h4>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {day.day_label ? `Día ${day.day_label} · ` : ''}{day.exercises.length} ejercicio(s) cargados
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
        title={memberId ? 'Planes del miembro' : 'Planes de entrenamiento'}
        subtitle={memberId ? `Mostrando ${data?.count || 0} plan(es) del miembro seleccionado` : 'Crea, asigna y administra las rutinas de tus miembros desde un solo lugar.'}
        action={currentContext === 'instructor' || user?.is_staff ? (
          <button type="button" className="btn-primary" onClick={() => setWizardOpen(true)} data-testid="open-create-plan-wizard">
            <Plus size={16} /> Crear plan
          </button>
        ) : null}
      />

      {!memberId && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Planes activos" value={summary?.active ?? 0} icon={<Dumbbell size={18} />} variant="success" />
          <StatCard label="Planes en borrador" value={summary?.draft ?? 0} icon={<NotebookTabs size={18} />} variant="warning" />
          <StatCard label="Próximos a finalizar" value={summary?.ending_soon ?? 0} icon={<Calendar size={18} />} variant="info" />
          <StatCard label="Miembros sin plan activo" value={summary?.members_without_active_plan ?? 0} icon={<UserRound size={18} />} variant="danger" />
        </div>
      )}

      {!memberId && (summary?.members_without_active_plan ?? 0) > 0 ? (
        <div className="mb-6 rounded-sm border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
          Hay {summary?.members_without_active_plan} miembros que todavía no tienen un plan activo.
        </div>
      ) : null}

      {!memberId && (unassignedMembers?.count ?? 0) > 0 ? (
        <div
          className="mb-6 rounded-sm border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100"
          data-testid="plans-unassigned-members-notice"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Hay {unassignedMembers?.count} miembros registrados sin trainer asignado.</p>
              <p className="mt-1">Asígnalos antes de crearles una rutina para que aparezcan correctamente en tu panel.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/members?assignment=unassigned" className="btn-secondary" data-testid="plans-unassigned-members-link">
                Ver miembros sin asignar
              </Link>
              <button type="button" className="btn-primary" onClick={() => setWizardOpen(true)} data-testid="plans-create-and-assign">
                Crear plan y asignar miembro
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!memberId && (
        <section className="mb-6 grid grid-cols-1 gap-3 rounded-sm border border-neutral-200 p-4 md:grid-cols-[220px_minmax(0,1fr)] dark:border-neutral-800">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Estado</span>
            <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TrainingPlanStatus | 'all')} data-testid="plans-status-filter">
              {(['all', 'active', 'draft', 'scheduled', 'finished', 'archived'] as Array<TrainingPlanStatus | 'all'>).map((status) => (
                <option key={status} value={status}>{PLAN_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Buscar por miembro, correo, plan u objetivo</span>
            <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." data-testid="plans-search-input" />
          </label>
        </section>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} lines={4} />)}
        </div>
      ) : !data?.results.length ? (
        <EmptyState
          icon={<Dumbbell size={48} />}
          title={search || statusFilter !== 'all' ? 'No encontramos planes con estos filtros.' : 'No hay planes de entrenamiento todavía.'}
          description={search || statusFilter !== 'all' ? 'Ajusta la búsqueda o cambia el filtro de estado.' : 'Crea el primer plan para asignar una rutina clara a un miembro.'}
          action={currentContext === 'instructor' || user?.is_staff ? (
            <button type="button" className="btn-primary" onClick={() => setWizardOpen(true)}>Crear primer plan</button>
          ) : null}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.results.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}

      {wizardOpen ? <TrainingPlanWizard open onClose={() => setWizardOpen(false)} /> : null}
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
              {DAY_OF_WEEK_LABELS[todayWorkout.day_of_week]} · {todayWorkout.name}
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
          <p>Días configurados: <span className="font-semibold text-neutral-900 dark:text-white">{activePrescription?.dias.length || 0}</span></p>
          <p>Plan listo: <span className="font-semibold text-neutral-900 dark:text-white">{activePrescription?.estado_prescripcion.esta_lista_para_member ? 'Sí' : 'Pendiente'}</span></p>
          <p>Estado operativo: <span className="font-semibold text-neutral-900 dark:text-white">{dashboardSummary?.payment_status ? 'Activo en seguimiento' : 'Sin registros de pago todavía'}</span></p>
        </div>
      </div>
    </div>
  )
}

function PlanCard({ plan }: { plan: TrainingPlan }) {
  const navigate = useNavigate()
  const duplicatePlan = useDuplicatePlanMutation()
  const createRevision = useCreatePlanRevisionMutation()
  const publishPlan = usePublishPlanMutation()
  const finishPlan = useFinishPlanMutation()
  const archivePlan = useArchivePlanMutation()
  const status = (plan.status || (plan.is_active ? 'active' : 'finished')) as TrainingPlanStatus

  return (
    <div
      data-testid={`plan-card-${plan.id}`}
      className="card p-6 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-primary/10 text-primary rounded-sm">
          <Dumbbell size={20} />
        </div>
        <Badge variant={PLAN_STATUS_VARIANT[status] ?? 'neutral'}>{PLAN_STATUS_LABELS[status]}</Badge>
      </div>
      <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-1">
        {plan.name}
      </h3>
      <p className="mb-2 text-sm text-neutral-500">{plan.member_name || 'Miembro asignado'}{plan.member_email ? ` · ${plan.member_email}` : ''}</p>
      <Badge variant="info" className="mb-3">{GOAL_LABELS[plan.goal] || plan.goal}</Badge>
      <div className="space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
        <p>{plan.days_per_week} días/semana · {plan.weeks_duration} semanas</p>
        <p>Inicio: {formatDate(plan.start_date)}</p>
        {plan.end_date && <p>Fin: {formatDate(plan.end_date)}</p>}
        {plan.workout_days?.length ? <p>{plan.workout_days.length} día(s) configurados</p> : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Link to={`/plans/${plan.id}`} className="btn-secondary text-sm">
          Ver plan <ChevronRight size={14} />
        </Link>
        <div className="flex flex-wrap gap-2">
          {status === 'draft' ? <Link to={`/plans/${plan.id}/edit`} className="btn-primary text-sm" data-testid={`configure-plan-${plan.id}`}>Configurar</Link> : null}
          {status === 'active' ? <button className="btn-primary text-sm" type="button" disabled={createRevision.isPending} onClick={() => createRevision.mutate(plan.id, { onSuccess: (draft) => navigate(`/plans/${draft.id}/edit`) })}>Crear revisión</button> : null}
          {status === 'draft' ? <button className="btn-secondary text-sm" type="button" disabled={publishPlan.isPending} onClick={() => publishPlan.mutate(plan.id)}><CheckCircle size={14} /> Publicar</button> : null}
          <button type="button" className="btn-secondary text-sm" onClick={() => duplicatePlan.mutate({ id: plan.id })} disabled={duplicatePlan.isPending}>
            <Copy size={14} /> Duplicar
          </button>
          {status === 'active' ? (
            <button type="button" className="btn-secondary text-sm" onClick={() => finishPlan.mutate({ id: plan.id })} disabled={finishPlan.isPending}>
              <CheckCircle size={14} /> Finalizar
            </button>
          ) : null}
          {status !== 'archived' ? (
            <button type="button" className="btn-secondary text-sm" onClick={() => archivePlan.mutate({ id: plan.id })} disabled={archivePlan.isPending}>
              <Archive size={14} /> Archivar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
