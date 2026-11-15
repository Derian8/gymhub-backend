import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { Copy, Plus, Trash2, X } from 'lucide-react'
import { GOAL_LABELS, MUSCLE_GROUP_OPTIONS } from '@/shared/lib/utils'
import type {
  DayLabel,
  DayOfWeek,
  ExerciseType,
  GoalType,
  CatalogExercise,
  MuscleGroup,
  TrainingTemplate,
  TrainingTemplateDayPayload,
  TrainingTemplateExercisePayload,
  TrainingTemplatePayload,
} from '@/shared/types'
import {
  useCatalogExercisesQuery,
  useCreateTrainingTemplateMutation,
  useGymMachinesQuery,
  useUpdateTrainingTemplateMutation,
} from '../hooks/usePlans'

type ExerciseDraft = TrainingTemplateExercisePayload & { catalogo_detalle?: CatalogExercise | null }
type DayDraft = Omit<TrainingTemplateDayPayload, 'ejercicios'> & { ejercicios: ExerciseDraft[] }

const labels: DayLabel[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const weekdays: Array<{ value: DayOfWeek; label: string }> = [
  { value: 'mon', label: 'Lunes' }, { value: 'tue', label: 'Martes' },
  { value: 'wed', label: 'Miércoles' }, { value: 'thu', label: 'Jueves' },
  { value: 'fri', label: 'Viernes' }, { value: 'sat', label: 'Sábado' },
  { value: 'sun', label: 'Domingo' },
]

function ejercicioVacio(orden: number): ExerciseDraft {
  return {
    catalogo_ejercicio: null, imagen_referencia_url: '', url_video: '', maquina: null,
    catalogo_detalle: null,
    nombre: '', grupo_muscular: 'full_body', tipo_ejercicio: 'strength', series: 3,
    rango_repeticiones: '8-12', minutos_objetivo: null, peso_sugerido_kg: null,
    unidad_peso_sugerido: 'kg', descanso_segundos: 60, notas_tecnicas: '', orden,
  }
}

function diaVacio(orden: number): DayDraft {
  return {
    nombre: `Día ${labels[orden] ?? 'A'}`, etiqueta_dia: labels[orden] ?? 'A',
    dia_semana: weekdays[orden % weekdays.length].value, orden, ejercicios: [ejercicioVacio(0)],
  }
}

function desdePlantilla(plantilla: TrainingTemplate): DayDraft[] {
  return plantilla.dias.map((dia, index) => ({
    nombre: dia.nombre,
    etiqueta_dia: dia.etiqueta_dia,
    dia_semana: dia.dia_semana ?? weekdays[index % weekdays.length].value,
    orden: index,
    ejercicios: dia.ejercicios.map((ejercicio, ejercicioIndex) => ({
      catalogo_ejercicio: ejercicio.catalogo_ejercicio ?? null,
      catalogo_detalle: ejercicio.catalogo_detalle ?? null,
      imagen_referencia_url: ejercicio.imagen_referencia_url ?? '',
      url_video: ejercicio.url_video ?? '',
      maquina: ejercicio.maquina ?? null,
      nombre: ejercicio.nombre,
      grupo_muscular: ejercicio.grupo_muscular,
      tipo_ejercicio: ejercicio.tipo_ejercicio,
      series: ejercicio.series,
      rango_repeticiones: ejercicio.rango_repeticiones,
      minutos_objetivo: ejercicio.minutos_objetivo,
      peso_sugerido_kg: ejercicio.peso_sugerido_kg,
      unidad_peso_sugerido: ejercicio.unidad_peso_sugerido ?? 'kg',
      descanso_segundos: ejercicio.descanso_segundos,
      notas_tecnicas: ejercicio.notas_tecnicas,
      orden: ejercicioIndex,
    })),
  }))
}

interface RoutineTemplateBuilderProps {
  open: boolean
  onClose: () => void
  template?: TrainingTemplate | null
  onSaved?: (template: TrainingTemplate) => void
  assignAfterSave?: boolean
}

export function RoutineTemplateBuilder({ open, onClose, template, onSaved, assignAfterSave = false }: RoutineTemplateBuilderProps) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [objetivo, setObjetivo] = useState<GoalType>('general')
  const [nivel, setNivel] = useState<'low' | 'medium' | 'high'>('medium')
  const [diasPorSemana, setDiasPorSemana] = useState(3)
  const [modo, setModo] = useState<'weekly' | 'cycle'>('weekly')
  const [dias, setDias] = useState<DayDraft[]>([diaVacio(0)])
  const [busquedaCatalogo, setBusquedaCatalogo] = useState('')
  const catalogoQuery = useCatalogExercisesQuery({ search: busquedaCatalogo }, open)
  const maquinasQuery = useGymMachinesQuery(open)
  const crear = useCreateTrainingTemplateMutation()
  const actualizar = useUpdateTrainingTemplateMutation()
  const guardando = crear.isPending || actualizar.isPending
  const ejerciciosTotales = dias.reduce((total, dia) => total + dia.ejercicios.length, 0)
  const catalogo = useMemo(() => catalogoQuery.data?.results ?? [], [catalogoQuery.data])
  const maquinas = (maquinasQuery.data?.results ?? []).filter((maquina) => maquina.is_active)

  useEffect(() => {
    if (!open) return
    setNombre(template?.nombre ?? '')
    setDescripcion(template?.descripcion ?? '')
    setObjetivo(template?.objetivo ?? 'general')
    setNivel(template?.nivel_adherencia_recomendado ?? 'medium')
    setDiasPorSemana(template?.dias_por_semana_sugeridos ?? 3)
    setModo(template?.modo_ejecucion ?? 'weekly')
    setDias(template ? desdePlantilla(template) : [diaVacio(0)])
    setBusquedaCatalogo('')
  }, [open, template])

  if (!open) return null

  const actualizarEjercicio = (diaIndex: number, ejercicioIndex: number, cambios: Partial<ExerciseDraft>) => {
    setDias((actuales) => actuales.map((dia, index) => index !== diaIndex ? dia : {
      ...dia,
      ejercicios: dia.ejercicios.map((ejercicio, itemIndex) => itemIndex !== ejercicioIndex
        ? ejercicio : { ...ejercicio, ...cambios }),
    }))
  }

  const agregarDia = () => setDias((actuales) => [...actuales, diaVacio(actuales.length)])

  const guardar = () => {
    const payload: TrainingTemplatePayload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      objetivo,
      nivel_adherencia_recomendado: nivel,
      dias_por_semana_sugeridos: diasPorSemana,
      modo_ejecucion: modo,
      esta_activa: true,
      dias: dias.map((dia, index) => ({
        ...dia,
        orden: index,
        dia_semana: modo === 'weekly' ? dia.dia_semana : null,
        ejercicios: dia.ejercicios.map((ejercicio, ejercicioIndex) => ejercicioPayload(ejercicio, ejercicioIndex)),
      })),
    }
    if (template) {
      actualizar.mutate({ templateId: template.id, payload }, { onSuccess: (saved) => { onClose(); onSaved?.(saved) } })
    } else {
      crear.mutate(payload, { onSuccess: (saved) => { onClose(); onSaved?.(saved) } })
    }
  }

  const sePuedeGuardar = Boolean(nombre.trim() && dias.length && dias.every((dia) =>
    dia.nombre.trim() && dia.ejercicios.length && dia.ejercicios.every((ejercicio) =>
      ejercicio.nombre.trim() && (ejercicio.tipo_ejercicio === 'timed'
        ? Number(ejercicio.minutos_objetivo) > 0
        : Number(ejercicio.series) > 0 && Boolean(ejercicio.rango_repeticiones.trim())),
    ),
  ))

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-neutral-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={template ? 'Editar rutina' : 'Crear rutina'}>
      <div className="mx-auto max-w-6xl rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <div>
            <p className="label-base">Biblioteca de rutinas</p>
            <h2 className="mt-1 font-heading text-2xl font-bold">{template ? 'Editar rutina' : 'Crear rutina desde cero'}</h2>
            <p className="mt-1 text-sm text-neutral-500">Diseña una vez, guárdala y úsala para varios clientes.</p>
          </div>
          <button type="button" className="btn-secondary !p-2" aria-label="Cerrar" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="space-y-6 p-5">
          <section className="grid gap-4 rounded-xl border border-neutral-200 p-4 md:grid-cols-2 dark:border-neutral-800">
            <Field label="Nombre de la rutina">
              <input className="input" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej. Fuerza inicial · 3 días" autoFocus />
            </Field>
            <Field label="Objetivo">
              <select className="input" value={objetivo} onChange={(event) => setObjetivo(event.target.value as GoalType)}>
                {Object.entries(GOAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Días por semana">
              <input className="input" type="number" min={1} max={7} value={diasPorSemana} onChange={(event) => setDiasPorSemana(Math.min(7, Math.max(1, Number(event.target.value) || 1)))} />
            </Field>
            <details className="md:col-span-2">
              <summary className="cursor-pointer text-sm font-semibold text-primary">Opciones adicionales (descripción, calendario y nivel)</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Descripción breve"><textarea className="input min-h-20" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Enfoque o indicaciones generales" /></Field>
                <Field label="Calendario"><select className="input" value={modo} onChange={(event) => setModo(event.target.value as 'weekly' | 'cycle')}><option value="weekly">Días de la semana</option><option value="cycle">Ciclo flexible</option></select></Field>
                <Field label="Nivel recomendado"><select className="input" value={nivel} onChange={(event) => setNivel(event.target.value as 'low' | 'medium' | 'high')}><option value="low">Inicial</option><option value="medium">Intermedio</option><option value="high">Avanzado</option></select></Field>
              </div>
            </details>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-lg font-bold">Estructura</h3><p className="text-sm text-neutral-500">{dias.length} días · {ejerciciosTotales} ejercicios</p></div>
              <button type="button" className="btn-secondary" onClick={agregarDia}><Plus size={16} /> Agregar día</button>
            </div>

            {dias.map((dia, diaIndex) => (
              <article key={diaIndex} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_180px_auto]">
                  <Field label="Nombre del bloque"><input className="input" value={dia.nombre} onChange={(event) => setDias((actuales) => actuales.map((item, index) => index === diaIndex ? { ...item, nombre: event.target.value } : item))} /></Field>
                  <Field label="Etiqueta"><select className="input" value={dia.etiqueta_dia} onChange={(event) => setDias((actuales) => actuales.map((item, index) => index === diaIndex ? { ...item, etiqueta_dia: event.target.value as DayLabel } : item))}>{labels.map((label) => <option key={label}>{label}</option>)}</select></Field>
                  {modo === 'weekly' ? <Field label="Día de semana"><select className="input" value={dia.dia_semana ?? 'mon'} onChange={(event) => setDias((actuales) => actuales.map((item, index) => index === diaIndex ? { ...item, dia_semana: event.target.value as DayOfWeek } : item))}>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></Field> : <div />}
                  <div className="flex items-end gap-2">
                    <button type="button" className="btn-secondary !p-2" title="Duplicar día" onClick={() => setDias((actuales) => [...actuales, { ...dia, nombre: `${dia.nombre} copia`, etiqueta_dia: labels[actuales.length] ?? 'A', orden: actuales.length, ejercicios: dia.ejercicios.map((ejercicio, index) => ({ ...ejercicio, orden: index })) }])}><Copy size={16} /></button>
                    <button type="button" className="btn-secondary !p-2 text-red-600" title="Eliminar día" disabled={dias.length === 1} onClick={() => setDias((actuales) => actuales.filter((_, index) => index !== diaIndex))}><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="space-y-3">
                  {dia.ejercicios.map((ejercicio, ejercicioIndex) => {
                    const selectedCatalog = catalogo.find((item) => item.id === ejercicio.catalogo_ejercicio) ?? ejercicio.catalogo_detalle
                    const imagen = ejercicio.imagen_referencia_url || selectedCatalog?.animacion_url || selectedCatalog?.imagen_url
                    const videoCatalogo = selectedCatalog?.video_url
                    const videoAgregado = ejercicio.url_video
                    return (
                      <div key={ejercicioIndex} className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900/70">
                        <div className="grid gap-3 md:grid-cols-3">
                          <Field label="Elegir del catálogo">
                            <input className="input mb-2" placeholder="Buscar ejercicio" value={busquedaCatalogo} onChange={(event) => setBusquedaCatalogo(event.target.value)} />
                            <select className="input" value={ejercicio.catalogo_ejercicio ?? ''} onChange={(event) => {
                              const item = catalogo.find((candidate) => candidate.id === Number(event.target.value))
                              actualizarEjercicio(diaIndex, ejercicioIndex, item ? {
                                catalogo_detalle: item,
                                catalogo_ejercicio: item.id, nombre: item.nombre,
                                grupo_muscular: item.grupo_muscular_plan || ejercicio.grupo_muscular,
                                maquina: item.maquina_recomendada ?? null,
                                notas_tecnicas: item.instrucciones_es,
                              } : { catalogo_ejercicio: null, catalogo_detalle: null })
                            }}>
                              <option value="">Ejercicio manual</option>
                              {selectedCatalog && !catalogo.some((item) => item.id === selectedCatalog.id) ? <option value={selectedCatalog.id}>{selectedCatalog.nombre}</option> : null}
                              {catalogo.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                            </select>
                            <div className="mt-2 flex items-center gap-3 rounded-lg border border-neutral-200 p-2 dark:border-neutral-700">
                              {imagen ? <img className="h-16 w-16 rounded-lg object-cover" src={imagen} alt={`Referencia visual de ${ejercicio.nombre || selectedCatalog?.nombre || 'ejercicio'}`} onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-center text-[10px] font-semibold text-primary">Sin imagen asociada</span>}
                              <div className="min-w-0 text-xs"><p className="font-semibold">{ejercicio.imagen_referencia_url ? 'Imagen personalizada' : selectedCatalog?.animacion_url ? 'Animación del catálogo' : selectedCatalog?.imagen_url ? 'Imagen del catálogo' : 'Sin imagen asociada'}</p>{videoCatalogo ? <a className="mt-1 inline-block font-semibold text-primary underline" href={videoCatalogo} target="_blank" rel="noreferrer">Video del catálogo</a> : null}{videoAgregado ? <a className="mt-1 block font-semibold text-primary underline" href={videoAgregado} target="_blank" rel="noreferrer">Video adicional</a> : null}{!videoCatalogo && !videoAgregado ? <p className="mt-1 text-neutral-500">Sin video asociado</p> : null}</div>
                            </div>
                          </Field>
                          <Field label="Nombre"><input className="input" value={ejercicio.nombre} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { nombre: event.target.value })} placeholder="Ej. Sentadilla goblet" /></Field>
                          <Field label="Tipo"><select className="input" value={ejercicio.tipo_ejercicio} onChange={(event) => {
                            const tipo = event.target.value as ExerciseType
                            actualizarEjercicio(diaIndex, ejercicioIndex, tipo === 'timed'
                              ? { tipo_ejercicio: tipo, series: null, rango_repeticiones: '', minutos_objetivo: 10, peso_sugerido_kg: null }
                              : { tipo_ejercicio: tipo, series: 3, rango_repeticiones: '8-12', minutos_objetivo: null })
                          }}><option value="strength">Repeticiones</option><option value="timed">Por tiempo</option></select></Field>
                          {ejercicio.tipo_ejercicio === 'timed' ? <Field label="Minutos"><input className="input" type="number" min={1} value={ejercicio.minutos_objetivo ?? 10} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { minutos_objetivo: Number(event.target.value) || 1 })} /></Field> : <>
                            <Field label="Series"><input className="input" type="number" min={1} value={ejercicio.series ?? 3} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { series: Number(event.target.value) || 1 })} /></Field>
                            <Field label="Repeticiones"><input className="input" value={ejercicio.rango_repeticiones} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { rango_repeticiones: event.target.value })} placeholder="8-12" /></Field>
                          </>}
                          <Field label="Descanso (segundos)"><input className="input" type="number" min={0} value={ejercicio.descanso_segundos} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { descanso_segundos: Number(event.target.value) || 0 })} /></Field>
                          <details className="md:col-span-3">
                            <summary className="cursor-pointer text-sm font-semibold text-primary">Detalles adicionales (grupo, máquina, medios y notas)</summary>
                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                              <Field label="Grupo muscular"><select className="input" value={ejercicio.grupo_muscular} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { grupo_muscular: event.target.value as MuscleGroup })}>{MUSCLE_GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                              <Field label="Máquina"><select className="input" value={ejercicio.maquina ?? ''} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { maquina: event.target.value ? Number(event.target.value) : null })}><option value="">Sin máquina específica</option>{maquinas.map((maquina) => <option key={maquina.id} value={maquina.id}>{maquina.name}{maquina.category ? ` · ${maquina.category}` : ''}</option>)}</select></Field>
                              <Field label="Peso sugerido (kg)"><input className="input" type="number" min={0} value={ejercicio.peso_sugerido_kg ?? ''} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { peso_sugerido_kg: event.target.value ? Number(event.target.value) : null })} disabled={ejercicio.tipo_ejercicio === 'timed'} /></Field>
                              <Field label="Imagen adicional (URL HTTPS)"><input className="input" type="url" value={ejercicio.imagen_referencia_url ?? ''} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { imagen_referencia_url: event.target.value })} placeholder="No reemplaza la imagen del catálogo" /></Field>
                              <Field label="Video adicional (YouTube)"><input className="input" type="url" value={ejercicio.url_video ?? ''} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { url_video: event.target.value })} placeholder="Se conserva junto al video del catálogo" /></Field>
                              <Field label="Indicaciones"><input className="input" value={ejercicio.notas_tecnicas} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { notas_tecnicas: event.target.value })} /></Field>
                            </div>
                          </details>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button type="button" className="text-sm font-semibold text-red-600 disabled:opacity-40" disabled={dia.ejercicios.length === 1} onClick={() => setDias((actuales) => actuales.map((item, index) => index !== diaIndex ? item : { ...item, ejercicios: item.ejercicios.filter((_, itemIndex) => itemIndex !== ejercicioIndex) }))}>Quitar ejercicio</button>
                        </div>
                      </div>
                    )
                  })}
                  <button type="button" className="btn-secondary" onClick={() => setDias((actuales) => actuales.map((item, index) => index !== diaIndex ? item : { ...item, ejercicios: [...item.ejercicios, ejercicioVacio(item.ejercicios.length)] }))}><Plus size={16} /> Agregar ejercicio</button>
                </div>
              </article>
            ))}
          </section>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm text-neutral-500">{assignAfterSave && !template ? 'Se guardará y luego confirmarás la asignación al cliente.' : 'Se guarda en la biblioteca para volver a usarla.'}</p>
          <div className="flex gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="btn-primary" disabled={!sePuedeGuardar || guardando} onClick={guardar}>{guardando ? 'Guardando…' : template ? 'Guardar cambios' : assignAfterSave ? 'Guardar y asignar' : 'Guardar rutina'}</button></div>
        </footer>
      </div>
    </div>
  )
}

function ejercicioPayload(ejercicio: ExerciseDraft, orden: number): TrainingTemplateExercisePayload {
  return {
    catalogo_ejercicio: ejercicio.catalogo_ejercicio,
    imagen_referencia_url: ejercicio.imagen_referencia_url,
    url_video: ejercicio.url_video,
    maquina: ejercicio.maquina,
    nombre: ejercicio.nombre,
    grupo_muscular: ejercicio.grupo_muscular,
    tipo_ejercicio: ejercicio.tipo_ejercicio,
    series: ejercicio.series,
    rango_repeticiones: ejercicio.rango_repeticiones,
    minutos_objetivo: ejercicio.minutos_objetivo,
    peso_sugerido_kg: ejercicio.peso_sugerido_kg,
    unidad_peso_sugerido: ejercicio.unidad_peso_sugerido ?? 'kg',
    descanso_segundos: ejercicio.descanso_segundos,
    notas_tecnicas: ejercicio.notas_tecnicas,
    orden,
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-1 text-sm"><span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>{children}</label>
}
