import { navigationHref } from "@/features/projects/navigationContext";
import { NavLink, Outlet, useParams , useSearchParams } from "react-router-dom";
import { usePermissions } from "@/features/auth/usePermissions";
import { PageContainer } from "@/components/base/PageContainer";
export function ReportsLayout() {
  const [navigationParams] = useSearchParams();
  const { projectId } = useParams(),
    { hasPermission } = usePermissions(),
    root = `/app/projects/${projectId}/technical-reports`;
  return (
    <PageContainer>
      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            Laudos técnicos patrimoniais
          </h2>
          <p className="text-sm text-muted-foreground">
            Documentos com fontes rastreáveis, revisão e aprovação interna. Sem
            atribuição automática de habilitação ou assinatura técnica.
          </p>
        </div>
        <nav
          aria-label="Navegação dos laudos"
          className="section-navigation"
        >
          <NavLink end to={navigationHref(root, navigationParams)}>
            Laudos do projeto
          </NavLink>
          <NavLink to={navigationHref(root + "/templates", navigationParams)}>Modelos da organização</NavLink>
          {hasPermission("technical-reports:templates") && (
            <NavLink to={navigationHref(root + "/responsibles", navigationParams)}>
              Responsáveis cadastrados
            </NavLink>
          )}
        </nav>
        <Outlet />
      </section>
    </PageContainer>
  );
}
