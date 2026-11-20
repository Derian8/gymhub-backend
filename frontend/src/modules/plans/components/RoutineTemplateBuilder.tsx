import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Copy, Plus, Sparkles, Trash2 } from 'lucide-react'
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
const titulosPasos = ['Objetivo', 'Modalidad', 'Ejercicios', 'Revisar'] as const
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
    rango_repeticiones: '8-12', minutos_objetivo: null, duracion_trabajo_segundos: null, peso_sugerido_kg: null,
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
      duracion_trabajo_segundos: ejercicio.duracion_trabajo_segundos ?? null,
      peso_sugerido_kg: ejercicio.peso_sugerido_kg,
      unidad_peso_sugerido: ejercicio.unidad_peso_sugerido ?? 'kg',
      descanso_segundos: ejercicio.descanso_segundos,
      descanso_entre_ejercicios_segundos: ejercicio.descanso_entre_ejercicios_segundos ?? 0,
      notas_tecnicas: ejercicio.notas_tecnicas,
      orden: ejercicioIndex,
    })),
  }))
}

function errorEnBloques(dias: DayDraft[], modo: 'weekly' | 'cycle'): string | null {
  if (dias.length < 1 || dias.length > 7) return 'Agrega entre 1 y 7 bloques de entrenamiento.'

  const etiquetas = new Set<DayLabel>()
  const diasSemana = new Set<DayOfWeek>()
  for (const [indiceDia, dia] of dias.entries()) {
    const bloque = `Bloque ${indiceDia + 1}`
    if (!dia.nombre.trim()) return `${bloque}: escribe un nombre.`
    if (etiquetas.has(dia.etiqueta_dia)) return `${bloque}: elige una etiqueta diferente.`
    etiquetas.add(dia.etiqueta_dia)
    if (modo === 'weekly') {
      if (!dia.dia_semana) return `${bloque}: elige un día de la semana.`
      if (diasSemana.has(dia.dia_semana)) return `${bloque}: elige un día de la semana diferente.`
      diasSemana.add(dia.dia_semana)
    }
    if (!dia.ejercicios.length) return `${bloque}: agrega al menos un ejercicio.`

    for (const [indiceEjercicio, ejercicio] of dia.ejercicios.entries()) {
      const ubicacion = `${bloque}, ejercicio ${indiceEjercicio + 1}`
      if (!ejercicio.nombre.trim()) return `${ubicacion}: escribe un nombre o elígelo del catálogo.`
      const series = ejercicio.series ?? (ejercicio.tipo_ejercicio === 'timed' ? 1 : 0)
      if (!Number.isInteger(series) || series < 1 || series > 20) {
        return `${ubicacion}: indica entre 1 y 20 ${ejercicio.tipo_ejercicio === 'timed' ? 'rondas' : 'series'}.`
      }
      if (ejercicio.tipo_ejercicio === 'timed') {
        const segundos = ejercicio.duracion_trabajo_segundos ?? (ejercicio.minutos_objetivo ?? 0) * 60
        if (ejercicio.duracion_trabajo_segundos && ejercicio.minutos_objetivo) {
          return `${ubicacion}: usa segundos o minutos de trabajo, no ambos.`
        }
        if (ejercicio.rango_repeticiones.trim()) return `${ubicacion}: los ejercicios por tiempo no usan repeticiones.`
        if (!Number.isInteger(segundos) || segundos < 1 || segundos > 36000) {
          return `${ubicacion}: indica un tiempo de trabajo entre 1 y 36000 segundos.`
        }
      } else if (!ejercicio.rango_repeticiones.trim()) {
        return `${ubicacion}: indica las repeticiones, por ejemplo 8 o 8-12.`
      } else if (ejercicio.minutos_objetivo !== null || ejercicio.duracion_trabajo_segundos !== null) {
        return `${ubicacion}: quita la duración de trabajo de este ejercicio por repeticiones.`
      }
      if (!Number.isInteger(ejercicio.descanso_segundos) || ejercicio.descanso_segundos < 0) {
        return `${ubicacion}: indica un descanso válido en segundos.`
      }
      if (ejercicio.peso_sugerido_kg !== null && Number(ejercicio.peso_sugerido_kg) < 0) {
        return `${ubicacion}: el peso sugerido no puede ser negativo.`
      }
      if (ejercicio.imagen_referencia_url && !ejercicio.imagen_referencia_url.startsWith('https://')) {
        return `${ubicacion}: la imagen adicional debe usar HTTPS.`
      }
      if (ejercicio.url_video && !/^https:\/\/(?:www\.youtube\.com\/|youtu\.be\/)/.test(ejercicio.url_video)) {
        return `${ubicacion}: el video adicional debe ser un enlace HTTPS de YouTube.`
      }
    }
  }
  return null
}

interface RoutineTemplateBuilderProps {
  template?: TrainingTemplate | null
  onSaved: (template: TrainingTemplate) => void
}

export function RoutineTemplateBuilder({ template, onSaved }: RoutineTemplateBuilderProps) {
  const [paso, setPaso] = useState(0)
  const [diaActivo, setDiaActivo] = useState(0)
  const [ejercicioActivo, setEjercicioActivo] = useState(0)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [disponibleClientes, setDisponibleClientes] = useState(false)
  const [objetivo, setObjetivo] = useState<GoalType>('general')
  const [nivel, setNivel] = useState<'low' | 'medium' | 'high'>('medium')
  const [diasPorSemana, setDiasPorSemana] = useState(3)
  const [modo, setModo] = useState<'weekly' | 'cycle'>('cycle')
  const [dias, setDias] = useState<DayDraft[]>([diaVacio(0)])
  const [busquedaCatalogo, setBusquedaCatalogo] = useState('')
  const catalogoQuery = useCatalogExercisesQuery({ search: busquedaCatalogo })
  const sugerenciasQuery = useCatalogExercisesQuery()
  const maquinasQuery = useGymMachinesQuery()
  const crear = useCreateTrainingTemplateMutation()
  const actualizar = useUpdateTrainingTemplateMutation()
  const guardando = crear.isPending || actualizar.isPending
  const ejerciciosTotales = dias.reduce((total, dia) => total + dia.ejercicios.length, 0)
  const catalogo = useMemo(() => catalogoQuery.data?.results ?? [], [catalogoQuery.data])
  const opcionesCatalogo = catalogo.slice(0, 40)
  const sugerencias = useMemo(() => {
    const grupos: Record<GoalType, MuscleGroup[]> = {
      fat_loss: ['cardio', 'full_body', 'legs'],
      muscle_gain: ['chest', 'back', 'legs', 'shoulders'],
      endurance: ['cardio', 'full_body', 'legs'],
      flexibility: ['full_body', 'legs', 'back'],
      maintenance: ['full_body', 'legs', 'back', 'chest'],
      general: ['full_body', 'legs', 'back', 'chest'],
    }
    const candidatos = (sugerenciasQuery.data?.results ?? []).filter((item) =>
      objetivo === 'flexibility'
        ? /stretch|estir|flexib/i.test(item.categoria + ' ' + item.nombre)
        : grupos[objetivo].includes(item.grupo_muscular_plan as MuscleGroup),
    ).sort((a, b) => Number(Boolean(b.imagen_url || b.animacion_url)) - Number(Boolean(a.imagen_url || a.animacion_url)))
    if (objetivo === 'flexibility') return candidatos.slice(0, 8)
    const seleccionados = grupos[objetivo].flatMap((grupo) => candidatos.filter((item) => item.grupo_muscular_plan === grupo).slice(0, 2))
    return seleccionados.slice(0, 8)
  }, [sugerenciasQuery.data, objetivo])
  const maquinas = (maquinasQuery.data?.results ?? []).filter((maquina) => maquina.is_active)

  useEffect(() => {
    setNombre(template?.nombre ?? '')
    setDescripcion(template?.descripcion ?? '')
    setDisponibleClientes(template?.disponible_clientes ?? false)
    setObjetivo(template?.objetivo ?? 'general')
    setNivel(template?.nivel_adherencia_recomendado ?? 'medium')
    setDiasPorSemana(template?.dias_por_semana_sugeridos ?? 3)
    setModo(template?.modo_ejecucion ?? 'cycle')
    setDias(template ? desdePlantilla(template) : [diaVacio(0)])
    setBusquedaCatalogo('')
    setPaso(0)
    setDiaActivo(0)
    setEjercicioActivo(0)
  }, [template])

  const actualizarEjercicio = (diaIndex: number, ejercicioIndex: number, cambios: Partial<ExerciseDraft>) => {
    setDias((actuales) => actuales.map((dia, index) => index !== diaIndex ? dia : {
      ...dia,
      ejercicios: dia.ejercicios.map((ejercicio, itemIndex) => itemIndex !== ejercicioIndex
        ? ejercicio : { ...ejercicio, ...cambios }),
    }))
  }

  const agregarDia = () => {
    setDias((actuales) => {
      const etiqueta = labels.find((label) => !actuales.some((dia) => dia.etiqueta_dia === label)) ?? 'A'
      const diaSemana = weekdays.find((day) => !actuales.some((dia) => dia.dia_semana === day.value))?.value ?? 'mon'
      return [...actuales, { ...diaVacio(actuales.length), nombre: `Día ${etiqueta}`, etiqueta_dia: etiqueta, dia_semana: diaSemana }]
    })
    setDiaActivo(dias.length)
    setEjercicioActivo(0)
  }

  const elegirSugerencia = (item: CatalogExercise) => {
    const cambios: Partial<ExerciseDraft> = {
      catalogo_ejercicio: item.id, catalogo_detalle: item, nombre: item.nombre,
      grupo_muscular: item.grupo_muscular_plan || 'full_body',
      maquina: item.maquina_recomendada ?? null,
      notas_tecnicas: item.instrucciones_es,
    }
    const dia = dias[diaActivo]
    const indice = dia.ejercicios[ejercicioActivo]?.nombre.trim() ? dia.ejercicios.length : ejercicioActivo
    if (indice === dia.ejercicios.length) {
      setDias((actuales) => actuales.map((actual, index) => index === diaActivo
        ? { ...actual, ejercicios: [...actual.ejercicios, { ...ejercicioVacio(indice), ...cambios }] } : actual))
    } else {
      actualizarEjercicio(diaActivo, indice, cambios)
    }
    setEjercicioActivo(indice)
  }

  const errorObjetivo = !nombre.trim() ? 'Escribe el nombre de la rutina para continuar.' : null
  const errorModalidad = !Number.isInteger(diasPorSemana) || diasPorSemana < 1 || diasPorSemana > 7
    ? 'Indica entre 1 y 7 visitas sugeridas por semana.' : null
  const errorBloques = errorEnBloques(dias, modo)
  const erroresPasos = [errorObjetivo, errorModalidad, errorBloques] as const
  const errorPasoActual = paso < 3 ? erroresPasos[paso] : null
  const sePuedeGuardar = erroresPasos.every((error) => error === null)

  const irAlPaso = (siguientePaso: number) => {
    setPaso(siguientePaso)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const guardar = () => {
    if (!sePuedeGuardar || guardando) return
    const payload: TrainingTemplatePayload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      disponible_clientes: disponibleClientes,
      objetivo,
      nivel_adherencia_recomendado: nivel,
      dias_por_semana_sugeridos: diasPorSemana,
      modo_ejecucion: modo,
      esta_activa: template?.esta_activa ?? true,
      dias: dias.map((dia, index) => ({
        ...dia,
        orden: index,
        dia_semana: modo === 'weekly' ? dia.dia_semana : null,
        ejercicios: dia.ejercicios.map((ejercicio, ejercicioIndex) => ejercicioPayload(ejercicio, ejercicioIndex)),
      })),
    }
    if (template) {
      actualizar.mutate({ templateId: template.id, payload }, { onSuccess: onSaved })
    } else {
      crear.mutate(payload, { onSuccess: onSaved })
    }
  }

  return (
    <div className="card overflow-hidden">
        <div className="rutina-pasos border-b border-neutral-200 bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-900/40 sm:px-7">
          <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest">
            <span className="text-primary">{template ? 'Editar' : 'Crear'} rutina</span>
            <span className="text-neutral-500 dark:text-neutral-400">Paso {paso + 1} de {titulosPasos.length}</span>
          </div>
          <div className="mt-4 sm:hidden" aria-label="Progreso del asistente">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white" aria-hidden="true">{paso + 1}</span>
              <div className="min-w-0">
                <p className="font-bold">{titulosPasos[paso]}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{paso < titulosPasos.length - 1 ? `Siguiente: ${titulosPasos[paso + 1]}` : 'Último paso'}</p>
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700" role="progressbar" aria-valuenow={paso + 1} aria-valuemin={1} aria-valuemax={titulosPasos.length} aria-label="Paso actual">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((paso + 1) / titulosPasos.length) * 100}%` }} />
            </div>
          </div>
          <div className="relative mt-5 hidden sm:block" aria-label="Progreso del asistente">
            <div className="absolute left-[12.5%] right-[12.5%] top-5 h-0.5 bg-neutral-200 dark:bg-neutral-700" aria-hidden="true" />
            <div className="absolute left-[12.5%] top-5 h-0.5 bg-primary transition-all" style={{ width: `${(paso / (titulosPasos.length - 1)) * 75}%` }} aria-hidden="true" />
            <ol className="relative grid grid-cols-4">
              {titulosPasos.map((titulo, indice) => (
                <li key={titulo} className="flex flex-col items-center gap-2 text-center" aria-current={indice === paso ? 'step' : undefined}>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold ${indice < paso ? 'border-primary bg-primary text-white' : indice === paso ? 'border-primary bg-white text-primary ring-4 ring-primary/15 dark:bg-neutral-900' : 'border-neutral-300 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400'}`} aria-hidden="true">
                    {indice < paso ? <Check size={18} /> : indice + 1}
                  </span>
                  <span className={`text-xs font-semibold ${indice === paso ? 'text-primary' : indice < paso ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400'}`}>{titulo}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="space-y-6 p-5 sm:p-7">
          {paso === 0 ? <>
          <div><h2 className="text-xl font-bold">¿Qué quieres lograr?</h2><p className="text-sm text-neutral-500">El objetivo orienta las sugerencias. Puedes cambiarlas en cualquier momento.</p></div>
          <section className="grid gap-4 rounded-xl border border-neutral-200 p-4 md:grid-cols-2 dark:border-neutral-800">
            <Field label="Nombre de la rutina">
              <input className="input" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej. Fuerza inicial · 3 días" required />
            </Field>
            <Field label="Objetivo">
              <select className="input" value={objetivo} onChange={(event) => setObjetivo(event.target.value as GoalType)}>
                {Object.entries(GOAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Descripción breve (opcional)"><textarea className="input min-h-20" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Enfoque o indicaciones generales" /></Field>
            <Field label="Nivel recomendado"><select className="input" value={nivel} onChange={(event) => setNivel(event.target.value as 'low' | 'medium' | 'high')}><option value="low">Inicial</option><option value="medium">Intermedio</option><option value="high">Avanzado</option></select></Field>
          </section>
          </> : null}

          {paso === 1 ? <section className="space-y-5">
            <label className="flex items-start gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <input type="checkbox" checked={disponibleClientes} onChange={(event) => setDisponibleClientes(event.target.checked)} className="mt-1 h-5 w-5 accent-primary" />
              <span><strong>Disponible como rutina libre para clientes</strong><span className="mt-1 block text-sm text-neutral-500">Los clientes con entrada confirmada podrán elegir sus bloques sin cambiar el plan asignado.</span></span>
            </label>
            <div><h2 className="text-xl font-bold">Elige cómo avanza la rutina</h2><p className="text-sm text-neutral-500">En ambos modos se recuerda el último bloque completado por cada cliente.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setModo('cycle')} className={`rounded-xl border p-5 text-left ${modo === 'cycle' ? 'border-primary bg-primary/5' : 'border-neutral-200 dark:border-neutral-800'}`}><strong>Flexible · A → B → C</strong><span className="mt-2 block text-sm text-neutral-500">El siguiente bloque queda listo para la próxima visita, sin día fijo.</span></button>
              <button type="button" onClick={() => setModo('weekly')} className={`rounded-xl border p-5 text-left ${modo === 'weekly' ? 'border-primary bg-primary/5' : 'border-neutral-200 dark:border-neutral-800'}`}><strong>Semanal · días sugeridos</strong><span className="mt-2 block text-sm text-neutral-500">Muestra el calendario, pero una ausencia no salta bloques.</span></button>
            </div>
            <Field label="Visitas sugeridas por semana"><input className="input max-w-40" type="number" min={1} max={7} value={diasPorSemana} onChange={(event) => setDiasPorSemana(Math.min(7, Math.max(1, Number(event.target.value) || 1)))} /></Field>
          </section> : null}

          {paso === 2 ? <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-lg font-bold">Bloques de entrenamiento</h3><p className="text-sm text-neutral-500">{dias.length} bloques · {ejerciciosTotales} ejercicios</p></div>
              <button type="button" className="btn-secondary" disabled={dias.length >= 7} onClick={agregarDia}><Plus size={16} /> Agregar bloque</button>
            </div>
            {errorBloques ? <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="status">Para continuar: {errorBloques}</p> : null}

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bloques">
              {dias.map((dia, indice) => <button key={indice} type="button" role="tab" aria-selected={diaActivo === indice} onClick={() => { setDiaActivo(indice); setEjercicioActivo(0) }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${diaActivo === indice ? 'bg-primary text-white' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{dia.etiqueta_dia} · {dia.nombre}</button>)}
            </div>

            {dias.map((dia, diaIndex) => diaIndex === diaActivo && (
              <article key={diaIndex} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_180px_auto]">
                  <Field label="Nombre del bloque"><input className="input" value={dia.nombre} onChange={(event) => setDias((actuales) => actuales.map((item, index) => index === diaIndex ? { ...item, nombre: event.target.value } : item))} /></Field>
                  <Field label="Etiqueta"><select className="input" value={dia.etiqueta_dia} onChange={(event) => setDias((actuales) => actuales.map((item, index) => index === diaIndex ? { ...item, etiqueta_dia: event.target.value as DayLabel } : item))}>{labels.map((label) => <option key={label}>{label}</option>)}</select></Field>
                  {modo === 'weekly' ? <Field label="Día de semana"><select className="input" value={dia.dia_semana ?? 'mon'} onChange={(event) => setDias((actuales) => actuales.map((item, index) => index === diaIndex ? { ...item, dia_semana: event.target.value as DayOfWeek } : item))}>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></Field> : <div />}
                  <div className="flex items-end gap-2">
                    <button type="button" className="btn-secondary !p-2" title="Duplicar bloque" disabled={dias.length >= 7} onClick={() => { setDias((actuales) => {
                      const etiqueta = labels.find((label) => !actuales.some((item) => item.etiqueta_dia === label)) ?? 'A'
                      const diaSemana = weekdays.find((day) => !actuales.some((item) => item.dia_semana === day.value))?.value ?? 'mon'
                      return [...actuales, { ...dia, nombre: `${dia.nombre} copia`, etiqueta_dia: etiqueta, dia_semana: diaSemana, orden: actuales.length, ejercicios: dia.ejercicios.map((ejercicio, index) => ({ ...ejercicio, orden: index })) }]
                    }); setDiaActivo(dias.length); setEjercicioActivo(0) }}><Copy size={16} /></button>
                    <button type="button" className="btn-secondary !p-2 text-red-600" title="Eliminar bloque" disabled={dias.length === 1} onClick={() => { setDias((actuales) => actuales.filter((_, index) => index !== diaIndex)); setDiaActivo(Math.max(0, diaIndex - 1)); setEjercicioActivo(0) }}><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="flex items-center gap-2 font-semibold"><Sparkles size={16} /> Sugeridos para {GOAL_LABELS[objetivo]}</p>
                    <p className="mt-1 text-xs text-neutral-500">Selección por categoría y grupo muscular. Revisa técnica y adapta la carga a la persona.</p>
                    <div className="mt-3 flex flex-wrap gap-2">{sugerencias.map((item) => <button key={item.id} type="button" onClick={() => elegirSugerencia(item)} className="rounded-lg border border-primary/25 bg-white px-3 py-2 text-left text-xs font-semibold hover:border-primary dark:bg-neutral-900">{item.nombre}{!item.imagen_url && !item.animacion_url ? ' · sin imagen' : ''}</button>)}{!sugerencias.length ? <span className="text-sm text-neutral-500">No hay sugerencias para este objetivo. Busca en el catálogo.</span> : null}</div>
                  </div>
                  <div className="flex flex-wrap gap-2" aria-label="Ejercicios del bloque">{dia.ejercicios.map((item, indice) => <button key={indice} type="button" onClick={() => setEjercicioActivo(indice)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${ejercicioActivo === indice ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{indice + 1}. {item.nombre || 'Nuevo ejercicio'}</button>)}</div>
                  {dia.ejercicios.map((ejercicio, ejercicioIndex) => {
                    if (ejercicioIndex !== ejercicioActivo) return null
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
                              {selectedCatalog && !opcionesCatalogo.some((item) => item.id === selectedCatalog.id) ? <option value={selectedCatalog.id}>{selectedCatalog.nombre}</option> : null}
                              {opcionesCatalogo.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
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
                              ? { tipo_ejercicio: tipo, series: 1, rango_repeticiones: '', minutos_objetivo: null, duracion_trabajo_segundos: 30, descanso_segundos: 10, peso_sugerido_kg: null }
                              : { tipo_ejercicio: tipo, series: 3, rango_repeticiones: '8-12', minutos_objetivo: null, duracion_trabajo_segundos: null, descanso_segundos: 60 })
                          }}><option value="strength">Repeticiones</option><option value="timed">Por tiempo</option></select></Field>
                          {ejercicio.tipo_ejercicio === 'timed' ? <><Field label="Rondas"><input className="input" type="number" min={1} max={20} value={ejercicio.series ?? 1} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { series: Number(event.target.value) || 1 })} /></Field><Field label="Trabajo (segundos)"><input className="input" type="number" min={1} max={36000} value={ejercicio.duracion_trabajo_segundos ?? (ejercicio.minutos_objetivo ?? 1) * 60} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { duracion_trabajo_segundos: Number(event.target.value) || 1, minutos_objetivo: null })} /></Field></> : <>
                            <Field label="Series"><input className="input" type="number" min={1} value={ejercicio.series ?? 3} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { series: Number(event.target.value) || 1 })} /></Field>
                            <Field label="Repeticiones"><input className="input" value={ejercicio.rango_repeticiones} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { rango_repeticiones: event.target.value })} placeholder="8-12" /></Field>
                          </>}
                          <Field label="Descanso entre series (segundos)"><input className="input" type="number" min={0} max={600} value={ejercicio.descanso_segundos} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { descanso_segundos: Number(event.target.value) || 0 })} /></Field>
                          <Field label="Descanso al terminar el ejercicio (segundos)"><input className="input" type="number" min={0} max={600} value={ejercicio.descanso_entre_ejercicios_segundos ?? 0} onChange={(event) => actualizarEjercicio(diaIndex, ejercicioIndex, { descanso_entre_ejercicios_segundos: Number(event.target.value) || 0 })} /></Field>
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
                          <button type="button" className="text-sm font-semibold text-red-600 disabled:opacity-40" disabled={dia.ejercicios.length === 1} onClick={() => { setDias((actuales) => actuales.map((item, index) => index !== diaIndex ? item : { ...item, ejercicios: item.ejercicios.filter((_, itemIndex) => itemIndex !== ejercicioIndex) })); setEjercicioActivo(Math.max(0, ejercicioIndex - 1)) }}>Quitar ejercicio</button>
                        </div>
                      </div>
                    )
                  })}
                  <button type="button" className="btn-secondary" onClick={() => { setDias((actuales) => actuales.map((item, index) => index !== diaIndex ? item : { ...item, ejercicios: [...item.ejercicios, ejercicioVacio(item.ejercicios.length)] })); setEjercicioActivo(dia.ejercicios.length) }}><Plus size={16} /> Agregar ejercicio</button>
                </div>
              </article>
            ))}
          </section> : null}
          {paso === 3 ? <section className="space-y-5">
            <div><h2 className="text-xl font-bold">Revisa y guarda</h2><p className="text-sm text-neutral-500">La rutina se guarda en la biblioteca y luego podrás asignarla a cada cliente.</p></div>
            <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"><p className="text-lg font-bold">{nombre || 'Sin nombre'}</p><p className="mt-1 text-sm text-neutral-500">{GOAL_LABELS[objetivo]} · {modo === 'cycle' ? 'Secuencia flexible' : 'Semanal con continuidad'} · {diasPorSemana} visitas sugeridas</p>{descripcion ? <p className="mt-2 text-sm">{descripcion}</p> : null}</div>
            {dias.map((dia, indice) => <div key={indice} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"><p className="font-bold">{dia.etiqueta_dia} · {dia.nombre}</p><p className="text-sm text-neutral-500">{modo === 'weekly' ? `${weekdays.find((item) => item.value === dia.dia_semana)?.label ?? 'Sin día'} · ` : ''}{dia.ejercicios.length} ejercicios</p><ol className="mt-3 list-inside list-decimal space-y-1 text-sm">{dia.ejercicios.map((ejercicio, ejercicioIndex) => <li key={ejercicioIndex}>{ejercicio.nombre || 'Ejercicio sin nombre'} · {ejercicio.tipo_ejercicio === 'timed' ? `${ejercicio.series ?? 1} × ${ejercicio.duracion_trabajo_segundos ?? (ejercicio.minutos_objetivo ?? 0) * 60}s` : `${ejercicio.series ?? 0} × ${ejercicio.rango_repeticiones}`}</li>)}</ol></div>)}
            {!sePuedeGuardar ? <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{erroresPasos.find((error) => error !== null)}</p> : null}
          </section> : null}
        </div>

        <footer className="border-t border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50 sm:px-7">
          {errorPasoActual && paso !== 2 ? <p className="mb-3 text-sm font-medium text-amber-700 dark:text-amber-300" role="status">{errorPasoActual}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {paso === 0 ? <Link className="btn-secondary inline-flex w-full items-center justify-center sm:w-auto" to="/routines">Cancelar</Link> : <button type="button" className="btn-secondary inline-flex w-full items-center justify-center gap-2 sm:w-auto" onClick={() => irAlPaso(paso - 1)}><ArrowLeft size={16} aria-hidden="true" /> Anterior</button>}
            {paso < 3 ? <button type="button" className="btn-primary inline-flex min-h-12 w-full items-center justify-center gap-3 whitespace-nowrap sm:w-auto" disabled={Boolean(errorPasoActual)} onClick={() => { if (!errorPasoActual) irAlPaso(paso + 1) }}><span className="sm:hidden">Continuar</span><span className="hidden sm:inline">Continuar a {titulosPasos[paso + 1]}</span><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20" aria-hidden="true"><ArrowRight size={16} /></span></button> : <button type="button" className="btn-primary inline-flex w-full items-center justify-center sm:w-auto" disabled={!sePuedeGuardar || guardando} onClick={guardar}>{guardando ? 'Guardando…' : template ? 'Guardar cambios' : 'Guardar rutina'}</button>}
          </div>
        </footer>
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
    duracion_trabajo_segundos: ejercicio.duracion_trabajo_segundos ?? null,
    peso_sugerido_kg: ejercicio.peso_sugerido_kg,
    unidad_peso_sugerido: ejercicio.unidad_peso_sugerido ?? 'kg',
    descanso_segundos: ejercicio.descanso_segundos,
    descanso_entre_ejercicios_segundos: ejercicio.descanso_entre_ejercicios_segundos ?? 0,
    notas_tecnicas: ejercicio.notas_tecnicas,
    orden,
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-1 text-sm"><span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>{children}</label>
}
