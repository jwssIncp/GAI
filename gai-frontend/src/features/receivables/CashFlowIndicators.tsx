import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MoneyInput } from "@/components/base/Inputs";
import { FormField } from "@/components/base/FormField";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/features/auth/usePermissions";
import { formatMoney } from "@/utils/format";
import { percent } from "./financeApi";
import {
  monthBr,
  parseBrMoney,
  type BoardQuery,
  type CashFlowIndicators as IndicatorsData,
  type CashFlowIndicatorValues,
  type SaleSimulationInput,
} from "./cashFlowBoardApi";
import { useCashFlowIndicators } from "./useCashFlowIndicators";
import { useViewPreference } from "./useViewPreference";

const pct = (v: string | null) => percent(v);
const money = (v: string | null) => (v === null ? "—" : formatMoney(v));
const addMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

type Card = { label: string; value: string; simulated?: string; delta?: string | null; hint?: string };

function IndicatorCard({ label, value, simulated, delta, hint }: Card) {
  const shown = simulated ?? value;
  const changed = simulated !== undefined && simulated !== value;
  return (
    <div className={`rounded-lg border bg-card p-3 ${changed ? "border-primary/60" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${shown.startsWith("-") ? "text-destructive" : ""}`}>{shown}</p>
      {changed ? (
        <p className="text-xs text-muted-foreground">
          sem a venda: <s>{value}</s>
          {delta ? <> · variação {delta}</> : null}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type IndicatorsQuery = UseQueryResult<IndicatorsData>;

/** Barra "Simular venda" (acima dos cards, recolhível; preferência lembrada). Nada é gravado. */
export function SimulationBar({
  indicators,
  referenceMonth,
  sim,
  onSimulate,
}: {
  indicators: IndicatorsQuery;
  referenceMonth: string;
  sim: SaleSimulationInput | null;
  onSimulate: (s: SaleSimulationInput | null) => void;
}) {
  const { hasPermission } = usePermissions();
  const [collapsed, setCollapsed] = useViewPreference("cash-flow.simulation.collapsed", false);
  if (!hasPermission("cash-flow:simulate")) return null;
  const data = indicators.data?.configured ? indicators.data : null;
  const simulation = data?.simulation ?? null;
  return (
    <section aria-label="Simulação de venda" className="rounded-lg border border-dashed border-primary/50 bg-primary/[0.03] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary-text">Simular venda</h2>
        {sim ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">simulação ativa</span> : null}
        <span className="text-xs text-muted-foreground">50% sinal · 30% 2ª parcela · 20% 3ª parcela · só na tela, não grava</span>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "Mostrar" : "Ocultar"}
        </Button>
      </div>
      {collapsed ? null : (
        <div className="mt-2 grid gap-2">
          <SimulationForm key={referenceMonth} referenceMonth={referenceMonth} active={sim} onSimulate={onSimulate} />
          {indicators.isError && sim ? (
            <p role="alert" className="text-sm text-destructive">
              Simulação não calculada: {(indicators.error as Error).message}
            </p>
          ) : null}
          {simulation ? (
            <p role="status" className="rounded-md border border-primary/50 bg-primary/5 p-3 text-sm">
              Simulação (não gravada): venda de {formatMoney(simulation.input.value)} em {monthBr(simulation.input.signal_month)},{" "}
              {monthBr(simulation.input.second_month)} e {monthBr(simulation.input.third_month)} (50/30/20)
              {simulation.input.company_expenses ? ", com despesas por conta da empresa" : ""}. Os cards mostram o valor com a venda; o valor
              riscado é o atual.
              <span className="block text-xs text-muted-foreground">
                Cada parcela desconta IR, inventariantes ({pct(simulation.basis.field_agents_pct)})
                {simulation.input.company_expenses ? <> e despesas não reembolsáveis ({pct(simulation.basis.non_reimbursable_pct)})</> : null} pelos % dos 12
                meses anteriores. No ano: {formatMoney(simulation.basis.year_sale)} × MC {pct(simulation.basis.mc)}
                {simulation.input.company_expenses ? "" : ` + parte do cliente ${formatMoney(simulation.basis.client_share)}`} ={" "}
                {formatMoney(simulation.basis.sale_result)}.
              </span>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** Indicadores gerenciais (logo abaixo dos cards, recolhíveis; preferência lembrada). */
export function IndicatorsPanel({ indicators, simulating = false }: { indicators: IndicatorsQuery; simulating?: boolean }) {
  const [collapsed, setCollapsed] = useViewPreference("cash-flow.indicators.collapsed", false);
  if (indicators.isLoading) return <LoadingState />;
  // Simulação recusada: o motivo aparece na barra da simulação, não aqui.
  if (indicators.isError && !indicators.data && simulating) return null;
  if (indicators.isError && !indicators.data) return <ErrorState message="Não foi possível carregar os indicadores." onRetry={() => void indicators.refetch()} />;
  if (!indicators.data) return null;
  const data = indicators.data;
  if (!data.configured)
    return (
      <section aria-label="Indicadores gerenciais" className="rounded-lg border p-3 text-sm">
        Indicadores indisponíveis: não há parâmetros financeiros vigentes em {data.as_of.split("-").reverse().join("/")}.{" "}
        <Link className="font-semibold underline" to="/app/finance/parameters">
          Ver parâmetros
        </Link>
      </section>
    );
  const o = data.indicators;
  const s = data.simulation?.indicators;
  const pick = (f: (i: CashFlowIndicatorValues) => string | null, fmt: (v: string | null) => string) => ({ value: fmt(f(o)), ...(s ? { simulated: fmt(f(s)) } : {}) });
  const delta = data.simulation?.delta;
  const mc = o.contribution_margin;

  return (
    <section aria-label="Indicadores gerenciais" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Indicadores gerenciais {data.reference.year}</h2>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "Mostrar" : "Ocultar"}
        </Button>
      </div>
      {collapsed ? null : (
        <>
          {o.window.months_with_revenue === 0 || o.window.missing_accounts.length ? (
            <p role="status" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
              {o.window.months_with_revenue === 0
                ? "Sem receita na DRE nos 12 meses anteriores: margem de contribuição e pontos de equilíbrio indefinidos. "
                : "Margem de contribuição sem alguma conta associada na DRE (o % fica zero). "}
              <Link className="font-semibold underline" to="/app/finance/dre">
                Abrir a DRE mensal
              </Link>
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <IndicatorCard
              label="Resultado projetado do ano"
              {...pick((i) => i.projected_result, money)}
              delta={delta ? formatMoney(delta.projected_result) : null}
              hint={`resultado final da DRE jan–dez (${o.dre.estimates} estimativa(s))`}
            />
            <IndicatorCard
              label="Ponto de equilíbrio contábil"
              {...pick((i) => i.accounting_break_even, (v) => (v === null ? "Indefinido" : v === "0.00" ? "Atingido" : formatMoney(v)))}
              hint="receita que falta para resultado zero"
            />
            <IndicatorCard
              label="Ponto de equilíbrio econômico"
              {...pick((i) => i.economic_break_even, (v) => (v === null ? "Indefinido" : v === "0.00" ? "Atingido" : formatMoney(v)))}
              hint={`receita que falta para margem de ${pct(o.economic_margin_pct)}`}
            />
            <IndicatorCard label="Margem de contribuição" {...pick((i) => i.contribution_margin?.mc ?? null, pct)} hint={`MCe (sem não reembolsáveis): ${pct(mc?.mce ?? null)}`} />
            <IndicatorCard label="Margem líquida" {...pick((i) => i.net_margin, pct)} hint="resultado projetado ÷ receita do ano" />
            <IndicatorCard
              label="Prazo médio de recebimento"
              value={o.average_collection_days === null ? "—" : `${o.average_collection_days.replace(".", ",")} dias`}
              hint={`do contrato ao recebimento, desde ${o.collection_since.split("-").reverse().join("/")}`}
            />
            <IndicatorCard label={`Comissão do sócio (${pct(o.partner_commission.pct)})`} {...pick((i) => i.partner_commission.year, money)} hint="por trimestre, só sobre resultado positivo" />
          </div>

          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Como foi calculado</summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-semibold">
                  Margem de contribuição ({monthBr(o.window.from)} a {monthBr(o.window.to)}, receita {formatMoney(o.window.revenue)}
                  {o.window.taxed_revenue && o.window.taxed_revenue !== o.window.revenue ? `; IR sobre o faturamento de ${formatMoney(o.window.taxed_revenue)}` : ""})
                </p>
                {mc ? (
                  <table className="mt-1 w-full text-sm">
                    <tbody>
                      <tr><td>Imposto de renda</td><td className="text-right tabular-nums">{pct(mc.income_tax_pct)}</td></tr>
                      <tr><td>Inventariantes</td><td className="text-right tabular-nums">{pct(mc.field_agents_pct)}</td></tr>
                      <tr><td>Despesas não reembolsáveis</td><td className="text-right tabular-nums">{pct(mc.non_reimbursable_pct)}</td></tr>
                      <tr><td>Comissões</td><td className="text-right tabular-nums">{pct(mc.commission_pct)}</td></tr>
                      <tr><td>Sócio (efetivo, após IR)</td><td className="text-right tabular-nums">{pct(mc.partner_effective_pct)}</td></tr>
                      <tr className="font-semibold"><td>Margem de contribuição</td><td className="text-right tabular-nums">{pct(mc.mc)}</td></tr>
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted-foreground">Sem receita recebida na janela: margem e pontos de equilíbrio indefinidos.</p>
                )}
              </div>
              <div>
                <p className="font-semibold">Custo fixo mensal: {formatMoney(o.fixed_cost.total)} (ano {formatMoney(o.fixed_cost.year)})</p>
                <table className="mt-1 w-full text-sm">
                  <tbody>
                    {o.fixed_cost.items.map((i) => (
                      <tr key={i.key}>
                        <td>{i.label}</td>
                        <td className="text-right tabular-nums">{i.available ? formatMoney(i.amount) : <span className="text-warning">sem conta na DRE</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="font-semibold">Resultado operacional por trimestre</p>
                <table className="mt-1 w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground"><th className="text-left font-normal">Trimestre</th><th className="text-right font-normal">Operacional</th><th className="text-right font-normal">Sócio</th></tr>
                  </thead>
                  <tbody>
                    {o.partner_commission.operating_by_quarter.map((v, i) => (
                      <tr key={i}><td>{i + 1}º</td><td className="text-right tabular-nums">{formatMoney(v)}</td><td className="text-right tabular-nums">{formatMoney(o.partner_commission.quarters[i])}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="font-semibold">Base: DRE mensal {o.dre.year}</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {o.notes.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

/** Simulação + indicadores juntos (a página usa as duas partes separadas, em volta dos cards). */
export function CashFlowIndicators({ query }: { query: BoardQuery }) {
  const [sim, setSim] = useState<SaleSimulationInput | null>(null);
  const indicators = useCashFlowIndicators(query, sim);
  // Último mês de referência conhecido (a simulação recusada não tem dados, mas o formulário fica).
  const [reference, setReference] = useState<string | null>(null);
  if (indicators.data && indicators.data.reference.month !== reference) setReference(indicators.data.reference.month);
  return (
    <>
      {reference ? <SimulationBar indicators={indicators} referenceMonth={reference} sim={sim} onSimulate={setSim} /> : null}
      <IndicatorsPanel indicators={indicators} simulating={Boolean(sim)} />
    </>
  );
}

function SimulationForm({ referenceMonth, active, onSimulate }: { referenceMonth: string; active: SaleSimulationInput | null; onSimulate: (s: SaleSimulationInput | null) => void }) {
  const [value, setValue] = useState("");
  const [signal, setSignal] = useState(referenceMonth);
  const [second, setSecond] = useState(addMonth(referenceMonth, 1));
  const [third, setThird] = useState(addMonth(referenceMonth, 2));
  const [companyExpenses, setCompanyExpenses] = useState(false);
  const [error, setError] = useState("");
  const submit = () => {
    const v = parseBrMoney(value);
    if (!v) return setError("Informe o valor da venda (ex.: 10.000,00).");
    if (!(signal <= second && second <= third)) return setError("Os meses das parcelas devem estar em ordem.");
    setError("");
    onSimulate({ value: v, signal_month: signal, second_month: second, third_month: third, company_expenses: companyExpenses });
  };
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Simular venda">
      <FormField label="Valor da venda">
        <MoneyInput className="w-36" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Valor da venda" />
      </FormField>
      <FormField label="Sinal (50%)">
        <input type="month" aria-label="Mês do sinal" className="h-10 rounded-md border bg-background px-2 text-sm" value={signal} onChange={(e) => { setSignal(e.target.value); setSecond(addMonth(e.target.value, 1)); setThird(addMonth(e.target.value, 2)); }} />
      </FormField>
      <FormField label="2ª parcela (30%)">
        <input type="month" aria-label="Mês da 2ª parcela" className="h-10 rounded-md border bg-background px-2 text-sm" value={second} onChange={(e) => setSecond(e.target.value)} />
      </FormField>
      <FormField label="3ª parcela (20%)">
        <input type="month" aria-label="Mês da 3ª parcela" className="h-10 rounded-md border bg-background px-2 text-sm" value={third} onChange={(e) => setThird(e.target.value)} />
      </FormField>
      <label className="flex h-10 items-center gap-2 text-sm">
        <input type="checkbox" checked={companyExpenses} onChange={(e) => setCompanyExpenses(e.target.checked)} />
        Despesas por conta da empresa
      </label>
      <Button type="submit">Simular</Button>
      {active ? <Button type="button" variant="ghost" onClick={() => onSimulate(null)}>Limpar simulação</Button> : null}
      {error ? <p role="alert" className="w-full text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
