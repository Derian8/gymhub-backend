import { Navigate, useParams } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import { TrainerProgramPage } from '@/modules/members/pages/TrainerProgramPage'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { EmptyState } from '@/shared/components/UI'
import { usePlanDetailQuery, usePlansQuery } from '../hooks/usePlans'

export function PlanEditorPage() {
  const { id } = useParams<{ id: string }>()
  const planId = Number(id || '0')
  const { data: plan, isLoading } = usePlanDetailQuery(planId)

  if (isLoading) {
    return <CardSkeleton lines={6} />
  }

  if (!plan) {
    return (
      <EmptyState
        icon={<Dumbbell size={40} />}
        title="Plan no encontrado"
        description="No fue posible cargar el plan solicitado."
      />
    )
  }

  if (plan.status !== 'draft') {
    return <Navigate to={`/plans?member=${plan.member}`} replace />
  }

  return <TrainerProgramPage memberIdOverride={plan.member} planIdOverride={plan.id} plansContext />
}

export function MemberProgramRedirectPage() {
  const { id } = useParams<{ id: string }>()
  const memberId = Number(id || '0')
  const { data, isLoading } = usePlansQuery({ member: String(memberId) })

  if (isLoading) {
    return <CardSkeleton lines={4} />
  }

  const targetPlan = data?.results.find((plan) => plan.status === 'draft')
  if (targetPlan) {
    return <Navigate to={`/plans/${targetPlan.id}/edit`} replace />
  }

  return <Navigate to={`/plans?member=${memberId}`} replace />
}
