import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { plansApi } from '@/modules/plans/api/plansApi'
import { RoutineTemplateBuilder } from '@/modules/plans/components/RoutineTemplateBuilder'

export function RoutineEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const templateId = Number(id)
  const editing = Boolean(id)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['plan-template', templateId],
    queryFn: () => plansApi.trainingTemplate(templateId),
    enabled: editing && Number.isInteger(templateId),
  })

  if (editing && isLoading) return <div className="card p-8">Cargando rutina…</div>
  if (editing && (isError || !data)) return <div className="card p-8">No se pudo cargar la rutina. <Link className="text-primary underline" to="/routines">Volver</Link></div>
  return <RoutineTemplateBuilder open modoPagina template={data} onClose={() => navigate('/routines')} onSaved={() => navigate('/routines')} />
}
