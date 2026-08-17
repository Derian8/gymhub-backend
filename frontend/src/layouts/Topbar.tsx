import { Search, Menu } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getAvailableProfiles, useAuthStore } from '@/shared/store/authStore'
import { homePathForUser } from '@/shared/components/RouteGuards'
import type { PerfilUsuario } from '@/shared/types'
import { cn } from '@/shared/lib/utils'
import { BrandMark, SymbolFrame } from '@/shared/components/Brand'
import { ThemeToggle } from '@/shared/components/ThemeToggle'

interface TopbarProps {
  onMenuClick: () => void
  sidebarCollapsed: boolean
}

export function Topbar({ onMenuClick, sidebarCollapsed }: TopbarProps) {
  const { user, activeContext, setActiveContext } = useAuthStore()
  const navigate = useNavigate()
  const profiles = getAvailableProfiles(user)

  const changeContext = (context: PerfilUsuario) => {
    if (!user) return
    setActiveContext(context)
    navigate(homePathForUser(user, context))
  }

  return (
    <header
      data-testid="topbar"
      className={cn(
        'fixed top-0 right-0 h-16 z-30 flex items-center justify-between px-4 gap-4',
        'bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-200 dark:border-white/10',
        'transition-all duration-300',
        'left-0',
        sidebarCollapsed ? 'lg:left-16' : 'lg:left-64',
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
        {user && profiles.length > 1 && activeContext && (
          <label className="hidden items-center gap-2 sm:flex">
            <span className="sr-only">Perfil activo</span>
            <select
              value={activeContext}
              onChange={(event) => changeContext(event.target.value as PerfilUsuario)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200"
              data-testid="active-context-selector"
              aria-label="Perfil activo"
            >
              {profiles.map((profile) => (
                <option key={profile} value={profile}>
                  {profile === 'administrador' ? 'Administrador' : profile === 'instructor' ? 'Instructor' : 'Cliente'}
                </option>
              ))}
            </select>
          </label>
        )}
        <SymbolFrame size="sm" className="rounded-xl text-neutral-600 dark:text-neutral-400">
          <ThemeToggle />
        </SymbolFrame>

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
                {activeContext === 'administrador' ? 'Administrador' : activeContext === 'instructor' ? 'Instructor' : 'Cliente'}
              </span>
            </div>
          </Link>
        )}
      </div>
    </header>
  )
}
