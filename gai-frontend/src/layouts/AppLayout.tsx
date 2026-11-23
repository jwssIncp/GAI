import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { navigation } from '@/constants/navigation';
import { AppHeader } from './AppHeader';
import { Breadcrumbs } from './Breadcrumbs';

/**
 * Trilha discreta no topo do conteúdo, só onde ela ajuda: telas fora do menu (detalhes,
 * formulários, abas internas). Nas telas do próprio menu, o submenu já diz onde se está;
 * dentro de um projeto, a trilha fica na 2ª linha do cabeçalho.
 */
function RouteTrail() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '');
  if (/^\/app\/projects\/[1-9]\d*(\/|$)/.test(path)) return null;
  if (path === '/app' || navigation.some((item) => item.to === path)) return null;
  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 pt-4 sm:px-6 lg:px-8 xl:px-10">
      <Breadcrumbs />
    </div>
  );
}

export function AppLayout() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const exitOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', exitOnEscape);
    return () => window.removeEventListener('keydown', exitOnEscape);
  }, [fullscreen]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <a href="#main-content" onClick={event => {
        event.preventDefault();
        const content = document.getElementById('main-content');
        content?.focus();
        content?.scrollIntoView({ block: 'start' });
      }} className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus:translate-y-0">Ir para o conteúdo</a>
      {fullscreen ? null : <AppHeader onFullscreen={() => setFullscreen(true)} />}
      <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none" style={fullscreen ? { ['--app-header-height' as string]: '0px' } : undefined}>
        {fullscreen ? null : <RouteTrail />}
        <Outlet />
      </main>
      {fullscreen ? (
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="fixed bottom-[calc(12px+env(safe-area-inset-bottom,0px))] right-[calc(12px+env(safe-area-inset-right,0px))] z-[60] inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0A1F44] px-[18px] font-nav text-[0.8125rem] font-semibold text-white shadow-elevated"
        >
          <X size={15} aria-hidden="true" /> Sair da tela cheia
        </button>
      ) : null}
    </div>
  );
}
