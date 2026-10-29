import { DataTable } from "@/components/base/DataTable";
import { MetricCard } from "@/components/base/Cards";
import {
  budgetDate,
  budgetMoney,
  pricingMoney,
  pricingNumbers,
  pricingRates,
  type Payment,
  type Snapshot,
} from "./budgetApi";
export function PaymentMemory({
  payment,
  currency,
}: {
  payment: Payment;
  currency: string;
}) {
  return (
    <section className="grid gap-4">
      <h2 className="font-semibold">Condições de pagamento</h2>
      <p className="text-sm">
        Entrada: {budgetMoney(payment.entry, currency)} · saldo parcelado:{" "}
        {budgetMoney(payment.financed_balance, currency)} · saldo restante:{" "}
        {budgetMoney(payment.remaining_balance, currency)}
      </p>
      <DataTable
        items={payment.rows}
        getKey={(r) => r.position}
        columns={[
          {
            header: "Parcela",
            cell: (r) => (r.kind === "entry" ? "Entrada" : r.position),
          },
          { header: "Data prevista", cell: (r) => budgetDate(r.due_on) },
          { header: "Percentual efetivo", cell: (r) => `${r.percentage}%` },
          { header: "Valor", cell: (r) => budgetMoney(r.amount, currency) },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        O último valor absorve os centavos residuais. Percentuais efetivos são
        apresentados com quatro casas e fecham 100%. Datas preservam o último
        dia do mês. Este plano não gera recebíveis.
      </p>
    </section>
  );
}
export function BudgetMemory({ snapshot: s }: { snapshot: Snapshot }) {
  const c = s.calculation,
    p = s.pricing,
    money = (v: string) => budgetMoney(v, c.currency);
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Preço final"
          value={money(c.final_price)}
          tone="brand"
        />
        <MetricCard label="Custo estimado" value={money(c.cost_total)} />
        <MetricCard
          label="Equipe e campo"
          value={`${c.sizing.team} pessoas · ${c.sizing.field_days} dias`}
        />
        <MetricCard
          label="Resultado após custos, impostos e comissão"
          value={money(c.margin_amount)}
        />
      </div>
      <section className="premium-panel grid gap-2 p-5 text-sm">
        <h2 className="font-semibold">Entradas e dimensionamento</h2>
        <p>
          {c.inputs.assets} bens · {c.inputs.address_count} endereços ·
          produtividade {c.inputs.productivity} · fator{" "}
          {c.inputs.address_factor} · {c.inputs.available_days} dias
          disponíveis.
        </p>
        <p>
          Esforço: {c.sizing.effort_assets} pessoas-dia por bens e{" "}
          {c.sizing.effort_addresses} por endereços; adotado{" "}
          {c.sizing.person_days}. Equipe necessária: {c.sizing.required_team};
          adotada: {c.sizing.team}.
        </p>
        <p>
          Permanência: {c.sizing.stay_days} dias ({c.sizing.extra_days} extras);
          quartos: {c.sizing.rooms}.
        </p>
        <p>
          Restrições operacionais:{" "}
          {s.input.operational_constraints || "Nenhuma informada"}
        </p>
        <p>Responsável: {s.context.responsible.login}</p>
        {c.manual_adjustments ? (
          <p className="rounded border border-warning/30 p-3">
            Ajustes manuais autorizados: {c.manual_adjustments.reason}. Equipe{" "}
            {c.manual_adjustments.team ?? "configurada"}, dias{" "}
            {c.manual_adjustments.available_days ?? "configurados"},
            produtividade {c.manual_adjustments.productivity ?? "configurada"},
            margem {c.manual_adjustments.margin_pct ?? "configurada"}, acréscimo{" "}
            {c.manual_adjustments.operational_extra ?? "0.00"}, preço manual{" "}
            {c.manual_adjustments.final_price ?? "não utilizado"}.
          </p>
        ) : null}
      </section>
      <h2 className="font-semibold">Memória de custos</h2>
      <DataTable
        items={c.lines}
        getKey={(l) => l.key}
        columns={[
          { header: "Componente", cell: (l) => l.label },
          { header: "Quantidade", cell: (l) => l.quantity },
          { header: "Valor unitário", cell: (l) => money(l.unit_value) },
          { header: "Subtotal", cell: (l) => money(l.subtotal) },
          { header: "Fórmula", cell: (l) => l.formula },
        ]}
      />
      <section className="premium-panel grid gap-2 p-5 text-sm">
        <h2 className="font-semibold">Composição do preço</h2>
        <p>
          Impostos declarados {c.rates.tax_pct}%: {money(c.tax_amount)} ·
          comissão {c.rates.commission_pct}%: {money(c.commission_amount)} ·
          margem alvo {c.rates.margin_pct}%.
        </p>
        <p>
          Preço por gross-up: {money(c.gross_up_price)} · piso:{" "}
          {money(c.minimum_price)} · sugerido: {money(c.suggested_price)} ·
          final: {money(c.final_price)}.
        </p>
        <p>
          As taxas são premissas comerciais declaradas, sem enquadramento
          tributário automático. O resultado residual inclui eventual efeito do
          piso ou ajuste manual.
        </p>
      </section>
      <details className="premium-panel p-5">
        <summary className="cursor-pointer font-semibold">
          Fórmulas e parâmetros utilizados
        </summary>
        <div className="mt-4 grid gap-3 text-sm">
          <p>
            {p.name} · versão {p.version} · vigência {budgetDate(p.valid_from)}{" "}
            a {budgetDate(p.valid_to)}.
          </p>
          <p>Método: {c.engine_version}</p>
          {Object.values(c.formulas).map((v) => (
            <p key={v}>{v}</p>
          ))}
          {pricingNumbers.map(([key, label]) => (
            <p key={key}>
              {label}: {p.values[key]}
            </p>
          ))}
          {pricingMoney.map(([key, label]) => (
            <p key={key}>
              {label}: {money(p.values[key])}
            </p>
          ))}
          {pricingRates.map(([key, label]) => (
            <p key={key}>
              {label}: {p.values[key]}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}
