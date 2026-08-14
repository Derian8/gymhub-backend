import { useEffect, useMemo, useState } from 'react'
import { Calendar, Dumbbell, UserRound, X } from 'lucide-react'
import { useTrainersQuery } from '@/modules/members/hooks/useMembers'
import { Badge } from '@/shared/components/UI'
import { formatDate } from '@/shared/lib/utils'
import type { AdminRoutineQueueItem } from '@/shared/types'
import { useQuickRoutineAssignmentMutation, useTrainingTemplatesQuery } from '../hooks/usePlans'

interface QuickRoutineAssignmentModalProps {
  client: AdminRoutineQueueItem | null
  onClose: () => void
}

function localDateIso(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function nextDate(dateIso?: string) {
  if (!dateIso) return localDateIso()
  const date = new Date(`${dateIso}T12:00:00`)
  date.setDate(date.getDate() + 1)
  return localDateIso(date)
}

export function QuickRoutineAssignmentModal({ client, onClose }: QuickRoutineAssignmentModalProps) {
  const templatesQuery = useTrainingTemplatesQuery(Boolean(client))
  const trainersQuery = useTrainersQuery(Boolean(client))
  const assignment = useQuickRoutineAssignmentMutation()
  const [templateId, setTemplateId] = useState('')
  const [trainerId, setTrainerId] = useState('')
  const [startDate, setStartDate] = useState(localDateIso())
  const [weeksDuration, setWeeksDuration] = useState(8)
  const [preview, setPreview] = useState(false)

  const templates = templatesQuery.data?.results ?? []
  const trainers = trainersQuery.data ?? []
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === Number(templateId)),
    [templateId, templates],
  )
  const selectedTrainer = useMemo(
    () => trainers.find((trainer) => trainer.id === Number(trainerId)),
    [trainerId, trainers],
  )

  useEffect(() => {
    if (!client) return
    setTemplateId('')
    setTrainerId(client.trainer_id ? String(client.trainer_id) : '')
    setStartDate(nextDate(client.end_date))
    setWeeksDuration(8)
    setPreview(false)
  }, [client])

  useEffect(() => {
    if (client && !templateId && templates.length) setTemplateId(String(templates[0].id))
  }, [client, templateId, templates])

  useEffect(() => {
    if (client && !trainerId && trainers.length) setTrainerId(String(trainers[0].id))
  }, [client, trainerId, trainers])

  if (!client) return null

  const canContinue = Boolean(templateId && trainerId && startDate && weeksDuration >= 1 && weeksDuration <= 52)
  const trainerName = selectedTrainer
    ? selectedTrainer.user.first_name || selectedTrainer.user.email
    : 'Sin seleccionar'

  const submit = () => {
    if (!canContinue) return
    assignment.mutate({
      member_id: client.member_id,
      trainer_id: Number(trainerId),
      template_id: Number(templateId),
      start_date: startDate,
      weeks_duration: weeksDuration,
      confirm_trainer_change: Boolean(client.trainer_id && client.trainer_id !== Number(trainerId)),
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label="Asignar rutina rápida">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start justify-between border-b border-neutral-200 p-5 dark:border-neutral-800">
          <div>
            <p className="label-base">Asignación rápida</p>
            <h2 className="mt-1 font-heading text-2xl font-bold">{client.member_name}</h2>
            <p className="mt-1 text-sm text-neutral-500">Plantilla, responsable y vigencia en una sola revisión.</p>
          </div>
          <button type="button" className="p-2 text-neutral-500 hover:text-primary" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>

        {!client.can_publish ? (
          <div className="m-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
            El cliente debe regularizar su estado comercial antes de publicar una rutina.
          </div>
        ) : preview ? (
          <div className="space-y-5 p-5" data-testid="quick-routine-preview">
            <div className="grid gap-3 sm:grid-cols-2">
              <Review icon={<UserRound size={18} />} label="Cliente" value={client.member_name} />
              <Review icon={<UserRound size={18} />} label="Entrenador" value={trainerName} />
              <Review icon={<Dumbbell size={18} />} label="Plantilla" value={selectedTemplate?.nombre || 'Sin seleccionar'} />
              <Review icon={<Calendar size={18} />} label="Inicio y duración" value={`${formatDate(startDate)} · ${weeksDuration} semanas`} />
            </div>
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Contenido que se publicará</p>
                <Badge variant="info">{selectedTemplate?.dias.length ?? 0} día(s)</Badge>
              </div>
              <div className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                {(selectedTemplate?.dias ?? []).map((day) => (
                  <p key={day.id}><strong>{day.nombre}:</strong> {day.ejercicios.map((exercise) => exercise.nombre).join(' · ')}</p>
                ))}
              </div>
            </div>
            {client.trainer_id && client.trainer_id !== Number(trainerId) ? (
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                Al confirmar también cambiará el entrenador responsable de este cliente.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Plantilla</span>
              <select className="input" value={templateId} onChange={(event) => setTemplateId(event.target.value)} data-testid="quick-routine-template">
                <option value="">Selecciona una plantilla</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.nombre}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Entrenador responsable</span>
              <select className="input" value={trainerId} onChange={(event) => setTrainerId(event.target.value)} data-testid="quick-routine-trainer">
                <option value="">Selecciona un entrenador</option>
                {trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>{trainer.user.first_name} {trainer.user.last_name}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Fecha de inicio</span>
                <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Duración en semanas</span>
                <input className="input" type="number" min={1} max={52} value={weeksDuration} onChange={(event) => setWeeksDuration(Number(event.target.value))} />
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 border-t border-neutral-200 p-5 dark:border-neutral-800">
          {preview ? <button type="button" className="btn-secondary" onClick={() => setPreview(false)}>Editar</button> : null}
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          {!client.can_publish ? (
            <a className="btn-primary" href={`/billing?member=${client.member_id}`}>Regularizar pago</a>
          ) : preview ? (
            <button type="button" className="btn-primary" disabled={assignment.isPending} onClick={submit} data-testid="quick-routine-confirm">
              {assignment.isPending ? 'Publicando...' : client.end_date ? 'Confirmar programación' : 'Confirmar y publicar'}
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={!canContinue} onClick={() => setPreview(true)}>Revisar rutina</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Review({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center gap-2 text-primary">{icon}<span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span></div>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  )
}
