import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { FilterPanel } from "@/components/base/FilterPanel";
import { FormField } from "@/components/base/FormField";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Kpi } from "@/components/base/Cards";
import { useToast } from "@/components/ui/toast-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ModalForm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/features/auth/usePermissions";
import { retroactiveSettingsUrl } from "@/features/finance-settings/financeSettingsApi";
import { formatMoney } from "@/utils/format";
import {
  CashFlowBlock,
  type BlockAction,
  type BlockKind,
} from "./CashFlowBlock";
import { IndicatorsPanel, SimulationBar } from "./CashFlowIndicators";
import { useCashFlowIndicators } from "./useCashFlowIndicators";
import {
  cashFlowApi,
  cashFlowKeys,
  civilBr,
  monthBr,
  type BatchResult,
  type CashFlowKpis,
  type FlowItem,
  type SaleSimulationInput,
} from "./cashFlowBoardApi";

const select =
  "h-10 max-w-full rounded-md border bg-background px-3 text-sm md:max-w-[16rem]";

/** Card do fluxo: com simulação, mostra o valor com a venda e o original riscado. */
function FlowKpi({
  label,
  value,
  hint,
  tone,
  simulated,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger" | "warning";
  simulated?: string;
}) {
  const changed = simulated !== undefined && simulated !== value;
  const shown = changed ? simulated : value;
  return (
    <Kpi
      label={label}
      value={shown}
      hint={hint}
      tone={tone ?? (changed ? "highlight" : "default")}
      negative={shown.startsWith("-")}
    >
      {changed ? (
        <p className="text-xs text-muted-foreground">
          sem a venda: <s>{value}</s> · simulado
        </p>
      ) : null}
    </Kpi>
  );
}

const sumMoney = (a: string, b: string) =>
  ((Math.round(Number(a) * 100) + Math.round(Number(b) * 100)) / 100).toFixed(
    2,
  );

/** Cards do fluxo (mês, próximo mês e ano de referência); com simulação, os totais mostram o valor com a venda. */
function KpiRows({
  k,
  sim,
  projectFiltered,
}: {
  k: CashFlowKpis;
  sim?: CashFlowKpis;
  projectFiltered: boolean;
}) {
  const m = (v: string) => formatMoney(v);
  return (
    <section
      aria-label={`Indicadores do fluxo de caixa (${k.currency})`}
      className="grid gap-2"
    >
      {k.currency !== "BRL" ? (
        <p className="text-sm font-semibold">
          Valores em {k.currency} (não somados ao BRL)
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <FlowKpi
          label={`Total previsto ${monthBr(k.month.reference)}`}
          value={m(k.month.total)}
          simulated={sim ? m(sim.month.total) : undefined}
          hint="(entradas − saídas) do mês"
        />
        <FlowKpi
          label="Entradas do mês"
          value={m(sumMoney(k.month.in_realized, k.month.in_open))}
          hint={`${m(k.month.in_realized)} recebidas · ${m(k.month.in_open)} a receber`}
        />
        <FlowKpi
          label="Saídas do mês"
          value={m(sumMoney(k.month.out_realized, k.month.out_open))}
          hint={`${m(k.month.out_realized)} pagas · ${m(k.month.out_open)} a pagar`}
        />
        <FlowKpi
          label="Em atraso"
          value={m(k.overdue.in)}
          hint={`${k.overdue.in_count} entrada(s) · saídas ${m(k.overdue.out)} (${k.overdue.out_count})`}
          tone={
            k.overdue.in_count || k.overdue.out_count ? "danger" : undefined
          }
        />
        <FlowKpi
          label={`Total previsto ${monthBr(k.next_month.reference)}`}
          value={m(k.next_month.total)}
          simulated={sim ? m(sim.next_month.total) : undefined}
          hint="entradas líquidas de IR − saídas"
        />
        <FlowKpi
          label="Entradas do próximo mês (líquidas)"
          value={m(k.next_month.in_net)}
          hint={`bruto ${m(k.next_month.in_gross)}`}
        />
        <FlowKpi
          label="Saídas do próximo mês"
          value={m(k.next_month.out)}
          hint="sem o IR (já descontado das entradas)"
        />
        <FlowKpi
          label="Previsto não confirmado"
          value={m(k.proposed.amount)}
          hint={`${k.proposed.count} parcela(s) proposta(s)`}
          tone={k.proposed.count ? "warning" : undefined}
        />
        {k.year.dre_total != null ? (
          <FlowKpi
            label={`Total previsto ${k.year.reference} (DRE)`}
            value={m(k.year.dre_total)}
            simulated={
              sim?.year.dre_total != null ? m(sim.year.dre_total) : undefined
            }
            hint={`resultado da DRE jan–dez (antes do corte, a DRE usa o lançado/importado) · fluxo do ano: ${m(k.year.total)}`}
          />
        ) : (
          <FlowKpi
            label={`Total do ano ${k.year.reference}`}
            value={m(k.year.total)}
            hint={
              projectFiltered
                ? "pelo fluxo do projeto: a DRE é da organização inteira"
                : `entradas ${m(k.year.in)} − saídas ${m(k.year.out)} (com IR)`
            }
          />
        )}
        <FlowKpi
          label={`A receber em ${k.year.reference} (líquido)`}
          value={m(k.year.in_open_net)}
        />
        <FlowKpi
          label={`A pagar em ${k.year.reference}`}
          value={m(k.year.out_open)}
          hint="sem o IR"
        />
      </div>
    </section>
  );
}

type Dialog = {
  kind: "receive" | "reschedule" | "discard" | "redate" | "settle" | "repay" | "undo" | "unsettle";
  items: FlowItem[];
} | null;

const BLOCKS: Array<{
  kind: BlockKind;
  title: string;
  groups: FlowItem["group"][];
  direction: "in" | "out";
}> = [
  {
    kind: "billing",
    title: "Entradas de faturamento",
    groups: ["billing"],
    direction: "in",
  },
  {
    kind: "reimbursement",
    title: "Entradas de reembolso e revenda de placas",
    groups: ["reimbursement", "other_in"],
    direction: "in",
  },
  {
    kind: "to_reimburse",
    title: "Saídas para reembolsar",
    groups: ["to_reimburse"],
    direction: "out",
  },
  {
    kind: "non_reimbursable",
    title: "Saídas não reembolsáveis",
    groups: ["non_reimbursable"],
    direction: "out",
  },
];

/** Financeiro › Fluxo de caixa: filtro geral (na URL), avisos, simulação, cards, indicadores e os quatro blocos. */
export function CashFlowPage() {
  const { hasPermission } = usePermissions();
  const cache = useQueryClient();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const thisYear = String(new Date().getFullYear());
  // Filtro geral (gravado na URL: recarregar ou compartilhar o link abre igual).
  const year = params.get("year") ?? thisYear;
  const projectId = Number(params.get("project_id")) || undefined;
  const month = params.get("month") ?? undefined;
  const direction = (params.get("tipo") ?? "") as "" | "in" | "out";
  const onlyOpen = params.get("em_aberto") === "1";
  const currentMonth = params.get("mes_atual") === "1";
  const showReversed = params.get("estornos") === "1";
  const setFilter = (changes: Record<string, string | null>) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        for (const [k, v] of Object.entries(changes)) {
          if (v === null || v === "") next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  const query = useMemo(
    () => ({ project_id: projectId, year, month }),
    [projectId, year, month],
  );
  const [sim, setSim] = useState<SaleSimulationInput | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  // Sucesso vai por toast; falha fica na tela (inline) até a próxima ação.
  const [failure, setFailure] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [details, setDetails] = useState(false);
  const [balances, setBalances] = useState<
    Partial<Record<BlockKind, number | null>>
  >({});
  const board = useQuery({
    queryKey: cashFlowKeys.board(query),
    queryFn: () => cashFlowApi.board(query),
  });
  const indicators = useCashFlowIndicators(query, sim);
  const onBalance = useCallback(
    (kind: BlockKind, cents: number | null) =>
      setBalances((b) => (b[kind] === cents ? b : { ...b, [kind]: cents })),
    [],
  );

  const run = useMutation({
    mutationFn: async (job: () => Promise<BatchResult>) => job(),
    onSuccess: async (r) => {
      setDialog(null);
      setResetKey((k) => k + 1);
      const failures = r.results
        .filter((x) => !x.ok)
        .map((x) => x.message)
        .join("; ");
      if (r.done) toast({ title: `${r.done} item(ns) concluído(s).`, tone: "success" });
      setFailure(failures ? `Não concluídos: ${failures}` : null);
      await cache.invalidateQueries({ queryKey: cashFlowKeys.all });
    },
    onError: (e) => setFailure((e as Error).message),
  });

  const data = board.data;
  // Filtro geral nas tabelas (tipo, em aberto, mês atual, estornos); os cards seguem o mês e o ano de referência.
  const items = useMemo(() => {
    const now = (data?.as_of ?? "").slice(0, 7);
    return (data?.items ?? []).filter(
      (i) =>
        (showReversed || i.status !== "reversed") &&
        (!direction || i.direction === direction) &&
        (!onlyOpen || i.status === "open" || i.status === "proposed") &&
        (!currentMonth ||
          i.date.startsWith(now) ||
          (i.overdue && i.status !== "realized")),
    );
  }, [data, direction, onlyOpen, currentMonth, showReversed]);

  if (board.isLoading)
    return <LoadingState label="Carregando fluxo de caixa" />;
  if (board.isError)
    return (
      <ErrorState
        message={(board.error as Error).message}
        onRetry={() => void board.refetch()}
      />
    );
  if (!data) return null;
  const brl = data.kpis.find((k) => k.currency === "BRL") ?? data.kpis[0];
  const others = data.kpis.filter((k) => k !== brl);
  const simKpis = indicators.data?.configured
    ? (indicators.data.simulation?.kpis ?? undefined)
    : undefined;
  const years = [
    ...new Set([
      Number(thisYear) - 1,
      Number(thisYear),
      Number(thisYear) + 1,
      Number(thisYear) + 2,
      ...(year !== "all" ? [Number(year)] : []),
    ]),
  ]
    .sort()
    .map(String);
  const shownBlocks = BLOCKS.filter(
    (b) => !direction || b.direction === direction,
  );
  const visibleBalances = shownBlocks.map((b) => balances[b.kind]);
  const balance =
    visibleBalances.reduce<number>((s, v) => s + (v ?? 0), 0) / 100;
  const someHidden = visibleBalances.some((v) => v === null);
  const tablesYear = data.tables_year ?? year;

  // ── avisos: uma linha de resumo, detalhes sob demanda ──
  const alerts: Array<{
    key: string;
    summary: string;
    detail: React.ReactNode;
    tone?: "warning";
  }> = [];
  if (data.alerts.proposed_count)
    alerts.push({
      key: "proposed",
      tone: "warning",
      summary: `${data.alerts.proposed_count} proposta(s) não confirmada(s)`,
      detail: (
        <>
          {data.alerts.proposed_count} origem(ns) com recebível previsto e não
          confirmado ({formatMoney(data.alerts.proposed_amount)}). Elas já
          contam no fluxo como "previsto (não confirmado)"; confirme para virar
          recebível ou descarte com justificativa.
        </>
      ),
    });
  if (data.alerts.missing_parameters_since)
    alerts.push({
      key: "parameters",
      tone: "warning",
      summary: `${data.alerts.missing_tax_count} entrada(s) sem parâmetro vigente`,
      detail: (
        <>
          {data.alerts.missing_tax_count} entrada(s) sem parâmetro vigente (IR
          não calculado, sem valor de reserva).{" "}
          <Link
            className="font-semibold underline"
            to={retroactiveSettingsUrl(data.alerts.missing_parameters_since)}
          >
            Publicar versão dos parâmetros desde{" "}
            {civilBr(data.alerts.missing_parameters_since)}
          </Link>
        </>
      ),
    });
  if (data.alerts.unproposed_contracts.length)
    alerts.push({
      key: "unproposed",
      summary: `${data.alerts.unproposed_contracts.length} contrato(s) sem proposta`,
      detail: (
        <>
          <span className="block">Sem proposta de recebível:</span>
          <ul className="list-disc pl-5">
            {data.alerts.unproposed_contracts.map((c) => (
              <li key={c.source_key}>{c.reason}</li>
            ))}
          </ul>
          <Link
            className="font-semibold underline"
            to="/app/finance/parameters"
          >
            Ver parâmetros
          </Link>
        </>
      ),
    });
  if (data.alerts.undated_payments)
    alerts.push({
      key: "undated",
      summary: `${data.alerts.undated_payments} diária(s) sem data prevista`,
      detail: (
        <>
          {data.alerts.undated_payments} diária(s) em aberto sem data prevista
          ficam fora do fluxo (informe em Pagamento de inventariantes).
        </>
      ),
    });
  if (projectId)
    alerts.push({
      key: "fixed",
      summary: "custos fixos fora (filtro de projeto)",
      detail: (
        <>
          Custos fixos não pertencem a projeto: com um projeto filtrado eles
          ficam fora das tabelas e dos cards, e o total do ano é o do fluxo do
          projeto (a DRE é da organização inteira).
        </>
      ),
    });
  const warning = alerts.some((a) => a.tone === "warning");

  const refsOf = (list: FlowItem[]) =>
    list.map((i) => ({
      receivable_id: Number(i.refs.receivable_id),
      installment_id: Number(i.refs.installment_id),
    }));
  const eventsOf = (list: FlowItem[]) =>
    list.map((i) => ({
      receivable_id: Number(i.refs.receivable_id),
      event_id: Number(i.refs.event_id),
    }));
  const settleKeys = (list: FlowItem[]) =>
    list.map((i) => String(i.refs.settle_key));
  const sourceKeys = (list: FlowItem[]) => [
    ...new Set(list.map((i) => String(i.refs.source_key))),
  ];
  const onAction = (a: BlockAction) => {
    setFailure(null);
    if (a.kind === "confirm")
      run.mutate(() => cashFlowApi.confirm(sourceKeys(a.items)));
    // Desfazer recebimento/pagamento: sempre com confirmação.
    else
      setDialog({
        kind: a.kind as NonNullable<Dialog>["kind"],
        items: a.items,
      });
  };

  return (
    <div className="grid min-w-0 gap-4">
      <FilterPanel>
        <select
          aria-label="Ano"
          className={select}
          value={year}
          onChange={(e) =>
            setFilter({
              year: e.target.value === thisYear ? null : e.target.value,
            })
          }
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
          <option value="all">Todos os anos</option>
        </select>
        <select
          aria-label="Projeto"
          className={select}
          value={projectId ?? ""}
          onChange={(e) => setFilter({ project_id: e.target.value || null })}
        >
          <option value="">Projeto: todos</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Tipo"
          className={select}
          value={direction}
          onChange={(e) => setFilter({ tipo: e.target.value || null })}
        >
          <option value="">Entradas e saídas</option>
          <option value="in">Entradas</option>
          <option value="out">Saídas</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant={currentMonth ? "soft" : "ghost"}
          aria-pressed={currentMonth}
          onClick={() =>
            setFilter({ mes_atual: currentMonth ? null : "1", month: null })
          }
        >
          Mês atual
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) =>
              setFilter({ em_aberto: e.target.checked ? "1" : null })
            }
          />
          Somente em aberto
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showReversed}
            onChange={(e) =>
              setFilter({ estornos: e.target.checked ? "1" : null })
            }
          />
          Mostrar estornos
        </label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setParams(new URLSearchParams(), { replace: true })}
        >
          Limpar filtros
        </Button>
      </FilterPanel>
      <p className="-mt-2 text-xs text-muted-foreground">
        Tipo, "Somente em aberto", "Mês atual" e "Todos os anos" valem para as
        tabelas; os cards seguem o mês de referência (
        {monthBr(data.reference.month)}) e o ano {data.reference.year}.
      </p>

      {alerts.length ? (
        <div
          role="status"
          className={`rounded-md border p-3 text-sm ${warning ? "border-warning/50 bg-warning/10" : ""}`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {warning ? <span aria-hidden="true">⚠</span> : null}
            <span>{alerts.map((a) => a.summary).join(" · ")}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-expanded={details}
              onClick={() => setDetails(!details)}
            >
              {details ? "ocultar detalhes" : "ver detalhes"}
            </Button>
          </div>
          {details ? (
            <ul className="mt-2 grid gap-2">
              {alerts.map((a) => (
                <li key={a.key} className="rounded border bg-card p-2">
                  {a.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <SimulationBar
        indicators={indicators}
        referenceMonth={data.reference.month}
        sim={sim}
        onSimulate={setSim}
      />
      {brl ? (
        <KpiRows k={brl} sim={simKpis} projectFiltered={Boolean(projectId)} />
      ) : null}
      {others.map((k) => (
        <KpiRows key={k.currency} k={k} projectFiltered={Boolean(projectId)} />
      ))}
      <IndicatorsPanel indicators={indicators} simulating={Boolean(sim)} />

      {failure ? (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive-text">
          {failure}
        </p>
      ) : null}

      <div className="mt-2 grid gap-8">
        {shownBlocks.map((b) => (
          <CashFlowBlock
            key={b.kind}
            kind={b.kind}
            title={b.title}
            rows={items.filter((i) => b.groups.includes(i.group))}
            asOf={data.as_of}
            tablesYear={tablesYear}
            can={hasPermission}
            busy={run.isPending}
            resetKey={resetKey}
            onAction={onAction}
            onBalance={onBalance}
          />
        ))}
      </div>
      <p className="text-sm font-semibold">
        Saldo das linhas exibidas (entradas − saídas):{" "}
        <span className={`numeric ${balance < 0 ? "text-destructive-text" : ""}`}>
          {formatMoney(balance)}
        </span>
        {someHidden ? (
          <span className="font-normal text-muted-foreground">
            {" "}
            · blocos ocultos ficam fora
          </span>
        ) : null}
      </p>
      <p className="text-xs text-muted-foreground">
        Saídas vencidas e não pagas e entradas vencidas aparecem sempre, mesmo
        fora do ano ou do mês escolhido. Entradas pelo bruto e o IR como saída:
        o IR é descontado uma vez só (valor da entrada de faturamento × % dos
        parâmetros vigente na data; reembolsos e revenda de placas sem IR).
        Custos fixos vêm da DRE mensal a partir do mês de corte: "Lançado" é o
        valor lançado na DRE (não significa pago) e "Estimado" é a estimativa.
        Diárias têm baixa em Pagamento de inventariantes.
      </p>

      {dialog?.kind === "receive" || dialog?.kind === "settle" ? (
        <DateDialog
          title={
            dialog.kind === "receive"
              ? `Marcar ${dialog.items.length} parcela(s) como recebida(s)`
              : `Pagar ${dialog.items.length} saída(s)`
          }
          label={dialog.kind === "receive" ? "Data de recebimento" : "Data de pagamento"}
          today={data.as_of}
          max={data.as_of}
          busy={run.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(date) =>
            run.mutate(() =>
              dialog.kind === "receive"
                ? cashFlowApi.receive(refsOf(dialog.items), date)
                : cashFlowApi.settle(settleKeys(dialog.items), date),
            )
          }
        />
      ) : null}
      {dialog?.kind === "undo" || dialog?.kind === "unsettle" ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && !run.isPending && setDialog(null)}
          title={
            dialog.kind === "undo"
              ? `Desfazer ${dialog.items.length} recebimento(s)?`
              : `Desfazer ${dialog.items.length} pagamento(s)?`
          }
          description={
            dialog.kind === "undo"
              ? "O recebimento é estornado e a parcela volta a ficar em aberto. O estorno fica no histórico do recebível."
              : "A saída volta a ficar a pagar, sem data de pagamento."
          }
          confirmLabel={dialog.kind === "undo" ? "Desfazer recebimento" : "Desfazer pagamento"}
          busy={run.isPending}
          error={failure}
          onConfirm={() =>
            run.mutate(() =>
              dialog.kind === "undo"
                ? cashFlowApi.undoReceipts(eventsOf(dialog.items))
                : cashFlowApi.settle(settleKeys(dialog.items), null),
            )
          }
        />
      ) : null}
      {dialog?.kind === "repay" ? (
        <DateDialog
          title={`Alterar a data de pagamento (${dialog.items.length} saída(s))`}
          label="Nova data de pagamento"
          today={data.as_of}
          max={data.as_of}
          busy={run.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(date) =>
            run.mutate(() => cashFlowApi.settle(settleKeys(dialog.items), date))
          }
        />
      ) : null}
      {dialog?.kind === "redate" ? (
        <DateDialog
          title={`Alterar a data de recebimento (${dialog.items.length} recebimento(s))`}
          label="Nova data de recebimento"
          help="O recebimento atual é estornado e um novo é registrado na nova data, na mesma operação. Os dois ficam na auditoria."
          today={data.as_of}
          max={data.as_of}
          withReason
          busy={run.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(date, reason) =>
            run.mutate(() =>
              cashFlowApi.redateReceipts(eventsOf(dialog.items), date, reason!),
            )
          }
        />
      ) : null}
      {dialog?.kind === "reschedule" ? (
        <DateDialog
          title={`Nova data prevista (${dialog.items.length} parcela(s))`}
          label="Nova data prevista"
          today={data.as_of}
          withReason
          busy={run.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(date, reason) =>
            run.mutate(() =>
              cashFlowApi.reschedule(refsOf(dialog.items), date, reason!),
            )
          }
        />
      ) : null}
      {dialog?.kind === "discard" ? (
        <DateDialog
          title={`Descartar ${sourceKeys(dialog.items).length} proposta(s)`}
          label=""
          today={data.as_of}
          withReason
          noDate
          busy={run.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(_d, reason) =>
            run.mutate(() =>
              cashFlowApi.discard(sourceKeys(dialog.items), reason!),
            )
          }
        />
      ) : null}
    </div>
  );
}

function DateDialog({
  title,
  label,
  help,
  today,
  max,
  withReason,
  noDate,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  label: string;
  help?: string;
  today: string;
  /** Data máxima (baixas: hoje; data futura é recusada). */
  max?: string;
  withReason?: boolean;
  noDate?: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (date: string, reason?: string) => void;
}) {
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const future = Boolean(max && date && date > max);
  const invalid =
    (!noDate && (!date || future)) || (withReason && reason.trim().length < 5);
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title={title}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) onConfirm(date, reason.trim());
        }}
      >
        {help ? <p className="text-sm text-muted-foreground">{help}</p> : null}
        {!noDate ? (
          <FormField label={label}>
            <Input
              type="date"
              aria-label={label}
              value={date}
              max={max}
              onChange={(e) => setDate(e.target.value)}
            />
            {future ? (
              <span role="alert" className="text-xs text-destructive-text">
                Data futura não é aceita.
              </span>
            ) : null}
          </FormField>
        ) : null}
        {withReason ? (
          <FormField label="Justificativa">
            <textarea
              aria-label="Justificativa"
              className="min-h-16 rounded-md border bg-background px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Mínimo de 5 caracteres; fica na auditoria.
            </span>
          </FormField>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={busy} disabled={invalid}>
            Confirmar
          </Button>
        </div>
      </form>
    </ModalForm>
  );
}
