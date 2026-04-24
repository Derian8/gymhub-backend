import { MessageSquareMore, Send } from 'lucide-react'

import { useMarkReadMutation, useNotificationsQuery } from '../hooks/useAlerts'
import { Badge, EmptyState, PageHeader } from '@/shared/components/UI'
import { SymbolFrame } from '@/shared/components/Brand'
import { formatRelative } from '@/shared/lib/utils'

const MESSAGE_FILTER = { type: 'trainer_message' }

export function MessagesPage() {
  const { data, isLoading } = useNotificationsQuery(MESSAGE_FILTER)
  const { mutate: markRead } = useMarkReadMutation()
  const messages = data?.results ?? []

  return (
    <div data-testid="messages-page" className="page-enter">
      <PageHeader
        title="Mensajes del trainer"
        subtitle={`${messages.filter((message) => !message.read).length} pendientes de revisar`}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="card h-28 skeleton" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={<MessageSquareMore size={42} />}
          title="Sin mensajes del trainer"
          description="Cuando tu trainer te envíe una indicación desde el asistente, aparecerá aquí."
        />
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <button
              key={message.id}
              type="button"
              className="card w-full p-5 text-left transition-all duration-200 hover:border-primary/40"
              onClick={() => {
                if (!message.read) {
                  markRead(message.id)
                }
              }}
              data-testid={`trainer-message-${message.id}`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <SymbolFrame tone={message.read ? 'default' : 'primary'} size="sm" className="rounded-xl">
                    <Send size={16} />
                  </SymbolFrame>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">Indicaciones del trainer</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Recibido {formatRelative(message.created_at)}
                    </p>
                  </div>
                </div>
                <Badge variant={message.read ? 'neutral' : 'info'}>
                  {message.read ? 'Leído' : 'Nuevo'}
                </Badge>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {message.message}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
