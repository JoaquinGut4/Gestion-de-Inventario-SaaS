import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { getNavItem } from '@/config/navigation';
import type { AuthSession } from '@/hooks/useAuth';
import type { AdminSection } from '@/types';

interface AdminLayoutProps {
  activeNav: AdminSection;
  onNavigate: (section: AdminSection) => void;
  onLogout: () => void;
  session: AuthSession;
  inventarioCategorias: number;
  children: ReactNode;
}

export function AdminLayout({
  activeNav,
  onNavigate,
  onLogout,
  session,
  inventarioCategorias,
  children,
}: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.localStorage.getItem('inventario-sidebar-collapsed') === 'true',
  );
  const current = getNavItem(activeNav);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isSidebarOpen]);

  const handleNavigate = (section: AdminSection) => {
    onNavigate(section);
    setIsSidebarOpen(false);
  };

  const handleToggleCollapsed = () => {
    setIsSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue;
      window.localStorage.setItem('inventario-sidebar-collapsed', String(nextValue));
      return nextValue;
    });
  };

  return (
    <div className="flex min-h-dvh bg-slate-50 font-sans text-ink antialiased selection:bg-highlight/40">
      <Sidebar
        activeNav={activeNav}
        onNavigate={handleNavigate}
        onLogout={onLogout}
        session={session}
        inventarioCategorias={inventarioCategorias}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={handleToggleCollapsed}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-200 ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <Topbar
          title={current.title}
          description={current.description}
          onToggleSidebar={() => setIsSidebarOpen(true)}
          onNavigate={handleNavigate}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
