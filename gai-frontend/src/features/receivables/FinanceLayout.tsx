import { ProjectContextLink } from "@/features/projects/ProjectContextLink";
import { navigationHref } from "@/features/projects/navigationContext";
import { NavLink, Outlet, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { usePermissions } from "@/features/auth/usePermissions";
export function FinanceLayout() {
  const { hasPermission } = usePermissions(),
    [p] = useSearchParams();

  return (
    <PageContainer>
      <PageHeader
        title="Gestão financeira"
        description="Recebíveis, caixa e resultado gerencial por competência."
      />
      <ProjectContextLink />
      <nav
        aria-label="Navegação financeira"
        className="section-navigation"
      >
        {[
          ["Recebíveis", "/app/finance/receivables", "receivables:read"],
          ["Fluxo de caixa", "/app/finance/cash-flow", "cash-flow:read"],
          ["DRE Gerencial", "/app/finance/dre", "dre:read"],
        ]
          .filter((t) => hasPermission(t[2]))
          .map(([label, path]) => (
            <NavLink
              key={path}
              to={navigationHref(path, p)}
              className={({ isActive }) =>
                isActive
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }
            >
              {label}
            </NavLink>
          ))}
      </nav>
      <Outlet />
    </PageContainer>
  );
}
