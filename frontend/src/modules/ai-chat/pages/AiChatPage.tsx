import { useState } from 'react'
import { Bot, Send, Loader2, User } from 'lucide-react'
import { useAiChatMutation, useAiChatHistoryQuery } from '../hooks/useAiChat'
import { PageHeader, EmptyState } from '@/shared/components/UI'
import { cn } from '@/shared/lib/utils'
import type { AIChatMessage } from '@/shared/types'
import { useRef, useEffect } from 'react'

export function AiChatPage() {
  const [message, setMessage] = useState('')
  const { data: history, isLoading: historyLoading } = useAiChatHistoryQuery()
  const { mutate: sendMessage, isPending, data: lastResponse } = useAiChatMutation()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [localMessages, setLocalMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages, isPending])

  useEffect(() => {
    if (history?.length) {
      const msgs = [...history]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((m) => ({ role: m.role, content: m.content }))
      setLocalMessages(msgs)
    }
  }, [history])

  const handleSend = () => {
    if (!message.trim() || isPending) return
    const userMsg = message.trim()
    setMessage('')
    setLocalMessages((prev) => [...prev, { role: 'user', content: userMsg }])

    sendMessage(
      { message: userMsg },
      {
        onSuccess: (data) => {
          setLocalMessages((prev) => [...prev, { role: 'assistant', content: data.content }])
        },
        onError: () => {
          setLocalMessages((prev) => [...prev, { role: 'assistant', content: 'Lo siento, ocurrió un error. Intenta de nuevo.' }])
        },
      },
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div data-testid="ai-chat-page" className="page-enter flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <PageHeader
        title="Chat IA"
        subtitle="Tu asistente de fitness personal"
      />

      <div className="flex-1 flex flex-col card overflow-hidden">
        {/* Header with limit info */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-primary" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">GymHub AI</span>
          </div>
          {lastResponse && (
            <span className="text-xs text-neutral-400">
              {lastResponse.limit_reached ? 'Límite diario alcanzado' : 'Sesión activa'}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {historyLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="animate-spin text-neutral-400" size={24} />
            </div>
          ) : localMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                <Bot size={32} />
              </div>
              <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white mb-2">
                ¡Hola! Soy tu asistente de fitness
              </h3>
              <p className="text-sm text-neutral-400 max-w-sm">
                Pregúntame sobre nutrición, rutinas, técnica de ejercicios, o cualquier duda de tu entrenamiento.
              </p>
            </div>
          ) : (
            localMessages.map((msg, i) => (
              <ChatBubble key={i} role={msg.role} content={msg.content} />
            ))
          )}

          {isPending && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-sm px-4 py-3 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-neutral-400" />
                <span className="text-sm text-neutral-400">Pensando...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex gap-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta... (Enter para enviar)"
              rows={2}
              className="flex-1 px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-sm focus:outline-none focus:border-primary text-neutral-900 dark:text-white placeholder-neutral-400 resize-none"
              data-testid="chat-input"
            />
            <button
              onClick={handleSend}
              disabled={isPending || !message.trim()}
              className="btn-primary px-4 self-end flex items-center gap-1"
              data-testid="chat-send"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </div>
    </div>
  )
}

function ChatBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')} data-testid={`chat-bubble-${role}`}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        isUser ? 'bg-neutral-200 dark:bg-neutral-700' : 'bg-primary/10 text-primary',
      )}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className={cn(
        'max-w-[80%] px-4 py-3 rounded-sm text-sm leading-relaxed',
        isUser
          ? 'bg-primary text-white'
          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
      )}>
        {content}
      </div>
    </div>
  )
}
