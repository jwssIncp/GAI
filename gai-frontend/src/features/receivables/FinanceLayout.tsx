import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Outlet, useLocation } from "react-router-dom";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { ProjectContextLink } from "@/features/projects/ProjectContextLink";
import { dreTabLabel } from "@/constants/dreTabs";

/**
 * Título (h1) e descrição de cada tela do módulo Financeiro (a navegação é pelo menu
 * lateral). O rótulo acima do título vem da seção do menu (PageHeader); na DRE, o h1
 * é o nome da aba aberta.
 */
const PAGES: Record<string, [title: string, description: string]> = {
  receivables: ["Recebíveis", "Parcelas a receber, recebimentos e estornos com histórico."],
  "cash-flow": ["Fluxo de caixa", "Movimentos conhecidos e obrigações abertas. Resultado do período não é saldo bancário."],
  dre: ["DRE gerencial", "Resultado por competência explícita, com cobertura das fontes e histórico. Não é DRE contábil oficial."],
  remuneration: ["Remuneração", "Remuneração dos inventariantes por projeto."],
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
  commissions: ["Comissões", "Comissões comerciais por projeto e parceiro: calculadas ou informadas, pagas, pendentes e em atraso."],
  parameters: [
    "Parâmetros financeiros",
    "Valores usados nos cálculos financeiros da organização: impostos, comissões, diária padrão, custos fixos, listas e limites de anexo. Nenhum cálculo usa valor fixo no sistema: sem versão vigente, as telas que dependem destes parâmetros pedem a configuração.",
  ],
};

function financePage(pathname: string): [string, string] {
  const section = pathname.split("/app/finance/")[1]?.split("/")[0] ?? "";
  if (section === "dre") return [dreTabLabel(pathname), PAGES.dre[1]];
  return PAGES[section] ?? ["Financeiro", "Recebíveis, caixa e resultado gerencial por competência."];
}

/**
 * Lugar das ações da tela no cabeçalho (PageHeader). `undefined` = fora do
 * FinanceLayout (a tela mostra as ações no próprio topo); `null` = o cabeçalho
 * ainda não montou.
 */
const HeaderActionsSlot = createContext<HTMLElement | null | undefined>(undefined);

/**
 * Ações da tela no cabeçalho do módulo, à direita do título: as secundárias
 * primeiro e a primária por último (ex.: exportar e depois "Novo recebível").
 */
export function FinanceHeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderActionsSlot);
  if (slot === undefined) return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
  return slot ? createPortal(children, slot) : null;
}

export function FinanceLayout() {
  const [title, description] = financePage(useLocation().pathname);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <PageContainer>
      <PageHeader title={title} description={description} action={<div ref={setSlot} className="flex flex-wrap items-center justify-end gap-2 empty:hidden" />} />
      <ProjectContextLink />
      <HeaderActionsSlot.Provider value={slot}>
        <Outlet />
      </HeaderActionsSlot.Provider>
    </PageContainer>
  );
}
