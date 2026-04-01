import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Dumbbell,
  CreditCard, Utensils, Bell, Bot, User,
  LogOut, ChevronLeft, ChevronRight, Activity,
  ClipboardList, CheckSquare,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import { useLogoutMutation } from '@/modules/auth/hooks/useAuthMutations'
import { Avatar } from '@/shared/components/UI'

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
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-neutral-200 dark:border-neutral-800">
        {!collapsed && (
          <span className="font-heading font-black text-xl tracking-tight text-neutral-900 dark:text-white">
            GYM<span className="text-primary">HUB</span>
          </span>
        )}
        {collapsed && (
          <span className="font-heading font-black text-xl text-primary mx-auto">G</span>
        )}
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
            <span className="flex-shrink-0">{item.icon}</span>
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
          <User size={18} className="flex-shrink-0" />
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
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>

        {!collapsed && user && (
          <div className="flex items-center gap-2 px-4 py-2 mt-2 bg-neutral-50 dark:bg-neutral-900 rounded-sm">
            <Avatar name={`${user.first_name} ${user.last_name}` || user.email} size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">
                {user.first_name || user.username}
              </p>
              <p className="text-[10px] text-neutral-500 capitalize">{user.role}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
