import { Outlet, useLocation } from "react-router-dom";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { ProjectContextLink } from "@/features/projects/ProjectContextLink";

/** Título e descrição de cada tela do módulo Financeiro (a navegação é pelo menu lateral). */
const PAGES: Record<string, [title: string, description: string]> = {
  receivables: ["Recebíveis", "Parcelas a receber, recebimentos e estornos com histórico."],
  "cash-flow": ["Fluxo de caixa", "Movimentos conhecidos e obrigações abertas. Resultado do período não é saldo bancário."],
  dre: ["DRE Gerencial", "Resultado por competência explícita, com cobertura das fontes e histórico. Não é DRE contábil oficial."],
  remuneration: ["Remuneração", "Remuneração dos técnicos por projeto."],
  "field-agent-payments": [
    "Pagamento de inventariantes",
    "Diárias de todos os projetos: em aberto, atrasadas e pagas. A baixa é gravada nos próprios lançamentos.",
  ],
  expenses: [
    "Despesas",
    "Despesas por projeto: a reembolsar, reembolsáveis e não reembolsáveis, com o financeiro concluído ou não.",
  ],
  "asset-tags": [
    "Placas de patrimônio",
    "Compra de plaquetas do fornecedor e revenda ao cliente: custo, valor, líquido de impostos e lucro.",
  ],
  commissions: ["Comissões", "Comissões comerciais por contrato e parceiro: calculadas ou informadas, pagas, pendentes e atrasadas."],
  parameters: [
    "Parâmetros financeiros",
    "Valores usados nos cálculos financeiros da organização: impostos, comissões, diária padrão, custos fixos, listas e limites de anexo. Nenhum cálculo usa valor fixo no sistema: sem versão vigente, as telas que dependem destes parâmetros pedem a configuração.",
  ],
};

function financePage(pathname: string): [string, string] {
  const section = pathname.split("/app/finance/")[1]?.split("/")[0] ?? "";
  return PAGES[section] ?? ["Financeiro", "Recebíveis, caixa e resultado gerencial por competência."];
}

export function FinanceLayout() {
  const [title, description] = financePage(useLocation().pathname);
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <ProjectContextLink />
      <Outlet />
    </PageContainer>
  );
}
