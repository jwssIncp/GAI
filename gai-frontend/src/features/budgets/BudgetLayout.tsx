import { ProjectContextLink } from "@/features/projects/ProjectContextLink";
import { navigationHref } from "@/features/projects/navigationContext";
import { NavLink, Outlet, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
export function BudgetLayout() {
  const [params] = useSearchParams();
  return (
    <PageContainer>
      <PageHeader
        title="Orçamentos"
        description="Dimensionamento, precificação e propostas com memória de cálculo."
      />
      <ProjectContextLink />
      <nav
        className="section-navigation"
        aria-label="Navegação de orçamentos"
      >
        <NavLink
          className={({ isActive }) =>
            isActive ? "font-semibold text-primary" : "text-muted-foreground"
          }
          to={navigationHref("/app/budgets", params)}
          end
        >
          Orçamentos
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            isActive ? "font-semibold text-primary" : "text-muted-foreground"
          }
          to={navigationHref("/app/budgets/pricing", params)}
        >
          Parâmetros de preços
        </NavLink>
      </nav>
      <Outlet />
    </PageContainer>
  );
}
