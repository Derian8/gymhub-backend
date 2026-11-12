import { useEffect, useMemo, useRef, useState } from 'react'
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
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { getResolvedContext, useAuthStore } from '@/shared/store/authStore'
import { useLogoutMutation } from '@/modules/auth/hooks/useAuthMutations'
import { useMemberAttendanceToday } from '@/modules/attendance/hooks/useAttendance'
import './MobileBottomNav.css'

interface MobileNavItem {
  label: string
  to: string
  icon: React.ReactNode
  disabled?: boolean
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
  cliente: {
    primary: [
      { label: 'Inicio', to: '/today', icon: <Home size={19} /> },
      { label: 'Ejercicios', to: '/plans/my', icon: <Dumbbell size={19} /> },
      { label: 'Historial', to: '/history', icon: <ClipboardList size={19} /> },
      { label: 'Perfil', to: '/profile', icon: <User size={19} /> },
    ],
    secondary: [],
  },
} satisfies Record<string, { primary: MobileNavItem[]; secondary: MobileNavItem[] }>

function MobileNavLink({ item, onClick, compact = false }: { item: MobileNavItem; onClick?: () => void; compact?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to.startsWith('/dashboard/') || item.to === '/today'}
      onClick={(event) => {
        if (item.disabled) {
          event.preventDefault()
          return
        }
        onClick?.()
      }}
      aria-disabled={item.disabled || undefined}
      className={({ isActive }) => cn(
        compact
          ? 'mobile-tab flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold'
          : 'flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
        isActive
          ? item.disabled ? 'text-neutral-400 opacity-50' : 'text-primary'
          : item.disabled ? 'cursor-not-allowed text-neutral-400 opacity-50' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white',
      )}
      aria-label={item.disabled ? `${item.label}, disponible después de confirmar entrada` : item.label}
      title={item.disabled ? 'Disponible después de confirmar tu entrada' : undefined}
    >
      <span className={compact ? 'mobile-tab-icon' : 'inline-flex items-center justify-center'}>
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
  const dialogo = useRef<HTMLDialogElement>(null)
  const currentContext = getResolvedContext(user, activeContext) || 'cliente'
  const { hasCheckedInToday: hasAttendanceToday } = useMemberAttendanceToday(currentContext === 'cliente')
  const navigation = currentContext === 'cliente'
    ? { ...mobileNavigation.cliente, primary: mobileNavigation.cliente.primary.map((item) => item.to === '/plans/my' ? { ...item, disabled: !hasAttendanceToday } : item) }
    : mobileNavigation[currentContext]
  const hasSecondaryItems = navigation.secondary.length > 0
  const masActivo = moreOpen || navigation.secondary.some((item) => location.pathname.startsWith(item.to)) || location.pathname.startsWith('/profile')

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname, currentContext])

  useEffect(() => {
    const panel = dialogo.current
    if (!panel) return
    if (!moreOpen) {
      if (panel.open) panel.close()
      return
    }
    panel.showModal()
    const desplazamientoAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = desplazamientoAnterior }
  }, [moreOpen])

  useEffect(() => {
    const escritorio = window.matchMedia('(min-width: 1024px)')
    const cerrarEnEscritorio = () => { if (escritorio.matches) setMoreOpen(false) }
    escritorio.addEventListener('change', cerrarEnEscritorio)
    return () => escritorio.removeEventListener('change', cerrarEnEscritorio)
  }, [])

  const secondaryItems = useMemo(() => navigation.secondary, [navigation.secondary])

  return (
    <>
      <nav
        className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 flex items-start border-t border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 lg:hidden"
        aria-label="Navegación principal móvil"
        data-testid="mobile-bottom-nav"
      >
        {navigation.primary.map((item) => (
          <MobileNavLink key={item.to} item={item} compact />
        ))}
        {hasSecondaryItems ? <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'mobile-tab flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold',
            masActivo
              ? 'text-primary'
              : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white',
          )}
          aria-label="Más opciones"
          aria-expanded={moreOpen}
          aria-controls="mobile-more-sheet"
          aria-haspopup="dialog"
          data-active={masActivo}
          data-testid="mobile-more-button"
        >
          <span className="mobile-tab-icon"><MoreHorizontal size={24} /></span>
          <span>Más</span>
        </button> : null}
      </nav>

      {hasSecondaryItems ? (
          <dialog
            ref={dialogo}
            id="mobile-more-sheet"
            className="mobile-more-sheet rounded-t-3xl border-0 bg-white p-5 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50"
            aria-labelledby="mobile-more-title"
            onCancel={() => setMoreOpen(false)}
            onClose={() => setMoreOpen(false)}
            onClick={(event) => { if (event.target === event.currentTarget) setMoreOpen(false) }}
            data-testid="mobile-more-sheet"
          >
            <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-700" aria-hidden="true" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 id="mobile-more-title" className="font-heading text-2xl font-bold text-neutral-900 dark:text-white">Más opciones</h2>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Cerrar menú"
                autoFocus
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain"><div className="grid grid-cols-2 gap-2">
              {secondaryItems.map((item) => (
                <MobileNavLink key={item.to} item={item} onClick={() => setMoreOpen(false)} />
              ))}
              <MobileNavLink item={{ label: 'Perfil', to: '/profile', icon: <User size={18} /> }} onClick={() => setMoreOpen(false)} />
              <button
                type="button"
                onClick={() => logout()}
                disabled={isPending}
                className="flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                data-testid="mobile-logout-button"
              >
                <LogOut size={18} />
                <span>{isPending ? 'Saliendo…' : 'Cerrar sesión'}</span>
              </button>
            </div></div>
          </dialog>
      ) : null}
    </>
  )
}
