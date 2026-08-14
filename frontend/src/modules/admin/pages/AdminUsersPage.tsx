import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ShieldCheck, UserRoundCheck, Users } from 'lucide-react'
import { useMembershipPlansQuery } from '@/modules/billing/hooks/useBilling'
import { useTrainersQuery } from '@/modules/members/hooks/useMembers'
import { Badge, EmptyState, PageHeader } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import type { User } from '@/shared/types'
import { useAdminUsers, useEnableClientProfileMutation } from '../hooks/useAdminReport'

export function AdminUsersPage() {
  const { data: users, isLoading } = useAdminUsers()
  const [selected, setSelected] = useState<User | null>(null)

  return (
    <div className="page-enter space-y-7" data-testid="admin-users-page">
      <PageHeader
        title="Usuarios y perfiles"
        subtitle="Una sola cuenta puede tener capacidades de instructor y cliente, con contextos separados."
      />
      {isLoading ? <CardSkeleton lines={7} /> : (
        <section className="card overflow-hidden">
          <div className="border-b border-neutral-200 p-5 dark:border-neutral-800">
            <p className="label-base">Accesos</p>
            <h2 className="mt-1 text-xl font-bold">Cuentas registradas</h2>
          </div>
          {users?.length ? (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {users.map((user) => {
                const profiles = user.perfiles_disponibles || []
                const canBecomeClient = Boolean(user.trainerprofile_id && !user.memberprofile_id)
                return (
                  <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900 dark:text-white">
                        {`${user.first_name} ${user.last_name}`.trim() || user.email}
                      </p>
                      <p className="text-sm text-neutral-500">{user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profiles.map((profile) => (
                          <Badge key={profile} variant={profile === 'administrador' ? 'error' : profile === 'instructor' ? 'info' : 'success'}>
                            {profile}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {canBecomeClient ? (
                      <button type="button" className="btn-primary" onClick={() => setSelected(user)}>
                        <UserRoundCheck size={16} /> Habilitar como cliente
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-xs text-neutral-500">
                        <ShieldCheck size={15} /> Perfiles configurados
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : <EmptyState icon={<Users size={30} />} title="No hay cuentas" description="Registra el primer usuario para administrar sus perfiles." />}
        </section>
      )}
      {selected ? <EnableClientModal user={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}

function EnableClientModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { data: trainers } = useTrainersQuery()
  const { data: plans } = useMembershipPlansQuery()
  const mutation = useEnableClientProfileMutation()
  const [trainerId, setTrainerId] = useState(String(user.trainerprofile_id || ''))
  const [planId, setPlanId] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState<'cash' | 'sinpe' | 'transfer' | 'other'>('cash')
  const [reference, setReference] = useState('')
  const activePlans = useMemo(
    () => plans?.results.filter((plan) => (
      plan.is_active !== false
      && (!plan.trainer || plan.trainer === Number(trainerId))
    )) || [],
    [plans, trainerId],
  )

  useEffect(() => {
    if (!activePlans.some((plan) => String(plan.id) === planId)) {
      setPlanId(activePlans[0] ? String(activePlans[0].id) : '')
    }
  }, [activePlans, planId])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!user.trainerprofile_id || !trainerId || !planId) return
    mutation.mutate({
      trainerId: user.trainerprofile_id,
      payload: {
        entrenador_asignado: Number(trainerId),
        telefono: phone,
        plan_membresia: Number(planId),
        tipo_membresia: 'catalogo',
        renovacion_automatica: true,
        metodo_pago: method,
        referencia_pago: reference,
      },
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Habilitar perfil de cliente">
      <form onSubmit={submit} className="card w-full max-w-xl space-y-5 p-6">
        <div>
          <p className="label-base">Cuenta compartida</p>
          <h2 className="mt-1 text-2xl font-bold">Habilitar perfil de cliente</h2>
          <p className="mt-1 text-sm text-neutral-500">{user.first_name || user.email} conservará su perfil de instructor y podrá cambiar de contexto.</p>
        </div>
        <label className="block text-sm font-medium">Instructor responsable
          <select className="input mt-2 w-full" value={trainerId} onChange={(event) => setTrainerId(event.target.value)} required>
            {trainers?.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.user.first_name} {trainer.user.last_name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Membresía
          <select className="input mt-2 w-full" value={planId} onChange={(event) => setPlanId(event.target.value)} required>
            {activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · ₡{plan.price}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Teléfono
          <input className="input mt-2 w-full" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Método del primer pago
            <select className="input mt-2 w-full" value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
              <option value="cash">Efectivo</option><option value="sinpe">SINPE</option><option value="transfer">Transferencia</option><option value="other">Otro</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Referencia
            <input className="input mt-2 w-full" value={reference} onChange={(event) => setReference(event.target.value)} required={method !== 'cash'} />
          </label>
        </div>
        {!activePlans.length ? <p className="text-sm text-amber-600">Crea primero una membresía activa en Pagos.</p> : null}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending || !activePlans.length}>{mutation.isPending ? 'Guardando…' : 'Habilitar y registrar pago'}</button>
        </div>
      </form>
    </div>
  )
}
