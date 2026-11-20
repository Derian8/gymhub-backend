import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { plansApi } from '@/modules/plans/api/plansApi'
import { RoutineTemplateBuilder } from '@/modules/plans/components/RoutineTemplateBuilder'
import { PageHeader } from '@/shared/components/UI'

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

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-6 pb-8">
      <PageHeader
        title={editing ? 'Editar rutina' : 'Crear rutina'}
        subtitle={editing
          ? 'Actualiza la rutina de la biblioteca. Los planes ya asignados conservan su versión.'
          : 'Diseña una rutina reutilizable y luego asígnala a tus clientes.'}
        accionEnLinea
        action={<Link className="rutina-volver pulso-cabecera-volver btn-primary inline-flex min-h-11 items-center justify-center gap-2" to="/routines" aria-label="Volver a rutinas"><ArrowLeft size={16} aria-hidden="true" /><span className="hidden sm:inline">Volver a rutinas</span></Link>}
      />
      {editing && isLoading ? (
        <div className="card p-8">Cargando rutina…</div>
      ) : editing && (isError || !data) ? (
        <div className="card p-8">No se pudo cargar la rutina.</div>
      ) : (
        <RoutineTemplateBuilder template={data} onSaved={() => navigate('/routines')} />
      )}
    </div>
  )
}
