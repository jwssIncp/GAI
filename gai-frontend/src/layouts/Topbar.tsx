import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, ChevronRight, LogOut, Menu, Moon, Sun, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';

const breadcrumbLabels: Record<string, string> = {
  dashboard: 'Visão geral',
  organizations: 'Organizações',
  users: 'Usuários',
  roles: 'Perfis e acessos',
  companies: 'Empresas',
  projects: 'Projetos',
  summary: 'Visão geral',
  'field-agents': 'Inventariantes',
  'inventory-items': 'Itens inventariados',
  'accounting-items': 'Base contábil',
  'pending-issues': 'Pendências',
  finance: 'Financeiro',
  'import-sessions': 'Importações',
  'export-jobs': 'Exportações',
  profile: 'Perfil',
  settings: 'Configurações',
};

export function Breadcrumbs() {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean).slice(1);
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {parts.length ? parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
          {index ? <ChevronRight className="text-muted-foreground/50" size={12} /> : null}
          <span className={index === parts.length - 1 ? 'font-semibold text-foreground' : ''}>{/^\d+$/.test(part) ? `#${part}` : (breadcrumbLabels[part] ?? part.replaceAll('-', ' '))}</span>
        </span>
      )) : 'Visão geral'}
    </div>
  );
}

export function Topbar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const organizationLabel = user?.organization_id ? `Organizacao #${user.organization_id}` : 'Plataforma';
  const roleLabel = user?.role_assignments?.[0]?.role_name ?? 'Acesso autorizado';
  const initials = (user?.login ?? 'U').slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-border/70 bg-background/78 px-4 py-3 backdrop-blur-2xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir navegação" onClick={onOpenNavigation}>
          <Menu size={19} />
        </Button>
        <div className="min-w-0">
          <Breadcrumbs />
          <div className="mt-1 truncate text-[0.6875rem] font-medium text-muted-foreground">{organizationLabel}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl" aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="transition-transform duration-300 group-hover:rotate-12" size={17} /> : <Moon className="transition-transform duration-300 group-hover:-rotate-12" size={17} />}
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="secondary" className="h-11 rounded-xl p-1.5 pr-2 sm:pr-3" aria-label={`Menu do usuário ${user?.login ?? 'Usuário'}`}>
              <span className="grid size-8 place-items-center rounded-lg bg-premium-gradient text-[0.6875rem] font-extrabold text-white shadow-glow">{initials}</span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-32 truncate text-xs font-bold leading-tight">{user?.login ?? 'Usuario'}</span>
                <span className="block max-w-32 truncate text-[0.625rem] font-medium text-muted-foreground">{organizationLabel}</span>
              </span>
              <ChevronDown className="text-muted-foreground" size={14} />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={9} className="glass-surface z-50 min-w-64 rounded-xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-elevated data-[state=open]:animate-fade-up">
              <DropdownMenu.Label className="px-3 py-3">
                <span className="block text-xs font-bold">{user?.login ?? 'Usuário'}</span>
                <span className="mt-1 block max-w-56 truncate text-[0.6875rem] font-medium text-muted-foreground">{roleLabel}</span>
              </DropdownMenu.Label>
              <DropdownMenu.Separator className="my-1 h-px bg-border/70" />
              <DropdownMenu.Item className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition hover:bg-muted focus:bg-muted" onSelect={() => navigate('/app/profile')}>
                <UserRound size={15} /> Perfil
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border/70" />
              <DropdownMenu.Item className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive outline-none transition hover:bg-destructive/10 focus:bg-destructive/10" onSelect={() => void logout()}>
                <LogOut size={15} /> Sair
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
