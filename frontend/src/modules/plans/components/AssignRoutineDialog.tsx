import { useEffect, useState } from 'react'
import type React from 'react'
import { CalendarCheck, Search, X } from 'lucide-react'
import { useAdministratorsQuery, useMembersQuery } from '@/modules/members/hooks/useMembers'
import { useQuickRoutineAssignmentMutation } from '../hooks/usePlans'
import type { TrainingTemplate } from '@/shared/types'

function fechaLocal() {
  const ahora = new Date()
  const zona = ahora.getTimezoneOffset()
  return new Date(ahora.getTime() - zona * 60_000).toISOString().slice(0, 10)
}

export function AssignRoutineDialog({ template, onClose, onAssigned }: { template: TrainingTemplate; onClose: () => void; onAssigned?: () => void }) {
  const [busqueda, setBusqueda] = useState('')
  const [memberId, setMemberId] = useState<number | null>(null)
  const membersQuery = useMembersQuery({ search: busqueda.trim() || undefined, page: 1 })
  const members = membersQuery.data?.results ?? []
  const member = members.find((item) => item.id === memberId) ?? null
  const adminsQuery = useAdministratorsQuery(Boolean(member && !member.trainer_asignado))
  const asignar = useQuickRoutineAssignmentMutation()
  const admins = adminsQuery.data ?? []
  const [trainerId, setTrainerId] = useState('')
  const [startDate, setStartDate] = useState(fechaLocal())
  const [weeks, setWeeks] = useState(8)
  const effectiveTrainerId = member?.trainer_asignado ?? (trainerId ? Number(trainerId) : admins[0]?.id ?? null)
  const canAssign = Boolean(member && effectiveTrainerId && startDate && weeks >= 1 && weeks <= 52)

  useEffect(() => { setTrainerId('') }, [memberId])

  const submit = () => {
    if (!member || !effectiveTrainerId || !canAssign) return
    asignar.mutate({
      source_type: 'template',
      template_id: template.id,
      member_id: member.id,
      trainer_id: effectiveTrainerId,
      start_date: startDate,
      weeks_duration: weeks,
      confirm_trainer_change: false,
    }, { onSuccess: () => { onClose(); onAssigned?.() } })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-neutral-950/70 p-4" role="dialog" aria-modal="true" aria-label="Asignar rutina">
      <div className="my-auto w-full max-w-xl rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-200 p-5 dark:border-neutral-800">
          <div><p className="label-base">Asignar rutina{member ? ` a ${member.full_name}` : ''}</p><h2 className="mt-1 text-xl font-bold">{template.nombre}</h2><p className="mt-1 text-sm text-neutral-500">Revisa el contenido y la vigencia antes de confirmar.</p></div>
          <button type="button" className="btn-secondary !p-2" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="mb-2 flex items-center justify-between"><p className="font-semibold">Contenido que se asignará</p><span className="text-xs text-neutral-500">{template.dias.length} días</span></div>
            <div className="max-h-56 space-y-3 overflow-y-auto">
              {template.dias.map((day) => <div key={day.id}>
                <p className="text-sm font-semibold">{day.etiqueta_dia} · {day.nombre}</p>
                <div className="mt-1 space-y-1.5">
                  {day.ejercicios.map((exercise) => {
                    const image = exercise.imagen_visual_url || exercise.imagen_referencia_url || exercise.catalogo_detalle?.animacion_url || exercise.catalogo_detalle?.imagen_url
                    const videoCatalogo = exercise.catalogo_detalle?.video_url
                    const videoAgregado = exercise.url_video
                    return <div key={exercise.id} className="flex items-center gap-2 rounded-lg bg-neutral-50 p-2 text-sm dark:bg-neutral-900/70">
                      {image ? <img src={image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10 text-[9px] font-semibold text-primary">Sin imagen</span>}
                      <span className="min-w-0 flex-1 truncate"><strong>{exercise.nombre}</strong>{exercise.maquina_detalle ? ` · ${exercise.maquina_detalle.name}` : ''}</span>
                      <div className="flex shrink-0 flex-col items-end gap-1">{videoCatalogo ? <a href={videoCatalogo} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary underline">Catálogo</a> : null}{videoAgregado ? <a href={videoAgregado} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary underline">Adicional</a> : null}{!videoCatalogo && !videoAgregado ? <span className="text-xs text-neutral-400">Sin video</span> : null}</div>
                    </div>
                  })}
                </div>
              </div>)}
            </div>
          </div>
          <Field label="Buscar cliente por nombre o correo">
            <span className="relative block">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input className="input pl-10" type="search" value={busqueda} onChange={(event) => { setBusqueda(event.target.value); setMemberId(null) }} placeholder="Escribe un nombre o correo" autoFocus />
            </span>
          </Field>
          {member ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"><p className="font-semibold">{member.full_name}</p><p className="text-neutral-500">{member.email}</p></div>
          ) : membersQuery.isLoading ? (
            <p role="status" className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-500 dark:bg-neutral-900/70">Buscando clientes…</p>
          ) : members.length ? (
            <div className="max-h-44 space-y-2 overflow-y-auto" aria-label="Resultados de clientes">
              {members.map((item) => <button key={item.id} type="button" onClick={() => setMemberId(item.id)} className="w-full rounded-xl border border-neutral-200 p-3 text-left text-sm hover:border-primary dark:border-neutral-800"><span className="block font-semibold">{item.full_name}</span><span className="text-neutral-500">{item.email}</span></button>)}
            </div>
          ) : (
            <p className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-500 dark:bg-neutral-900/70">No encontramos clientes. Prueba con otro nombre o correo.</p>
          )}
          {member?.trainer_asignado ? <div className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800"><span className="font-medium">Administrador responsable:</span> {member.trainer_asignado_nombre || 'Administrador asignado'}</div> : <Field label="Administrador responsable"><select className="input" value={effectiveTrainerId ?? ''} onChange={(event) => setTrainerId(event.target.value)}><option value="">Selecciona un administrador</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.user.first_name ? `${admin.user.first_name} ${admin.user.last_name}` : admin.user.email}</option>)}</select></Field>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha de inicio"><input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
            <Field label="Duración"><select className="input" value={weeks} onChange={(event) => setWeeks(Number(event.target.value))}>{[4, 6, 8, 10, 12].map((option) => <option key={option} value={option}>{option} semanas</option>)}</select></Field>
          </div>
          {member?.tiene_plan_activo ? <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">El sistema valida la vigencia actual y evita publicar una rutina que se traslape con otra activa.</p> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="btn-primary" disabled={!canAssign || asignar.isPending || membersQuery.isLoading} onClick={submit}><CalendarCheck size={16} />{asignar.isPending ? 'Asignando…' : 'Confirmar asignación'}</button></footer>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-sm"><span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>{children}</label>
}
