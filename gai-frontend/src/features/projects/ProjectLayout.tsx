import { dashboardReturn, navigationHref } from "./navigationContext";
import { activeProjectTabId, projectTabAlerts, projectTabGroups, type ProjectTab, type ProjectTabAlert } from "./projectNavigation";
import { activeProjectAreaTab, projectAreaTab, rememberProject } from "./projectArea";
import { useProjectDashboard } from "./projectQueries";
import { useProjectLabel } from "./useProjectLabel";
import { Fragment, useEffect, useRef } from "react";
import { AlertTriangle, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { ErrorState } from "@/components/base/States";
import { usePermissions } from "@/features/auth/usePermissions";
import { cn } from "@/utils/cn";

export function ProjectLayout() {
  const { projectId } = useParams();
  const location = useLocation();
  const back = dashboardReturn(new URLSearchParams(location.search).get("return_to"));
  const valid = Boolean(projectId && /^\d+$/.test(projectId) && Number(projectId) >= 1);
  // Projeto escolhido fica lembrado: as outras sub-abas da área Projetos abrem direto nele.
  useEffect(() => {
    if (valid) rememberProject(Number(projectId));
  }, [projectId, valid]);
  if (!valid) return <ErrorState message="Projeto inválido." />;
  return (
    <div className="flex min-w-0 flex-1 flex-col" data-project-id={projectId}>
      {back && <Link className="mx-4 mt-4 text-sm text-primary underline" to={back}>Retornar ao dashboard da organização</Link>}
      <ProjectNavigation projectId={projectId!} />
      <Outlet />
    </div>
  );
}

function scrollIntoStrip(strip: HTMLElement | null) {
  const element = strip?.querySelector<HTMLElement>("[aria-current]");
  // Only scroll the horizontal strip, without moving the page or covering its content.
  if (!element || !strip) return;
  if (element.offsetLeft < strip.scrollLeft) strip.scrollLeft = element.offsetLeft;
  else if (element.offsetLeft + element.offsetWidth > strip.scrollLeft + strip.clientWidth) {
    strip.scrollLeft = element.offsetLeft + element.offsetWidth - strip.clientWidth;
  }
}

/**
 * Barra do projeto escolhido, logo abaixo das sub-abas da área Projetos (Painel Geral, Kick-off,
 * Pendências - Campo, ...): nome do projeto, "Trocar projeto" e as telas da sub-aba ativa quando
 * ela tem mais de uma (ex.: Inventário › Itens inventariados · Importações). No Painel Geral,
 * mostra as telas do GAI que não existem no sistema anterior: resumo/cadastro, dashboard,
 * unidades, contratos, financeiro e exportações. Destinos e permissões são os mesmos de antes.
 */
export function ProjectNavigation({ projectId }: { projectId: string }) {
  const location = useLocation();
  const { canAccess, hasPermission } = usePermissions();
  const tabStrip = useRef<HTMLDivElement>(null);
  const root = `/app/projects/${projectId}/`;
  const href = (tab: ProjectTab) => navigationHref(tab.path.startsWith("/") ? tab.path : root + tab.path, location.search);
  const projectName = useProjectLabel(projectId);

  const area = activeProjectAreaTab(location.pathname, location.hash) ?? projectAreaTab("overview");
  const groups = projectTabGroups(projectId)
    .filter((group) => area.groups.includes(group.id))
    .map((group) => ({ ...group, tabs: group.tabs.filter((tab) => canAccess(tab.permissions)) }))
    .filter((group) => group.tabs.length > 0);
  const tabCount = groups.reduce((sum, group) => sum + group.tabs.length, 0);
  const activeTabId = activeProjectTabId(projectId, location.pathname, location.hash);
  const switchTo = area.id === "overview" ? "/app/projects" : `${area.to}?escolher=1`;

  // Alertas ⚠: mesma consulta (mesma chave de cache) de GET /projects/:id/dashboard da Visão geral.
  const canReadProject = hasPermission("projects:read");
  const dashboard = useProjectDashboard(canReadProject ? Number(projectId) : undefined);
  const allAlerts = dashboard.data && String(dashboard.data.project?.id) === projectId ? projectTabAlerts(dashboard.data, { approvePayments: hasPermission("payments:approve"), approveExpenses: hasPermission("expenses:approve"), reschedulePayments: hasPermission("payments:reschedule") }) : {};
  const alertOf = (tab: ProjectTab): ProjectTabAlert | undefined => allAlerts[tab.id];

  useEffect(() => {
    scrollIntoStrip(tabStrip.current);
  }, [location.pathname, location.search, location.hash]);

  return (
    // Logo abaixo do cabeçalho de duas linhas (altura medida pelo AppHeader).
    <div className="sticky top-[var(--app-header-height,103px)] z-20 w-full border-b border-nav-border bg-card font-nav">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-1.5 max-md:px-3" aria-label="Abas do projeto">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-nav-muted">Projeto</span>
          <span className="truncate font-semibold text-nav-ink" title={projectName}>{projectName}</span>
          <Link
            to={switchTo}
            className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md border border-border-strong px-2.5 text-xs font-semibold text-nav-ink hover:bg-subnav-hover"
          >
            <ArrowLeftRight size={13} aria-hidden="true" /> Trocar projeto
          </Link>
        </div>
        {tabCount > 1 ? (
          <div ref={tabStrip} id="project-group-tabs" role="group" aria-label={`Telas de ${area.label}`} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {groups.map((group, index) => (
              <Fragment key={group.id}>
                {groups.length > 1 ? (
                  <span className={cn("shrink-0 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-nav-muted", index > 0 && "ml-2 border-l border-nav-border pl-3")}>
                    {group.label}
                  </span>
                ) : null}
                {group.tabs.map((tab) => {
                  const active = tab.id === activeTabId;
                  const alert = alertOf(tab);
                  return (
                    <Link
                      key={tab.id}
                      to={href(tab)}
                      title={alert ? `Atenção: ${alert.description}` : tab.hint}
                      aria-current={active ? "page" : undefined}
                      aria-describedby={alert ? `project-tab-alert-${tab.id}` : undefined}
                      className={cn(
                        "relative inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors max-md:min-h-10",
                        alert
                          ? cn("text-destructive ring-1 ring-inset ring-rose/45 hover:bg-destructive/[0.06]", active && "font-semibold after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-rose")
                          : active
                            ? "font-semibold text-nav-ink after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-nav-accent"
                            : "text-nav-muted hover:bg-subnav-hover hover:text-nav-ink",
                      )}
                    >
                      {tab.label}
                      {alert ? <AlertTriangle size={13} strokeWidth={2.2} aria-hidden="true" /> : null}
                      {alert?.count ? <span aria-hidden="true" className="tabular-nums font-semibold">{alert.count}</span> : null}
                      {tab.external ? <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" className="opacity-70" /> : null}
                    </Link>
                  );
                })}
              </Fragment>
            ))}
          </div>
        ) : null}
        {/* Descrições dos alertas (aria-describedby): fora dos links para não alterar o nome acessível. */}
        <div hidden>
          {groups.flatMap((group) => group.tabs).map((tab) => {
            const alert = alertOf(tab);
            return alert ? <span key={tab.id} id={`project-tab-alert-${tab.id}`}>Atenção: {alert.description}</span> : null;
          })}
        </div>
      </nav>
    </div>
  );
}
