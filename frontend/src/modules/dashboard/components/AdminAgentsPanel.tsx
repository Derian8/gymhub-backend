import { useState } from 'react'
import { Bot, Loader2, Sparkles } from 'lucide-react'

import { useAdminAgentMutation } from '@/modules/ai-chat/hooks/useAdminAgent'
import { Badge } from '@/shared/components/UI'
import { cn } from '@/shared/lib/utils'

const PREGUNTAS_SUGERIDAS = [
  '¿Qué requiere atención hoy?',
  'Analiza la cobranza',
  '¿Dónde hay riesgo de abandono?',
  'Revisa la cobertura de entrenamiento',
]

const PRIORIDAD_ESTILOS = {
  alta: 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30',
  media: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30',
  normal: 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
}

export function AdminAgentsPanel() {
  const [pregunta, setPregunta] = useState('')
  const { mutate, data, isPending } = useAdminAgentMutation()

  const consultar = (texto = pregunta) => {
    const preguntaFinal = texto.trim() || 'Prioriza los puntos de administración que requieren atención hoy.'
    setPregunta(preguntaFinal)
    mutate({ pregunta: preguntaFinal })
  }

  return (
    <section className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-white p-5 shadow-sm dark:from-primary/10 dark:via-neutral-950 dark:to-neutral-950" data-testid="admin-agents-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Bot size={19} /></span>
            <div>
              <h2 className="font-semibold text-neutral-900 dark:text-white">Agentes IA de administración</h2>
              <p className="text-xs text-neutral-500">Cobranza, retención, entrenamiento y crecimiento; análisis de solo lectura.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {PREGUNTAS_SUGERIDAS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => consultar(item)}
                disabled={isPending}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 transition hover:border-primary/40 hover:text-primary disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <form
          className="flex w-full gap-2 lg:max-w-md"
          onSubmit={(event) => { event.preventDefault(); consultar() }}
        >
          <input
            value={pregunta}
            onChange={(event) => setPregunta(event.target.value)}
            maxLength={600}
            placeholder="Pregunta sobre la administración…"
            aria-label="Pregunta para los agentes de administración"
            className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Analizar
          </button>
        </form>
      </div>

      {data ? (
        <div className="mt-5 border-t border-neutral-200/80 pt-4 dark:border-neutral-800" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={data.fuente === 'gemini' ? 'success' : 'info'}>
              {data.fuente === 'gemini' ? 'Gemini' : 'Respaldo por reglas'}
            </Badge>
            {data.codigo_proveedor ? <span className="text-xs text-neutral-500">Gemini respondió HTTP {data.codigo_proveedor}; se usó el análisis local.</span> : null}
          </div>
          <p className="whitespace-pre-line text-sm leading-6 text-neutral-700 dark:text-neutral-200">{data.respuesta}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.agentes.map((agente) => (
              <article key={agente.id} className={cn('rounded-xl border p-3', PRIORIDAD_ESTILOS[agente.prioridad])}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{agente.nombre}</h3>
                  <Badge variant={agente.prioridad === 'alta' ? 'error' : agente.prioridad === 'media' ? 'warning' : 'info'}>
                    {agente.prioridad === 'alta' ? 'Prioridad alta' : agente.prioridad === 'media' ? 'Seguimiento' : 'Estable'}
                  </Badge>
                </div>
                <p className="text-xs leading-5 text-neutral-600 dark:text-neutral-300">{agente.hallazgo}</p>
                <p className="mt-2 text-xs font-medium text-primary">{agente.siguiente_paso}</p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-neutral-400">Las herramientas comparten métricas agregadas, sin nombres ni correos. Evita incluir datos personales en tu pregunta y verifica el análisis antes de actuar.</p>
        </div>
      ) : null}
    </section>
  )
}
