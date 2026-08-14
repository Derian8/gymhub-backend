import { Link } from 'react-router-dom'
import { Activity, Dumbbell, Users } from 'lucide-react'
import { useAuthStore } from '@/shared/store/authStore'
import { useTrainerOverviewQuery } from '@/modules/members/hooks/useMembers'
import { EmptyState, PageHeader, StatCard } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'

export function TrainerTechnicalDashboard() {
  const user = useAuthStore((state) => state.user)
  const { data, isLoading } = useTrainerOverviewQuery()

  return (
    <div className="page-enter space-y-8" data-testid="trainer-dashboard">
      <PageHeader title={`Hola, ${user?.first_name || 'Entrenador'}`} subtitle="Rutinas, progreso y seguimiento técnico de tus clientes asignados." />
      {isLoading || !data ? <CardSkeleton lines={6} /> : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Clientes asignados" value={data.total_active_members} icon={<Users size={18} />} />
            <StatCard label="Sin rutina publicada" value={data.members_without_active_plan} icon={<Dumbbell size={18} />} variant="warning" />
            <StatCard label="Rutinas incompletas" value={data.incomplete_prescriptions} icon={<Dumbbell size={18} />} variant="warning" />
            <StatCard label="Sesiones esta semana" value={data.sessions_completed_this_week} icon={<Activity size={18} />} variant="info" />
          </section>
          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="label-base">Trabajo técnico</p><h2 className="text-xl font-bold">Clientes que requieren atención</h2></div>
              <Link to="/plans" className="btn-primary">Gestionar rutinas</Link>
            </div>
            {data.miembros_sin_plan_activo.length === 0 ? (
              <EmptyState title="Todos tienen rutina" description="No hay clientes asignados sin entrenamiento publicado." />
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {data.miembros_sin_plan_activo.map((member) => (
                  <Link key={member.id} to={`/members/${member.id}/program`} className="rounded-2xl border border-neutral-200 p-4 hover:border-primary dark:border-neutral-800">
                    <p className="font-semibold text-neutral-900 dark:text-white">{member.full_name}</p>
                    <p className="mt-1 text-sm text-neutral-500">{member.next_action}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
