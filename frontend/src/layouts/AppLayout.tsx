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
    <div className="min-h-screen bg-[#f7f8fc] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
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

        <main className="min-h-screen bg-[#f7f8fc] pt-16 dark:bg-neutral-950">
          <div className="page-enter px-3 py-4 pb-28 sm:px-4 md:p-6 md:pb-10">
            <BackendStatusBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
