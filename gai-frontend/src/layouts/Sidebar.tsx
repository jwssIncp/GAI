import { ShieldCheck, Sparkles, X } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navigation } from '@/constants/navigation';
import { usePermissions } from '@/features/auth/usePermissions';
import { cn } from '@/utils/cn';

type SidebarProps = {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

const sectionLabels = {
  workspace: 'Workspace',
  management: 'Administração',
};

export function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  const location = useLocation();

  useEffect(() => {
    onMobileOpenChange(false);
  }, [location.pathname, onMobileOpenChange]);

  return (
    <>
      <aside className="sticky top-0 z-30 hidden h-dvh w-[280px] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[8px_0_32px_-24px_hsl(var(--brand-ink)/0.9)] lg:block">
        <SidebarContent />
      </aside>
      <div className={cn('fixed inset-0 z-50 lg:hidden', mobileOpen ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!mobileOpen} inert={!mobileOpen}>
        <button
          type="button"
          className={cn('absolute inset-0 bg-topbar/70 backdrop-blur-sm transition-opacity duration-300', mobileOpen ? 'opacity-100' : 'opacity-0')}
          onClick={() => onMobileOpenChange(false)}
          aria-label="Fechar navegação"
          tabIndex={mobileOpen ? 0 : -1}
        />
        <aside
          className={cn('absolute inset-y-0 left-0 w-[min(88vw,310px)] border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-elevated transition-transform duration-300 ease-out', mobileOpen ? 'translate-x-0' : '-translate-x-full')}
          role="dialog"
          aria-modal="true"
          aria-label="Navegação principal"
        >
          <button type="button" className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-lg border border-sidebar-border bg-sidebar text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={() => onMobileOpenChange(false)} aria-label="Fechar menu">
            <X size={17} />
          </button>
          <SidebarContent />
        </aside>
      </div>
    </>
  );
}

function SidebarContent() {
  const { canAccess } = usePermissions();
  const visibleNavigation = navigation.filter((item) => canAccess(item.permissions));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[76px] items-center border-b border-sidebar-border px-5">
        <div className="flex items-center gap-3">
          <div className="relative grid size-10 place-items-center overflow-hidden rounded-xl bg-premium-gradient text-sm font-black tracking-[-0.04em] text-primary-foreground shadow-glow">
            <span className="relative z-10">G</span>
            <Sparkles className="absolute -right-1 -top-1 opacity-45" size={16} />
          </div>
          <div>
            <div className="text-base font-extrabold leading-none tracking-[-0.03em] text-sidebar-foreground">GAI</div>
            <div className="mt-1.5 text-[0.6875rem] font-medium text-sidebar-muted">Gestão inteligente de ativos</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Navegação principal">
        {(Object.keys(sectionLabels) as Array<keyof typeof sectionLabels>).map((section) => {
          const items = visibleNavigation.filter((item) => item.section === section);
          if (!items.length) return null;
          return (
            <div key={section} className="mb-6 last:mb-0">
              <p className="mb-2 px-3 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-sidebar-muted/75">{sectionLabels[section]}</p>
              <div className="grid gap-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => cn(
                        'group relative flex h-11 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm font-semibold text-sidebar-muted transition duration-200 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
                        isActive && 'bg-sidebar-accent text-sidebar-foreground shadow-inner-highlight',
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <span className={cn('absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary opacity-0 shadow-[0_0_10px_hsl(var(--primary))] transition-opacity', isActive && 'opacity-100')} />
                          <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg transition', isActive ? 'bg-primary/15 text-primary' : 'text-sidebar-muted group-hover:bg-white/[0.06] group-hover:text-primary')}>
                            <Icon size={16} strokeWidth={2.1} />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="p-3">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-3.5 shadow-inner-highlight">
          <div className="flex items-center gap-2 text-xs font-bold text-sidebar-foreground">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary"><ShieldCheck size={14} /></span>
            Ambiente protegido
          </div>
          <p className="mt-2 text-[0.6875rem] leading-5 text-sidebar-muted">Acesso segmentado por perfil e organização.</p>
        </div>
      </div>
    </div>
  );
}
