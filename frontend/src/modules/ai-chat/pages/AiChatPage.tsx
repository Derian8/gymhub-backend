import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Bot, CheckCircle, Copy, Loader2, Send, Sparkles, Target, User, Users } from 'lucide-react'
import { toast } from 'sonner'

import { useAiChatContextQuery, useAiChatHistoryQuery, useAiChatMutation, useAiChatSendMessageMutation } from '../hooks/useAiChat'
import { useMembersQuery } from '@/modules/members/hooks/useMembers'
import { Badge, EmptyState, PageHeader } from '@/shared/components/UI'
import { useAuthStore } from '@/shared/store/authStore'
import { cn, PAYMENT_STATUS_LABELS, RISK_LEVEL_BADGE, RISK_LEVEL_LABELS } from '@/shared/lib/utils'
import type { AIChatContext, AIChatResponse } from '@/shared/types'

type LocalMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function AiChatPage() {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [message, setMessage] = useState('')
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([])
  const [lastFallbackUsed, setLastFallbackUsed] = useState(false)
  const [sendableResponse, setSendableResponse] = useState<AIChatResponse | null>(null)
  const [sentMessageIds, setSentMessageIds] = useState<number[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isTrainer = Boolean(user?.role === 'trainer' || user?.is_staff)
  const selectedMemberId = isTrainer ? parseMemberId(searchParams.get('member')) : undefined
  const { data: context, isLoading: contextLoading, isError: contextError } = useAiChatContextQuery(selectedMemberId)
  const { data: history, isLoading: historyLoading, isError: historyError } = useAiChatHistoryQuery(selectedMemberId)
  const { data: membersPage } = useMembersQuery({ page: 1 }, isTrainer)
  const { mutate: sendMessage, isPending, data: lastResponse } = useAiChatMutation()
  const { mutate: sendTrainerMessage, isPending: isSendingTrainerMessage } = useAiChatSendMessageMutation()
  const canSendWithoutContext = !isTrainer || Boolean(selectedMemberId)
  const chatUnavailable = isTrainer && !selectedMemberId

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages, isPending])

  useEffect(() => {
    if (history) {
      const orderedMessages = [...history]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((item) => ({ role: item.role, content: item.content }))
      setLocalMessages(orderedMessages)
    }
  }, [history])

  const handleSelectMember = (memberId: number) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('member', String(memberId))
    setSearchParams(nextParams)
    setLocalMessages([])
    setLastFallbackUsed(false)
    setSendableResponse(null)
    setSentMessageIds([])
  }

  const handleSend = (presetMessage?: string) => {
    const content = (presetMessage ?? message).trim()
    if (!content || isPending || chatUnavailable || (context?.requires_member_selection ?? false)) return

    setMessage('')
    setLocalMessages((prev) => [...prev, { role: 'user', content }])

    sendMessage(
      {
        message: content,
        member_id: isTrainer ? (context?.member?.id ?? selectedMemberId) : undefined,
        conversation_id: context?.conversation_id ?? undefined,
      },
      {
        onSuccess: (data) => {
          setLastFallbackUsed(Boolean(data.fallback_used))
          setSendableResponse(data.sendable ? data : null)
          setLocalMessages((prev) => [...prev, { role: 'assistant', content: data.content }])
        },
        onError: () => {
          setLocalMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'No se pudo generar la respuesta. Intenta de nuevo.' },
          ])
        },
      },
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCopySendableMessage = async () => {
    if (!sendableResponse?.message_text) {
      return
    }
    await navigator.clipboard.writeText(sendableResponse.message_text)
    toast.success('Mensaje copiado')
  }

  const handleSendToMember = () => {
    if (!sendableResponse?.sendable || !sendableResponse.message_text || !context?.member?.id) {
      return
    }
    sendTrainerMessage(
      {
        member_id: context.member.id,
        message_text: sendableResponse.message_text,
        conversation_id: context.conversation_id ?? undefined,
        source_message_id: sendableResponse.message_id,
      },
      {
        onSuccess: (data) => {
          if (sendableResponse.message_id) {
            setSentMessageIds((current) => (current.includes(sendableResponse.message_id!) ? current : [...current, sendableResponse.message_id!]))
          }
          setSendableResponse((current) => current ? { ...current, message_text: data.message_text } : current)
        },
      },
    )
  }

  const sendableAlreadySent = Boolean(sendableResponse?.message_id && sentMessageIds.includes(sendableResponse.message_id))

  return (
    <div data-testid="ai-chat-page" className="page-enter flex flex-col gap-6">
      <PageHeader
        title={isTrainer ? 'Asistente Inteligente del Trainer' : 'Chat IA'}
        subtitle={isTrainer ? 'Analiza miembros con datos reales de GymHub y decide el siguiente paso.' : 'Coach personal con contexto real'}
      />

      {(contextError || historyError) && (
        <div
          className="rounded-sm border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
          data-testid="chat-degraded-banner"
        >
          El chat quedó en modo degradado porque el backend devolvió un error en contexto o historial. Puedes reintentar; si persiste, el servidor necesita revisión o migraciones.
        </div>
      )}

      {isTrainer && !selectedMemberId ? (
        <TrainerSelectionState
          members={membersPage?.results ?? []}
          onSelectMember={handleSelectMember}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-6">
          <aside className="space-y-4">
            <ChatContextPanel
              context={context}
              contextLoading={contextLoading}
              isTrainer={isTrainer}
              onSelectMember={handleSelectMember}
              members={membersPage?.results ?? []}
            />
            <PromptPanel
              prompts={context?.trainer_assistant?.quick_questions ?? (context?.suggested_prompts ?? []).map((prompt) => ({ label: prompt, prompt }))}
              onPromptClick={handleSend}
              disabled={isPending || context?.requires_member_selection}
            />
          </aside>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-3 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-primary" />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {context?.mode === 'trainer_member' ? 'Asistente del trainer' : 'GymHub AI'}
                </span>
                {context?.engine_mode === 'deterministic' ? (
                  <Badge variant="info">Asistente contextual</Badge>
                ) : (
                  <Badge variant="success">Mejora local activa</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                {context?.remaining_messages != null && context?.limit != null ? (
                  <span data-testid="chat-remaining">
                    {context.remaining_messages}/{context.limit} disponibles hoy
                  </span>
                ) : null}
                {(lastFallbackUsed || lastResponse?.fallback_used) && (
                  <Badge variant="warning">Respuesta con fallback</Badge>
                )}
              </div>
            </div>

            <div className="min-h-[28rem] space-y-4 overflow-y-auto p-6">
              {sendableResponse?.sendable && sendableResponse.message_text && context?.mode === 'trainer_member' && (
                <div className="rounded-sm border border-primary/20 bg-primary/5 p-4" data-testid="sendable-message-card">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-neutral-500">Mensaje para enviar</p>
                      {sendableResponse.priority_detected ? (
                        <div className="mt-2">
                          <Badge variant="warning">Prioridad: {priorityLabel(sendableResponse.priority_detected)}</Badge>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleCopySendableMessage}
                        data-testid="copy-sendable-message"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSendToMember}
                        disabled={isSendingTrainerMessage || sendableAlreadySent}
                        data-testid="sendable-message-send"
                      >
                        {sendableAlreadySent ? 'Enviado al member' : 'Enviar al member'}
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-200">{sendableResponse.message_text}</p>
                  <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                    Al enviarlo, el member lo verá en su bandeja de mensajes del trainer.
                  </p>
                </div>
              )}

              {historyLoading || contextLoading ? (
                <div className="flex h-full min-h-[20rem] items-center justify-center">
                  <Loader2 className="animate-spin text-neutral-400" size={24} />
                </div>
              ) : localMessages.length === 0 ? (
                <EmptyState
                  icon={<Sparkles size={42} />}
                  title={context?.mode === 'trainer_member' ? 'Asistente listo' : 'Coach listo'}
                  description={
                    context?.mode === 'trainer_member'
                      ? 'Pregunta por progreso, asistencia, pagos, entrenamiento o riesgos de este miembro.'
                      : 'Pregunta por tu sesión de hoy, adherencia o nutrición general.'
                  }
                />
              ) : (
                localMessages.map((msg, index) => (
                  <ChatBubble key={`${msg.role}-${index}`} role={msg.role} content={msg.content} />
                ))
              )}

              {isPending && (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot size={16} />
                  </div>
                  <div className="flex items-center gap-2 rounded-sm bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
                    <Loader2 size={14} className="animate-spin text-neutral-400" />
                    <span className="text-sm text-neutral-400">Generando respuesta…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-neutral-100 p-4 dark:border-neutral-800">
              <div className="flex gap-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    context?.mode === 'trainer_member'
                      ? 'Pregunta por este cliente...'
                      : 'Escribe tu pregunta...'
                  }
                  rows={2}
                  disabled={isPending || chatUnavailable || (context?.requires_member_selection ?? false) || (!context && !canSendWithoutContext)}
                  className="flex-1 resize-none rounded-sm border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  data-testid="chat-input"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isPending || !message.trim() || chatUnavailable || (context?.requires_member_selection ?? false) || (!context && !canSendWithoutContext)}
                  className="btn-primary self-end px-4"
                  data-testid="chat-send"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-neutral-400">
                Enter para enviar · Shift+Enter para nueva línea
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function priorityLabel(priority: NonNullable<AIChatResponse['priority_detected']>) {
  const labels: Record<string, string> = {
    payment: 'Pago',
    adherence: 'Adherencia',
    workout: 'Rutina',
    nutrition: 'Nutrición',
    general: 'Seguimiento',
  }
  return labels[priority] ?? 'Seguimiento'
}

function TrainerSelectionState({
  members,
  onSelectMember,
}: {
  members: Array<{ id: number; full_name: string; email: string; nivel_riesgo?: 'low' | 'medium' | 'high' }>
  onSelectMember: (memberId: number) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.86fr_1.14fr]">
      <div className="card p-6">
        <EmptyState
          icon={<Users size={42} />}
          title="Selecciona un cliente"
          description="El copiloto del trainer funciona sobre un miembro concreto para mantener respuestas accionables y seguras."
        />
      </div>
      <div className="card p-6">
        <p className="label-base mb-3">Clientes disponibles</p>
        <div className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-neutral-500">No hay clientes asignados para abrir el copiloto.</p>
          ) : (
            members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectMember(member.id)}
                className="flex w-full items-center justify-between rounded-sm border border-neutral-200 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                data-testid={`chat-member-option-${member.id}`}
              >
                <div>
                  <p className="font-medium text-neutral-900 dark:text-white">{member.full_name}</p>
                  <p className="text-sm text-neutral-500">{member.email}</p>
                </div>
                {member.nivel_riesgo ? (
                  <Badge variant={RISK_LEVEL_BADGE[member.nivel_riesgo]}>
                    Riesgo {RISK_LEVEL_LABELS[member.nivel_riesgo]}
                  </Badge>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ChatContextPanel({
  context,
  contextLoading,
  isTrainer,
  onSelectMember,
  members,
}: {
  context: Awaited<ReturnType<typeof useAiChatContextQuery>>['data']
  contextLoading: boolean
  isTrainer: boolean
  onSelectMember: (memberId: number) => void
  members: Array<{ id: number; full_name: string; email: string }>
}) {
  if (contextLoading) {
    return (
      <div className="card p-6">
        <div className="h-32 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
      </div>
    )
  }

  if (!context || context.requires_member_selection) {
    return (
      <div className="card p-6">
        <EmptyState
          icon={<Users size={32} />}
          title="Falta el contexto"
          description="Selecciona un cliente para cargar señales reales antes de conversar."
        />
      </div>
    )
  }

  return (
    <div className="card p-6 space-y-4" data-testid="chat-context-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-base">{isTrainer ? 'Cliente en contexto' : 'Tu contexto actual'}</p>
          <h2 className="font-heading text-2xl font-bold text-neutral-900 dark:text-white">
            {context.member?.full_name}
          </h2>
          <p className="text-sm text-neutral-500">{context.member?.email}</p>
        </div>
        {context.member?.nivel_riesgo ? (
          <Badge variant={RISK_LEVEL_BADGE[context.member.nivel_riesgo]}>
            Riesgo {RISK_LEVEL_LABELS[context.member.nivel_riesgo]}
          </Badge>
        ) : null}
      </div>

      {isTrainer && members.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {members.slice(0, 4).map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelectMember(member.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                member.id === context.member?.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-neutral-200 text-neutral-600 hover:border-primary/40 dark:border-neutral-800 dark:text-neutral-400',
              )}
            >
              {member.full_name}
            </button>
          ))}
        </div>
      ) : null}

      {isTrainer && context.trainer_assistant ? (
        <TrainerAssistantOverview context={context} />
      ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ContextTile label="Siguiente acción" value={context.member?.siguiente_accion || '—'} />
          <ContextTile label="Plan de entrenamiento" value={context.summary?.active_plan_name || 'Sin plan de entrenamiento'} />
          <ContextTile
            label="Pago"
            value={context.summary?.payment_status ? PAYMENT_STATUS_LABELS[context.summary.payment_status] : 'Sin registros'}
          />
          <ContextTile
            label="Prescripción"
            value={
              context.member?.estado_prescripcion === 'lista'
                ? 'Lista'
                : context.member?.estado_prescripcion === 'incompleta'
                ? 'Incompleta'
                : 'Sin plan'
            }
          />
          <ContextTile label="Sesión de hoy" value={context.summary?.today_workout_name || 'Sin sesión visible'} />
          <ContextTile
            label="Fricción principal"
            value={buildPrimaryFriction(context)}
          />
        </div>

      <div className="rounded-sm bg-neutral-100 p-4 dark:bg-neutral-900">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Resumen operativo</p>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{context.summary?.resumen_hoy}</p>
        {context.summary?.risk_reasons?.length ? (
          <p className="mt-2 text-xs text-neutral-500">
            Señales clave: {context.summary.risk_reasons.join(', ')}
          </p>
        ) : null}
        {context.analysis_context?.trainer_name ? (
          <p className="mt-2 text-xs text-neutral-500">
            Trainer en contexto: {context.analysis_context.trainer_name}
          </p>
        ) : null}
        {context.summary?.nutrition_goal ? (
          <p className="mt-2 text-xs text-neutral-500">Objetivo nutricional: {context.summary.nutrition_goal}</p>
        ) : null}
        <p className="mt-2 text-xs text-neutral-500" data-testid="chat-engine-status">
          {context.engine_mode === 'deterministic'
            ? 'Motor activo: asistente contextual gratuito'
            : context.local_llm_available
              ? 'Motor activo: reglas + mejora local'
              : 'Motor activo: reglas; mejora local no disponible'}
        </p>
      </div>

      {isTrainer && context.member ? (
        <Link
          to={`/members/${context.member.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver ficha completa del cliente
        </Link>
      ) : null}
    </div>
  )
}

function PromptPanel({
  prompts,
  onPromptClick,
  disabled,
}: {
  prompts: Array<{ label: string; prompt: string }>
  onPromptClick: (prompt: string) => void
  disabled?: boolean
}) {
  return (
    <div className="card p-6">
      <p className="label-base mb-3">Preguntas rápidas</p>
      <div className="flex flex-wrap gap-2">
        {prompts.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay sugerencias todavía.</p>
        ) : (
          prompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => onPromptClick(prompt.prompt)}
              disabled={disabled}
              className="rounded-full border border-neutral-200 px-3 py-2 text-left text-xs text-neutral-700 transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300"
              data-testid="chat-prompt"
            >
              {prompt.label}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function TrainerAssistantOverview({ context }: { context: AIChatContext }) {
  const assistant = context.trainer_assistant
  if (!assistant) return null
  const status = STATUS_META[assistant.overall_status]
  return (
    <div className="space-y-4">
      <div className={cn('rounded-sm border p-4', status.className)} data-testid="trainer-assistant-status">
        <div className="flex items-center gap-3">
          <status.Icon size={20} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide">Estado general</p>
            <p className="font-heading text-xl font-bold">{status.label}</p>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-neutral-200 p-4 dark:border-neutral-800" data-testid="trainer-detected-insights">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <p className="font-heading text-lg font-bold text-neutral-900 dark:text-white">Lo que detecté</p>
        </div>
        {assistant.detected_insights.length ? (
          <div className="space-y-2">
            {assistant.detected_insights.map((insight) => (
              <div key={`${insight.code}-${insight.title}`} className="rounded-sm bg-neutral-100 p-3 dark:bg-neutral-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">{insight.title}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{insight.detail}</p>
                  </div>
                  <Badge variant={INSIGHT_BADGE[insight.severity]}>{INSIGHT_LABEL[insight.severity]}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No hay señales automáticas con los datos actuales.</p>
        )}
      </div>
    </div>
  )
}

const STATUS_META = {
  excellent: {
    label: 'Excelente',
    Icon: CheckCircle,
    className: 'border-green-500/30 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300',
  },
  needs_follow_up: {
    label: 'Requiere seguimiento',
    Icon: Target,
    className: 'border-yellow-500/30 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300',
  },
  immediate_attention: {
    label: 'Atención inmediata',
    Icon: AlertTriangle,
    className: 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300',
  },
} as const

const INSIGHT_BADGE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  positive: 'success',
  neutral: 'neutral',
  info: 'info',
  warning: 'warning',
  critical: 'error',
}

const INSIGHT_LABEL: Record<string, string> = {
  positive: 'Bien',
  neutral: 'Neutro',
  info: 'Dato faltante',
  warning: 'Seguimiento',
  critical: 'Urgente',
}

function ContextTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{value}</p>
    </div>
  )
}

function ChatBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')} data-testid={`chat-bubble-${role}`}>
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-neutral-200 dark:bg-neutral-700' : 'bg-primary/10 text-primary',
        )}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-sm px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-white'
            : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
        )}
      >
        {content}
      </div>
    </div>
  )
}

function parseMemberId(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function buildPrimaryFriction(context: NonNullable<Awaited<ReturnType<typeof useAiChatContextQuery>>['data']>) {
  if (context.summary?.payment_status === 'late') {
    return context.summary.days_overdue != null
      ? `Mora activa (${context.summary.days_overdue} días)`
      : 'Mora activa'
  }
  if (context.summary?.payment_status === 'pending') {
    return context.summary.days_until_due != null
      ? `Pago pendiente (${context.summary.days_until_due} días)`
      : 'Pago pendiente'
  }
  if (context.summary?.inactivity_alert) {
    return 'Inactividad abierta'
  }
  if (context.member?.estado_prescripcion === 'incompleta') {
    return 'Prescripción incompleta'
  }
  return 'Sin bloqueo crítico'
}
