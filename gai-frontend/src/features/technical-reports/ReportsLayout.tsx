import { Outlet, useLocation, useParams } from "react-router-dom";
import { usePermissions } from "@/features/auth/usePermissions";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { Tabs } from "@/components/base/Tabs";

const TABS = {
  "": "Laudos do projeto",
  templates: "Modelos da organização",
  responsibles: "Responsáveis cadastrados",
} as const;

/** Título (h1) da tela de laudos: o nome da aba; no detalhe de um laudo, "Laudo técnico". */
function reportsTitle(pathname: string, root: string): string {
  const part = pathname.slice(root.length).split("/")[1] ?? "";
  if (part in TABS) return TABS[part as keyof typeof TABS];
  return "Laudo técnico";
}

export function ReportsLayout() {
  const { pathname } = useLocation();
  const { projectId } = useParams(),
    { hasPermission } = usePermissions(),
    root = `/app/projects/${projectId}/technical-reports`;
  return (
    <PageContainer>
      <PageHeader
        title={reportsTitle(pathname, root)}
        description="Laudos técnicos patrimoniais: documentos com fontes rastreáveis, revisão e aprovação interna. Sem atribuição automática de habilitação ou assinatura técnica."
      />
      <section className="grid gap-4">
        <Tabs
          label="Navegação dos laudos"
          tabs={[
            { label: TABS[""], to: root, end: true },
            { label: TABS.templates, to: root + "/templates" },
            ...(hasPermission("technical-reports:templates") ? [{ label: TABS.responsibles, to: root + "/responsibles" }] : []),
          ]}
        />
        <Outlet />
      </section>
    </PageContainer>
  );
}
