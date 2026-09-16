import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  CheckSquare,
  ClipboardList,
  CreditCard,
  Dumbbell,
  Home,
  LogOut,
  MoreHorizontal,
  NotebookTabs,
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { getResolvedContext, useAuthStore } from '@/shared/store/authStore'
import { useLogoutMutation } from '@/modules/auth/hooks/useAuthMutations'

interface MobileNavItem {
  label: string
  to: string
  icon: React.ReactNode
}

const mobileNavigation = {
  administrador: {
    primary: [
      { label: 'Inicio', to: '/dashboard/admin', icon: <Home size={19} /> },
      { label: 'Pagos', to: '/billing', icon: <CreditCard size={19} /> },
      { label: 'Clientes', to: '/members', icon: <Users size={19} /> },
      { label: 'Rutinas', to: '/routines', icon: <Dumbbell size={19} /> },
    ],
    secondary: [
      { label: 'Usuarios', to: '/admin/users', icon: <ShieldCheck size={18} /> },
      { label: 'Accesos', to: '/attendance', icon: <CheckSquare size={18} /> },
      { label: 'Planes técnicos', to: '/plans', icon: <Dumbbell size={18} /> },
      { label: 'Progreso', to: '/progress', icon: <Activity size={18} /> },
      { label: 'Reportes', to: '/reports', icon: <BarChart3 size={18} /> },
    ],
  },
  instructor: {
    primary: [
      { label: 'Inicio', to: '/dashboard/trainer', icon: <Home size={19} /> },
      { label: 'Clientes', to: '/members', icon: <Users size={19} /> },
      { label: 'Planes', to: '/plans', icon: <Dumbbell size={19} /> },
      { label: 'Progreso', to: '/progress', icon: <Activity size={19} /> },
    ],
    secondary: [],
  },
  cliente: {
    primary: [
      { label: 'Inicio', to: '/dashboard/member', icon: <Home size={19} /> },
      { label: 'Hoy', to: '/today', icon: <Dumbbell size={19} /> },
      { label: 'Membresía', to: '/membership', icon: <CreditCard size={19} /> },
      { label: 'Mi plan', to: '/plans/my', icon: <NotebookTabs size={19} /> },
    ],
    secondary: [
      { label: 'Progreso', to: '/progress', icon: <Activity size={18} /> },
      { label: 'Historial', to: '/records', icon: <ClipboardList size={18} /> },
    ],
  },
} satisfies Record<string, { primary: MobileNavItem[]; secondary: MobileNavItem[] }>

function MobileNavLink({ item, onClick, compact = false }: { item: MobileNavItem; onClick?: () => void; compact?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end
      onClick={onClick}
      className={({ isActive }) => cn(
        compact
          ? 'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition-colors'
          : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors',
        isActive
          ? 'text-primary'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white',
      )}
      aria-label={item.label}
    >
      <span className="relative inline-flex items-center justify-center">
        {item.icon}
      </span>
      <span className={compact ? 'truncate' : ''}>{item.label}</span>
    </NavLink>
  )
}

export function MobileBottomNav() {
  const { user, activeContext } = useAuthStore()
  const { mutate: logout, isPending } = useLogoutMutation()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const currentContext = getResolvedContext(user, activeContext) || 'cliente'
  const navigation = mobileNavigation[currentContext]
  const hasSecondaryItems = navigation.secondary.length > 0

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  const secondaryItems = useMemo(() => navigation.secondary, [navigation.secondary])

  return (
    <>
      <nav
        className="mobile-bottom-nav fixed inset-x-3 bottom-3 z-40 flex items-center gap-1 rounded-[1.6rem] border border-neutral-200/80 bg-white/95 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/95 dark:shadow-[0_18px_50px_rgba(0,0,0,0.55)] lg:hidden"
        aria-label="Navegación principal móvil"
        data-testid="mobile-bottom-nav"
      >
        {navigation.primary.map((item) => (
          <MobileNavLink key={item.to} item={item} compact />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition-colors',
            moreOpen || (hasSecondaryItems && secondaryItems.some((item) => location.pathname.startsWith(item.to)))
              ? 'text-primary'
              : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white',
          )}
          aria-label="Más opciones"
          aria-expanded={moreOpen}
          data-testid="mobile-more-button"
        >
          <MoreHorizontal size={19} />
          <span>Más</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px]"
            aria-label="Cerrar opciones"
            onClick={() => setMoreOpen(false)}
          />
          <section
            className="mobile-more-sheet absolute inset-x-0 bottom-0 rounded-t-[2rem] border-t border-neutral-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-neutral-950 dark:shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
            role="dialog"
            aria-modal="true"
            aria-label="Más opciones"
            data-testid="mobile-more-sheet"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="label-base">Accesos rápidos</p>
                <h2 className="mt-1 font-heading text-2xl font-black text-neutral-900 dark:text-white">Más opciones</h2>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-xl p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Cerrar menú"
              >
                <X size={19} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {secondaryItems.map((item) => (
                <MobileNavLink key={item.to} item={item} onClick={() => setMoreOpen(false)} />
              ))}
              <MobileNavLink item={{ label: 'Perfil', to: '/profile', icon: <User size={18} /> }} onClick={() => setMoreOpen(false)} />
              <button
                type="button"
                onClick={() => logout()}
                disabled={isPending}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                data-testid="mobile-logout-button"
              >
                <LogOut size={18} />
                <span>{isPending ? 'Saliendo…' : 'Cerrar sesión'}</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
