import { dashboardReturn, navigationHref } from "./navigationContext";
import { activeProjectTabId, groupOfTab, projectTabGroups, type ProjectTab } from "./projectNavigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
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
  const { canAccess } = usePermissions();
  const groupStrip = useRef<HTMLDivElement>(null);
  const tabStrip = useRef<HTMLDivElement>(null);
  const root = `/app/projects/${projectId}/`;
  const href = (tab: ProjectTab) => navigationHref(tab.path.startsWith("/") ? tab.path : root + tab.path, location.search);

  const groups = projectTabGroups(projectId)
    .map((group) => ({ ...group, tabs: group.tabs.filter((tab) => canAccess(tab.permissions)) }))
    .filter((group) => group.tabs.length > 0);
  const activeTabId = activeProjectTabId(projectId, location.pathname, location.hash);
  const activeGroup = groupOfTab(groups, activeTabId);
  // Grupo cuja primeira aba visível sai do workspace (↗): o clique só o seleciona e mostra
  // suas abas, sem navegar. A seleção vale apenas para a localização atual.
  const locationKey = location.pathname + location.search + location.hash;
  const [selection, setSelection] = useState<{ groupId: string; at: string } | null>(null);
  const selectedGroup = selection && selection.at === locationKey ? groups.find((group) => group.id === selection.groupId) ?? null : null;
  const shownGroup = selectedGroup ?? activeGroup;

  useEffect(() => {
    scrollIntoStrip(groupStrip.current);
    scrollIntoStrip(tabStrip.current);
  }, [location.pathname, location.search, location.hash, shownGroup?.id]);

  return (
    <div className="sticky top-[76px] z-20 mx-auto w-full max-w-[1560px] px-4 pt-4 sm:px-6 lg:px-8 xl:px-10">
      <nav
        className="grid gap-1 rounded-xl border border-border bg-card p-1.5 shadow-panel"
        aria-label="Abas do projeto"
      >
        <div ref={groupStrip} role="group" aria-label="Grupos do projeto" className="flex gap-1.5 overflow-x-auto">
          {groups.map((group) => {
            const active = group.id === activeGroup?.id;
            const shown = group.id === shownGroup?.id;
            const className = cn(
              "inline-flex min-h-10 shrink-0 items-center rounded-lg px-3.5 text-sm font-semibold transition",
              shown
                ? "bg-primary-subtle text-primary-text shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
                >
                  {group.label}
                </button>
              );
            }
            return (
              <Link
                key={group.id}
                to={href(group.tabs[0])}
                aria-current={active ? "true" : undefined}
                className={className}
              >
                {group.label}
              </Link>
            );
          })}
        </div>
        {shownGroup ? (
          <div
            ref={tabStrip}
            id="project-group-tabs"
            role="group"
            aria-label={`Abas de ${shownGroup.label}`}
            className="flex gap-1 overflow-x-auto border-t border-border px-0.5 pt-1"
          >
            {shownGroup.tabs.map((tab) => {
              const active = tab.id === activeTabId;
              return (
                <Link
                  key={tab.id}
                  to={href(tab)}
                  title={tab.hint}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-medium transition",
                    active
                      ? "font-semibold text-primary-text after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {tab.external ? <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" className="opacity-70" /> : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
