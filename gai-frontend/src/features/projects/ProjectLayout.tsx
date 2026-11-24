import { dashboardReturn, navigationHref } from "./navigationContext";
import { activeProjectTabId, groupOfTab, projectTabAlerts, projectTabGroups, type ProjectTab, type ProjectTabAlert } from "./projectNavigation";
import { useProjectDashboard } from "./projectQueries";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { ErrorState } from "@/components/base/States";
import { usePermissions } from "@/features/auth/usePermissions";
import { cn } from "@/utils/cn";

export function ProjectLayout() {
  const { projectId } = useParams();
  const location = useLocation();
  const back = dashboardReturn(new URLSearchParams(location.search).get("return_to"));
  if (!projectId || !/^\d+$/.test(projectId) || Number(projectId) < 1) {
    return <ErrorState message="Projeto inválido." />;
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col" data-project-id={projectId}>
      {back && <Link className="mx-4 mt-4 text-sm text-primary underline" to={back}>Retornar ao dashboard da organização</Link>}
      <ProjectNavigation projectId={projectId} />
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
 * Navegação do workspace em dois níveis: grupos (nível 1) e abas do grupo ativo (nível 2).
 * Cada aba mantém exatamente as permissões e o destino que tinha antes; um grupo só
 * aparece quando ao menos uma de suas abas está visível para o usuário.
 */
export function ProjectNavigation({ projectId }: { projectId: string }) {
  const location = useLocation();
  const { canAccess, hasPermission } = usePermissions();
  const groupStrip = useRef<HTMLDivElement>(null);
  const tabStrip = useRef<HTMLDivElement>(null);
  const root = `/app/projects/${projectId}/`;
  const href = (tab: ProjectTab) => navigationHref(tab.path.startsWith("/") ? tab.path : root + tab.path, location.search);

  // single: grupo definido com uma aba só (Kick-off, Avaliação, Laudo) — vale pela definição,
  // não pelas abas que o usuário vê, para um grupo parcialmente visível manter a segunda linha.
  const groups = projectTabGroups(projectId)
    .map((group) => ({ ...group, single: group.tabs.length === 1, tabs: group.tabs.filter((tab) => canAccess(tab.permissions)) }))
    .filter((group) => group.tabs.length > 0);
  const activeTabId = activeProjectTabId(projectId, location.pathname, location.hash);
  const activeGroup = groupOfTab(groups, activeTabId);
  // Grupo cuja primeira aba visível sai do workspace (↗): o clique só o seleciona e mostra
  // suas abas, sem navegar. A seleção vale apenas para a localização atual.
  const locationKey = location.pathname + location.search + location.hash;
  const [selection, setSelection] = useState<{ groupId: string; at: string } | null>(null);
  const selectedGroup = selection && selection.at === locationKey ? groups.find((group) => group.id === selection.groupId) ?? null : null;
  const shownGroup = selectedGroup ?? activeGroup;

  // Alertas ⚠ v1: mesma consulta (mesma chave de cache) de GET /projects/:id/dashboard que a
  // Visão geral usa; uma chamada por workspace, nenhuma por aba. Só abas visíveis recebem alerta
  // e o alerta do grupo considera apenas as abas visíveis dele.
  const canReadProject = hasPermission("projects:read");
  const dashboard = useProjectDashboard(canReadProject ? Number(projectId) : undefined);
  const allAlerts = dashboard.data && String(dashboard.data.project?.id) === projectId ? projectTabAlerts(dashboard.data, { approvePayments: hasPermission("payments:approve"), approveExpenses: hasPermission("expenses:approve"), reschedulePayments: hasPermission("payments:reschedule") }) : {};
  const alertOf = (tab: ProjectTab): ProjectTabAlert | undefined => allAlerts[tab.id];
  const groupAlert = (group: (typeof groups)[number]) => {
    const tabs = group.tabs.filter((tab) => alertOf(tab));
    if (!tabs.length) return undefined;
    return {
      severity: tabs.some((tab) => alertOf(tab)!.severity === "danger") ? ("danger" as const) : ("warning" as const),
      description: tabs.map((tab) => `${tab.label}: ${alertOf(tab)!.description}`).join("; "),
    };
  };

  useEffect(() => {
    scrollIntoStrip(groupStrip.current);
    scrollIntoStrip(tabStrip.current);
  }, [location.pathname, location.search, location.hash, shownGroup?.id]);

  return (
    // Logo abaixo do cabeçalho de duas linhas (altura medida pelo AppHeader).
    <div className="sticky top-[var(--app-header-height,103px)] z-20 w-full border-b border-nav-border bg-card font-nav">
      <nav
        className="grid gap-0.5 px-6 py-1.5 max-md:px-3"
        aria-label="Abas do projeto"
      >
        <div ref={groupStrip} role="group" aria-label="Grupos do projeto" className="flex gap-1 overflow-x-auto">
          {groups.map((group) => {
            const active = group.id === activeGroup?.id;
            const shown = group.id === shownGroup?.id;
            const alert = groupAlert(group);
            const descriptionId = alert ? `project-group-alert-${group.id}` : undefined;
            const className = cn(
              // Pílulas do submenu do sistema anterior; grupo com alerta em vermelho (#B23A48).
              "inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-[13px] text-[0.78125rem] font-semibold transition-colors max-md:min-h-10",
              alert
                ? shown
                  ? "bg-rose text-white"
                  : "text-destructive ring-1 ring-inset ring-rose/55 hover:bg-destructive/[0.06]"
                : shown
                  ? "bg-[#0A1F44] text-white dark:bg-steel-dark"
                  : "text-nav-muted hover:bg-subnav-hover hover:text-nav-ink",
            );
            const content = (
              <>
                {group.label}
                {alert ? <AlertTriangle size={14} strokeWidth={2.2} aria-hidden="true" /> : null}
              </>
            );
            if (group.tabs[0].external) {
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-expanded={shown}
                  aria-controls="project-group-tabs"
                  aria-current={active ? "true" : undefined}
                  onClick={() => setSelection({ groupId: group.id, at: locationKey })}
                  className={className}
                  aria-describedby={descriptionId}
                  title={alert ? `Atenção: ${alert.description}` : undefined}
                >
                  {content}
                </button>
              );
            }
            return (
              <Link
                key={group.id}
                to={href(group.tabs[0])}
                // Grupo de uma aba só: o link do grupo é a própria tela (aria-current="page").
                aria-current={active ? (group.single ? "page" : "true") : undefined}
                className={className}
                aria-describedby={descriptionId}
                title={alert ? `Atenção: ${alert.description}` : undefined}
              >
                {content}
              </Link>
            );
          })}
        </div>
        {/* Grupo de uma aba só (Kick-off, Avaliação, Laudo): o próprio grupo já leva à tela. */}
        {shownGroup && !(groups.find((group) => group.id === shownGroup.id)?.single && !shownGroup.tabs[0].external) ? (
          <div
            ref={tabStrip}
            id="project-group-tabs"
            role="group"
            aria-label={`Abas de ${shownGroup.label}`}
            className="flex gap-1 overflow-x-auto pt-0.5"
          >
            {shownGroup.tabs.map((tab) => {
              const active = tab.id === activeTabId;
              const alert = alertOf(tab);
              const descriptionId = alert ? `project-tab-alert-${tab.id}` : undefined;
              return (
                <Link
                  key={tab.id}
                  to={href(tab)}
                  title={alert ? `Atenção: ${alert.description}` : tab.hint}
                  aria-current={active ? "page" : undefined}
                  aria-describedby={descriptionId}
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
                  {/* Quantidade só na aba (no grupo, apenas o ⚠). aria-hidden: a descrição já informa o número. */}
                  {alert?.count ? <span aria-hidden="true" className="tabular-nums font-semibold">{alert.count}</span> : null}
                  {tab.external ? <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" className="opacity-70" /> : null}
                </Link>
              );
            })}
          </div>
        ) : null}
        {/* Descrições dos alertas (aria-describedby): fora dos links para não alterar o nome acessível. */}
        <div hidden>
          {groups.map((group) => {
            const alert = groupAlert(group);
            return alert ? <span key={group.id} id={`project-group-alert-${group.id}`}>Atenção: {alert.description}</span> : null;
          })}
          {shownGroup?.tabs.map((tab) => {
            const alert = alertOf(tab);
            return alert ? <span key={tab.id} id={`project-tab-alert-${tab.id}`}>Atenção: {alert.description}</span> : null;
          })}
        </div>
      </nav>
    </div>
  );
}
