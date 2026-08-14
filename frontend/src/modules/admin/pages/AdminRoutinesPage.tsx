import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Dumbbell, UserRound } from 'lucide-react'
import { usePlansQuery } from '@/modules/plans/hooks/usePlans'
import { QuickRoutineAssignmentModal } from '@/modules/plans/components/QuickRoutineAssignmentModal'
import { Badge, PageHeader, StatCard } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { formatDate } from '@/shared/lib/utils'
import type { AdminRoutineQueueItem } from '@/shared/types'
import { useAdminDashboard } from '../hooks/useAdminReport'

export function AdminRoutinesPage() {
  const { data, isLoading } = useAdminDashboard()
  const { data: plans, isLoading: plansLoading } = usePlansQuery({ status: 'active' })
  const [selectedClient, setSelectedClient] = useState<AdminRoutineQueueItem | null>(null)

  return (
    <div className="page-enter space-y-7" data-testid="admin-routines-page">
      <PageHeader title="Rutinas" subtitle="Asignaciones rápidas y vencimientos, sin mezclar la operación comercial." />
      {isLoading || !data ? <CardSkeleton lines={6} /> : (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Clientes sin rutina" value={data.training.without_routine_count} icon={<UserRound size={18} />} variant="warning" />
            <StatCard label="Vencen en 14 días" value={data.training.ending_soon_count} icon={<CalendarClock size={18} />} variant="info" />
          </section>
          <section className="grid gap-6 xl:grid-cols-2">
            <Queue title="Clientes sin rutina" items={data.training.without_routine} empty="Todos tienen una rutina activa." onSelect={setSelectedClient} />
            <Queue title="Próximas a vencer" items={data.training.ending_soon} empty="No hay rutinas próximas a vencer." onSelect={setSelectedClient} />
          </section>
        </>
      )}

      <section className="card p-5 sm:p-6">
        <div><p className="label-base">Consulta</p><h2 className="mt-1 text-xl font-bold">Rutinas activas</h2></div>
        {plansLoading ? <div className="mt-4"><CardSkeleton lines={4} /></div> : (
          <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
            {plans?.results.length ? plans.results.map((plan) => (
              <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold">{plan.member_name || 'Cliente'} · {plan.name}</p>
                  <p className="text-xs text-neutral-500">Finaliza {plan.end_date ? formatDate(plan.end_date) : 'sin fecha'} · {plan.days_per_week} días/semana</p>
                </div>
                <div className="flex items-center gap-2"><Badge variant="success">Activa</Badge><Link className="btn-secondary text-sm" to={`/members/${plan.member}`}>Ver cliente</Link></div>
              </div>
            )) : <p className="py-8 text-center text-sm text-neutral-500">No hay rutinas activas.</p>}
          </div>
        )}
      </section>
      <QuickRoutineAssignmentModal client={selectedClient} onClose={() => setSelectedClient(null)} />
    </div>
  )
}

function Queue({ title, items, empty, onSelect }: { title: string; items: AdminRoutineQueueItem[]; empty: string; onSelect: (item: AdminRoutineQueueItem) => void }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><Dumbbell size={20} className="text-primary" /></div>
      <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
        {items.length ? items.map((item) => (
          <div key={`${item.member_id}-${item.plan_id ?? 0}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div><p className="font-semibold">{item.member_name}</p><p className="text-xs text-neutral-500">{item.end_date ? `Finaliza ${formatDate(item.end_date)}` : item.trainer_name || 'Sin entrenador'}</p></div>
            {item.can_publish ? <button type="button" className="btn-primary text-sm" onClick={() => onSelect(item)}>{item.end_date ? 'Programar siguiente' : 'Asignar plantilla'}</button> : <Link to={`/billing?member=${item.member_id}`} className="btn-secondary text-sm">Regularizar pago</Link>}
          </div>
        )) : <p className="py-8 text-center text-sm text-neutral-500">{empty}</p>}
      </div>
    </section>
  )
}
