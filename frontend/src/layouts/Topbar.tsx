import { useState } from 'react'
import { Bell, Sun, Moon, Search, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/authStore'
import { useNotificationsQuery } from '@/modules/alerts/hooks/useAlerts'
import { cn } from '@/shared/lib/utils'

interface TopbarProps {
  onMenuClick: () => void
  sidebarCollapsed: boolean
}

export function Topbar({ onMenuClick, sidebarCollapsed }: TopbarProps) {
  const { theme, toggleTheme, user } = useAuthStore()
  const { data: notifications } = useNotificationsQuery()
  const [showNotifs, setShowNotifs] = useState(false)

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
        className="lg:hidden p-2 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
        data-testid="topbar-menu"
      >
        <Menu size={20} />
      </button>

      {/* Search (desktop) */}
      <div className="hidden md:flex items-center gap-2 flex-1 max-w-sm">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-900 rounded-sm border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-primary text-neutral-900 dark:text-white placeholder-neutral-400"
            data-testid="topbar-search"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          data-testid="theme-toggle"
          className="p-2 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            data-testid="notifications-bell"
            className="p-2 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors relative"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <NotificationsDropdown
              notifications={notifications?.results || []}
              onClose={() => setShowNotifs(false)}
            />
          )}
        </div>

        {/* User greeting */}
        {user && (
          <Link
            to="/profile"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            data-testid="topbar-user"
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              {(user.first_name?.[0] || user.email[0]).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {user.first_name || user.username}
            </span>
          </Link>
        )}
      </div>
    </header>
  )
}

function NotificationsDropdown({
  notifications,
  onClose,
}: {
  notifications: Array<{ id: number; message: string; read: boolean; created_at: string }>
  onClose: () => void
}) {
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
