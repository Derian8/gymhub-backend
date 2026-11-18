import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { plansApi } from '@/modules/plans/api/plansApi'
import { PageHeader } from '@/shared/components/UI'
import type { CatalogExercise } from '@/shared/types'

const initial: Partial<CatalogExercise> = { nombre: '', categoria: '', parte_cuerpo: '', equipo: '', musculo_objetivo: '', instrucciones_es: '', imagen_url: '', animacion_url: '', video_url: '', atribucion_media: '', esta_activo: true }
const fields: Array<{ key: keyof CatalogExercise; label: string }> = [
  { key: 'nombre', label: 'Nombre' }, { key: 'categoria', label: 'Categoría' },
  { key: 'parte_cuerpo', label: 'Parte del cuerpo' }, { key: 'equipo', label: 'Equipo' },
  { key: 'musculo_objetivo', label: 'Músculo principal' },
  { key: 'imagen_url', label: 'URL de imagen HTTPS' }, { key: 'animacion_url', label: 'URL de animación HTTPS' },
  { key: 'video_url', label: 'URL de video HTTPS' }, { key: 'atribucion_media', label: 'Atribución de medios' },
]

export function CatalogExerciseEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const exerciseId = Number(id)
  const editing = Boolean(id)
  const exercise = useQuery({ queryKey: ['catalog-exercise', exerciseId], queryFn: () => plansApi.catalogExercise(exerciseId), enabled: editing })
  const [form, setForm] = useState<Partial<CatalogExercise>>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (exercise.data) setForm(exercise.data) }, [exercise.data])
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      if (editing) await plansApi.updateCatalogExercise(exerciseId, form)
      else await plansApi.createCatalogExercise(form)
      navigate('/routines/exercises')
    } catch { setError('No se pudo guardar el ejercicio. Revisa los campos y las URL.') }
    finally { setSaving(false) }
  }
  if (editing && exercise.isLoading) return <div className="card p-6">Cargando ejercicio…</div>
  if (editing && exercise.isError) return <div className="card p-6">No se pudo cargar el ejercicio.</div>
  return <div className="page-enter mx-auto max-w-4xl space-y-6">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" to="/routines/exercises"><ArrowLeft size={16} /> Ejercicios</Link>
    <PageHeader title={editing ? 'Editar ejercicio' : 'Crear ejercicio'} subtitle="Los cambios del catálogo se aplican a futuras asignaciones. Los planes e historiales existentes conservan su copia." />
    <div className="card space-y-5 p-5 sm:p-7"><div className="grid gap-4 sm:grid-cols-2">{fields.map(({ key, label }) => <label key={key} className="space-y-1 text-sm"><span className="font-semibold">{label}</span><input className="input" type={key === 'nombre' ? 'text' : key.endsWith('_url') ? 'url' : 'text'} required={key === 'nombre'} value={String(form[key] ?? '')} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div><label className="block space-y-1 text-sm"><span className="font-semibold">Instrucciones</span><textarea className="input min-h-32" value={form.instrucciones_es ?? ''} onChange={(event) => setForm((current) => ({ ...current, instrucciones_es: event.target.value }))} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.esta_activo ?? true} onChange={(event) => setForm((current) => ({ ...current, esta_activo: event.target.checked }))} /> Activo para nuevas rutinas</label>{error && <p className="text-sm text-red-600" role="alert">{error}</p>}<div className="flex justify-end gap-2"><Link className="btn-secondary" to="/routines/exercises">Cancelar</Link><button className="btn-primary" disabled={saving || !form.nombre?.trim()} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar ejercicio'}</button></div></div>
  </div>
}
