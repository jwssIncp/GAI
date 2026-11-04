import { dashboardReturn, navigationHref } from "./navigationContext";
import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { ErrorState } from "@/components/base/States";
import { PermissionGate } from "@/features/auth/PermissionGate";
import { cn } from "@/utils/cn";

type ProjectTab = {
  label: string;
  path: string;
  permissions: string[];
  hint?: string;
};

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

export function ProjectNavigation({ projectId }: { projectId: string }) {
  const location = useLocation();
  const navigation = useRef<HTMLElement>(null);
  const root = `/app/projects/${projectId}/`;
  const tabs: ProjectTab[] = [
    { label: "Visão geral", path: "summary", permissions: ["projects:read"] },
    { label: "Dashboard", path: "dashboard", permissions: ["projects:read"] },
    { label: "Orçamentos", path: `/app/budgets?project_id=${projectId}`, permissions: ["budgets:read"] },
    { label: "Contratos", path: "contracts", permissions: ["projects:read", "contracts:read"] },
    {
      label: "Preparação",
      path: "preparation/kickoff",
      permissions: ["project-preparation:read"],
    },
    {
      label: "Coordenação de Campo",
      path: "field-coordination",
      permissions: ["field-coordination:read"],
    },
    {
      label: "Itens",
      path: "inventory-items",
      permissions: ["inventory-items:read"],
    },
    {
      label: "Inventário",
      path: "inventory/sessions",
      permissions: ["inventory-sessions:read"],
    },
    {
      label: "Imagens",
      path: "inventory-items?view=images",
      permissions: ["inventory-items:read"],
      hint: "Imagens ficam no detalhe do item.",
    },
    {
      label: "Base contábil",
      path: "accounting-items",
      permissions: ["inventory-accounting-items:read"],
    },
    {
      label: "Pendências",
      path: "pending-issues",
      permissions: ["inventory-pending-issues:read"],
    },
    {
      label: "Inventariantes",
      path: "summary#inventariantes",
      permissions: ["projects:read", "project-field-agents:read"],
    },
    {
      label: "Financeiro",
      path: "finance",
      permissions: ["payments:read", "expenses:read"],
    },
    {label:'DRE Gerencial',path:`/app/finance/dre?project_id=${projectId}`,permissions:['dre:read']},
    {label:'Recebíveis',path:`/app/finance/receivables?project_id=${projectId}`,permissions:['receivables:read']},
    {label:'Fluxo de caixa',path:`/app/finance/cash-flow?project_id=${projectId}`,permissions:['cash-flow:read']},
    {label:"Laudos",path:"technical-reports",permissions:["technical-reports:read"]},
    {
      label: "Prestações",
      path: "finance/accountabilities",
      permissions: ["expense-accountabilities:read"],
    },
    {
      label: "Importações",
      path: "import-sessions",
      permissions: ["import-sessions:read"],
    },
    {
      label: "Exportações",
      path: "export-jobs",
      permissions: ["export-jobs:read"],
    },
    {
      label: "Unidades",
      path: "summary#unidades",
      permissions: ["projects:read", "project-units:read"],
    },
    {
      label: "Configurações",
      path: "summary#configuracoes",
      permissions: ["projects:read"],
    },
  ];
  useEffect(() => {
    const element = navigation.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    // Only scroll the horizontal tab strip, without moving the page or covering its content.
    if (element && navigation.current) {
      const strip = navigation.current;
      if (element.offsetLeft < strip.scrollLeft)
        strip.scrollLeft = element.offsetLeft;
      else if (
        element.offsetLeft + element.offsetWidth >
        strip.scrollLeft + strip.clientWidth
      ) {
        strip.scrollLeft =
          element.offsetLeft + element.offsetWidth - strip.clientWidth;
      }
    }
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="sticky top-[76px] z-20 mx-auto w-full max-w-[1560px] px-4 pt-4 sm:px-6 lg:px-8 xl:px-10">
      <nav
        ref={navigation}
        className="flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-panel"
        aria-label="Abas do projeto"
      >
        {tabs.map((tab) => {
          const target = navigationHref(tab.path.startsWith('/') ? tab.path : root + tab.path, location.search);
          const url = new URL(target, "http://project.local");
          const active = tab.path.startsWith("preparation/")
            ? location.pathname.startsWith(root + "preparation/")
            : tab.path === "technical-reports"
                ? location.pathname.startsWith(root + "technical-reports")
                : tab.path === "inventory/sessions"
              ? location.pathname.startsWith(root + "inventory/sessions")
              : location.pathname === url.pathname &&
                location.hash === url.hash &&
                (tab.path.startsWith("inventory-items")
                  ? new URLSearchParams(location.search).get("view") ===
                    url.searchParams.get("view")
                  : true);
          return (
            <PermissionGate key={tab.path} permissions={tab.permissions}>
              <Link
                to={target}
                title={tab.hint}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-xs font-semibold transition",
                  active
                    ? "bg-primary-subtle text-primary-text shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </PermissionGate>
          );
        })}
      </nav>
    </div>
  );
}
