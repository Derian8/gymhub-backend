import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Mail, Lock, Loader2, Save } from 'lucide-react'
import { useAuthStore } from '@/shared/store/authStore'
import { PageHeader, Avatar, Badge } from '@/shared/components/UI'
import { useUpdateMeMutation } from '@/modules/auth/hooks/useAuthMutations'
import type { UpdateProfileData } from '@/shared/types'

const profileSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  first_name: z.string().trim().min(1, 'El nombre es requerido'),
  last_name: z.string().trim().min(1, 'El apellido es requerido'),
})

type ProfileForm = z.infer<typeof profileSchema>

export function ProfilePage() {
  const { user } = useAuthStore()
  const { mutate: updateMe, isPending } = useUpdateMeMutation()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: user?.email ?? '',
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
    },
  })

  useEffect(() => {
    if (!user) {
      return
    }
    reset({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
    })
  }, [reset, user])

  if (!user) return null

  const onSubmit = (data: ProfileForm) => {
    const payload: UpdateProfileData = {
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
    }
    updateMe(payload)
  }

  return (
    <div data-testid="profile-page" className="page-enter mx-auto max-w-4xl">
      <PageHeader title="Mi Perfil" subtitle="Actualiza tu correo y datos personales sin cambiar tu rol." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="card flex flex-col items-center gap-3 p-6 text-center">
          <Avatar
            name={`${user.first_name} ${user.last_name}`.trim() || user.email}
            size="lg"
          />
          <div>
            <h2 className="font-heading text-xl font-bold text-neutral-900 dark:text-white">
              {`${user.first_name} ${user.last_name}`.trim() || 'Cuenta sin nombre'}
            </h2>
            <p className="text-sm text-neutral-500">{user.email}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant={user.role === 'trainer' ? 'info' : 'success'}>
              {user.role === 'trainer' ? 'Entrenador' : 'Miembro'}
            </Badge>
            {user.is_staff ? <Badge variant="warning">Staff</Badge> : null}
          </div>
        </section>

        <section className="card p-6">
          <div className="mb-5">
            <h3 className="font-heading text-lg font-bold text-neutral-900 dark:text-white">
              Información de acceso
            </h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              El correo se normaliza en minúsculas y tu rol permanece fijo.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" data-testid="profile-form">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-base mb-2 block">Nombre</label>
                <div className="relative">
                  <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    {...register('first_name')}
                    type="text"
                    className="input-base w-full pl-10"
                    data-testid="profile-first-name-input"
                    autoComplete="given-name"
                  />
                </div>
                {errors.first_name ? (
                  <p className="mt-1 text-xs text-red-500" data-testid="profile-first-name-error">
                    {errors.first_name.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="label-base mb-2 block">Apellido</label>
                <div className="relative">
                  <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    {...register('last_name')}
                    type="text"
                    className="input-base w-full pl-10"
                    data-testid="profile-last-name-input"
                    autoComplete="family-name"
                  />
                </div>
                {errors.last_name ? (
                  <p className="mt-1 text-xs text-red-500" data-testid="profile-last-name-error">
                    {errors.last_name.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="label-base mb-2 block">Email</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  {...register('email')}
                  type="email"
                  className="input-base w-full pl-10"
                  data-testid="profile-email-input"
                  autoComplete="email"
                />
              </div>
              {errors.email ? (
                <p className="mt-1 text-xs text-red-500" data-testid="profile-email-error">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoField
                icon={<User size={16} />}
                label="Usuario"
                value={`@${user.username}`}
              />
              <InfoField
                icon={<Lock size={16} />}
                label="Rol"
                value={user.role === 'trainer' ? 'Entrenador' : 'Miembro'}
              />
            </div>

            <button
              type="submit"
              disabled={isPending || !isDirty}
              className="btn-primary inline-flex items-center gap-2"
              data-testid="profile-save-button"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Guardar cambios
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

function InfoField({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/70">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex-shrink-0 text-neutral-400">{icon}</span>
        <div>
          <p className="label-base">{label}</p>
          <p className="mt-0.5 text-sm text-neutral-700 dark:text-neutral-300">{value}</p>
        </div>
      </div>
    </div>
  )
}
