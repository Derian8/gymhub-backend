import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { AlertTriangle, Copy, Plus, Trash2, X } from 'lucide-react'
import { Avatar, Badge } from '@/shared/components/UI'
import { DAY_OF_WEEK_LABELS, GOAL_LABELS, MUSCLE_LABELS, formatDate } from '@/shared/lib/utils'
import { useMembersQuery } from '@/modules/members/hooks/useMembers'
import { useCreateCompletePlanMutation, useTrainingTemplatesQuery } from '../hooks/usePlans'
import type {
  CompleteTrainingPlanPayload,
  DayLabel,
  DayOfWeek,
  ExercisePayload,
  ExerciseType,
  GoalType,
  MemberProfile,
  MuscleGroup,
  TrainingPlanLevel,
  TrainingPlanStatus,
} from '@/shared/types'

const dayLabels: DayLabel[] = ['A', 'B', 'C', 'D']
const weekdays: Array<{ value: DayOfWeek; label: string }> = [
  { value: 'mon', label: 'Lunes' },
  { value: 'tue', label: 'Martes' },
  { value: 'wed', label: 'Miércoles' },
  { value: 'thu', label: 'Jueves' },
  { value: 'fri', label: 'Viernes' },
  { value: 'sat', label: 'Sábado' },
  { value: 'sun', label: 'Domingo' },
]
const goals: Array<{ value: GoalType; label: string }> = [
  { value: 'fat_loss', label: 'Pérdida de grasa' },
  { value: 'muscle_gain', label: 'Ganancia muscular' },
  { value: 'endurance', label: 'Resistencia' },
  { value: 'flexibility', label: 'Movilidad' },
  { value: 'general', label: 'Acondicionamiento general' },
  { value: 'maintenance', label: 'Personalizado' },
]
const muscles: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'core', 'full_body', 'cardio']

type WizardDay = CompleteTrainingPlanPayload['days'][number]

interface TrainingPlanWizardProps {
  open: boolean
  onClose: () => void
  preselectedMember?: MemberProfile | null
  onCreated?: (planId: number) => void
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addWeeks(dateIso: string, weeks: number) {
  const date = new Date(`${dateIso}T00:00:00`)
  date.setDate(date.getDate() + weeks * 7)
  return date.toISOString().slice(0, 10)
}

function emptyExercise(order = 0): Omit<ExercisePayload, 'workout_day'> {
  return {
    name: '',
    muscle_group: 'full_body',
    exercise_type: 'strength',
    sets: 3,
    reps_range: '8-12',
    target_minutes: null,
    machine: null,
    weight_suggestion_kg: null,
    rest_seconds: 60,
    technique_notes: '',
    order,
  }
}

function normalizeExercise(exercise: Omit<ExercisePayload, 'workout_day'>): Omit<ExercisePayload, 'workout_day'> {
  if (exercise.muscle_group === 'cardio' || exercise.exercise_type === 'timed') {
    return {
      ...exercise,
      exercise_type: 'timed',
      sets: null,
      reps_range: '',
      target_minutes: exercise.target_minutes ?? 10,
      weight_suggestion_kg: null,
    }
  }
  return {
    ...exercise,
    exercise_type: 'strength',
    sets: exercise.sets ?? 3,
    reps_range: exercise.reps_range || '8-12',
    target_minutes: null,
  }
}

export function TrainingPlanWizard({ open, onClose, preselectedMember, onCreated }: TrainingPlanWizardProps) {
  const [step, setStep] = useState(preselectedMember ? 2 : 1)
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<MemberProfile | null>(preselectedMember ?? null)
  const [conflictStrategy, setConflictStrategy] = useState<CompleteTrainingPlanPayload['conflict_strategy']>('keep')
  const [form, setForm] = useState({
    name: '',
    goal: 'general' as GoalType,
    level: 'intermediate' as TrainingPlanLevel,
    start_date: todayIso(),
    weeks_duration: 8,
    end_date: addWeeks(todayIso(), 8),
    days_per_week: 3,
    notes: '',
    status: 'draft' as TrainingPlanStatus,
  })
  const [days, setDays] = useState<WizardDay[]>([])
  const membersQuery = useMembersQuery({ search, ordering: 'prescripcion' }, open)
  const templatesQuery = useTrainingTemplatesQuery()
  const createCompletePlan = useCreateCompletePlanMutation()

  useEffect(() => {
    if (!open) return
    setSelectedMember(preselectedMember ?? null)
    setStep(preselectedMember ? 2 : 1)
  }, [open, preselectedMember])

  useEffect(() => {
    setForm((current) => ({
      ...current,
      end_date: addWeeks(current.start_date, current.weeks_duration),
    }))
  }, [form.start_date, form.weeks_duration])

  const hasActivePlan = selectedMember?.tiene_plan_activo
  const totalExercises = days.reduce((total, day) => total + day.exercises.length, 0)
  const canContinueMember = !!selectedMember && (!hasActivePlan || conflictStrategy !== 'keep' || form.status !== 'active')
  const canSave = !!selectedMember && form.name.trim().length > 0 && days.every((day) => day.name.trim() && day.exercises.every((exercise) => exercise.name.trim()))
  const filteredMembers = membersQuery.data?.results ?? []

  const activeFiltersText = useMemo(() => search.trim() ? `Búsqueda activa: ${search.trim()}` : '', [search])

  if (!open) return null

  const updateExercise = (dayIndex: number, exerciseIndex: number, patch: Partial<Omit<ExercisePayload, 'workout_day'>>) => {
    setDays((current) => current.map((day, index) => {
      if (index !== dayIndex) return day
      return {
        ...day,
        exercises: day.exercises.map((exercise, itemIndex) => (
          itemIndex === exerciseIndex ? normalizeExercise({ ...exercise, ...patch }) : exercise
        )),
      }
    }))
  }

  const addDay = () => {
    setDays((current) => {
      const order = current.length
      return [
        ...current,
        {
          name: `Día ${dayLabels[order] ?? 'A'}`,
          day_label: dayLabels[order] ?? 'A',
          day_of_week: weekdays[order % weekdays.length].value,
          order,
          exercises: [emptyExercise(0)],
        },
      ]
    })
  }

  const duplicateDay = (day: WizardDay) => {
    setDays((current) => [
      ...current,
      {
        ...day,
        name: `${day.name} (copia)`,
        order: current.length,
        exercises: day.exercises.map((exercise, index) => ({ ...exercise, name: `${exercise.name} (copia)`, order: index })),
      },
    ])
  }

  const applyTemplate = (templateId: number) => {
    const template = templatesQuery.data?.results.find((item) => item.id === templateId)
    if (!template) return
    setForm((current) => ({
      ...current,
      name: current.name || template.nombre,
      goal: template.objetivo,
      days_per_week: template.dias_por_semana_sugeridos,
    }))
    setDays(template.dias.map((day, index) => ({
      name: day.nombre,
      day_label: day.etiqueta_dia,
      day_of_week: weekdays[index % weekdays.length].value,
      order: index,
      exercises: day.ejercicios.map((exercise, exerciseIndex) => normalizeExercise({
        name: exercise.nombre,
        muscle_group: exercise.grupo_muscular,
        exercise_type: exercise.tipo_ejercicio,
        sets: exercise.series,
        reps_range: exercise.rango_repeticiones,
        target_minutes: exercise.minutos_objetivo,
        machine: null,
        weight_suggestion_kg: exercise.peso_sugerido_kg,
        rest_seconds: exercise.descanso_segundos,
        technique_notes: exercise.notas_tecnicas,
        order: exerciseIndex,
      })),
    })))
    setStep(3)
  }

  const submit = (status: TrainingPlanStatus) => {
    if (!selectedMember || !canSave) return
    createCompletePlan.mutate({
      member: selectedMember.id,
      name: form.name,
      goal: form.goal,
      start_date: form.start_date,
      end_date: form.end_date,
      weeks_duration: form.weeks_duration,
      days_per_week: form.days_per_week,
      status,
      level: form.level,
      notes: form.notes,
      conflict_strategy: status === 'active' ? conflictStrategy : 'keep',
      days,
    }, {
      onSuccess: (plan) => {
        onCreated?.(plan.id)
        onClose()
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-950/70 px-4 py-6">
      <div className="mx-auto max-w-5xl rounded-sm border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="label-base">Planes de entrenamiento</p>
            <h2 className="font-heading text-2xl font-bold text-neutral-900 dark:text-white">Crear plan</h2>
            <p className="text-sm text-neutral-500">Crea, asigna y revisa la rutina antes de publicarla.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-4 gap-2 text-xs font-semibold uppercase tracking-wide">
          {['Miembro', 'Datos', 'Rutina', 'Revisión'].map((label, index) => (
            <button
              key={label}
              type="button"
              className={`rounded-sm border px-2 py-2 ${step === index + 1 ? 'border-primary bg-primary/10 text-primary' : 'border-neutral-200 text-neutral-500 dark:border-neutral-800'}`}
              onClick={() => setStep(index + 1)}
              disabled={index > 0 && !selectedMember}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {step === 1 && (
          <section className="space-y-4">
            <Field label="Buscar miembro por nombre o correo">
              <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Derian, correo@..." data-testid="plan-member-search" />
            </Field>
            {activeFiltersText ? <p className="text-xs text-neutral-500">{activeFiltersText}</p> : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={`rounded-sm border p-4 text-left transition ${selectedMember?.id === member.id ? 'border-primary bg-primary/10' : 'border-neutral-200 dark:border-neutral-800'}`}
                  onClick={() => setSelectedMember(member)}
                  data-testid={`select-plan-member-${member.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={member.full_name} photo={member.photo} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-neutral-900 dark:text-white">{member.full_name}</p>
                      <p className="truncate text-sm text-neutral-500">{member.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={member.tiene_plan_activo ? 'success' : 'warning'}>
                          {member.tiene_plan_activo ? 'Plan activo' : 'Sin plan activo'}
                        </Badge>
                        <Badge variant="neutral">{member.estado_prescripcion?.replace(/_/g, ' ') || 'Sin estado'}</Badge>
                        {member.membresia_actual?.status ? <Badge variant="info">{member.membresia_actual.status}</Badge> : null}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {!filteredMembers.length && !membersQuery.isLoading ? (
              <p className="text-sm text-neutral-500">No encontramos miembros con estos filtros.</p>
            ) : null}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            {selectedMember && (
              <div className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-sm text-neutral-500">Miembro seleccionado</p>
                <p className="font-semibold text-neutral-900 dark:text-white">{selectedMember.full_name}</p>
                {hasActivePlan ? (
                  <div className="mt-3 rounded-sm border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                    <div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> Este miembro ya tiene un plan activo.</div>
                    <select className="input" value={conflictStrategy} onChange={(event) => setConflictStrategy(event.target.value as CompleteTrainingPlanPayload['conflict_strategy'])}>
                      <option value="keep">Cancelar operación activa</option>
                      <option value="replace_active">Reemplazar al iniciar el nuevo plan</option>
                      <option value="schedule_after_active">Programar el nuevo plan para después</option>
                    </select>
                  </div>
                ) : null}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre del plan">
                <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required data-testid="wizard-plan-name" />
              </Field>
              <Field label="Objetivo">
                <select className="input" value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value as GoalType })}>
                  {goals.map((goal) => <option key={goal.value} value={goal.value}>{goal.label}</option>)}
                </select>
              </Field>
              <Field label="Nivel">
                <select className="input" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as TrainingPlanLevel })}>
                  <option value="beginner">Principiante</option>
                  <option value="intermediate">Intermedio</option>
                  <option value="advanced">Avanzado</option>
                  <option value="custom">Personalizado</option>
                </select>
              </Field>
              <Field label="Estado inicial">
                <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TrainingPlanStatus })}>
                  <option value="draft">Borrador</option>
                  <option value="active">Activo</option>
                  <option value="scheduled">Programado</option>
                </select>
              </Field>
              <Field label="Fecha de inicio">
                <input className="input" type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} />
              </Field>
              <Field label="Duración en semanas">
                <input className="input" type="number" min={1} max={52} value={form.weeks_duration} onChange={(event) => setForm({ ...form, weeks_duration: Number(event.target.value) || 1 })} />
              </Field>
              <Field label="Fecha de finalización">
                <input className="input" type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} min={form.start_date} />
              </Field>
              <Field label="Días por semana">
                <input className="input" type="number" min={1} max={7} value={form.days_per_week} onChange={(event) => setForm({ ...form, days_per_week: Number(event.target.value) || 1 })} />
              </Field>
            </div>
            <Field label="Notas generales">
              <textarea className="input min-h-24" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </Field>
            {!!templatesQuery.data?.results.length && (
              <Field label="Crear desde plantilla">
                <select className="input" defaultValue="" onChange={(event) => event.target.value && applyTemplate(Number(event.target.value))}>
                  <option value="">Crear desde cero</option>
                  {templatesQuery.data.results.map((template) => (
                    <option key={template.id} value={template.id}>{template.nombre}</option>
                  ))}
                </select>
              </Field>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">Días y ejercicios</h3>
                <p className="text-sm text-neutral-500">Arma la estructura que se guardará de forma atómica.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={addDay} data-testid="wizard-add-day"><Plus size={16} /> Agregar día</button>
            </div>
            {!days.length ? (
              <p className="rounded-sm border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">Todavía no hay días configurados.</p>
            ) : (
              <div className="space-y-4">
                {days.map((day, dayIndex) => (
                  <div key={`${day.order}-${day.day_label}`} className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800">
                    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <Field label="Nombre del día">
                        <input className="input" value={day.name} onChange={(event) => setDays((current) => current.map((item, index) => index === dayIndex ? { ...item, name: event.target.value } : item))} />
                      </Field>
                      <Field label="Etiqueta">
                        <select className="input" value={day.day_label} onChange={(event) => setDays((current) => current.map((item, index) => index === dayIndex ? { ...item, day_label: event.target.value as DayLabel } : item))}>
                          {dayLabels.map((label) => <option key={label} value={label}>{label}</option>)}
                        </select>
                      </Field>
                      <Field label="Día real">
                        <select className="input" value={day.day_of_week} onChange={(event) => setDays((current) => current.map((item, index) => index === dayIndex ? { ...item, day_of_week: event.target.value as DayOfWeek } : item))}>
                          {weekdays.map((weekday) => <option key={weekday.value} value={weekday.value}>{weekday.label}</option>)}
                        </select>
                      </Field>
                      <div className="flex items-end gap-2">
                        <button type="button" className="btn-secondary" onClick={() => duplicateDay(day)}><Copy size={16} /> Duplicar</button>
                        <button type="button" className="btn-danger" onClick={() => setDays((current) => current.filter((_, index) => index !== dayIndex))}><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {day.exercises.map((exercise, exerciseIndex) => (
                        <div key={exerciseIndex} className="grid grid-cols-1 gap-3 rounded-sm bg-neutral-50 p-3 md:grid-cols-6 dark:bg-neutral-900/60">
                          <Field label="Ejercicio">
                            <input className="input" value={exercise.name} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { name: event.target.value })} />
                          </Field>
                          <Field label="Grupo">
                            <select className="input" value={exercise.muscle_group} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { muscle_group: event.target.value as MuscleGroup })}>
                              {muscles.map((muscle) => <option key={muscle} value={muscle}>{MUSCLE_LABELS[muscle]}</option>)}
                            </select>
                          </Field>
                          <Field label="Tipo">
                            <select className="input" value={exercise.exercise_type} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { exercise_type: event.target.value as ExerciseType })}>
                              <option value="strength">Fuerza</option>
                              <option value="timed">Por tiempo</option>
                            </select>
                          </Field>
                          {exercise.exercise_type === 'timed' ? (
                            <Field label="Minutos">
                              <input className="input" type="number" min={1} value={exercise.target_minutes ?? 10} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { target_minutes: Number(event.target.value) || 1 })} />
                            </Field>
                          ) : (
                            <>
                              <Field label="Series">
                                <input className="input" type="number" min={1} value={exercise.sets ?? 3} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { sets: Number(event.target.value) || 1 })} />
                              </Field>
                              <Field label="Reps">
                                <input className="input" value={exercise.reps_range} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { reps_range: event.target.value })} />
                              </Field>
                            </>
                          )}
                          <Field label="Descanso">
                            <input className="input" type="number" min={1} value={exercise.rest_seconds} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { rest_seconds: Number(event.target.value) || 60 })} />
                          </Field>
                          <Field label="Peso inicial">
                            <input className="input" type="number" min={0} value={exercise.weight_suggestion_kg ?? ''} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { weight_suggestion_kg: event.target.value ? Number(event.target.value) : null })} disabled={exercise.exercise_type === 'timed'} />
                          </Field>
                          <Field label="Indicaciones">
                            <input className="input" value={exercise.technique_notes ?? ''} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { technique_notes: event.target.value })} />
                          </Field>
                          <div className="flex items-end">
                            <button type="button" className="btn-danger w-full" onClick={() => setDays((current) => current.map((item, index) => index === dayIndex ? { ...item, exercises: item.exercises.filter((_, itemIndex) => itemIndex !== exerciseIndex) } : item))}>
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="btn-secondary" onClick={() => setDays((current) => current.map((item, index) => index === dayIndex ? { ...item, exercises: [...item.exercises, emptyExercise(item.exercises.length)] } : item))}>
                        <Plus size={16} /> Agregar ejercicio
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <h3 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">Revisión</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <ReviewItem label="Miembro" value={selectedMember?.full_name || 'Sin seleccionar'} />
              <ReviewItem label="Plan" value={form.name || 'Sin nombre'} />
              <ReviewItem label="Objetivo" value={GOAL_LABELS[form.goal] || form.goal} />
              <ReviewItem label="Inicio" value={formatDate(form.start_date)} />
              <ReviewItem label="Finalización" value={formatDate(form.end_date)} />
              <ReviewItem label="Duración" value={`${form.weeks_duration} semanas`} />
              <ReviewItem label="Días semanales" value={`${form.days_per_week}`} />
              <ReviewItem label="Total de días" value={`${days.length}`} />
              <ReviewItem label="Total ejercicios" value={`${totalExercises}`} />
              <ReviewItem label="Estado inicial" value={form.status === 'active' ? 'Activo' : form.status === 'scheduled' ? 'Programado' : 'Borrador'} />
            </div>
            {!canSave ? (
              <p className="rounded-sm border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                Completa miembro, nombre del plan y nombres de ejercicios antes de guardar.
              </p>
            ) : null}
          </section>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
          <button type="button" className="btn-secondary" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>Atrás</button>
          <div className="flex flex-wrap justify-end gap-2">
            {step < 4 ? (
              <button type="button" className="btn-primary" onClick={() => setStep(Math.min(4, step + 1))} disabled={step === 1 && !canContinueMember}>Continuar</button>
            ) : (
              <>
                <button type="button" className="btn-secondary" disabled={!canSave || createCompletePlan.isPending} onClick={() => submit('draft')}>Guardar como borrador</button>
                <button type="button" className="btn-primary" disabled={!canSave || createCompletePlan.isPending || (hasActivePlan && conflictStrategy === 'keep')} onClick={() => submit(form.status === 'scheduled' ? 'scheduled' : 'active')}>Guardar y activar</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      {children}
    </label>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 font-semibold text-neutral-900 dark:text-white">{value}</p>
    </div>
  )
}
