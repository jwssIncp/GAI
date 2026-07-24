import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    if (!navigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [navigationOpen]);

  return (
    <div className="relative flex min-h-dvh bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-40 -top-52 size-[34rem] rounded-full bg-primary/[0.035] blur-3xl" />
        <div className="absolute -bottom-56 left-1/3 size-[30rem] rounded-full bg-brand-navy/[0.025] blur-3xl" />
      </div>
      <Sidebar mobileOpen={navigationOpen} onMobileOpenChange={setNavigationOpen} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNavigation={() => setNavigationOpen(true)} />
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
