import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Dumbbell,
  CreditCard, User,
  LogOut, ChevronLeft, ChevronRight, Activity,
  CheckSquare, ClipboardList, NotebookTabs, BarChart3, ChevronDown,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { getResolvedContext, useAuthStore } from '@/shared/store/authStore'
import { useLogoutMutation } from '@/modules/auth/hooks/useAuthMutations'
import { Avatar } from '@/shared/components/UI'
import { BrandMark, BrandWordmark, SymbolFrame } from '@/shared/components/Brand'

interface NavItem {
  label: string
  icon: React.ReactNode
  to: string
}

const adminNav: NavItem[] = [
  { label: 'Inicio', icon: <LayoutDashboard size={18} />, to: '/dashboard/admin' },
  { label: 'Pagos', icon: <CreditCard size={18} />, to: '/billing' },
  { label: 'Clientes', icon: <Users size={18} />, to: '/members' },
  { label: 'Usuarios y perfiles', icon: <User size={18} />, to: '/admin/users' },
  { label: 'Rutinas', icon: <Dumbbell size={18} />, to: '/routines' },
]

const adminMoreNav: NavItem[] = [
  { label: 'Accesos', icon: <CheckSquare size={18} />, to: '/attendance' },
  { label: 'Planes técnicos', icon: <Dumbbell size={18} />, to: '/plans' },
  { label: 'Progreso', icon: <Activity size={18} />, to: '/progress' },
  { label: 'Reportes', icon: <BarChart3 size={18} />, to: '/reports' },
]

const trainerNav: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, to: '/dashboard/trainer' },
  { label: 'Clientes asignados', icon: <Users size={18} />, to: '/members' },
]

const trainerStageTwoNav: NavItem[] = [
  { label: 'Planes', icon: <Dumbbell size={18} />, to: '/plans' },
  { label: 'Progreso', icon: <Activity size={18} />, to: '/progress' },
]

const memberNav: NavItem[] = [
  { label: 'Inicio', icon: <LayoutDashboard size={18} />, to: '/dashboard/member' },
  { label: 'Hoy', icon: <Dumbbell size={18} />, to: '/today' },
  { label: 'Mi membresía', icon: <CreditCard size={18} />, to: '/membership' },
]

const memberTrackingNav: NavItem[] = [
  { label: 'Mi Plan', icon: <NotebookTabs size={18} />, to: '/plans/my' },
  { label: 'Progreso', icon: <Activity size={18} />, to: '/progress' },
  { label: 'Historial', icon: <ClipboardList size={18} />, to: '/records' },
]

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onToggle: () => void
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, mobileOpen, onToggle, onCloseMobile }: SidebarProps) {
  const { user, activeContext } = useAuthStore()
  const { mutate: logout, isPending } = useLogoutMutation()
  const [secondaryOpen, setSecondaryOpen] = useState(false)
  const currentContext = getResolvedContext(user, activeContext)
  const isAdmin = currentContext === 'administrador'
  const isTrainer = currentContext === 'instructor'
  const navItems = isAdmin ? adminNav : isTrainer ? trainerNav : memberNav
  const secondaryItems = isTrainer ? trainerStageTwoNav : isAdmin ? adminMoreNav : memberTrackingNav
  const secondaryLabel = isTrainer ? 'Entrenamiento · Etapa 2' : isAdmin ? 'Más' : 'Mi seguimiento'
  const compact = collapsed && !mobileOpen

  return (
    <aside
      data-testid="sidebar"
      className={cn(
        'fixed left-0 top-0 z-40 flex h-full flex-col transition-all duration-300',
        'bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800',
        'w-72 max-w-[86vw] shadow-2xl lg:max-w-none lg:shadow-none',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        collapsed ? 'lg:w-16' : 'lg:w-64',
      )}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-neutral-200 dark:border-neutral-800">
        {!compact ? <BrandWordmark compact /> : <BrandMark size="sm" className="mx-auto" />}
        <button
          onClick={onToggle}
          data-testid="sidebar-toggle"
          className={cn(
            'hidden p-1.5 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 transition-colors lg:inline-flex',
            compact && 'mx-auto',
          )}
        >
          {compact ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onCloseMobile}
            data-testid={`nav-${item.to.replace('/', '').replace('/', '-')}`}
            className={({ isActive }) =>
              cn(
                'sidebar-link',
                isActive && 'sidebar-link-active',
                compact && 'justify-center px-0',
              )
            }
            title={compact ? item.label : undefined}
          >
            <SymbolFrame
              size="sm"
              tone="default"
              className={cn(
                'rounded-xl border-transparent bg-transparent shadow-none',
                compact ? 'mx-auto' : '',
              )}
            >
              {item.icon}
            </SymbolFrame>
            {!compact && <span>{item.label}</span>}
          </NavLink>
        ))}
        {secondaryItems.length > 0 && (
          <div className="pt-2">
            {!compact && (
              <button
                type="button"
                className="sidebar-link w-full justify-between text-left"
                onClick={() => setSecondaryOpen((open) => !open)}
                aria-expanded={secondaryOpen}
              >
                <span className="text-xs font-semibold uppercase tracking-wider">{secondaryLabel}</span>
                <ChevronDown size={15} className={cn('transition-transform', secondaryOpen && 'rotate-180')} />
              </button>
            )}
            {(compact || secondaryOpen) && secondaryItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active', compact && 'justify-center px-0')}
                title={compact ? item.label : undefined}
              >
                <SymbolFrame size="sm" tone="default" className="rounded-xl border-transparent bg-transparent shadow-none">{item.icon}</SymbolFrame>
                {!compact && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 space-y-1">
        <NavLink
          to="/profile"
          onClick={onCloseMobile}
          data-testid="nav-profile"
          className={({ isActive }) =>
            cn('sidebar-link', isActive && 'sidebar-link-active', compact && 'justify-center px-0')
          }
        >
          <SymbolFrame size="sm" className="rounded-xl border-transparent bg-transparent shadow-none">
            <User size={18} className="flex-shrink-0" />
          </SymbolFrame>
          {!compact && <span>Perfil</span>}
        </NavLink>

        <button
          data-testid="logout-button"
          onClick={() => logout()}
          disabled={isPending}
          className={cn(
            'sidebar-link w-full text-left hover:text-red-500 dark:hover:text-red-400',
            compact && 'justify-center px-0',
          )}
        >
          <SymbolFrame size="sm" className="rounded-xl border-transparent bg-transparent shadow-none">
            <LogOut size={18} className="flex-shrink-0" />
          </SymbolFrame>
          {!compact && <span>Cerrar sesión</span>}
        </button>

        {!compact && user && (
          <div className="mt-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-3 dark:border-white/10 dark:bg-neutral-900/80">
            <div className="mb-2 flex items-center gap-2">
              <Avatar name={`${user.first_name} ${user.last_name}` || user.email} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
                  Cuenta activa
                </p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                {user.first_name || user.username}
              </p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 capitalize">{isAdmin ? 'Administrador' : isTrainer ? 'Instructor' : 'Cliente'}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
