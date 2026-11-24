import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, Maximize2, Moon, Settings, Sun, UserRound } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { GaiLogo } from '@/components/base/GaiLogo';
import { useToast } from '@/components/ui/toast-context';
import { navigationSectionFor, navigationSections, visibleNavigation, type NavigationItem, type NavigationSection } from '@/constants/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { usePermissions } from '@/features/auth/usePermissions';
import { navigationContext, navigationHref } from '@/features/projects/navigationContext';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';
import { activeProjectAreaTab, projectAreaTabs } from '@/features/projects/projectArea';
import { organizationLabel } from './organizationLabel';

/** Altura real do cabeçalho (muda no mobile): barras fixas abaixo dele usam a variável. */
const HEADER_HEIGHT_VAR = '--app-header-height';

const ghostButton = 'inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] border-[1.5px] border-[#D7DCE6] bg-nav px-3 text-[0.8125rem] font-semibold text-nav-ink transition-colors hover:border-nav-accent dark:border-border max-md:min-h-10';

/**
 * Menu superior em duas linhas, no padrão do sistema anterior:
 * - linha 1: logo (leva à Visão geral), áreas (Projetos, Comercial, Financeiro e, à
 *   direita, ⚙ Administração) e o usuário;
 * - linha 2: telas da área escolhida, em pílulas. Em Projetos, são as sub-abas do sistema
 *   anterior (Painel Geral, Kick-off, ...), também dentro de um projeto (com a barra do projeto abaixo).
 * Clicar numa área só troca a linha 2 (não navega). Itens e permissões vêm de
 * `constants/navigation.ts`; área sem item permitido não aparece.
 */
export function AppHeader({ onFullscreen }: { onFullscreen?: () => void }) {
  const location = useLocation();
  const { canAccess, hasPermission } = usePermissions();
  const header = useRef<HTMLElement>(null);
  const items = visibleNavigation(canAccess, hasPermission);
  const areas = navigationSections.filter(([key]) => key !== 'overview' && items.some((item) => item.section === key));
  const routeSection = navigationSectionFor(location.pathname);
  const locationKey = location.pathname + location.search;
  // Área escolhida pelo clique vale só para a localização atual; ao navegar, volta a ser a da rota.
  const [picked, setPicked] = useState<{ section: NavigationSection; at: string } | null>(null);
  const shown = picked && picked.at === locationKey ? picked.section : routeSection;
  const project = location.pathname.match(/^\/app\/projects\/([1-9]\d*)(?:\/|$)/)?.[1];
  const insideProject = Boolean(project) && shown === 'projects';

  useLayoutEffect(() => {
    const element = header.current;
    if (!element) return;
    const update = () => document.documentElement.style.setProperty(HEADER_HEIGHT_VAR, `${element.offsetHeight}px`);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const context = navigationContext(new URLSearchParams(location.search));
  if (project) context.set('project_id', project);
  const href = (item: NavigationItem) =>
    item.to.startsWith('/app/budgets') || item.to.startsWith('/app/finance') || item.to === '/app/projects' ? navigationHref(item.to, context) : item.to;
  const subItems = shown ? items.filter((item) => item.section === shown && item.section !== 'overview') : [];
  const areaLabel = shown ? navigationSections.find(([key]) => key === shown)?.[1] : undefined;
  // Área Projetos no padrão do sistema anterior: as sub-abas (Painel Geral, Kick-off, ...) valem
  // para todos os projetos e continuam visíveis dentro de um projeto, com a aba dele ativa.
  const projectTabs = shown === 'projects' ? projectAreaTabs.filter((tab) => canAccess(tab.permissions)) : [];
  const activeAreaTab = activeProjectAreaTab(location.pathname, location.hash);

  return (
    <header ref={header} className="sticky top-0 z-30 font-nav">
      <div className="flex min-h-[58px] items-center justify-between gap-3 border-b border-nav-border bg-nav px-6 max-md:flex-wrap max-md:gap-y-1.5 max-md:px-3 max-md:py-2">
        <div className="flex min-w-0 flex-1 items-center gap-[26px] max-md:order-2 max-md:w-full max-md:flex-none max-md:gap-2.5">
          <Link to="/app/dashboard" aria-label="Visão geral" className="shrink-0 rounded-md max-md:hidden">
            <GaiLogo variant="compact" className="w-[108px]" />
          </Link>
          <nav aria-label="Navegação principal" className="flex min-w-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden pb-px">
            {areas.map(([key, label]) => {
              const admin = key === 'management';
              const on = key === shown;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  aria-current={key === routeSection ? 'true' : undefined}
                  onClick={() => setPicked({ section: key, at: locationKey })}
                  className={cn(
                    'inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-4 text-[0.8125rem] font-semibold transition-colors max-md:min-h-10 max-md:px-3.5',
                    admin && 'md:ml-auto',
                    on
                      ? admin ? 'bg-[#0A1F44] text-white dark:bg-secondary dark:text-foreground' : 'bg-nav-accent text-[#0A1F44]'
                      : 'text-nav-muted hover:bg-subnav-hover hover:text-nav-ink',
                  )}
                >
                  {admin ? <Settings size={14} aria-hidden="true" /> : null}
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
        <UserArea onFullscreen={onFullscreen} />
      </div>
      {projectTabs.length ? (
        <nav aria-label="Telas de Projetos" className="flex min-h-11 items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-nav-border bg-subnav px-6 max-md:px-3">
          {projectTabs.map((tab) => {
            const active = tab.id === activeAreaTab?.id;
            return (
              <Link
                key={tab.id}
                to={tab.id === 'overview' ? navigationHref(tab.to, context) : tab.to}
                aria-current={active ? (insideProject ? 'true' : 'page') : undefined}
                className={cn(
                  'inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-full px-[13px] text-[0.78125rem] font-semibold transition-colors max-md:min-h-10',
                  active ? 'bg-[#0A1F44] text-white dark:bg-steel-dark' : 'text-nav-muted hover:bg-subnav-hover hover:text-nav-ink',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      ) : subItems.length ? (
        <nav aria-label={`Telas de ${areaLabel}`} className="flex min-h-11 items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-nav-border bg-subnav px-6 max-md:px-3">
          {subItems.map((item) => (
            <NavLink
              key={item.to}
              to={href(item)}
              className={({ isActive }) => cn(
                'inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-full px-[13px] text-[0.78125rem] font-semibold transition-colors max-md:min-h-10',
                isActive ? 'bg-[#0A1F44] text-white dark:bg-steel-dark' : 'text-nav-muted hover:bg-subnav-hover hover:text-nav-ink',
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

function UserArea({ onFullscreen }: { onFullscreen?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme, preference, setTheme } = useTheme();
  const { toast } = useToast();
  const organization = organizationLabel(user);
  const roleLabel = user?.role_assignments?.[0]?.role_name ?? 'Acesso autorizado';
  const initials = (user?.login ?? 'U').slice(0, 2).toUpperCase();
  const signOut = () => void logout().catch(() => toast({ title: 'Sessão encerrada neste navegador', description: 'Não foi possível confirmar o encerramento no servidor.', tone: 'error' }));

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2.5 max-md:order-1 max-md:w-full max-md:justify-between">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={`Menu do usuário ${user?.login ?? 'Usuário'}`} className="flex min-w-0 items-center gap-2.5 rounded-lg p-1 text-left hover:bg-subnav-hover">
            <span className="min-w-0 text-right leading-tight max-xl:hidden max-md:block max-md:text-left">
              <span className="block max-w-44 truncate text-[0.84375rem] font-semibold text-nav-ink">{user?.login ?? 'Usuário'}</span>
              <span className="block max-w-44 truncate text-[0.6875rem] text-[#8A93A6] dark:text-muted-foreground">{organization}</span>
            </span>
            <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-nav-accent text-[0.75rem] font-bold text-[#0A1F44]">{initials}</span>
            <ChevronDown className="text-nav-muted" size={14} aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-64 rounded-[10px] border border-border bg-popover p-1.5 font-sans text-popover-foreground shadow-elevated data-[state=open]:animate-fade-up">
            <DropdownMenu.Label className="px-3 py-3">
              <span className="block text-xs font-bold">{user?.login ?? 'Usuário'}</span>
              <span className="mt-1 block max-w-56 truncate text-[0.6875rem] font-medium text-muted-foreground">{roleLabel}</span>
            </DropdownMenu.Label>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Label className="px-3 py-2 text-xs font-semibold text-muted-foreground">Aparência</DropdownMenu.Label>
            <DropdownMenu.RadioGroup value={preference} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}>
              {([['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Usar tema do sistema']] as const).map(([value, label]) => (
                <DropdownMenu.RadioItem key={value} value={value} className="relative flex min-h-10 cursor-pointer items-center rounded-md py-2 pl-8 pr-3 text-sm outline-none focus:bg-muted data-[state=checked]:text-primary-text">
                  <DropdownMenu.ItemIndicator className="absolute left-3 size-2 rounded-full bg-primary-text" />{label}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium outline-none hover:bg-muted focus:bg-muted" onSelect={() => navigate('/app/profile')}>
              <UserRound size={15} /> Perfil
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10" onSelect={signOut}>
              <LogOut size={15} /> Sair
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <div className="flex items-center gap-2">
        {onFullscreen ? (
          <button type="button" className={cn(ghostButton, 'max-lg:hidden')} title="Ver a tela em tela cheia" onClick={onFullscreen}>
            <Maximize2 size={14} aria-hidden="true" /> Tela cheia
          </button>
        ) : null}
        <button type="button" className={cn(ghostButton, 'w-9 px-0 max-md:w-10')} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button type="button" className={ghostButton} onClick={signOut}>Sair</button>
      </div>
    </div>
  );
}
