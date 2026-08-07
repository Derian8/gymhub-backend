import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Copy, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/shared/components/UI'
import { useCreateMemberMutation } from '../hooks/useMembers'

const initialForm = { nombres: '', apellidos: '', correo_electronico: '', telefono: '', fecha_nacimiento: '', contacto_emergencia: '' }

export function NewMemberPage() {
  const [form, setForm] = useState(initialForm)
  const [created, setCreated] = useState<{ id: number; password: string; name: string } | null>(null)
  const createMember = useCreateMemberMutation()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    createMember.mutate(form, { onSuccess: (data) => setCreated({ id: data.member.id, password: data.contrasena_temporal, name: data.member.full_name }) })
  }
  if (created) return <div className="mx-auto max-w-2xl"><PageHeader title="Miembro creado" subtitle="Entrega esta contraseña por un canal seguro; no volverá a mostrarse." /><section className="card p-6"><h2 className="text-xl font-bold">{created.name}</h2><div className="mt-5 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900"><p className="label-base">Contraseña temporal</p><div className="mt-2 flex items-center gap-3"><code className="flex-1 text-lg font-bold">{created.password}</code><button className="btn-secondary" onClick={() => { navigator.clipboard.writeText(created.password); toast.success('Contraseña copiada') }}><Copy size={16} /> Copiar</button></div></div><div className="mt-6 flex flex-wrap gap-3"><Link className="btn-primary" to={`/members/${created.id}`}>Abrir miembro</Link><Link className="btn-secondary" to={`/billing?member=${created.id}`}>Configurar membresía</Link><button className="btn-secondary" onClick={() => { setCreated(null); setForm(initialForm) }}>Crear otro</button></div></section></div>
  return <div className="mx-auto max-w-3xl"><PageHeader title="Nuevo miembro" subtitle="Crea la cuenta, asígnala a tu gimnasio y continúa luego con membresía y plan de entrenamiento." /><form className="card grid gap-5 p-6 sm:grid-cols-2" onSubmit={submit}>{Object.entries(form).map(([key, value]) => <label key={key} className={key === 'contacto_emergencia' ? 'sm:col-span-2' : ''}><span className="label-base">{{ nombres: 'Nombres', apellidos: 'Apellidos', correo_electronico: 'Correo electrónico', telefono: 'Teléfono', fecha_nacimiento: 'Fecha de nacimiento', contacto_emergencia: 'Contacto de emergencia' }[key as keyof typeof form]}</span><input className="input-base mt-2 w-full" type={key === 'correo_electronico' ? 'email' : key === 'fecha_nacimiento' ? 'date' : 'text'} required={['nombres','apellidos','correo_electronico','telefono'].includes(key)} value={value} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<div className="sm:col-span-2 flex justify-end"><button className="btn-primary flex items-center gap-2" disabled={createMember.isPending}><UserPlus size={17} /> Crear miembro</button></div></form></div>
}
