import { ArrowLeftRight, Building2, ContactRound, FileSpreadsheet, FolderKanban, Landmark, LayoutDashboard, ShieldCheck, Users, Wallet } from 'lucide-react';

// Menu lateral por módulo (seção). A ordem do array é preservada: o Dashboard usa os
// primeiros itens permitidos como "acesso rápido"; o Sidebar agrupa por seção.
export type NavigationSection = 'overview' | 'projects' | 'commercial' | 'finance' | 'management';

export const navigation: Array<{ label: string; to: string; icon: typeof LayoutDashboard; permissions?: string[]; section: NavigationSection }> = [
  { label: 'Visão geral', to: '/app/dashboard', icon: LayoutDashboard, section: 'overview' },
  { label: 'Projetos', to: '/app/projects', icon: FolderKanban, permissions: ['projects:read'], section: 'projects' },
  { label: 'Orçamentos', to: '/app/budgets', icon: FolderKanban, permissions: ['budgets:read'], section: 'commercial' },
  { label: 'Inventariantes', to: '/app/field-agents', icon: ContactRound, permissions: ['field-agents:read'], section: 'projects' },
  {label:'Recebíveis',to:'/app/finance/receivables',icon:Wallet,permissions:['receivables:read'],section:'finance'},
  {label:'Fluxo de caixa',to:'/app/finance/cash-flow',icon:ArrowLeftRight,permissions:['cash-flow:read'],section:'finance'},
  {label:'DRE Gerencial',to:'/app/finance/dre',icon:FileSpreadsheet,permissions:['dre:read'],section:'finance'},
  { label: 'Organizações', to: '/app/organizations', icon: Landmark, permissions: ['organizations:read'], section: 'management' },
  { label: 'Usuários', to: '/app/users', icon: Users, permissions: ['users:read'], section: 'management' },
  { label: 'Perfis e acessos', to: '/app/roles', icon: ShieldCheck, permissions: ['org_roles:read'], section: 'management' },
  { label: 'Empresas', to: '/app/companies', icon: Building2, permissions: ['companies:read'], section: 'commercial' },
];
