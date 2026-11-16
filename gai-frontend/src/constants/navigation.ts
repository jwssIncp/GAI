import { ArrowLeftRight, BadgeDollarSign, HandCoins, Percent, ReceiptText, Tags, Building2, ContactRound, FileSpreadsheet, FolderKanban, Landmark, LayoutDashboard, ShieldCheck, SlidersHorizontal, Users, Wallet } from 'lucide-react';

// Menu lateral por módulo (seção). A ordem do array é preservada: o Dashboard usa os
// primeiros itens permitidos como "acesso rápido"; o Sidebar agrupa por seção.
export type NavigationSection = 'overview' | 'projects' | 'commercial' | 'finance' | 'management';

/**
 * Ordem e rótulos das seções (módulos). Fonte única: o menu lateral usa como título
 * de grupo (exceto "Visão geral", que não tem título) e o PageHeader usa como rótulo
 * acima do título (eyebrow) de cada tela.
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

export const navigation: Array<{ label: string; to: string; icon: typeof LayoutDashboard; permissions?: string[]; section: NavigationSection }> = [
  { label: 'Visão geral', to: '/app/dashboard', icon: LayoutDashboard, section: 'overview' },
  { label: 'Projetos', to: '/app/projects', icon: FolderKanban, permissions: ['projects:read'], section: 'projects' },
  { label: 'Orçamentos', to: '/app/budgets', icon: FolderKanban, permissions: ['budgets:read'], section: 'commercial' },
  { label: 'Inventariantes', to: '/app/field-agents', icon: ContactRound, permissions: ['field-agents:read'], section: 'projects' },
  {label:'Recebíveis',to:'/app/finance/receivables',icon:Wallet,permissions:['receivables:read'],section:'finance'},
  {label:'Fluxo de caixa',to:'/app/finance/cash-flow',icon:ArrowLeftRight,permissions:['cash-flow:read'],section:'finance'},
  {label:'DRE gerencial',to:'/app/finance/dre',icon:FileSpreadsheet,permissions:['dre:read'],section:'finance'},
  { label: 'Remuneração', to: '/app/finance/remuneration', icon: BadgeDollarSign, permissions: ['payments:read'], section: 'finance' },
  { label: 'Pagamento de inventariantes', to: '/app/finance/field-agent-payments', icon: HandCoins, permissions: ['payments:read'], section: 'finance' },
  { label: 'Despesas', to: '/app/finance/expenses', icon: ReceiptText, permissions: ['expenses:read'], section: 'finance' },
  { label: 'Placas de patrimônio', to: '/app/finance/asset-tags', icon: Tags, permissions: ['asset-tag-orders:read'], section: 'finance' },
  { label: 'Comissões', to: '/app/finance/commissions', icon: Percent, permissions: ['commissions:read'], section: 'finance' },
  { label: 'Organizações', to: '/app/organizations', icon: Landmark, permissions: ['organizations:read'], section: 'management' },
  { label: 'Usuários', to: '/app/users', icon: Users, permissions: ['users:read'], section: 'management' },
  { label: 'Perfis e acessos', to: '/app/roles', icon: ShieldCheck, permissions: ['org_roles:read'], section: 'management' },
  { label: 'Parâmetros financeiros', to: '/app/finance/parameters', icon: SlidersHorizontal, permissions: ['finance-settings:read'], section: 'management' },
  { label: 'Empresas', to: '/app/companies', icon: Building2, permissions: ['companies:read'], section: 'commercial' },
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
