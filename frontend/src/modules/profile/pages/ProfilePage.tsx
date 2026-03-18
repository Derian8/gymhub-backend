import { User, Mail, Phone, Lock, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/shared/store/authStore'
import { PageHeader, Avatar, Badge } from '@/shared/components/UI'

export function ProfilePage() {
  const { user } = useAuthStore()

  if (!user) return null

  return (
    <div data-testid="profile-page" className="page-enter max-w-2xl mx-auto">
      <PageHeader title="Mi Perfil" subtitle="Información de tu cuenta" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Avatar section */}
        <div className="card p-6 flex flex-col items-center text-center gap-3">
          <Avatar
            name={`${user.first_name} ${user.last_name}` || user.email}
            size="lg"
          />
          <div>
            <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white">
              {user.first_name} {user.last_name}
            </h2>
            <p className="text-sm text-neutral-500">{user.email}</p>
          </div>
          <Badge variant={user.role === 'trainer' ? 'info' : 'success'}>
            {user.role === 'trainer' ? 'Entrenador' : 'Miembro'}
          </Badge>
          {user.is_staff && (
            <Badge variant="warning">Staff</Badge>
          )}
        </div>

        {/* Info section */}
        <div className="md:col-span-2 space-y-4">
          <div className="card p-6">
            <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-4">
              Información personal
            </h3>
            <div className="space-y-4">
              <InfoField
                icon={<User size={16} />}
                label="Nombre completo"
                value={`${user.first_name} ${user.last_name}`.trim() || '—'}
              />
              <InfoField
                icon={<Mail size={16} />}
                label="Email"
                value={user.email}
              />
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
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <span className="text-neutral-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="label-base">{label}</p>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">{value}</p>
      </div>
    </div>
  )
}
