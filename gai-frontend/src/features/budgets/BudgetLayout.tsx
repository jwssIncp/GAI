import { ProjectContextLink } from "@/features/projects/ProjectContextLink";
import { Outlet } from "react-router-dom";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { Tabs } from "@/components/base/Tabs";
export function BudgetLayout() {
  return (
    <PageContainer>
      <PageHeader
        title="Orçamentos"
        description="Dimensionamento, precificação e propostas com memória de cálculo."
      />
      <ProjectContextLink />
      <Tabs
        label="Navegação de orçamentos"
        tabs={[
          { label: "Orçamentos", to: "/app/budgets", end: true },
          { label: "Parâmetros de preços", to: "/app/budgets/pricing" },
        ]}
      />
      <Outlet />
    </PageContainer>
  );
}
