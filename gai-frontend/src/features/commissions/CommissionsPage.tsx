import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { FilterPanel } from "@/components/base/FilterPanel";
import { FormField } from "@/components/base/FormField";
import { InlineEdit } from "@/components/base/InlineEdit";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ModalForm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/features/auth/usePermissions";
import { moneyBr, normalizeMoney } from "@/features/remuneration/remunerationApi";
import { formatMoney } from "@/utils/format";
import {
  COMMISSION_STATUS_LABEL,
  civilBr,
  commissionAmount,
  commissionsApi,
  commissionsKeys,
  normalizePercent,
  pctBr,
  type CommissionFilters,
  type CommissionInput,
  type CommissionList,
  type CommissionRow,
  type CommissionStatus,
  type Partner,
} from "./commissionsApi";

const select = "h-10 max-w-[14rem] rounded-md border bg-background px-3 text-sm";
const ADD_PARTNER = "__add__";
const STATUS_CLASS: Record<CommissionStatus, string> = {
  paid: "bg-success/15 text-success",
  overdue: "bg-destructive/15 text-destructive",
  pending: "bg-warning/20",
};

function Kpi({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-3 ${alert ? "border-destructive/50" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${alert ? "text-destructive" : ""}`}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Financeiro › Comissões (doc 06 §6). */
export function CommissionsPage() {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("commissions:edit");
  const canPartners = hasPermission("commission-partners:edit");
  const cache = useQueryClient();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<CommissionFilters>(() => {
    const p = Number(params.get("project_id"));
    return p ? { project_id: p } : {};
  });
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<CommissionRow | null>(null);
  const [partnersOpen, setPartnersOpen] = useState(false);
  const query = useQuery({ queryKey: commissionsKeys.list(filters), queryFn: () => commissionsApi.list(filters) });
  const refresh = () => cache.invalidateQueries({ queryKey: commissionsKeys.all });
  const save = async (id: number, payload: CommissionInput) => {
    await commissionsApi.update(id, payload);
    await refresh();
  };
  const remove = useMutation({
    mutationFn: (id: number) => commissionsApi.remove(id),
    onSuccess: async () => {
      setRemoving(null);
      await refresh();
    },
  });
  const setFilter = (key: keyof CommissionFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value === "" ? undefined : key === "status" ? value : Number(value) }));

  if (query.isLoading) return <LoadingState label="Carregando comissões" />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  const data = query.data!;
  const k = data.kpis;
  const cell = "whitespace-nowrap border-b px-2 py-2";

  return (
    <div className="grid gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Comissão = valor do contrato × % ÷ 100; o valor informado à mão prevalece (apague para voltar ao cálculo). Status automático:
        Pago com data de pagamento, Atrasado se a data prevista já passou, senão Pendente.
      </p>
      <section aria-label="Indicadores das comissões" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Total de comissões" value={formatMoney(k.total)} />
        <Kpi label="Pagas" value={formatMoney(k.paid)} />
        <Kpi label="Pendentes" value={formatMoney(k.pending)} />
        <Kpi label="Atrasadas" value={formatMoney(k.overdue)} hint={`${k.overdue_count} comissão(ões) com a prevista vencida`} alert={k.overdue_count > 0} />
      </section>
      <FilterPanel>
        <select aria-label="Filtrar por contrato" className={select} value={filters.project_id ?? ""} onChange={(e) => setFilter("project_id", e.target.value)}>
          <option value="">Contrato: todos</option>
          {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Filtrar por parceiro" className={select} value={filters.partner_id ?? ""} onChange={(e) => setFilter("partner_id", e.target.value)}>
          <option value="">Parceiro: todos</option>
          {data.partners.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select aria-label="Filtrar por status" className={select} value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">Status: todos</option>
          {(Object.keys(COMMISSION_STATUS_LABEL) as CommissionStatus[]).map((s) => <option key={s} value={s}>{COMMISSION_STATUS_LABEL[s]}</option>)}
        </select>
        <Button type="button" variant="ghost" onClick={() => setFilters({})}>Limpar</Button>
        <Button type="button" variant="secondary" onClick={() => setPartnersOpen(true)}>Parceiros ({data.partners.length})</Button>
        {canEdit ? <Button type="button" onClick={() => setCreating(true)}><Plus size={16} /> Nova comissão</Button> : null}
      </FilterPanel>

      <div className="premium-panel">
        <div className="overflow-x-auto" role="region" aria-label="Lançamentos de comissões" tabIndex={0}>
          <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                {["Contrato", "Parceiro", "Valor do contrato", "% comissão", "Valor da comissão", "Data prevista", "Data de pagamento", "Status", ""].map((h, i) => (
                  <th key={`${h}-${i}`} scope="col" className={`whitespace-nowrap border-b px-2 py-3 font-semibold ${i === 0 ? "sticky left-0 z-10 bg-muted" : ""}`}>{h || <span className="sr-only">Ações</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} className={r.status === "overdue" ? "bg-destructive/[0.06]" : "hover:bg-primary/[0.05]"}>
                  <td className={`${cell} sticky left-0 z-10 max-w-[14rem] truncate bg-card`} title={r.project_name}>
                    <InlineEdit label="Contrato" kind="select" value={String(r.project_id)} disabled={!canEdit}
                      options={data.projects.filter((p) => p.open || p.id === r.project_id).map((p) => ({ value: String(p.id), label: p.name }))}
                      onSave={(v) => save(r.id, { project_id: Number(v) })} />
                  </td>
                  <td className={cell}>
                    <InlineEdit label="Parceiro" kind="select" value={String(r.partner_id)} disabled={!canEdit}
                      display={r.partner_name}
                      options={[...(data.partners.some((p) => p.id === r.partner_id) ? [] : [{ value: String(r.partner_id), label: r.partner_name }]), ...data.partners.map((p) => ({ value: String(p.id), label: p.label }))]}
                      onSave={(v) => save(r.id, { partner_id: Number(v) })} />
                  </td>
                  <td className={`${cell} tabular-nums`}>
                    <InlineEdit label="Valor do contrato" kind="money" value={r.contract_value} format={(v) => formatMoney(v)} parse={(t) => normalizeMoney(t)} disabled={!canEdit}
                      onSave={(v) => save(r.id, { contract_value: v })} />
                  </td>
                  <td className={`${cell} tabular-nums`}>
                    <InlineEdit label="% comissão" kind="number" value={r.percent} format={pctBr} parse={normalizePercent} disabled={!canEdit}
                      onSave={(v) => save(r.id, { percent: v })} />
                  </td>
                  <td className={`${cell} font-semibold tabular-nums`}>
                    <InlineEdit label="Valor da comissão" kind="money" value={r.amount_manual ?? ""} disabled={!canEdit}
                      display={<span title={r.amount_manual ? `Informado à mão (calculado: ${formatMoney(r.calculated_amount)})` : "Calculado: valor × % ÷ 100"}>{formatMoney(r.amount)}{r.amount_manual ? <span className="ml-1 text-xs font-normal text-warning">manual</span> : null}</span>}
                      format={(v) => formatMoney(v)}
                      parse={(t) => (t.trim() === "" ? "" : normalizeMoney(t))}
                      onSave={(v) => save(r.id, { amount_manual: v || null })} />
                  </td>
                  <td className={cell}>
                    <InlineEdit label="Data prevista" kind="date" value={r.expected_payment_on ?? ""} format={civilBr} disabled={!canEdit} onSave={(v) => save(r.id, { expected_payment_on: v || null })} />
                  </td>
                  <td className={cell}>
                    <InlineEdit label="Data de pagamento" kind="date" value={r.paid_on ?? ""} format={civilBr} disabled={!canEdit} onSave={(v) => save(r.id, { paid_on: v || null })} />
                  </td>
                  <td className={cell}><span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[r.status]}`}>{COMMISSION_STATUS_LABEL[r.status]}</span></td>
                  <td className={cell}>
                    {canEdit ? <Button type="button" variant="ghost" className="size-8" aria-label={`Excluir comissão de ${r.partner_name} em ${r.project_name}`} title="Excluir" onClick={() => setRemoving(r)}><Trash2 size={15} /></Button> : null}
                  </td>
                </tr>
              ))}
              {!data.items.length ? <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Nenhuma comissão.</td></tr> : null}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="sticky left-0 z-10 bg-card px-2 py-3">Total ({data.totals.count})</td>
                <td />
                <td className="px-2 py-3 tabular-nums">{formatMoney(data.totals.contract_value)}</td>
                <td />
                <td className="px-2 py-3 tabular-nums">{formatMoney(data.totals.amount)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {creating ? <NewCommissionDialog data={data} projectId={filters.project_id} canPartners={canPartners} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await refresh(); }} /> : null}
      {partnersOpen ? <PartnersDialog canEdit={canPartners} onClose={() => setPartnersOpen(false)} onChanged={() => void refresh()} /> : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => {
          if (o) return;
          setRemoving(null);
          remove.reset();
        }}
        title="Excluir comissão"
        description={removing ? `Excluir a comissão de ${removing.partner_name} em ${removing.project_name} (${formatMoney(removing.amount)})?` : ""}
        busy={remove.isPending}
        error={remove.isError ? (remove.error as Error).message : null}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}

/** Cadastro rápido de parceiro (nome + empresa). Duplicado: avisa e seleciona o existente. */
function QuickPartner({ partners, onCreated, onCancel }: { partners: Partner[]; onCreated: (id: number) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cache = useQueryClient();
  const run = useMutation({
    mutationFn: () => commissionsApi.createPartner({ name: name.trim(), company: company.trim() || null }),
    onSuccess: async (r) => {
      await cache.invalidateQueries({ queryKey: commissionsKeys.all });
      onCreated(r.id);
    },
    onError: async (e) => {
      setError((e as Error).message);
      const fresh = await commissionsApi.partners();
      const fold = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
      const found = [...partners, ...fresh].find((p) => fold(p.name) === fold(name) && fold(p.company ?? "") === fold(company));
      if (found) onCreated(found.id);
    },
  });
  return (
    <div className="grid gap-2 rounded-md border p-3 sm:col-span-2">
      <p className="text-sm font-semibold">Adicionar parceiro</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input aria-label="Nome do parceiro" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <Input aria-label="Empresa do parceiro" placeholder="Empresa (opcional)" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="button" loading={run.isPending} disabled={name.trim().length < 2} onClick={() => run.mutate()}>Adicionar</Button>
      </div>
    </div>
  );
}

function NewCommissionDialog({ data, projectId, canPartners, onClose, onSaved }: { data: CommissionList; projectId?: number; canPartners: boolean; onClose: () => void; onSaved: () => void }) {
  const projectValue = (id: string) => data.projects.find((p) => String(p.id) === id)?.contract_value ?? null;
  const [project, setProject] = useState(projectId ? String(projectId) : "");
  const [partner, setPartner] = useState("");
  const [value, setValue] = useState(() => moneyBr(projectValue(projectId ? String(projectId) : "") ?? ""));
  const [percent, setPercent] = useState("");
  const [manual, setManual] = useState("");
  const [expected, setExpected] = useState("");
  const [paid, setPaid] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partners = useQuery({ queryKey: commissionsKeys.partners, queryFn: commissionsApi.partners, initialData: data.partners });
  const v = normalizeMoney(value);
  const p = normalizePercent(percent);
  const calculated = v && p ? commissionAmount(v, p) : null;
  const create = useMutation({ mutationFn: (payload: CommissionInput) => commissionsApi.create(payload), onSuccess: onSaved, onError: (e) => setError((e as Error).message) });
  const submit = () => {
    if (!project) return setError("Escolha o contrato.");
    if (!partner) return setError("Escolha o parceiro.");
    if (!v) return setError("Informe o valor do contrato.");
    if (!p) return setError("Informe o % de comissão (até 100, duas casas).");
    const m = manual.trim() ? normalizeMoney(manual) : null;
    if (manual.trim() && !m) return setError("Valor da comissão inválido.");
    create.mutate({ project_id: Number(project), partner_id: Number(partner), contract_value: v, percent: p, amount_manual: m, expected_payment_on: expected || null, paid_on: paid || null });
  };
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title="Nova comissão">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <FormField label="Contrato (projeto)">
          <select aria-label="Contrato" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={project}
            onChange={(e) => {
              setProject(e.target.value);
              // Trocar o contrato atualiza o valor com o do projeto.
              setValue(moneyBr(projectValue(e.target.value) ?? ""));
            }}>
            <option value="">Selecione</option>
            {data.projects.filter((x) => x.open).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </FormField>
        <FormField label="Parceiro">
          <select aria-label="Parceiro" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={partner}
            onChange={(e) => (e.target.value === ADD_PARTNER ? setAdding(true) : setPartner(e.target.value))}>
            <option value="">Selecione</option>
            {(partners.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            {canPartners ? <option value={ADD_PARTNER}>+ Adicionar parceiro…</option> : null}
          </select>
        </FormField>
        {adding ? (
          <QuickPartner partners={partners.data ?? []} onCancel={() => setAdding(false)} onCreated={async (id) => { await partners.refetch(); setPartner(String(id)); setAdding(false); }} />
        ) : null}
        <FormField label="Valor do contrato (R$)"><Input aria-label="Valor do contrato (R$)" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></FormField>
        <FormField label="% comissão"><Input aria-label="% comissão" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} /></FormField>
        <FormField label="Valor da comissão (R$)">
          <Input aria-label="Valor da comissão (R$)" inputMode="decimal" placeholder={calculated ? moneyBr(calculated) : ""} value={manual} onChange={(e) => setManual(e.target.value)} />
          <span className="text-xs text-muted-foreground">
            {calculated ? `Calculado: ${formatMoney(calculated)}.` : "Calculado pelo valor × %."} Preencha só para informar outro valor.
          </span>
        </FormField>
        <FormField label="Data prevista de pagamento"><Input type="date" aria-label="Data prevista de pagamento" value={expected} onChange={(e) => setExpected(e.target.value)} /></FormField>
        <FormField label="Data de pagamento"><Input type="date" aria-label="Data de pagamento" value={paid} onChange={(e) => setPaid(e.target.value)} /></FormField>
        {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={create.isPending}>Lançar comissão</Button>
        </div>
      </form>
    </ModalForm>
  );
}

function PartnersDialog({ canEdit, onClose, onChanged }: { canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: commissionsKeys.partners, queryFn: commissionsApi.partners });
  const [removing, setRemoving] = useState<Partner | null>(null);
  const [adding, setAdding] = useState(false);
  const remove = useMutation({
    mutationFn: (id: number) => commissionsApi.removePartner(id),
    onSuccess: async () => {
      setRemoving(null);
      await cache.invalidateQueries({ queryKey: commissionsKeys.all });
      onChanged();
    },
  });
  return (
    <ModalForm open onOpenChange={(o) => !o && onClose()} title="Parceiros">
      <div className="grid gap-3">
        {query.isLoading ? <LoadingState label="Carregando parceiros" /> : (
          <table className="w-full text-sm" aria-label="Parceiros">
            <thead className="text-xs text-muted-foreground"><tr><th className="text-left">Parceiro</th><th className="text-left">Comissões</th><th /></tr></thead>
            <tbody>
              {(query.data ?? []).map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{p.label}</td>
                  <td className="py-2 tabular-nums">{p.commissions ?? 0}</td>
                  <td className="py-2 text-right">
                    {canEdit ? <Button type="button" variant="ghost" className="size-8" aria-label={`Excluir parceiro ${p.label}`} title="Excluir" onClick={() => setRemoving(p)}><Trash2 size={15} /></Button> : null}
                  </td>
                </tr>
              ))}
              {!query.data?.length ? <tr><td colSpan={3} className="py-3 text-muted-foreground">Nenhum parceiro.</td></tr> : null}
            </tbody>
          </table>
        )}
        {adding ? (
          <QuickPartner partners={query.data ?? []} onCancel={() => setAdding(false)} onCreated={async () => { setAdding(false); await query.refetch(); onChanged(); }} />
        ) : canEdit ? (
          <div className="flex justify-end"><Button type="button" onClick={() => setAdding(true)}>Adicionar parceiro</Button></div>
        ) : null}
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Excluir parceiro"
        description={removing ? `Excluir ${removing.label} da lista? As ${removing.commissions ?? 0} comissão(ões) já lançadas mantêm o nome.` : ""}
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </ModalForm>
  );
}
