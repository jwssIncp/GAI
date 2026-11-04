import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, ChevronRight, LogOut, Menu, Moon, Sun, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { navigationHref } from '@/features/projects/navigationContext';
import { useToast } from '@/components/ui/toast-context';

const breadcrumbLabels: Record<string, string> = {
  'technical-reports': 'Laudos',
  templates: 'Modelos',
  responsibles: 'Responsáveis',
  dashboard: 'Visão geral',
  organizations: 'Organizações',
  users: 'Usuários',
  roles: 'Perfis e acessos',
  companies: 'Empresas',
  projects: 'Projetos',
  summary: 'Visão geral',
  contracts: 'Contratos',
  budgets: 'Orçamentos',
  pricing: 'Parâmetros de preços',
  'field-agents': 'Inventariantes',
  'inventory-items': 'Itens inventariados',
  'accounting-items': 'Base contábil',
  'pending-issues': 'Pendências',
  finance: 'Financeiro',
  dre:'DRE Gerencial',
  entries:'Classificações',
  accounts:'Plano de contas',
  periods:'Competências',
  receivables:'Contas a receber',
  'cash-flow':'Fluxo de caixa',
  new:'Novo',
  'import-sessions': 'Importações',
  'export-jobs': 'Exportações',
  profile: 'Perfil',
  settings: 'Configurações',
  preparation: 'Preparação',
  kickoff: 'Kickoff',
  'field-coordination': 'Coordenação de Campo',
  inventory: 'Inventário',
  sessions: 'Sessões',
  accountabilities: 'Prestações',
};

export function Breadcrumbs() {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean).slice(1);
  return (
    <nav aria-label="Breadcrumbs" className="min-w-0 text-sm text-topbar-muted"><ol className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
      {parts.length ? parts.map((part, index) => (
        <li key={`${part}-${index}`} className={`items-center gap-1 ${index < parts.length - 1 ? 'hidden sm:inline-flex' : 'inline-flex min-w-0'}`}>
          {index ? <ChevronRight className="shrink-0 text-topbar-muted" size={12} aria-hidden="true" /> : null}
          {index < parts.length - 1 && (['projects', 'budgets', 'organizations', 'users', 'roles', 'companies', 'field-agents'].includes(part) || (index === 1 && parts[0] === 'projects' && /^\d+$/.test(part))) ?
            <Link className="rounded px-1 py-1 hover:text-topbar-foreground hover:underline" to={navigationHref('/app/' + parts.slice(0, index + 1).join('/'), location.search)}>{/^\d+$/.test(part) ? `#${part}` : breadcrumbLabels[part]}</Link> :
            <span aria-current={index === parts.length - 1 ? 'page' : undefined} className={index === parts.length - 1 ? 'truncate font-semibold text-topbar-foreground' : ''}>{/^\d+$/.test(part) ? `#${part}` : (breadcrumbLabels[part] ?? part.replaceAll('-', ' '))}</span>}
        </li>
      )) : 'Visão geral'}
    </ol></nav>
  );
}

export function Topbar({ onOpenNavigation, navigationOpen = false }: { onOpenNavigation: () => void; navigationOpen?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme, preference, setTheme } = useTheme();
  const { toast } = useToast();
  const organizationLabel = user?.organization_id ? `Organização #${user.organization_id}` : 'Plataforma';
  const roleLabel = user?.role_assignments?.[0]?.role_name ?? 'Acesso autorizado';
  const initials = (user?.login ?? 'U').slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-topbar-border bg-topbar/95 px-4 py-3 text-topbar-foreground shadow-[0_8px_30px_-24px_hsl(var(--brand-ink)/0.95)] backdrop-blur-2xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button id="gai-navigation-trigger" aria-controls="mobile-navigation" aria-expanded={navigationOpen} variant="ghost" size="icon" className="text-topbar-foreground hover:border-white/10 hover:bg-white/[0.07] lg:hidden" aria-label="Abrir navegação" onClick={onOpenNavigation}>
          <Menu size={19} />
        </Button>
        <div className="min-w-0">
          <Breadcrumbs />
          <div className="mt-1 truncate text-[0.6875rem] font-medium text-topbar-muted">{organizationLabel}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl text-topbar-muted hover:border-white/10 hover:bg-white/[0.07] hover:text-topbar-foreground" aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="transition-transform duration-300 group-hover:rotate-12" size={17} /> : <Moon className="transition-transform duration-300 group-hover:-rotate-12" size={17} />}
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="secondary" className="h-11 rounded-xl border-white/10 bg-white/[0.06] p-1.5 pr-2 text-topbar-foreground shadow-none hover:border-primary/35 hover:bg-white/[0.1] sm:pr-3" aria-label={`Menu do usuário ${user?.login ?? 'Usuário'}`}>
              <span className="grid size-8 place-items-center rounded-lg bg-premium-gradient text-[0.6875rem] font-extrabold text-primary-foreground shadow-glow">{initials}</span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-32 truncate text-xs font-bold leading-tight">{user?.login ?? 'Usuario'}</span>
                <span className="block max-w-32 truncate text-[0.625rem] font-medium text-topbar-muted">{organizationLabel}</span>
              </span>
              <ChevronDown className="text-topbar-muted" size={14} />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={9} className="glass-surface z-50 min-w-64 rounded-xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-elevated data-[state=open]:animate-fade-up">
              <DropdownMenu.Label className="px-3 py-3">
                <span className="block text-xs font-bold">{user?.login ?? 'Usuário'}</span>
                <span className="mt-1 block max-w-56 truncate text-[0.6875rem] font-medium text-muted-foreground">{roleLabel}</span>
              </DropdownMenu.Label>
              <DropdownMenu.Separator className="my-1 h-px bg-border/70" />
              <DropdownMenu.Label className="px-3 py-2 text-xs font-semibold text-muted-foreground">Aparência</DropdownMenu.Label>
              <DropdownMenu.RadioGroup value={preference} onValueChange={value => setTheme(value as 'light' | 'dark' | 'system')}>
                {([['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Usar tema do sistema']] as const).map(([value, label]) => <DropdownMenu.RadioItem key={value} value={value} className="relative flex min-h-11 cursor-pointer items-center rounded-lg py-2 pl-8 pr-3 text-sm outline-none focus:bg-muted data-[state=checked]:text-primary-text">
                  <DropdownMenu.ItemIndicator className="absolute left-3 size-2 rounded-full bg-primary-text" />{label}
                </DropdownMenu.RadioItem>)}
              </DropdownMenu.RadioGroup>
              <DropdownMenu.Separator className="my-1 h-px bg-border/70" />
              <DropdownMenu.Item className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition hover:bg-muted focus:bg-muted" onSelect={() => navigate('/app/profile')}>
                <UserRound size={15} /> Perfil
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border/70" />
              <DropdownMenu.Item className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive outline-none transition hover:bg-destructive/10 focus:bg-destructive/10" onSelect={() => void logout().catch(() => toast({ title: 'Sessão encerrada neste navegador', description: 'Não foi possível confirmar o encerramento no servidor.', tone: 'error' }))}>
                <LogOut size={15} /> Sair
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
