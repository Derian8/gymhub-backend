import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Dumbbell,
  CreditCard, Utensils, Bell, Bot, User,
  LogOut, ChevronLeft, ChevronRight, Activity,
  ClipboardList, CheckSquare, MessageSquareMore,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { useLogoutMutation } from '@/modules/auth/hooks/useAuthMutations'
import { Avatar } from '@/shared/components/UI'
import { BrandMark, BrandWordmark, SymbolFrame } from '@/shared/components/Brand'

interface NavItem {
  label: string
  icon: React.ReactNode
  to: string
  roles?: ('trainer' | 'member')[]
}

const trainerNav: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, to: '/dashboard/trainer' },
  { label: 'Miembros', icon: <Users size={18} />, to: '/members' },
  { label: 'Planes', icon: <Dumbbell size={18} />, to: '/plans' },
  { label: 'Asistencia', icon: <CheckSquare size={18} />, to: '/attendance' },
  { label: 'Alertas', icon: <Bell size={18} />, to: '/alerts' },
  { label: 'Facturación', icon: <CreditCard size={18} />, to: '/billing' },
  { label: 'Nutrición', icon: <Utensils size={18} />, to: '/nutrition' },
  { label: 'Gráficas', icon: <Activity size={18} />, to: '/charts' },
  { label: 'Chat IA', icon: <Bot size={18} />, to: '/ai-chat' },
]

const memberNav: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, to: '/dashboard/member' },
  { label: 'Mi Plan', icon: <Dumbbell size={18} />, to: '/plans/my' },
  { label: 'Check-in', icon: <CheckSquare size={18} />, to: '/attendance/check-in' },
  { label: 'Mensajes', icon: <MessageSquareMore size={18} />, to: '/messages' },
  { label: 'Progreso', icon: <Activity size={18} />, to: '/progress' },
  { label: 'Sesiones', icon: <ClipboardList size={18} />, to: '/sessions' },
  { label: 'Nutrición', icon: <Utensils size={18} />, to: '/nutrition' },
  { label: 'Pagos', icon: <CreditCard size={18} />, to: '/billing' },
  { label: 'Chat IA', icon: <Bot size={18} />, to: '/ai-chat' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuthStore()
  const { mutate: logout, isPending } = useLogoutMutation()
  const isTrainer = user?.role === 'trainer' || user?.is_staff
  const navItems = isTrainer ? trainerNav : memberNav

  return (
    <aside
      data-testid="sidebar"
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300',
        'bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-neutral-200 dark:border-neutral-800">
        {!collapsed ? <BrandWordmark compact /> : <BrandMark size="sm" className="mx-auto" />}
        <button
          onClick={onToggle}
          data-testid="sidebar-toggle"
          className={cn(
            'p-1.5 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 transition-colors',
            collapsed && 'mx-auto',
          )}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-testid={`nav-${item.to.replace('/', '').replace('/', '-')}`}
            className={({ isActive }) =>
              cn(
                'sidebar-link',
                isActive && 'sidebar-link-active',
                collapsed && 'justify-center px-0',
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <SymbolFrame
              size="sm"
              tone="default"
              className={cn(
                'rounded-xl border-transparent bg-transparent shadow-none',
                collapsed ? 'mx-auto' : '',
              )}
            >
              {item.icon}
            </SymbolFrame>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 space-y-1">
        <NavLink
          to="/profile"
          data-testid="nav-profile"
          className={({ isActive }) =>
            cn('sidebar-link', isActive && 'sidebar-link-active', collapsed && 'justify-center px-0')
          }
        >
          <SymbolFrame size="sm" className="rounded-xl border-transparent bg-transparent shadow-none">
            <User size={18} className="flex-shrink-0" />
          </SymbolFrame>
          {!collapsed && <span>Perfil</span>}
        </NavLink>

        <button
          data-testid="logout-button"
          onClick={() => logout()}
          disabled={isPending}
          className={cn(
            'sidebar-link w-full text-left hover:text-red-500 dark:hover:text-red-400',
            collapsed && 'justify-center px-0',
          )}
        >
          <SymbolFrame size="sm" className="rounded-xl border-transparent bg-transparent shadow-none">
            <LogOut size={18} className="flex-shrink-0" />
          </SymbolFrame>
          {!collapsed && <span>Cerrar sesión</span>}
        </button>

        {!collapsed && user && (
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
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 capitalize">{user.role}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
