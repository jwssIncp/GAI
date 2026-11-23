import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { retroactiveSettingsUrl } from "@/features/finance-settings/financeSettingsApi";
import { Plus, Trash2 } from "lucide-react";
import { Kpi, KpiGrid } from "@/components/base/Cards";
import { FilterPanel } from "@/components/base/FilterPanel";
import { FormField } from "@/components/base/FormField";
import { InlineEdit } from "@/components/base/InlineEdit";
import { MoneyInput } from "@/components/base/MoneyInput";
import { ErrorState, LoadingState } from "@/components/base/States";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ModalForm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-context";
import { usePermissions } from "@/features/auth/usePermissions";
import { FinanceHeaderActions } from "@/features/receivables/FinanceLayout";
import { formatMoney } from "@/utils/format";
import {
  assetTagsApi,
  assetTagsKeys,
  civilBr,
  normalizeUnit,
  unitBr,
  type AssetTagFilters,
  type AssetTagInput,
  type AssetTagList,
  type AssetTagRow,
} from "./assetTagsApi";

const select = "h-10 max-w-[14rem] rounded-md border bg-background px-3 text-sm";
const TYPE_LABEL = { reimbursable: "Reembolsável", non_reimbursable: "Não reembolsável" } as const;


const qty = (n: number) => n.toLocaleString("pt-BR");
const intParse = (typed: string) => (/^\d+$/.test(typed.trim()) ? String(Number(typed)) : typed.trim() === "" ? "" : null);

/** Financeiro › Placas de patrimônio (doc 06 §5). */
export function AssetTagsPage() {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("asset-tag-orders:edit");
  const { toast } = useToast();
  const cache = useQueryClient();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<AssetTagFilters>(() => {
    const p = Number(params.get("project_id"));
    return p ? { project_id: p } : {};
  });
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<AssetTagRow | null>(null);
  const query = useQuery({ queryKey: assetTagsKeys.list(filters), queryFn: () => assetTagsApi.list(filters) });
  const remove = useMutation({
    mutationFn: (id: number) => assetTagsApi.remove(id),
    onSuccess: async () => {
      setRemoving(null);
      toast({ title: "Pedido de placas excluído.", tone: "success" });
      await cache.invalidateQueries({ queryKey: assetTagsKeys.all });
    },
  });
  const save = async (id: number, payload: AssetTagInput) => {
    await assetTagsApi.update(id, payload);
    await cache.invalidateQueries({ queryKey: assetTagsKeys.all });
  };
  const setFilter = <K extends keyof AssetTagFilters>(key: K, value: string) =>
    setFilters((f) => ({ ...f, [key]: value === "" ? undefined : key === "project_id" ? Number(value) : value }));

  // ação primária no cabeçalho do módulo (à direita do título)
  const actions = canEdit ? (
    <FinanceHeaderActions>
      <Button type="button" onClick={() => setCreating(true)}><Plus size={16} /> Novo pedido</Button>
    </FinanceHeaderActions>
  ) : null;
  if (query.isLoading) return <LoadingState label="Carregando placas" />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  const data = query.data!;
  const k = data.kpis;
  const tax = data.parameters.tag_tax_pct;
  const cell = "whitespace-nowrap border-b px-2 py-2";
  const filtered = Object.values(filters).some((v) => v !== undefined && v !== "");

  return (
    <div className="grid gap-4">
      {actions}
      <p className="max-w-4xl text-xs leading-5 text-muted-foreground">
        Quantidade = sequência final − inicial + 1 (quando informada).
        Valor líquido = valor total − {tax ? `${tax.replace(".", ",")}%` : "% de impostos dos parâmetros"} de impostos; lucro = líquido − custo.
        O tipo de despesa vem de "Plaquetas por conta de" do contrato; a alteração manual prevalece.
        {!data.parameters.configured ? " Sem parâmetros financeiros vigentes hoje: o líquido dos pedidos novos fica em branco." : ""}
      </p>
      {k.missing_tax_count ? (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">
          {k.missing_tax_count} pedido(s) sem % de impostos vigente na data do pedido (anterior à primeira versão dos parâmetros
          financeiros): líquido e lucro desses pedidos ficam em branco e fora dos totais; o sistema não usa valor de reserva.{" "}
          {k.missing_tax_since ? (
            <Link className="font-semibold underline" to={retroactiveSettingsUrl(k.missing_tax_since)}>
              Publicar versão dos parâmetros desde {civilBr(k.missing_tax_since)}
            </Link>
          ) : null}
        </p>
      ) : null}
      {/* Seis cards como no sistema anterior: quantidades (azul) e valores (verde). */}
      <section aria-label="Indicadores das placas">
        <KpiGrid>
        <Kpi group="next" tinted label="Placas compradas" value={qty(k.purchased)} />
        <Kpi group="next" label="Pagamento pendente (qtd)" value={qty(k.supplier_pending)} />
        <Kpi group="next" label="A receber (qtd)" value={qty(k.to_receive)} />
        <Kpi group="month" tinted label="Custo total" value={formatMoney(k.cost_total)} />
        <Kpi group="month" label="Valor total cliente" value={formatMoney(k.value_total)} />
        <Kpi group="month" label="Lucro líquido" value={formatMoney(k.net_profit)} negative={k.net_profit.startsWith("-")} note={k.missing_tax_count ? `${k.missing_tax_count} pedido(s) sem % de impostos` : undefined} />
        </KpiGrid>
      </section>
      <FilterPanel>
        <select aria-label="Filtrar por projeto" className={select} value={filters.project_id ?? ""} onChange={(e) => setFilter("project_id", e.target.value)}>
          <option value="">Projeto: todos</option>
          {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Filtrar por pagamento ao fornecedor" className={select} value={filters.supplier_status ?? ""} onChange={(e) => setFilter("supplier_status", e.target.value)}>
          <option value="">Pagamento fornecedor: todos</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
        </select>
        <select aria-label="Filtrar por recebido do cliente" className={select} value={filters.received ?? ""} onChange={(e) => setFilter("received", e.target.value)}>
          <option value="">Recebido cliente: todos</option>
          <option value="yes">Sim</option>
          <option value="no">Não</option>
        </select>
        <select aria-label="Filtrar por tipo de despesa" className={select} value={filters.expense_type ?? ""} onChange={(e) => setFilter("expense_type", e.target.value)}>
          <option value="">Tipo: todos</option>
          <option value="reimbursable">Reembolsável</option>
          <option value="non_reimbursable">Não reembolsável</option>
          <option value="unclassified">Sem tipo</option>
        </select>
        <input aria-label="Filtrar por nº da proposta" placeholder="Nº proposta" className="h-10 w-36 rounded-md border bg-background px-3 text-sm" value={filters.proposal ?? ""} onChange={(e) => setFilter("proposal", e.target.value)} />
        <Button type="button" variant="ghost" onClick={() => setFilters({})}>Limpar</Button>
      </FilterPanel>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="max-h-[620px] overflow-auto" role="region" aria-label="Pedidos de placas" tabIndex={0}>
          <table className="data-table w-full min-w-[1800px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {["Proposta", "Projeto", "Data", "Qtd", "Seq. inicial", "Seq. final", "Modelo", "Fornecedor", "Custo unit.", "Pgto fornecedor", "Previsão pgto", "Pago em", "Valor unit.", "Previsão receb.", "Recebido", "Recebido em", "Tipo de despesa", "Custo total", "Valor total", `Líquido (−${tax ? tax.replace(".", ",") : "?"}%)`, "Lucro", ""].map((h, i) => (
                  <th key={`${h}-${i}`} scope="col" className={`whitespace-nowrap border-b px-2 py-3 font-semibold ${i === 0 ? "sticky left-0 !z-[3]" : ""}`}>{h || <span className="sr-only">Ações</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} className="hover:bg-primary/[0.05]">
                  <td className={`${cell} sticky left-0 z-10 bg-card`}>
                    <InlineEdit label="Nº proposta" value={r.proposal_number ?? ""} disabled={!canEdit} onSave={(v) => save(r.id, { proposal_number: v || null })} />
                  </td>
                  <td className={`${cell} max-w-[12rem] truncate`} title={r.project_name}>
                    <InlineEdit label="Projeto" kind="select" value={String(r.project_id)} options={data.projects.filter((p) => p.open || p.id === r.project_id).map((p) => ({ value: String(p.id), label: p.name }))} disabled={!canEdit} onSave={(v) => save(r.id, { project_id: Number(v) })} />
                  </td>
                  <td className={cell}><InlineEdit label="Data" kind="date" value={r.ordered_on} format={civilBr} disabled={!canEdit} onSave={(v) => save(r.id, { ordered_on: v })} /></td>
                  <td className={`${cell} tabular-nums`}>
                    {r.quantity_from_sequence ? (
                      <span title="Calculada pela sequência (fim − início + 1)">{qty(r.quantity)}</span>
                    ) : (
                      <InlineEdit label="Quantidade" kind="number" value={String(r.quantity)} format={(v) => qty(Number(v))} parse={(t) => (/^\d+$/.test(t.trim()) ? String(Number(t)) : null)} disabled={!canEdit} onSave={(v) => save(r.id, { quantity: Number(v) })} />
                    )}
                  </td>
                  <td className={`${cell} tabular-nums`}><InlineEdit label="Sequência inicial" kind="number" value={r.sequence_start === null ? "" : String(r.sequence_start)} parse={intParse} disabled={!canEdit} onSave={(v) => save(r.id, { sequence_start: v ? Number(v) : null })} /></td>
                  <td className={`${cell} tabular-nums`}><InlineEdit label="Sequência final" kind="number" value={r.sequence_end === null ? "" : String(r.sequence_end)} parse={intParse} disabled={!canEdit} onSave={(v) => save(r.id, { sequence_end: v ? Number(v) : null })} /></td>
                  <td className={cell}>
                    <InlineEdit label="Modelo" kind="select" value={r.model ?? ""} options={[{ value: "", label: "—" }, ...(data.parameters.tag_models ?? (r.model ? [r.model] : [])).map((m) => ({ value: m, label: m }))]} disabled={!canEdit} onSave={(v) => save(r.id, { model: v || null })} />
                  </td>
                  <td className={cell}><InlineEdit label="Fornecedor" value={r.supplier_name} disabled={!canEdit} onSave={(v) => save(r.id, { supplier_name: v })} /></td>
                  <td className={`${cell} tabular-nums`}><InlineEdit label="Custo unitário" kind="money" value={r.unit_cost} format={unitBr} parse={normalizeUnit} disabled={!canEdit} onSave={(v) => save(r.id, { unit_cost: v })} /></td>
                  <td className={cell}>
                    <InlineEdit label="Pagamento ao fornecedor" kind="select" value={r.supplier_payment_status} options={[{ value: "pending", label: "Pendente" }, { value: "paid", label: "Pago" }]} disabled={!canEdit} onSave={(v) => save(r.id, { supplier_paid: v === "paid" })}
                      display={r.supplier_payment_status === "paid"
                        ? <StatusBadge finance="paid" title="Fornecedor pago" />
                        : <StatusBadge finance="pending" title="Pagamento ao fornecedor pendente" />} />
                  </td>
                  <td className={cell}><InlineEdit label="Previsão de pagamento" kind="date" value={r.supplier_expected_payment_on ?? ""} format={civilBr} disabled={!canEdit} onSave={(v) => save(r.id, { supplier_expected_payment_on: v || null })} /></td>
                  <td className={cell}><InlineEdit label="Data de pagamento" kind="date" value={r.supplier_paid_on ?? ""} format={civilBr} disabled={!canEdit} onSave={(v) => save(r.id, { supplier_paid_on: v || null })} /></td>
                  <td className={`${cell} tabular-nums`}><InlineEdit label="Valor unitário ao cliente" kind="money" value={r.unit_price} format={unitBr} parse={normalizeUnit} disabled={!canEdit} onSave={(v) => save(r.id, { unit_price: v })} /></td>
                  <td className={cell}><InlineEdit label="Previsão de recebimento" kind="date" value={r.client_expected_receipt_on ?? ""} format={civilBr} disabled={!canEdit} onSave={(v) => save(r.id, { client_expected_receipt_on: v || null })} /></td>
                  <td className={cell}>
                    <InlineEdit label="Recebido do cliente" kind="select" value={r.client_received ? "yes" : "no"} options={[{ value: "no", label: "Não" }, { value: "yes", label: "Sim" }]} disabled={!canEdit} onSave={(v) => save(r.id, { client_received: v === "yes" })} />
                  </td>
                  <td className={cell}><InlineEdit label="Data de recebimento" kind="date" value={r.client_received_on ?? ""} format={civilBr} disabled={!canEdit} onSave={(v) => save(r.id, { client_received_on: v || null })} /></td>
                  <td className={cell}>
                    <InlineEdit
                      label="Tipo de despesa"
                      kind="select"
                      value={r.expense_type_source === "manual" ? r.expense_type ?? "" : ""}
                      options={[
                        { value: "", label: `Pelo contrato (${r.contract_expense_type ? TYPE_LABEL[r.contract_expense_type] : "não informado"})` },
                        { value: "reimbursable", label: "Reembolsável" },
                        { value: "non_reimbursable", label: "Não reembolsável" },
                      ]}
                      display={<span title={r.expense_type_source === "manual" ? "Alterado manualmente" : "Pelo contrato"}>{r.expense_type ? TYPE_LABEL[r.expense_type] : "—"}{r.expense_type_source === "manual" ? " ✎" : ""}</span>}
                      disabled={!canEdit}
                      onSave={(v) => save(r.id, { expense_type_override: (v || null) as AssetTagInput["expense_type_override"] })}
                    />
                  </td>
                  <td className={`${cell} numeric text-right`}>{formatMoney(r.cost_total)}</td>
                  <td className={`${cell} numeric text-right`}>{formatMoney(r.value_total)}</td>
                  <td className={`${cell} numeric text-right`} title={r.net_value === null ? `Sem % de impostos vigente em ${civilBr(r.ordered_on)}` : undefined}>{r.net_value === null ? "—" : formatMoney(r.net_value)}</td>
                  <td className={`${cell} numeric text-right font-semibold ${r.net_profit?.startsWith("-") ? "text-destructive" : ""}`}>{r.net_profit === null ? "—" : formatMoney(r.net_profit)}</td>
                  <td className={cell}>
                    {canEdit ? (
                      <Button type="button" variant="ghost" className="size-8" aria-label={`Excluir pedido ${r.proposal_number ?? r.id}`} title="Excluir" onClick={() => setRemoving(r)}><Trash2 size={15} /></Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!data.items.length ? <tr><td colSpan={22} className="px-3 py-6 text-center text-muted-foreground">{filtered ? "Nenhum pedido de placas com estes filtros." : "Nenhum pedido de placas."}</td></tr> : null}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="sticky left-0 z-10 bg-card px-2 py-3">Total ({data.totals.count})</td>
                <td colSpan={2} />
                <td className="px-2 py-3 tabular-nums">{qty(data.totals.quantity)}</td>
                <td colSpan={13} />
                <td className="numeric px-2 py-3 text-right">{formatMoney(data.totals.cost_total)}</td>
                <td className="numeric px-2 py-3 text-right">{formatMoney(data.totals.value_total)}</td>
                <td className="numeric px-2 py-3 text-right" title={data.totals.missing_tax_count ? `Sem ${data.totals.missing_tax_count} pedido(s) sem % de impostos` : undefined}>{formatMoney(data.totals.net_value)}{data.totals.missing_tax_count ? "*" : ""}</td>
                <td className={`numeric px-2 py-3 text-right ${data.totals.net_profit.startsWith("-") ? "text-destructive" : ""}`}>{formatMoney(data.totals.net_profit)}{data.totals.missing_tax_count ? "*" : ""}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {creating ? <NewOrderDialog data={data} projectId={filters.project_id} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); toast({ title: "Pedido de placas lançado.", tone: "success" }); await cache.invalidateQueries({ queryKey: assetTagsKeys.all }); }} /> : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => {
          if (o) return;
          setRemoving(null);
          remove.reset();
        }}
        title="Excluir pedido de placas"
        description={removing ? `Excluir o pedido ${removing.proposal_number ?? `#${removing.id}`} (${qty(removing.quantity)} placas, ${removing.project_name})?` : ""}
        confirmLabel="Excluir"
        busy={remove.isPending}
        error={remove.isError ? (remove.error as Error).message : null}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}

function NewOrderDialog({ data, projectId, onClose, onSaved }: { data: AssetTagList; projectId?: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    project_id: projectId ? String(projectId) : "",
    proposal_number: "",
    ordered_on: data.today,
    quantity: "",
    sequence_start: "",
    sequence_end: "",
    model: "",
    supplier_name: data.parameters.default_tag_supplier ?? "",
    unit_cost: "",
    supplier_expected_payment_on: "",
    unit_price: "",
    client_expected_receipt_on: "",
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const start = Number(form.sequence_start);
  const end = Number(form.sequence_end);
  const bySequence = form.sequence_start !== "" && form.sequence_end !== "" && start > 0 && end >= start;
  const create = useMutation({ mutationFn: (payload: AssetTagInput) => assetTagsApi.create(payload), onSuccess: onSaved, onError: (e) => setError((e as Error).message) });
  const submit = () => {
    const cost = normalizeUnit(form.unit_cost);
    const price = normalizeUnit(form.unit_price);
    if (!form.project_id) return setError("Escolha o projeto.");
    if (form.sequence_start && form.sequence_end && end < start) return setError("A sequência final é menor que a inicial.");
    if (!bySequence && !/^\d+$/.test(form.quantity)) return setError("Informe a quantidade ou a sequência.");
    if (!cost || !price) return setError("Informe custo e valor unitários (até 4 casas).");
    create.mutate({
      project_id: Number(form.project_id),
      proposal_number: form.proposal_number.trim() || null,
      ordered_on: form.ordered_on,
      ...(bySequence ? { sequence_start: start, sequence_end: end } : { quantity: Number(form.quantity) }),
      model: form.model || null,
      supplier_name: form.supplier_name.trim(),
      unit_cost: cost,
      unit_price: price,
      supplier_expected_payment_on: form.supplier_expected_payment_on || null,
      client_expected_receipt_on: form.client_expected_receipt_on || null,
    });
  };
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title="Novo pedido de placas">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <FormField label="Projeto">
          <select aria-label="Projeto" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
            <option value="">Selecione</option>
            {data.projects.filter((p) => p.open).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>
        <FormField label="Nº proposta"><Input aria-label="Nº proposta" value={form.proposal_number} onChange={(e) => set("proposal_number", e.target.value)} /></FormField>
        <FormField label="Data"><Input type="date" aria-label="Data do pedido" value={form.ordered_on} onChange={(e) => set("ordered_on", e.target.value)} /></FormField>
        <FormField label="Modelo">
          <select aria-label="Modelo" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.model} onChange={(e) => set("model", e.target.value)}>
            <option value="">—</option>
            {(data.parameters.tag_models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </FormField>
        <FormField label="Sequência inicial"><Input inputMode="numeric" aria-label="Sequência inicial" value={form.sequence_start} onChange={(e) => set("sequence_start", e.target.value)} /></FormField>
        <FormField label="Sequência final"><Input inputMode="numeric" aria-label="Sequência final" value={form.sequence_end} onChange={(e) => set("sequence_end", e.target.value)} /></FormField>
        <FormField label="Quantidade">
          <Input inputMode="numeric" aria-label="Quantidade" disabled={bySequence} value={bySequence ? String(end - start + 1) : form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          {bySequence ? <span className="text-xs text-muted-foreground">Pela sequência: fim − início + 1.</span> : null}
        </FormField>
        <FormField label="Fornecedor"><Input aria-label="Fornecedor" value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} /></FormField>
        <FormField label="Custo unitário (R$)"><MoneyInput decimals={4} aria-label="Custo unitário (R$)" value={form.unit_cost} onValueChange={(v) => set("unit_cost", v)} /></FormField>
        <FormField label="Valor unitário ao cliente (R$)"><MoneyInput decimals={4} aria-label="Valor unitário ao cliente (R$)" value={form.unit_price} onValueChange={(v) => set("unit_price", v)} /></FormField>
        <FormField label="Previsão de pagamento"><Input type="date" aria-label="Previsão de pagamento" value={form.supplier_expected_payment_on} onChange={(e) => set("supplier_expected_payment_on", e.target.value)} /></FormField>
        <FormField label="Previsão de recebimento"><Input type="date" aria-label="Previsão de recebimento" value={form.client_expected_receipt_on} onChange={(e) => set("client_expected_receipt_on", e.target.value)} /></FormField>
        {error ? <p role="alert" className="text-sm text-destructive-text sm:col-span-2">{error}</p> : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>Voltar</Button>
          <Button type="submit" loading={create.isPending}>Lançar pedido</Button>
        </div>
      </form>
    </ModalForm>
  );
}
