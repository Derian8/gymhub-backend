import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useRegisterMutation } from '../hooks/useAuthMutations'

const registerSchema = z
  .object({
    email: z.string().trim().email('Email inválido'),
    first_name: z.string().trim().min(1, 'El nombre es requerido'),
    last_name: z.string().trim().min(1, 'El apellido es requerido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    password2: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.password2, {
    message: 'Las contraseñas no coinciden',
    path: ['password2'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { mutate: registerMember, isPending } = useRegisterMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = (data: RegisterForm) => {
    registerMember({
      ...data,
      role: 'member',
    })
  }

  return (
    <div className="page-enter">
      <h1 className="mb-1 text-3xl font-heading font-black uppercase tracking-tight text-neutral-900 dark:text-white">
        Crear cuenta
      </h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        Regístrate como miembro para empezar a usar tu panel
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" data-testid="register-form">
        <div>
          <label className="label-base mb-2 block">Email</label>
          <input
            {...register('email')}
            type="email"
            placeholder="tu@email.com"
            className="input-base w-full"
            data-testid="register-email-input"
            autoComplete="email"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500" data-testid="register-email-error">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-base mb-2 block">Nombre</label>
            <input
              {...register('first_name')}
              type="text"
              placeholder="Nombre"
              className="input-base w-full"
              data-testid="register-first-name-input"
              autoComplete="given-name"
            />
            {errors.first_name && (
              <p className="mt-1 text-xs text-red-500" data-testid="register-first-name-error">
                {errors.first_name.message}
              </p>
            )}
          </div>

          <div>
            <label className="label-base mb-2 block">Apellido</label>
            <input
              {...register('last_name')}
              type="text"
              placeholder="Apellido"
              className="input-base w-full"
              data-testid="register-last-name-input"
              autoComplete="family-name"
            />
            {errors.last_name && (
              <p className="mt-1 text-xs text-red-500" data-testid="register-last-name-error">
                {errors.last_name.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="label-base mb-2 block">Contraseña</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="input-base w-full pr-10"
              data-testid="register-password-input"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              data-testid="register-toggle-password"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-500" data-testid="register-password-error">
              {errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label className="label-base mb-2 block">Confirmar contraseña</label>
          <input
            {...register('password2')}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="input-base w-full"
            data-testid="register-password2-input"
            autoComplete="new-password"
          />
          {errors.password2 && (
            <p className="mt-1 text-xs text-red-500" data-testid="register-password2-error">
              {errors.password2.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary flex w-full items-center justify-center gap-2"
          data-testid="register-submit"
        >
          {isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creando cuenta...
            </>
          ) : (
            'CREAR CUENTA'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-primary hover:text-primary-dark">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
