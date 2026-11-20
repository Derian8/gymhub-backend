import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import apiClient from '@/shared/api/client'
import { extractApiError } from '@/shared/lib/utils'

interface Estado {
  configurado: boolean
  modo_demo: boolean
  cantidades: Partial<Record<'pendiente' | 'fallido' | 'revisar' | 'aceptado', number>>
  aceptados?: number
}

const claveConsulta = ['estado-correos']

export function EstadoCorreos() {
  const consultas = useQueryClient()
  const estado = useQuery({
    queryKey: claveConsulta,
    queryFn: async () => (await apiClient.get<Estado>('/api/admin/correos/')).data,
    refetchInterval: 60_000,
  })
  const procesar = useMutation({
    mutationFn: async () => (await apiClient.post<Estado>('/api/admin/correos/')).data,
    onSuccess: (resultado) => {
      consultas.setQueryData(claveConsulta, resultado)
      toast.success(`${resultado.aceptados ?? 0} correos aceptados por el proveedor`)
    },
    onError: (error) => toast.error(extractApiError(error)),
  })
  const cantidades = estado.data?.cantidades ?? {}
  const pendientes = (cantidades.pendiente ?? 0) + (cantidades.fallido ?? 0)

  return <section className="card p-5" aria-label="Estado de correos">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-heading text-lg font-bold">Correos de pagos</h2>
        {estado.isError ? <p role="alert" className="text-sm">No se pudo consultar el estado de correos.</p>
          : !estado.data ? <p className="text-sm text-neutral-500">Consultando correos…</p>
          : !estado.data.configurado ? <p className="text-sm text-neutral-500">Envío desactivado o pendiente de configurar Resend.</p>
          : <>
            <p className="text-sm text-neutral-500">{estado.data.modo_demo ? 'Modo demo: los correos se dirigen al buzón de prueba.' : 'Envío a clientes habilitado.'}</p>
            <p className="mt-1 text-sm" aria-live="polite">{pendientes} pendientes · {cantidades.aceptado ?? 0} aceptados · {cantidades.revisar ?? 0} requieren revisión</p>
            <p className="mt-1 text-xs text-neutral-500">La aceptación del proveedor no confirma la entrega. Los reintentos respetan la espera y la cuota disponible.</p>
          </>}
      </div>
      <button type="button" className="btn-secondary" disabled={procesar.isPending || !estado.data?.configurado || !pendientes} onClick={() => procesar.mutate()}>
        {procesar.isPending ? 'Procesando…' : 'Procesar correos pendientes'}
      </button>
    </div>
  </section>
}
