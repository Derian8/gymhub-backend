import { ShieldCheck, Users } from 'lucide-react'
import { Badge, EmptyState, PageHeader } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { useAdminUsers } from '../hooks/useAdminReport'

export function AdminUsersPage() {
  const { data: users, isLoading } = useAdminUsers()

  return (
    <div className="page-enter space-y-7" data-testid="admin-users-page">
      <PageHeader
        title="Usuarios y perfiles"
        subtitle="Consulta las cuentas administrativas y de clientes del gimnasio."
      />
      {isLoading ? <CardSkeleton lines={7} /> : (
        <section className="card overflow-hidden">
          <div className="border-b border-neutral-200 p-5 dark:border-neutral-800">
            <p className="label-base">Accesos</p>
            <h2 className="mt-1 text-xl font-bold">Cuentas registradas</h2>
          </div>
          {users?.length ? (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {users.map((user) => {
                const profiles = user.perfiles_disponibles || []
                return (
                  <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900 dark:text-white">
                        {`${user.first_name} ${user.last_name}`.trim() || user.email}
                      </p>
                      <p className="text-sm text-neutral-500">{user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profiles.map((profile) => (
                          <Badge key={profile} variant={profile === 'administrador' ? 'error' : 'success'}>
                            {profile}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-2 text-xs text-neutral-500">
                      <ShieldCheck size={15} /> Rol exclusivo
                    </span>
                  </div>
                )
              })}
            </div>
          ) : <EmptyState icon={<Users size={30} />} title="No hay cuentas" description="Registra el primer usuario para administrar sus perfiles." />}
        </section>
      )}
    </div>
  )
}
