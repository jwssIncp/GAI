import { DataTable } from "@/components/base/DataTable";
import { MetricCard } from "@/components/base/Cards";
import {
  budgetDate,
  budgetMoney,
  pricingLabel,
  pricingMoney,
  pricingNumbers,
  pricingRates,
  pricingValue,
  type Payment,
  type Snapshot,
} from "./budgetApi";
import { formatDecimal, formatInteger, formatPercent } from "@/utils/format";
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
          { header: "Percentual efetivo", cell: (r) => formatPercent(r.percentage, 4) },
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
          value={`${formatInteger(c.sizing.team)} pessoas · ${formatInteger(c.sizing.field_days)} dias`}
        />
        <MetricCard
          label="Resultado após custos, impostos e comissão"
          value={money(c.margin_amount)}
        />
      </div>
      <section className="premium-panel grid gap-2 p-5 text-sm">
        <h2 className="font-semibold">Entradas e dimensionamento</h2>
        <p>
          {formatInteger(c.inputs.assets)} bens ·{" "}
          {formatInteger(c.inputs.address_count)} endereços · produtividade{" "}
          {formatInteger(c.inputs.productivity)} · fator{" "}
          {formatDecimal(c.inputs.address_factor)} ·{" "}
          {formatInteger(c.inputs.available_days)} dias disponíveis.
        </p>
        <p>
          Esforço: {formatInteger(c.sizing.effort_assets)} pessoas-dia por bens
          e {formatInteger(c.sizing.effort_addresses)} por endereços; adotado{" "}
          {formatInteger(c.sizing.person_days)}. Equipe necessária:{" "}
          {formatInteger(c.sizing.required_team)}; adotada:{" "}
          {formatInteger(c.sizing.team)}.
        </p>
        <p>
          Permanência: {formatInteger(c.sizing.stay_days)} dias (
          {formatInteger(c.sizing.extra_days)} extras); quartos:{" "}
          {formatInteger(c.sizing.rooms)}.
        </p>
        <p>
          Restrições operacionais:{" "}
          {s.input.operational_constraints || "Nenhuma informada"}
        </p>
        <p>Responsável: {s.context.responsible.login}</p>
        {c.manual_adjustments ? (
          <p className="rounded border border-warning/30 p-3">
            Ajustes manuais autorizados: {c.manual_adjustments.reason}. Equipe{" "}
            {c.manual_adjustments.team == null
              ? "configurada"
              : formatInteger(c.manual_adjustments.team)}
            , dias{" "}
            {c.manual_adjustments.available_days == null
              ? "configurados"
              : formatInteger(c.manual_adjustments.available_days)}
            , produtividade{" "}
            {c.manual_adjustments.productivity == null
              ? "configurada"
              : formatInteger(c.manual_adjustments.productivity)}
            , margem{" "}
            {c.manual_adjustments.margin_pct == null
              ? "configurada"
              : formatPercent(c.manual_adjustments.margin_pct)}
            , acréscimo {money(c.manual_adjustments.operational_extra ?? "0")},
            preço manual{" "}
            {c.manual_adjustments.final_price == null
              ? "não utilizado"
              : money(c.manual_adjustments.final_price)}
            .
          </p>
        ) : null}
      </section>
      <h2 className="font-semibold">Memória de custos</h2>
      <DataTable
        items={c.lines}
        getKey={(l) => l.key}
        columns={[
          { header: "Componente", cell: (l) => l.label },
          { header: "Quantidade", cell: (l) => formatInteger(l.quantity) },
          { header: "Valor unitário", cell: (l) => money(l.unit_value) },
          { header: "Subtotal", cell: (l) => money(l.subtotal) },
          { header: "Fórmula", cell: (l) => l.formula },
        ]}
      />
      <section className="premium-panel grid gap-2 p-5 text-sm">
        <h2 className="font-semibold">Composição do preço</h2>
        <p>
          Impostos declarados {formatPercent(c.rates.tax_pct)}:{" "}
          {money(c.tax_amount)} · comissão {formatPercent(c.rates.commission_pct)}
          : {money(c.commission_amount)} · margem alvo{" "}
          {formatPercent(c.rates.margin_pct)}.
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
          {[...pricingNumbers, ...pricingMoney, ...pricingRates].map(
            ([key, label]) => (
              <p key={key}>
                {pricingLabel(label)}: {pricingValue(p.values, key)}
              </p>
            ),
          )}
        </div>
      </details>
    </div>
  );
}
