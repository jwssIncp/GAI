import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="relative flex min-h-dvh bg-background">
      <a href="#main-content" onClick={event => {
        event.preventDefault();
        const content = document.getElementById('main-content');
        content?.focus();
        content?.scrollIntoView({ block: 'start' });
      }} className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus:translate-y-0">Ir para o conteúdo</a>
      <Sidebar mobileOpen={navigationOpen} onMobileOpenChange={setNavigationOpen} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar navigationOpen={navigationOpen} onOpenNavigation={() => setNavigationOpen(true)} />
        <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
