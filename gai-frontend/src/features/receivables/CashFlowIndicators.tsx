import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MoneyInput } from "@/components/base/Inputs";
import { FormField } from "@/components/base/FormField";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/features/auth/usePermissions";
import { retroactiveSettingsUrl } from "@/features/finance-settings/financeSettingsApi";
import { formatMoney } from "@/utils/format";
import {
  indicatorsApi,
  indicatorsKeys,
  monthBr,
  parseBrMoney,
  type BoardQuery,
  type CashFlowIndicatorValues,
  type SaleSimulationInput,
} from "./cashFlowBoardApi";

const pct = (v: string | null) => (v === null ? "—" : `${v.replace(".", ",")}%`);
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

/** Indicadores do fluxo de caixa e simulação de venda (doc 06 §7.4, etapa 8). */
export function CashFlowIndicators({ query }: { query: BoardQuery }) {
  const { hasPermission } = usePermissions();
  const [sim, setSim] = useState<SaleSimulationInput | null>(null);
  const indicators = useQuery({ queryKey: indicatorsKeys.get(query, sim), queryFn: () => indicatorsApi.get(query, sim), placeholderData: keepPreviousData });
  if (indicators.isLoading) return <LoadingState />;
  if (indicators.isError && sim)
    return (
      <section aria-label="Indicadores gerenciais" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 p-3 text-sm">
        <p role="alert" className="text-destructive">Simulação não calculada: {(indicators.error as Error).message}</p>
        <Button type="button" variant="ghost" onClick={() => setSim(null)}>Limpar simulação</Button>
      </section>
    );
  if (indicators.isError || !indicators.data) return <ErrorState message="Não foi possível carregar os indicadores." onRetry={() => void indicators.refetch()} />;
  const data = indicators.data;
  if (!data.configured)
    return (
      <section aria-label="Indicadores gerenciais" className="rounded-lg border p-3 text-sm">
        Indicadores indisponíveis: não há parâmetros financeiros vigentes em {data.as_of.split("-").reverse().join("/")}.{" "}
        <Link className="font-semibold underline" to="/app/finance/parameters">Ver parâmetros</Link>
      </section>
    );
  const o = data.indicators;
  const s = data.simulation?.indicators;
  const pick = (f: (i: CashFlowIndicatorValues) => string | null, fmt: (v: string | null) => string) =>
    ({ value: fmt(f(o)), ...(s ? { simulated: fmt(f(s)) } : {}) });
  const delta = data.simulation?.delta;
  const sk = data.simulation?.kpis;
  const mc = o.contribution_margin;

  return (
    <section aria-label="Indicadores gerenciais" className="grid gap-3">
      <h2 className="text-base font-semibold">Indicadores gerenciais {data.reference.year}</h2>
      {hasPermission("cash-flow:simulate") ? (
        <SimulationForm referenceMonth={data.reference.month} active={sim} onSimulate={setSim} />
      ) : null}
      {data.simulation ? (
        <p role="status" className="rounded-md border border-primary/50 bg-primary/5 p-3 text-sm">
          Simulação (não gravada): venda de {formatMoney(data.simulation.input.value)} em {monthBr(data.simulation.input.signal_month)},{" "}
          {monthBr(data.simulation.input.second_month)} e {monthBr(data.simulation.input.third_month)} (50/30/20)
          {data.simulation.input.company_expenses ? ", com despesas por conta da empresa" : ""}. Os cards mostram o valor com a venda; o
          valor riscado é o atual.
        </p>
      ) : null}
      {o.window.missing_tax.count ? (
        <p role="status" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          Margem de contribuição incompleta: {o.window.missing_tax.count} entrada(s) da janela ({formatMoney(o.window.missing_tax.amount)}) sem IR, por falta de
          parâmetro vigente na data.{" "}
          <Link className="font-semibold underline" to={retroactiveSettingsUrl(o.window.missing_tax.since!)}>
            Publicar versão dos parâmetros desde {o.window.missing_tax.since!.split("-").reverse().join("/")}
          </Link>
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {sk ? (
          <>
            <IndicatorCard label={`Total previsto ${monthBr(data.kpis.month.reference)}`} value={formatMoney(data.kpis.month.total)} simulated={formatMoney(sk.month.total)} delta={delta ? formatMoney(delta.month_total) : null} />
            <IndicatorCard label={`Total previsto ${monthBr(data.kpis.next_month.reference)}`} value={formatMoney(data.kpis.next_month.total)} simulated={formatMoney(sk.next_month.total)} delta={delta ? formatMoney(delta.next_month_total) : null} />
            <IndicatorCard label={`Total do ano ${data.kpis.year.reference}`} value={formatMoney(data.kpis.year.total)} simulated={formatMoney(sk.year.total)} delta={delta ? formatMoney(delta.year_total) : null} />
          </>
        ) : null}
        <IndicatorCard
          label="Resultado projetado do ano"
          {...pick((i) => i.projected_result, money)}
          delta={delta ? formatMoney(delta.projected_result) : null}
          hint="fluxo do ano − custo fixo × 12 − comissão do sócio"
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
        <IndicatorCard label="Prazo médio de recebimento" value={o.average_collection_days === null ? "—" : `${o.average_collection_days.replace(".", ",")} dias`} hint={`do contrato ao recebimento, desde ${o.collection_since.split("-").reverse().join("/")}`} />
        <IndicatorCard label={`Comissão do sócio (${pct(o.partner_commission.pct)})`} {...pick((i) => i.partner_commission.year, money)} hint="por trimestre, só sobre resultado positivo" />
      </div>

      <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Como foi calculado</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-semibold">
              Margem de contribuição ({monthBr(o.window.from)} a {monthBr(o.window.to)}, receita {formatMoney(o.window.revenue)})
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
                    <td className="text-right tabular-nums">{i.available ? formatMoney(i.amount) : <span className="text-warning">indisponível (média DRE)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="font-semibold">Resultado operacional por trimestre</p>
            <table className="mt-1 w-full text-sm">
              <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Trimestre</th><th className="text-right font-normal">Operacional</th><th className="text-right font-normal">Sócio</th></tr></thead>
              <tbody>
                {o.partner_commission.operating_by_quarter.map((v, i) => (
                  <tr key={i}><td>{i + 1}º</td><td className="text-right tabular-nums">{formatMoney(v)}</td><td className="text-right tabular-nums">{formatMoney(o.partner_commission.quarters[i])}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="font-semibold">Enquanto a DRE (etapa 9) não existe</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {o.depends_on_dre.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        </div>
      </details>
    </section>
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
    <form className="flex flex-wrap items-end gap-2 rounded-lg border p-3" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Simular venda">
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
