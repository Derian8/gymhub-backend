import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLoginMutation } from '../hooks/useAuthMutations'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { mutate: login, isPending } = useLoginMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginForm) => login(data)

  return (
    <div className="page-enter">
      <h1 className="text-3xl font-heading font-black uppercase tracking-tight text-neutral-900 dark:text-white mb-1">
        Iniciar sesión
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
        Ingresa tus credenciales para continuar
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" data-testid="login-form">
        <div>
          <label className="label-base block mb-2">Email</label>
          <input
            {...register('email')}
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
          <label className="label-base block mb-2">Contraseña</label>
          <div className="relative">
            <input
              {...register('password')}
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

      <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-semibold text-primary hover:text-primary-dark">
          Regístrate
        </Link>
      </p>
    </div>
  )
}
