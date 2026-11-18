import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, Copy, Eye, EyeOff, Loader2, LogIn, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useLoginMutation } from '../hooks/useAuthMutations'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

type LoginForm = z.infer<typeof loginSchema>

const CUENTAS_DEMO = [
  {
    nombre: 'Administrador',
    descripcion: 'Gestiona clientes, cobros, rutinas y asistencia.',
    correo: 'admin@gymhub.com',
    contrasena: 'PulsoAdmin2026!',
    icono: ShieldCheck,
  },
  {
    nombre: 'Cliente',
    descripcion: 'Consulta tu rutina, progreso y estado de membresía.',
    correo: 'member1@gymhub.com',
    contrasena: 'PulsoCliente2026!',
    icono: UserRound,
  },
]

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch { /* Se intenta la alternativa compatible a continuación. */ }
  const campo = document.createElement('textarea')
  campo.value = texto
  campo.setAttribute('readonly', '')
  campo.style.position = 'fixed'
  campo.style.opacity = '0'
  document.body.appendChild(campo)
  campo.select()
  let copiado = false
  try { copiado = document.execCommand('copy') }
  catch { copiado = false }
  campo.remove()
  return copiado
}

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [mostrarAccesosDemo, establecerMostrarAccesosDemo] = useState(false)
  const [avisoDemo, establecerAvisoDemo] = useState('')
  const { mutate: login, isPending } = useLoginMutation()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginForm) => login(data)

  const copiarCredenciales = async (cuenta: typeof CUENTAS_DEMO[number]) => {
    const copiado = await copiarTexto(`Correo: ${cuenta.correo}\nContraseña: ${cuenta.contrasena}`)
    if (copiado) {
      establecerAvisoDemo(`Credenciales de ${cuenta.nombre.toLowerCase()} copiadas.`)
    } else {
      establecerAvisoDemo('No se pudo copiar. Puedes seleccionar las credenciales visibles o pulsar Usar acceso.')
    }
  }

  return (
    <div className="page-enter">
      <h1 className="mb-1 text-2xl font-heading font-black uppercase tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
        Iniciar sesión
      </h1>
      <p className="mb-5 text-sm text-neutral-500 dark:text-neutral-400">
        Ingresa tus credenciales para continuar
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="login-form">
        <div>
          <label htmlFor="correo-acceso" className="label-base mb-1 block">Email</label>
          <input
            {...register('email')}
            id="correo-acceso"
            type="email"
            placeholder="tu@email.com"
            className="input-base w-full"
            data-testid="email-input"
            autoComplete="email"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1" data-testid="email-error">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="clave-acceso" className="label-base mb-1 block">Contraseña</label>
          <div className="relative">
            <input
              {...register('password')}
              id="clave-acceso"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="input-base w-full pr-10"
              data-testid="password-input"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              data-testid="toggle-password"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs mt-1" data-testid="password-error">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          id="login-submit"
          type="submit"
          disabled={isPending}
          className="btn-primary w-full flex items-center justify-center gap-2"
          data-testid="login-submit"
        >
          {isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Preparando servidor e ingresando...
            </>
          ) : (
            'INGRESAR'
          )}
        </button>
      </form>

      <section className="mt-4 border-t border-neutral-200 pt-3 dark:border-white/10" aria-labelledby="titulo-accesos-demo">
        <button type="button" aria-expanded={mostrarAccesosDemo} aria-controls="contenido-accesos-demo" onClick={() => establecerMostrarAccesosDemo((actual) => !actual)} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-white/5">
          <ShieldCheck size={16} className="shrink-0 text-primary" aria-hidden="true" />
          <span id="titulo-accesos-demo" className="text-sm font-bold text-neutral-900 dark:text-white">Accesos demo</span>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-neutral-400">Admin y cliente</span>
          <ChevronDown size={16} className={`shrink-0 text-neutral-400 transition-transform ${mostrarAccesosDemo ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <div id="contenido-accesos-demo" hidden={!mostrarAccesosDemo} className="mt-2 space-y-2">
          {CUENTAS_DEMO.map((cuenta) => (
            <article key={cuenta.nombre} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/[0.03]" aria-label={`Acceso demo de ${cuenta.nombre.toLowerCase()}`}>
              <div className="flex items-start gap-2">
                <cuenta.icono size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-neutral-900 dark:text-white">{cuenta.nombre}</h3>
                  <p className="mt-0.5 truncate text-[10px] text-neutral-500 dark:text-neutral-400" title={cuenta.descripcion}>{cuenta.descripcion}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" disabled={isPending || !cuenta.contrasena} aria-label={`Usar acceso de ${cuenta.nombre.toLowerCase()}`} title="Completar formulario" onClick={() => {
                    setValue('email', cuenta.correo, { shouldValidate: true })
                    setValue('password', cuenta.contrasena, { shouldValidate: true })
                    establecerAvisoDemo(`Acceso de ${cuenta.nombre.toLowerCase()} preparado. Pulsa Ingresar para continuar.`)
                    document.getElementById('login-submit')?.focus()
                  }} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"><LogIn size={15} aria-hidden="true" /></button>
                  <button type="button" disabled={!cuenta.contrasena} aria-label={`Copiar credenciales de ${cuenta.nombre.toLowerCase()}`} title="Copiar credenciales" onClick={() => void copiarCredenciales(cuenta)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300"><Copy size={15} aria-hidden="true" /></button>
                </div>
              </div>
              <dl className="mt-2 grid gap-1 border-t border-neutral-200 pt-2 text-[10px] dark:border-white/10">
                <div className="flex min-w-0 items-baseline gap-2"><dt className="w-12 shrink-0 text-neutral-400">Correo</dt><dd className="min-w-0 truncate font-mono text-neutral-700 dark:text-neutral-200 select-all" title={cuenta.correo}>{cuenta.correo}</dd></div>
                <div className="flex min-w-0 items-baseline gap-2"><dt className="w-12 shrink-0 text-neutral-400">Clave</dt><dd className="min-w-0 truncate font-mono text-neutral-700 dark:text-neutral-200 select-all" title={cuenta.contrasena}>{cuenta.contrasena || 'Pendiente de configurar'}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <p role="status" className={`${avisoDemo ? 'mt-2' : ''} text-[10px] text-neutral-500 dark:text-neutral-400`}>{avisoDemo}</p>
      </section>
      <p className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
        Las cuentas de miembros son creadas por la administración del gimnasio.
      </p>
    </div>
  )
}
