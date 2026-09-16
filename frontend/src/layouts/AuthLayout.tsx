import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Activity, Dumbbell, Users } from 'lucide-react'
import { BrandWordmark, PulsoDecorativo, SymbolFrame } from '@/shared/components/Brand'
import { useBackendStatusStore } from '@/shared/store/backendStatusStore'
import { BASE_URL } from '@/shared/api/client'
import { warmBackend } from '@/shared/api/backendWarmup'
import { ThemeToggle } from '@/shared/components/ThemeToggle'

export function AuthLayout() {
  const clearBackendIssue = useBackendStatusStore((s) => s.clearIssue)

  useEffect(() => {
    clearBackendIssue()
    void warmBackend(BASE_URL).catch(() => undefined)
  }, [clearBackendIssue])

  return (
    <div className="pulso-acceso relative flex min-h-screen bg-white text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <ThemeToggle className="absolute right-5 top-5 z-20 rounded-full border border-neutral-200 bg-white p-3 text-neutral-600 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300" />
      <section className="pulso-portada relative hidden min-w-0 flex-1 flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
        <PulsoDecorativo className="pointer-events-none absolute -right-24 top-20 w-[110%] text-primary/10" />
        <div className="relative z-10">
          <BrandWordmark />
          <p className="mb-5 mt-10 text-[10px] font-bold uppercase tracking-[0.32em] text-neutral-500 dark:text-neutral-400">Gestiona · Conecta · Crece</p>
          <h1 className="text-6xl font-heading font-bold uppercase leading-[0.95] tracking-tight xl:text-7xl">
            Tu gimnasio.<br /><span className="text-primary">A tu ritmo.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-neutral-600 dark:text-neutral-300">
            Entrenamiento, comunidad y progreso. Todo lo que mueve tu gimnasio, conectado en un solo lugar.
          </p>
        </div>
        <div className="relative z-10 mt-8">
          <img src="/marca/pulso-banner.png" alt="PULSO: gestión deportiva desde tu computadora y tu teléfono" width={1600} height={900} className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-lg dark:border-white/10" />
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[{ icono: Users, texto: 'Tu comunidad' }, { icono: Dumbbell, texto: 'Tu entrenamiento' }, { icono: Activity, texto: 'Tu progreso' }].map(({ icono: Icono, texto }) => (
              <div key={texto} className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                <SymbolFrame tone="primary" size="sm"><Icono size={16} /></SymbolFrame>
                <span>{texto}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="relative flex w-full flex-col justify-center border-neutral-200 px-6 py-20 dark:border-white/10 sm:px-10 lg:w-[460px] lg:border-l xl:w-[500px]">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10">
            <BrandWordmark />
            <div className="mt-7 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Tu próximo paso empieza aquí
            </div>
          </div>
          <Outlet />
          <p className="mt-10 border-t border-neutral-200 pt-5 text-xs text-neutral-500 dark:border-white/10 dark:text-neutral-400">PULSO · El ritmo sigue aquí.</p>
        </div>
      </section>
    </div>
  )
}
