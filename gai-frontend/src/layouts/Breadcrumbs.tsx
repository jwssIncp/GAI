import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { navigationHref } from '@/features/projects/navigationContext';
import { usePermissions } from '@/features/auth/usePermissions';
import { useProject } from '@/features/projects/projectQueries';
import { projectBreadcrumbSteps } from '@/features/projects/projectNavigation';
import { navigationSectionFor, sectionLabel } from '@/constants/navigation';
import { useQuery } from '@tanstack/react-query';
import { companySource, organizationSource, userSource } from '@/components/base/entitySources';
import { budgetApi } from '@/features/budgets/budgetApi';
import { financeApi } from '@/features/receivables/financeApi';

// Nome do registro aberto na trilha (no lugar de "#id"). Sem permissão ou com
// erro, a consulta falha e a trilha mantém o código.
const crumbNames: Record<string, (id: number) => Promise<string | null>> = {
  companies: async (id) => (await companySource.one!(id, {}))?.label ?? null,
  users: async (id) => (await userSource.one!(id, {}))?.label ?? null,
  organizations: async (id) => (await organizationSource.one!(id, {}))?.label ?? null,
  budgets: async (id) => (await budgetApi.detail(id)).number ?? null,
  receivables: async (id) => (await financeApi.detail(String(id))).data?.description ?? null,
};

function useCrumbName(parts: string[]) {
  const index = parts.findIndex((part, i) => i > 0 && /^\d+$/.test(part) && parts[i - 1] in crumbNames);
  const resource = index > 0 ? parts[index - 1] : null;
  const id = index > 0 ? Number(parts[index]) : null;
  const query = useQuery({
    queryKey: ['crumb-name', resource, id],
    queryFn: () => crumbNames[resource!](id!),
    enabled: resource !== null,
    retry: false,
    staleTime: 60_000,
  });
  return { index, name: query.data ?? null };
}

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
  dre:'DRE gerencial',
  entries:'Classificações e ajustes',
  accounts:'Plano de contas',
  periods:'Competências',
  monthly:'DRE mensal',
  statement:'Demonstrativo',
  receivables:'Recebíveis',
  'cash-flow':'Fluxo de caixa',
  parameters: 'Parâmetros financeiros',
  remuneration: 'Remuneração',
  'field-agent-payments': 'Pagamento de inventariantes',
  expenses: 'Despesas',
  'asset-tags': 'Placas de patrimônio',
  commissions: 'Comissões',
  new:'Novo',
  'import-sessions': 'Importações',
  'export-jobs': 'Exportações',
  profile: 'Perfil',
  settings: 'Configurações',
  preparation: 'Preparação',
  kickoff: 'Kickoff',
  'field-coordination': 'Coordenação de campo',
  inventory: 'Inventário',
  sessions: 'Sessões',
  accountabilities: 'Prestações',
  'access-denied': 'Acesso negado',
};

/**
 * Níveis da trilha que viram link. No Financeiro, a raiz e as listas/abas também
 * (ex.: Financeiro › Recebíveis › #12, Financeiro › DRE gerencial › Classificações e ajustes › #5);
 * /app/finance leva à primeira tela financeira permitida.
 */
const linkable = ['projects', 'budgets', 'organizations', 'users', 'roles', 'companies', 'field-agents', 'finance', 'receivables', 'dre', 'entries'];

type Crumb = { label: string; to?: string };

// No mobile (< sm) mostra só os dois últimos itens (ex.: "Visão geral › Resumo"), sem seta antes
// do primeiro item visível; a aba atual tem prioridade e o grupo é truncado se faltar espaço.
// No desktop mostra a trilha toda.
function BreadcrumbList({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumbs" className="min-w-0 text-sm text-muted-foreground"><ol className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        const firstOnMobile = index === crumbs.length - 2;
        return (
          <li key={`${crumb.label}-${index}`} className={`items-center gap-1 ${last ? 'inline-flex min-w-0 shrink-0 max-w-[70%] sm:max-w-none sm:shrink' : firstOnMobile ? 'inline-flex min-w-0 shrink' : 'hidden sm:inline-flex'}`}>
            {index ? <ChevronRight className={`shrink-0 text-muted-foreground ${firstOnMobile ? 'hidden sm:block' : ''}`} size={12} aria-hidden="true" /> : null}
            {crumb.to && !last ?
              <Link className="truncate rounded px-1 py-1 hover:text-foreground hover:underline" to={crumb.to}>{crumb.label}</Link> :
              <span aria-current={last ? 'page' : undefined} className={last ? 'truncate font-semibold text-foreground' : 'truncate'}>{crumb.label}</span>}
          </li>
        );
      })}
    </ol></nav>
  );
}

// Dentro do workspace: Projetos › <nome do projeto> › <grupo> › <aba> [› detalhe], com os
// mesmos nomes da navegação em dois níveis. Sem permissão de leitura do projeto, mostra #id.
function ProjectBreadcrumbs({ projectId }: { projectId: string }) {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('projects:read');
  const project = useProject(canRead ? Number(projectId) : undefined);
  const root = `/app/projects/${projectId}/`;
  const name = canRead && project.data && String(project.data.id) === projectId ? project.data.name : `#${projectId}`;
  const crumbs: Crumb[] = [
    { label: 'Projetos', to: navigationHref('/app/projects', location.search) },
    { label: name, to: navigationHref(root + 'summary', location.search) },
    ...projectBreadcrumbSteps(projectId, location.pathname, location.hash).map((step) => ({
      label: step.label,
      to: step.to ? navigationHref(root + step.to, location.search) : undefined,
    })),
  ];
  return <BreadcrumbList crumbs={crumbs} />;
}

export function Breadcrumbs() {
  const location = useLocation();
  const projectId = location.pathname.match(/^\/app\/projects\/([1-9]\d*)\/./)?.[1];
  const parts = location.pathname.split('/').filter(Boolean).slice(1);
  const crumbName = useCrumbName(projectId ? [] : parts);
  if (projectId) return <ProjectBreadcrumbs projectId={projectId} />;
  if (!parts.length) return <nav aria-label="Breadcrumbs" className="min-w-0 text-sm text-muted-foreground"><ol className="flex items-center gap-1 overflow-hidden whitespace-nowrap">Visão geral</ol></nav>;
  // Tela do menu fora do módulo da própria URL (ex.: Parâmetros financeiros fica em
  // /app/finance/parameters, mas no grupo Administração): o 1º nível é a seção do menu.
  const section = navigationSectionFor(location.pathname);
  const outsideUrlModule = parts[0] === 'finance' && section !== null && section !== 'finance';
  const crumbs: Crumb[] = parts.map((part, index) => {
    if (index === 0 && outsideUrlModule) return { label: sectionLabel(section) };
    return {
      label: index === crumbName.index && crumbName.name ? crumbName.name : /^\d+$/.test(part) ? `#${part}` : (breadcrumbLabels[part] ?? part.replaceAll('-', ' ')),
      to: index < parts.length - 1 && (linkable.includes(part) || (index === 1 && parts[0] === 'projects' && /^\d+$/.test(part)))
        ? navigationHref('/app/' + parts.slice(0, index + 1).join('/'), location.search)
        : undefined,
    };
  });
  return <BreadcrumbList crumbs={crumbs} />;
}
