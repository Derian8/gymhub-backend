import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { Dumbbell } from 'lucide-react'
import { TrainerProgramPage } from '@/modules/members/pages/TrainerProgramPage'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { EmptyState } from '@/shared/components/UI'
import { useCreatePlanRevisionMutation, usePlanDetailQuery, usePlansQuery } from '../hooks/usePlans'

export function PlanEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const planId = Number(id || '0')
  const { data: plan, isLoading } = usePlanDetailQuery(planId)
  const createRevision = useCreatePlanRevisionMutation()
  const revisionRequested = useRef(false)

  useEffect(() => {
    if (!plan || plan.status === 'draft' || revisionRequested.current || createRevision.isPending) {
      return
    }

    revisionRequested.current = true
    createRevision.mutate(plan.id, {
      onSuccess: (revision) => navigate(`/plans/${revision.id}/edit`, { replace: true }),
    })
  }, [createRevision, navigate, plan])

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
    if (plan.status !== 'active') {
      return (
        <EmptyState
          icon={<Dumbbell size={40} />}
          title="Rutina no editable"
          description="Solo las rutinas activas pueden generar una nueva revisión."
        />
      )
    }
    if (createRevision.isError) {
      return (
        <EmptyState
          icon={<Dumbbell size={40} />}
          title="No se pudo preparar la revisión"
          description="La rutina activa no pudo abrirse para edición. Intenta nuevamente desde el detalle del plan."
        />
      )
    }
    return (
      <div className="page-enter space-y-4">
        <CardSkeleton lines={6} />
        <p className="text-center text-sm text-neutral-500">Preparando una nueva revisión editable de la rutina…</p>
      </div>
    )
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
