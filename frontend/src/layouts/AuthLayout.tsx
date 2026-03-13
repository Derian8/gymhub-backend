import { Outlet } from 'react-router-dom'
import { useAuthStore } from '@/shared/store/authStore'
import { useEffect } from 'react'

export function AuthLayout() {
  const { theme } = useAuthStore()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950">
      {/* Left: decorative */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-neutral-950">
        <img
          src="https://images.unsplash.com/photo-1761971975769-97e598bf526b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
          alt="Modern Gym Interior"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950/80 to-neutral-950/40" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="mb-8">
            <div className="w-12 h-1 bg-primary mb-6" />
            <h2 className="text-4xl xl:text-5xl font-heading font-black text-white uppercase tracking-tight leading-none">
              ELEVA TU<br />
              <span className="text-primary">RENDIMIENTO</span>
            </h2>
            <p className="mt-4 text-neutral-400 text-base max-w-sm">
              Gestión integral de gimnasio. Miembros, entrenadores y resultados en un solo lugar.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Miembros activos', value: '500+' },
              { label: 'Entrenamientos', value: '10K+' },
              { label: 'Satisfacción', value: '98%' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 border border-white/10 rounded-sm p-3">
                <p className="text-2xl font-heading font-black text-white">{stat.value}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="w-full lg:w-[480px] flex flex-col justify-center px-8 py-12 bg-white dark:bg-neutral-950">
        <div className="max-w-sm mx-auto w-full">
          <div className="mb-8">
            <span className="font-heading font-black text-3xl tracking-tight text-neutral-900 dark:text-white">
              GYM<span className="text-primary">HUB</span>
            </span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
