import { ArrowLeftRight, BadgeDollarSign, HandCoins, Percent, ReceiptText, Tags, Building2, ContactRound, FileSpreadsheet, FolderKanban, Landmark, LayoutDashboard, ShieldCheck, SlidersHorizontal, Users, Wallet } from 'lucide-react';

// Menu superior em duas linhas (padrão do sistema anterior): linha 1 = áreas (seções),
// linha 2 = telas da área. A ordem do array é a ordem do menu; o Dashboard usa os
// primeiros itens permitidos como "acesso rápido".
export type NavigationSection = 'overview' | 'projects' | 'commercial' | 'finance' | 'management';

/**
 * Ordem e rótulos das seções (módulos). Fonte única: o menu superior usa como abas de
 * área (exceto "Visão geral", que é o clique no logo; "Administração" fica à direita) e
 * o PageHeader usa como rótulo acima do título (eyebrow) de cada tela.
 */
export const navigationSections: ReadonlyArray<readonly [NavigationSection, string]> = [
  ['overview', 'Visão geral'],
  ['projects', 'Projetos'],
  ['commercial', 'Comercial'],
  ['finance', 'Financeiro'],
  ['management', 'Administração'],
];

export function sectionLabel(section: NavigationSection): string {
  return navigationSections.find(([key]) => key === section)![1];
}

export type NavigationItem = { label: string; to: string; icon: typeof LayoutDashboard; permissions?: string[]; section: NavigationSection };

/**
 * Itens do menu visíveis para o perfil. Sem `projects:read` mas com `projects:create`,
 * o item Projetos vira "Novo projeto" (cria sem expor a lista).
 */
export function visibleNavigation(canAccess: (permissions?: string[]) => boolean, hasPermission: (permission: string) => boolean): NavigationItem[] {
  return navigation.flatMap((item) => {
    if (canAccess(item.permissions)) return [item];
    if (item.to === '/app/projects' && hasPermission('projects:create')) return [{ ...item, label: 'Novo projeto', to: '/app/projects/new', permissions: ['projects:create'] }];
    return [];
  });
}

export const navigation: NavigationItem[] = [
  // Ordem = ordem do menu superior (área › telas), como no sistema anterior.
  // Inventariantes fica no Financeiro (decisão do cliente, 23/11/2026).
  { label: 'Visão geral', to: '/app/dashboard', icon: LayoutDashboard, section: 'overview' },
  { label: 'Projetos', to: '/app/projects', icon: FolderKanban, permissions: ['projects:read'], section: 'projects' },
  { label: 'Orçamentos', to: '/app/budgets', icon: FolderKanban, permissions: ['budgets:read'], section: 'commercial' },
  { label: 'Empresas', to: '/app/companies', icon: Building2, permissions: ['companies:read'], section: 'commercial' },
  {label:'Fluxo de caixa',to:'/app/finance/cash-flow',icon:ArrowLeftRight,permissions:['cash-flow:read'],section:'finance'},
  {label:'Recebíveis',to:'/app/finance/receivables',icon:Wallet,permissions:['receivables:read'],section:'finance'},
  {label:'DRE gerencial',to:'/app/finance/dre',icon:FileSpreadsheet,permissions:['dre:read'],section:'finance'},
  { label: 'Inventariantes', to: '/app/field-agents', icon: ContactRound, permissions: ['field-agents:read'], section: 'finance' },
  { label: 'Remuneração por projeto', to: '/app/finance/remuneration', icon: BadgeDollarSign, permissions: ['payments:read'], section: 'finance' },
  { label: 'Pagamento de inventariantes', to: '/app/finance/field-agent-payments', icon: HandCoins, permissions: ['payments:read'], section: 'finance' },
  { label: 'Despesas', to: '/app/finance/expenses', icon: ReceiptText, permissions: ['expenses:read'], section: 'finance' },
  { label: 'Placas de patrimônio', to: '/app/finance/asset-tags', icon: Tags, permissions: ['asset-tag-orders:read'], section: 'finance' },
  { label: 'Comissões', to: '/app/finance/commissions', icon: Percent, permissions: ['commissions:read'], section: 'finance' },
  { label: 'Usuários', to: '/app/users', icon: Users, permissions: ['users:read'], section: 'management' },
  { label: 'Perfis e acessos', to: '/app/roles', icon: ShieldCheck, permissions: ['org_roles:read'], section: 'management' },
  { label: 'Organizações', to: '/app/organizations', icon: Landmark, permissions: ['organizations:read'], section: 'management' },
  { label: 'Parâmetros financeiros', to: '/app/finance/parameters', icon: SlidersHorizontal, permissions: ['finance-settings:read'], section: 'management' },
];

/**
 * Permissões da tela de um item do menu: a rota usa a MESMA lista do menu
 * (uma fonte só), para nunca mostrar um item que cai em acesso negado nem
 * abrir por link uma tela cuja API recusa.
 */
/**
 * Seção (módulo) da rota atual: tudo dentro de /app/projects/:id é "Projetos"; nas
 * demais, vale o item do menu de prefixo mais longo (ex.: /app/finance/parameters fica
 * em "Administração", /app/finance/receivables/12 em "Financeiro"). Telas fora do menu
 * no Financeiro (ex.: /app/finance) ficam em "Financeiro". Sem seção: null.
 */
export function navigationSectionFor(pathname: string): NavigationSection | null {
  if (/^\/app\/projects(\/|$)/.test(pathname)) return 'projects';
  const match = navigation
    .filter((item) => pathname === item.to || pathname.startsWith(item.to + '/'))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (match) return match.section;
  if (/^\/app\/finance(\/|$)/.test(pathname)) return 'finance';
  return null;
}

export function navigationPermissions(to: string): string[] {
  const item = navigation.find((i) => i.to === to);
  if (!item) throw new Error(`Rota fora do menu: ${to}`);
  return item.permissions ?? [];
}
