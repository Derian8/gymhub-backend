import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileBottomNav } from './MobileBottomNav'
import { cn } from '@/shared/lib/utils'
import { BackendStatusBanner } from '@/shared/components/BackendStatusBanner'

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  return (
    <div className="pulso-aplicacion min-h-screen text-neutral-900 dark:text-neutral-50">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <MobileBottomNav />

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div
        className={cn(
          'transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64',
        )}
      >
        <Topbar
          onMenuClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="pulso-contenido min-h-screen pt-16">
          <div className="page-enter mx-auto max-w-[1600px] px-4 py-6 pb-28 sm:px-6 md:p-8 md:pb-28 lg:pb-10">
            <BackendStatusBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
