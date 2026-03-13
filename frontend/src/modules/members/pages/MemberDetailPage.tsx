import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Phone, Calendar, Mail, Dumbbell, CreditCard, CheckSquare } from 'lucide-react'
import { useMemberDetailQuery, useActivateMemberMutation } from '../hooks/useMembers'
import { useMembershipPlansQuery } from '@/modules/billing/hooks/useBilling'
import { Badge, PageHeader, Avatar } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { formatDate } from '@/shared/lib/utils'
import { useState } from 'react'

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const memberId = parseInt(id || '0')
  const { data: member, isLoading } = useMemberDetailQuery(memberId)
  const { data: plans } = useMembershipPlansQuery()
  const { mutate: activate, isPending: isActivating } = useActivateMemberMutation()
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>()

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
            {!member.is_active && (
              <button
                onClick={() => activate({ id: member.id, membershipPlanId: selectedPlanId })}
                disabled={isActivating}
                className="btn-primary flex items-center gap-2"
                data-testid="activate-member-btn"
              >
                {isActivating ? 'Activando...' : 'Activar miembro'}
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
          {/* Activation panel */}
          {!member.is_active && (
            <div className="card p-6 border-yellow-500/30" data-testid="activation-panel">
              <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-4">
                Activar miembro
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                Selecciona un plan de membresía para activar al miembro y generar su calendario de pagos.
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
                        onChange={() => setSelectedPlanId(plan.id)}
                        className="accent-primary"
                      />
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-white text-sm">{plan.name}</p>
                        <p className="text-xs text-neutral-500">${plan.price_monthly}/mes · {plan.duration_months} mes(es)</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <QuickLink
              icon={<Dumbbell size={20} />}
              label="Ver planes"
              to={`/plans?member=${member.id}`}
              testId="member-plans-link"
            />
            <QuickLink
              icon={<CreditCard size={20} />}
              label="Facturación"
              to={`/billing?member=${member.id}`}
              testId="member-billing-link"
            />
            <QuickLink
              icon={<CheckSquare size={20} />}
              label="Asistencia"
              to={`/attendance?member=${member.id}`}
              testId="member-attendance-link"
            />
          </div>
        </div>
      </div>
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
