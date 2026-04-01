import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Phone, Calendar, Mail, Dumbbell, CreditCard, CheckSquare, Apple, AlertTriangle, Activity } from 'lucide-react'
import { useMemberActivePrescriptionQuery, useMemberDetailQuery, useActivateMemberMutation, useAssignTrainerMutation, useMemberDashboardQuery } from '../hooks/useMembers'
import { useMembershipPlansQuery } from '@/modules/billing/hooks/useBilling'
import { Badge, PageHeader, Avatar } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { formatDate, formatDateTime, RISK_LEVEL_BADGE, RISK_LEVEL_LABELS } from '@/shared/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/shared/store/authStore'
import { descripcionPublicacionPrescripcion, leerPublicacionPrescripcion } from '@/shared/lib/prescriptionPublication'

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const memberId = parseInt(id || '0')
  const { data: member, isLoading } = useMemberDetailQuery(memberId)
  const { data: dashboardSummary } = useMemberDashboardQuery(memberId)
  const { data: activePrescription } = useMemberActivePrescriptionQuery(memberId)
  const { data: plans } = useMembershipPlansQuery()
  const { mutate: activate, isPending: isActivating } = useActivateMemberMutation()
  const { mutate: assignTrainer, isPending: isAssigningTrainer } = useAssignTrainerMutation()
  const { user } = useAuthStore()
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>()
  const [agreedPrice, setAgreedPrice] = useState<number | undefined>()
  const lastPublication = useMemo(() => leerPublicacionPrescripcion(memberId), [memberId])

  useEffect(() => {
    if (!member || !plans?.results.length || selectedPlanId) {
      return
    }
    const defaultPlan = plans.results.find((plan) => plan.id === member.membership_plan) ?? plans.results[0]
    if (!defaultPlan) {
      return
    }
    setSelectedPlanId(defaultPlan.id)
    setAgreedPrice(Number(member.precio_suscripcion_actual ?? defaultPlan.price_monthly))
  }, [member, plans, selectedPlanId])

  if (isLoading) {
    return (
      <div className="page-enter">
        <div className="mb-6 h-8 w-32 skeleton rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CardSkeleton lines={5} />
          <div className="lg:col-span-2">
            <CardSkeleton lines={4} />
          </div>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="text-center py-16">
        <p className="text-neutral-500">Miembro no encontrado</p>
        <Link to="/members" className="text-primary mt-2 block">← Volver a miembros</Link>
      </div>
    )
  }

  const canManagePrescription = user?.is_staff || (member.trainer_asignado !== null && member.trainer_asignado === user?.trainerprofile_id)
  const prescriptionStatus = !member.trainer_asignado
    ? 'Sin asignar'
    : activePrescription?.estado_prescripcion.esta_lista_para_member
      ? 'Lista para member'
      : activePrescription?.estado_prescripcion.tiene_plan_activo
        ? 'Incompleta'
        : 'Pendiente'
  const prescriptionVariant = !member.trainer_asignado
    ? 'warning'
    : activePrescription?.estado_prescripcion.esta_lista_para_member
      ? 'success'
      : 'warning'

  return (
    <div data-testid="member-detail-page" className="page-enter">
      <Link to="/members" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-primary transition-colors mb-6">
        <ArrowLeft size={16} />
        Volver a miembros
      </Link>

      <PageHeader
        title={member.full_name}
        subtitle={member.email}
        breadcrumb={[{ label: 'Miembros', href: '/members' }, { label: member.full_name }]}
        action={
          <div className="flex gap-2">
            {member.trainer_asignado && canManagePrescription && (
              <Link
                to={`/members/${member.id}/program`}
                className="btn-primary"
                data-testid="manage-prescription-btn"
              >
                {activePrescription?.estado_prescripcion.tiene_plan_activo ? 'Editar prescripción' : 'Asignar plan al miembro'}
              </Link>
            )}
            {member.trainer_asignado && (
              <Link
                to={`/ai-chat?member=${member.id}`}
                className="btn-secondary"
                data-testid="open-ai-copilot-btn"
              >
                Abrir copiloto IA
              </Link>
            )}
            {!member.is_active && (
              <button
                onClick={() => activate({ id: member.id, planId: selectedPlanId, agreedPrice })}
                disabled={isActivating}
                className="btn-primary flex items-center gap-2"
                data-testid="activate-member-btn"
              >
                {isActivating ? 'Activando...' : 'Activar miembro'}
              </button>
            )}
            {!member.trainer_asignado && user?.role === 'trainer' && (
              <button
                onClick={() => assignTrainer(member.id)}
                disabled={isAssigningTrainer}
                className="btn-secondary"
                data-testid="assign-trainer-btn"
              >
                {isAssigningTrainer ? 'Asignando...' : 'Asignarme cliente'}
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="card p-6 space-y-6" data-testid="member-profile-card">
          <div className="flex flex-col items-center text-center gap-3">
            <Avatar name={member.full_name} photo={member.photo} size="lg" />
            <div>
              <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">{member.full_name}</h2>
              <p className="text-sm text-neutral-500">{member.email}</p>
            </div>
            <Badge variant={member.is_active ? 'success' : 'error'}>
              {member.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
            <Badge variant={member.trainer_asignado ? 'info' : 'warning'}>
              {member.trainer_asignado_nombre ? `Trainer: ${member.trainer_asignado_nombre}` : 'Sin trainer asignado'}
            </Badge>
          </div>

          <div className="space-y-3 text-sm">
            <InfoRow icon={<Mail size={14} />} label="Email" value={member.email} />
            <InfoRow icon={<Phone size={14} />} label="Teléfono" value={member.phone || '—'} />
            <InfoRow icon={<Calendar size={14} />} label="Fecha nacimiento" value={formatDate(member.birth_date)} />
            <InfoRow icon={<Calendar size={14} />} label="Fecha ingreso" value={formatDate(member.join_date)} />
            {member.emergency_contact && (
              <InfoRow icon={<Phone size={14} />} label="Contacto emergencia" value={member.emergency_contact} />
            )}
          </div>
        </div>

        {/* Actions & details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6" data-testid="member-prescription-panel">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="label-base">Prescripción del trainer</p>
                <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white">
                  {member.trainer_asignado
                    ? activePrescription?.plan_activo?.name || 'Aún no hay plan publicado'
                    : 'Primero asigna este cliente'}
                </h3>
                <p className="text-sm text-neutral-500 mt-1">
                  {member.trainer_asignado_nombre
                    ? `Responsable: ${member.trainer_asignado_nombre}`
                    : 'Sin trainer asignado todavía.'}
                </p>
                {lastPublication && (
                  <p className="text-sm text-neutral-500 mt-1" data-testid="member-last-publication">
                    Ultima publicacion: {descripcionPublicacionPrescripcion(lastPublication.tipo)} el {formatDateTime(lastPublication.fechaIso)}
                  </p>
                )}
              </div>
              <Badge variant={prescriptionVariant}>
                {prescriptionStatus}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <PrescriptionTile
                label="Plan activo"
                value={activePrescription?.estado_prescripcion.tiene_plan_activo ? 'Publicado' : 'Pendiente'}
              />
              <PrescriptionTile
                label="Nutrición"
                value={activePrescription?.estado_prescripcion.tiene_nutricion ? 'Asignada' : 'Pendiente'}
              />
              <PrescriptionTile
                label="Visible para member"
                value={activePrescription?.estado_prescripcion.esta_lista_para_member ? 'Sí' : 'No'}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {!member.trainer_asignado && user?.role === 'trainer' ? (
                <button
                  onClick={() => assignTrainer(member.id)}
                  disabled={isAssigningTrainer}
                  className="btn-secondary"
                  data-testid="prescription-assign-trainer-btn"
                >
                  {isAssigningTrainer ? 'Asignando...' : 'Asignarme y empezar prescripción'}
                </button>
              ) : canManagePrescription ? (
                <Link
                  to={`/members/${member.id}/program`}
                  className="btn-secondary"
                  data-testid="open-prescription-flow-btn"
                >
                  {activePrescription?.estado_prescripcion.tiene_plan_activo ? 'Abrir flujo de prescripción' : 'Crear prescripción'}
                </Link>
              ) : null}
              {activePrescription?.plan_activo && (
                <Link
                  to={`/plans/${activePrescription.plan_activo.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                  data-testid="active-plan-detail-link"
                >
                  Ver plan publicado
                </Link>
              )}
            </div>
          </div>

          <div className="card p-6" data-testid="member-risk-panel">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="label-base">Radar de adherencia</p>
                <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white">
                  {dashboardSummary?.siguiente_accion || 'Sin recomendación disponible'}
                </h3>
              </div>
              {member.nivel_riesgo ? (
                <Badge variant={RISK_LEVEL_BADGE[member.nivel_riesgo]}>
                  Riesgo {RISK_LEVEL_LABELS[member.nivel_riesgo]} · {member.riesgo_adherencia || 0}/100
                </Badge>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <InsightTile
                icon={<CheckSquare size={18} />}
                label="Último check-in"
                value={member.days_since_last_checkin == null ? 'Sin registro' : `${member.days_since_last_checkin} días`}
              />
              <InsightTile
                icon={<Dumbbell size={18} />}
                label="Última sesión"
                value={member.days_since_last_session == null ? 'Sin registro' : `${member.days_since_last_session} días`}
              />
              <InsightTile
                icon={<Activity size={18} />}
                label="Último progreso"
                value={member.days_since_last_progress == null ? 'Sin registro' : `${member.days_since_last_progress} días`}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Señales detectadas</p>
              {member.motivos_riesgo?.length ? (
                member.motivos_riesgo.map((reason) => (
                  <div key={reason} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>{reason}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">Sin señales críticas por ahora.</p>
              )}
            </div>
          </div>

          {/* Activation panel */}
          {!member.is_active && (
            <div className="card p-6 border-yellow-500/30" data-testid="activation-panel">
              <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-4">
                Activar miembro
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                Selecciona un plan configurable y define el precio acordado para activar al miembro y generar su suscripción.
              </p>
              {plans?.results && (
                <div className="space-y-2 mb-4">
                  {plans.results.map((plan) => (
                    <label
                      key={plan.id}
                      className={`flex items-center gap-3 p-3 border rounded-sm cursor-pointer transition-colors ${
                        selectedPlanId === plan.id
                          ? 'border-primary bg-primary/5'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={selectedPlanId === plan.id}
                        onChange={() => {
                          setSelectedPlanId(plan.id)
                          setAgreedPrice(Number(plan.price_monthly))
                        }}
                        className="accent-primary"
                      />
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-white text-sm">{plan.name}</p>
                        <p className="text-xs text-neutral-500">${plan.price_monthly}/mes base · {plan.duration_months} mes(es)</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Precio acordado de la suscripción
                </label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={agreedPrice ?? ''}
                  onChange={(event) => setAgreedPrice(event.target.value ? Number(event.target.value) : undefined)}
                  data-testid="activation-agreed-price-input"
                />
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <QuickLink
              icon={<Dumbbell size={20} />}
              label="Asignar plan"
              to={`/members/${member.id}/program`}
              testId="member-program-link"
            />
            <QuickLink
              icon={<CreditCard size={20} />}
              label="Facturación"
              to={`/billing?member=${member.id}`}
              testId="member-billing-link"
            />
            <QuickLink
              icon={<AlertTriangle size={20} />}
              label="Alertas"
              to="/alerts"
              testId="member-alerts-link"
            />
            <QuickLink
              icon={<CheckSquare size={20} />}
              label="Asistencia"
              to={`/attendance?member=${member.id}`}
              testId="member-attendance-link"
            />
            <QuickLink
              icon={<Apple size={20} />}
              label="Nutrición"
              to={`/nutrition?member=${member.id}`}
              testId="member-nutrition-link"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function PrescriptionTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 dark:border-neutral-800 p-3">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}

function InsightTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="flex items-center gap-2 text-neutral-500 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-medium text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-neutral-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
        <p className="text-neutral-700 dark:text-neutral-300">{value}</p>
      </div>
    </div>
  )
}

function QuickLink({ icon, label, to, testId }: { icon: React.ReactNode; label: string; to: string; testId: string }) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="card p-4 flex items-center gap-3 hover:border-primary/50 transition-all hover:-translate-y-0.5 group"
    >
      <span className="text-primary">{icon}</span>
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-primary transition-colors">
        {label}
      </span>
    </Link>
  )
}
