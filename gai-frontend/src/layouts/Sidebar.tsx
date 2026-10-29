import * as Dialog from '@radix-ui/react-dialog';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { GaiLogo } from '@/components/base/GaiLogo';
import { navigation } from '@/constants/navigation';
import { usePermissions } from '@/features/auth/usePermissions';
import { navigationContext, navigationHref } from '@/features/projects/navigationContext';
import { cn } from '@/utils/cn';

type SidebarProps = { mobileOpen: boolean; onMobileOpenChange: (open: boolean) => void };
const sectionLabels = { workspace: 'Área de trabalho', management: 'Administração' };

export function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('gai.sidebar.collapsed') === 'true'; } catch { return false; }
  });
  useEffect(() => { onMobileOpenChange(false); }, [location.pathname, location.search, onMobileOpenChange]);
  useEffect(() => {
    const screen = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (screen.matches) onMobileOpenChange(false); };
    screen.addEventListener('change', closeOnDesktop);
    return () => screen.removeEventListener('change', closeOnDesktop);
  }, [onMobileOpenChange]);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('gai.sidebar.collapsed', String(next)); } catch { /* Applies for this session. */ }
  }
  return <>
    <aside aria-label="Menu lateral" className={cn('sticky top-0 z-30 hidden h-dvh shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block', collapsed ? 'w-[88px]' : 'w-[264px]')}>
      <SidebarContent collapsed={collapsed} onToggle={toggle} />
    </aside>
    <Dialog.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-topbar/70 backdrop-blur-sm" />
        <Dialog.Content id="mobile-navigation" aria-describedby={undefined}
          onCloseAutoFocus={event => { event.preventDefault(); document.getElementById('gai-navigation-trigger')?.focus(); }}
          className="fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-elevated">
          <Dialog.Title className="sr-only">Navegação principal</Dialog.Title>
          <Dialog.Close aria-label="Fechar menu" className="absolute right-3 top-4 z-10 grid size-11 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-white"><X size={19} /></Dialog.Close>
          <SidebarContent />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}

function SidebarContent({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const location = useLocation();
  const context = navigationContext(new URLSearchParams(location.search));
  const project = location.pathname.match(/^\/app\/projects\/([1-9]\d*)(?:\/|$)/)?.[1];
  if (project) context.set('project_id', project);
  const { canAccess } = usePermissions();
  const visible = navigation.filter(item => canAccess(item.permissions));
  return <div className="flex h-full flex-col">
    <div className={cn('flex h-[76px] shrink-0 items-center border-b border-sidebar-border', collapsed ? 'justify-center' : 'px-5')}>
      <GaiLogo variant={collapsed ? 'symbol' : 'horizontal'} appearance="dark" />
    </div>
    <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Navegação principal">
      {(Object.keys(sectionLabels) as Array<keyof typeof sectionLabels>).map(section => {
        const items = visible.filter(item => item.section === section);
        if (!items.length) return null;
        return <div key={section} className="mb-6 last:mb-0">
          <p className={cn('mb-2 px-3 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-sidebar-muted', collapsed && 'sr-only')}>{sectionLabels[section]}</p>
          <div className="grid gap-1">
            {items.map(item => {
              const Icon = item.icon;
              return <NavLink key={item.to}
                to={item.to.startsWith('/app/budgets') || item.to.startsWith('/app/finance') || item.to === '/app/projects' ? navigationHref(item.to, context) : item.to}
                aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined}
                className={({ isActive }) => cn('group relative flex min-h-11 items-center gap-3 rounded-lg text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent/70 hover:text-white', collapsed ? 'justify-center px-1' : 'px-3', isActive && 'bg-sidebar-accent text-white shadow-inner-highlight')}>
                {({ isActive }) => <>
                  <span className={cn('absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary', !isActive && 'opacity-0')} />
                  <Icon size={19} strokeWidth={1.8} className={cn('shrink-0', isActive && 'text-primary')} aria-hidden="true" />
                  <span className={collapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
                </>}
              </NavLink>;
            })}
          </div>
        </div>;
      })}
    </nav>
    {onToggle && <div className="border-t border-sidebar-border p-3">
      <button type="button" onClick={onToggle} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!collapsed} title={collapsed ? 'Expandir menu lateral' : undefined} className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-xs font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-white', collapsed && 'justify-center px-0')}>
        {collapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /> Recolher menu</>}
      </button>
    </div>}
  </div>;
}
