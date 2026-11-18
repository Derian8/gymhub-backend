import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { plansApi } from '@/modules/plans/api/plansApi'
import { Badge, PageHeader } from '@/shared/components/UI'
import { formatDate } from '@/shared/lib/utils'

export function RoutineClientsPage() {
  const { id } = useParams()
  const templateId = Number(id)
  const [historial, setHistorial] = useState(false)
  const [page, setPage] = useState(1)
  const template = useQuery({ queryKey: ['plan-template', templateId], queryFn: () => plansApi.trainingTemplate(templateId) })
  const clients = useQuery({
    queryKey: ['template-clients', templateId, historial, page],
    queryFn: () => plansApi.templateClients(templateId, historial, page),
  })
  return <div className="page-enter space-y-6">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" to="/routines"><ArrowLeft size={16} /> Rutinas</Link>
    <PageHeader title={template.data?.nombre ?? 'Clientes de la rutina'} subtitle="Las asignaciones existentes conservan su propia versión. Para cambiar un cliente, crea una revisión de su plan." />
    <div className="flex gap-2" aria-label="Estado de las asignaciones">
      <button type="button" aria-pressed={!historial} className={historial ? 'btn-secondary' : 'btn-primary'} onClick={() => { setHistorial(false); setPage(1) }}>Vigentes</button>
      <button type="button" aria-pressed={historial} className={historial ? 'btn-primary' : 'btn-secondary'} onClick={() => { setHistorial(true); setPage(1) }}>Anteriores</button>
    </div>
    {clients.isLoading ? <div className="card p-6">Cargando asignaciones…</div> : clients.isError ? <div className="card p-6">No se pudieron cargar las asignaciones.</div> : !clients.data?.results.length ? <div className="card p-6 text-neutral-600 dark:text-neutral-300">No hay asignaciones en esta sección.</div> : <div className="card overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"><tr><th className="p-4">Cliente</th><th className="p-4">Plan asignado</th><th className="p-4">Estado</th><th className="p-4">Inicio</th><th className="p-4">Acciones</th></tr></thead><tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">{clients.data.results.map((plan) => <tr key={plan.id}><td className="p-4"><div className="font-semibold">{plan.member_name}</div><div className="text-neutral-600 dark:text-neutral-300">{plan.member_email}</div></td><td className="p-4">{plan.name} · v{plan.numero_version ?? 1}</td><td className="p-4"><Badge variant={plan.status === 'active' ? 'success' : plan.status === 'scheduled' ? 'info' : 'neutral'}>{plan.status === 'active' ? 'Activa' : plan.status === 'scheduled' ? 'Programada' : 'Anterior'}</Badge></td><td className="p-4">{formatDate(plan.start_date)}</td><td className="p-4"><Link className="inline-flex min-h-11 items-center px-2 font-semibold text-primary" to={`/plans/${plan.id}`}>Ver plan</Link><Link className="inline-flex min-h-11 items-center px-2 font-semibold text-primary" to={`/members/${plan.member}/history`}>Historial</Link></td></tr>)}</tbody></table></div>}
    {(clients.data?.previous || clients.data?.next) && <div className="flex gap-2"><button className="btn-secondary" disabled={!clients.data.previous} onClick={() => setPage((value) => value - 1)}>Anterior</button><button className="btn-secondary" disabled={!clients.data.next} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div>}
  </div>
}
