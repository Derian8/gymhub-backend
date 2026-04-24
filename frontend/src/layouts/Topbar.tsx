import { useState } from 'react'
import { Bell, Sun, Moon, Search, Menu, MessageSquareMore, ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/authStore'
import { useNotificationsQuery } from '@/modules/alerts/hooks/useAlerts'
import { cn } from '@/shared/lib/utils'
import { BrandMark, SymbolFrame } from '@/shared/components/Brand'
import type { Notification } from '@/shared/types'

interface TopbarProps {
  onMenuClick: () => void
  sidebarCollapsed: boolean
}

export function Topbar({ onMenuClick, sidebarCollapsed }: TopbarProps) {
  const { theme, toggleTheme, user } = useAuthStore()
  const { data: notifications } = useNotificationsQuery()
  const [showNotifs, setShowNotifs] = useState(false)
  const navigate = useNavigate()

  const unreadCount = notifications?.results?.filter((n) => !n.read).length || 0

  return (
    <header
      data-testid="topbar"
      className={cn(
        'fixed top-0 right-0 h-16 z-30 flex items-center justify-between px-4 gap-4',
        'bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-200 dark:border-white/10',
        'transition-all duration-300',
        sidebarCollapsed ? 'left-16' : 'left-64',
      )}
    >
      {/* Left: hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-neutral-500"
        data-testid="topbar-menu"
      >
        <SymbolFrame size="sm" className="rounded-xl">
          <Menu size={18} />
        </SymbolFrame>
      </button>

      {/* Search (desktop) */}
      <div className="hidden md:flex items-center gap-2 flex-1 max-w-sm">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full rounded-2xl border border-neutral-200 bg-white/85 py-2.5 pl-10 pr-4 text-sm text-neutral-900 shadow-sm backdrop-blur-sm placeholder-neutral-400 focus:outline-none focus:border-primary dark:border-white/10 dark:bg-neutral-900/85 dark:text-white"
            data-testid="topbar-search"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          data-testid="theme-toggle"
          className="text-neutral-600 dark:text-neutral-400 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          <SymbolFrame size="sm" className="rounded-xl">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </SymbolFrame>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            data-testid="notifications-bell"
            className="relative text-neutral-600 dark:text-neutral-400 transition-colors"
          >
            <SymbolFrame size="sm" className="rounded-xl">
              <Bell size={17} />
            </SymbolFrame>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <NotificationsDropdown
              isMember={user?.role === 'member'}
              notifications={notifications?.results || []}
              onOpenMessages={() => {
                setShowNotifs(false)
                navigate('/messages')
              }}
              onClose={() => setShowNotifs(false)}
            />
          )}
        </div>

        {/* User greeting */}
        {user && (
          <Link
            to="/profile"
            className="hidden sm:flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white/85 px-3 py-1.5 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/30 dark:border-white/10 dark:bg-neutral-900/85"
            data-testid="topbar-user"
          >
            <BrandMark size="sm" />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                {user.first_name || user.username}
              </span>
              <span className="block text-[10px] uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
                Perfil
              </span>
            </div>
          </Link>
        )}
      </div>
    </header>
  )
}

function NotificationsDropdown({
  isMember,
  notifications,
  onOpenMessages,
  onClose,
}: {
  isMember?: boolean
  notifications: Notification[]
  onOpenMessages: () => void
  onClose: () => void
}) {
  const trainerMessages = notifications.filter((notification) => notification.type === 'trainer_message')

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        data-testid="notifications-dropdown"
        className="absolute right-0 top-full mt-2 w-80 card z-50 py-2 shadow-xl"
      >
        <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Notificaciones</h3>
        </div>
        {isMember && trainerMessages.length > 0 && (
          <button
            type="button"
            onClick={onOpenMessages}
            className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-3 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
            data-testid="notifications-open-messages"
          >
            <div className="flex items-center gap-3">
              <SymbolFrame tone="primary" size="sm" className="rounded-xl">
                <MessageSquareMore size={16} />
              </SymbolFrame>
              <div>
                <p className="font-medium">Mensajes del trainer</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {trainerMessages.filter((message) => !message.read).length} sin leer
                </p>
              </div>
            </div>
            <ArrowRight size={16} className="text-neutral-400" />
          </button>
        )}
        <div className="max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-neutral-400">Sin notificaciones</p>
          ) : (
            notifications.slice(0, 10).map((n) => (
              <div
                key={n.id}
                className={cn(
                  'px-4 py-3 border-b border-neutral-50 dark:border-neutral-800/50 last:border-0',
                  !n.read && 'bg-primary/5',
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  {n.type === 'trainer_message' ? (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Mensaje trainer</span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Sistema</span>
                  )}
                </div>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">{n.message}</p>
                {!n.read && (
                  <span className="mt-1 inline-block text-[10px] font-bold text-primary uppercase">nuevo</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
