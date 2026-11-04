import { navigationHref } from "@/features/projects/navigationContext";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { DataTable } from "@/components/base/DataTable";
import { Pagination } from "@/components/base/Pagination";
import { ErrorState, LoadingState } from "@/components/base/States";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import {
  cls,
  dreApi,
  groups,
  money,
  scope,
  type Account,
  type Entry,
  type Source,
} from "./dreApi";
const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  recognized: "Reconhecido",
  excluded: "Excluído por decisão documentada",
  void: "Estornado gerencialmente",
};
export function DreEntryForm({
  initial,
  source,
  accounts,
  onSave,
}: {
  initial?: Entry;
  source?: Source;
  accounts: Account[];
  onSave: (d: object) => Promise<void>;
}) {
  const src = initial?.data.source ?? source,
    [kind, setKind] = useState(src?.kind ?? "manual"),
    [key] = useState(crypto.randomUUID()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [allocations, setAllocations] = useState(
    initial?.data.allocations.map((a) => ({
      month: a.month,
      amount: a.amount,
      account_id: String(a.account?.id ?? ""),
    })) ?? [
      {
        month: new Date().toISOString().slice(0, 7),
        amount: source?.amount ?? "",
        account_id: "",
      },
    ],
  );
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget),
          v = (k: string) => String(f.get(k) ?? "").trim();
        try {
          await onSave({
            source_kind: kind,
            ...(kind !== "manual" ? { source_id: Number(v("source_id")) } : {}),
            ...(v("project_id") ? { project_id: Number(v("project_id")) } : {}),
            economic_key: v("economic_key"),
            event_document: v("event_document"),
            description: v("description"),
            currency: v("currency"),
            currency_reason: v("currency_reason"),
            status: v("status"),
            allocations: allocations.map((a) => ({
              month: a.month,
              amount: a.amount,
              account_id: a.account_id ? Number(a.account_id) : null,
            })),
            reason: v("reason"),
            command_key: key,
            ...(initial ? { revision: initial.revision } : {}),
          });
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm">
        Reconhecimento econômico explícito. A data de pagamento não define
        competência. Valores e contas abaixo devem corresponder ao evento
        documentado.
      </p>
      <label className="grid gap-1 text-sm">
        Origem
        <select
          className={cls}
          name="source_kind"
          value={kind}
          disabled={!!initial || !!source}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="manual">Evento documental manual</option>
          <option value="receivable">Recebível</option>
          <option value="expense">Despesa</option>
          <option value="payment">Pagamento de inventariante</option>
        </select>
      </label>
      {kind !== "manual" && (
        <label className="grid gap-1 text-sm">
          ID da origem
          <input
            name="source_id"
            className={cls}
            type="number"
            min={1}
            defaultValue={src?.id ?? ""}
            readOnly={!!initial || !!source}
            required
          />
        </label>
      )}
      <label className="grid gap-1 text-sm">
        Projeto (ID, opcional)
        <input
          name="project_id"
          className={cls}
          type="number"
          min={1}
          defaultValue={initial?.projectId ?? src?.project_id ?? ""}
          readOnly={!!initial || !!source}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Chave do fato econômico
        <input
          name="economic_key"
          className={cls}
          required
          minLength={3}
          defaultValue={initial?.data.economic_key ?? source?.key ?? ""}
          readOnly={!!initial}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Documento e evidência do evento
        <input
          name="event_document"
          className={cls}
          required
          minLength={5}
          defaultValue={initial?.data.event_document ?? ""}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Descrição
        <input
          name="description"
          className={cls}
          required
          minLength={3}
          defaultValue={initial?.data.description ?? source?.description ?? ""}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Moeda
        <select
          className={cls}
          name="currency"
          defaultValue={initial?.data.currency ?? source?.currency ?? "BRL"}
          disabled={!!initial}
        >
          {["BRL", "USD", "EUR"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {initial && (
          <input type="hidden" name="currency" value={initial.data.currency} />
        )}
      </label>
      <label className="grid gap-1 text-sm">
        Justificativa documental da moeda
        <input
          name="currency_reason"
          className={cls}
          defaultValue={initial?.data.currency_reason ?? ""}
          required={kind === "expense" || kind === "payment"}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Situação do reconhecimento
        <select
          className={cls}
          name="status"
          defaultValue={initial?.data.status ?? "recognized"}
        >
          {Object.entries(statusLabels).map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-3 rounded-xl border p-3">
        <legend className="px-1 font-semibold">
          Alocações por competência
        </legend>
        <p className="text-xs text-muted-foreground">
          Sem conta, o valor permanece não classificado. Use ponto decimal,
          exemplo 100.01.
        </p>
        {allocations.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3">
            <label className="grid gap-1 text-sm">
              Competência {i + 1}
              <input
                className={cls}
                type="month"
                required
                value={a.month}
                onChange={(e) => {
                  const v = e.target.value;
                  setAllocations((rows) =>
                    rows.map((r, n) => (n === i ? { ...r, month: v } : r)),
                  );
                }}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Valor {i + 1}
              <input
                className={cls}
                required
                value={a.amount}
                onChange={(e) => {
                  const v = e.target.value;
                  setAllocations((rows) =>
                    rows.map((r, n) => (n === i ? { ...r, amount: v } : r)),
                  );
                }}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Conta gerencial {i + 1}
              <select
                className={cls}
                value={a.account_id}
                onChange={(e) => {
                  const v = e.target.value;
                  setAllocations((rows) =>
                    rows.map((r, n) => (n === i ? { ...r, account_id: v } : r)),
                  );
                }}
              >
                <option value="">Não classificado</option>
                {accounts
                  .filter((c) => c.data.active && c.data.posting)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.data.name} · {groups[c.data.group]}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setAllocations((rows) => rows.filter((_, n) => n !== i))
              }
            >
              Remover alocação {i + 1}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setAllocations((rows) => [
              ...rows,
              {
                month: new Date().toISOString().slice(0, 7),
                amount: "",
                account_id: "",
              },
            ])
          }
        >
          Adicionar competência
        </Button>
      </fieldset>
      <label className="grid gap-1 text-sm">
        Justificativa
        <input className={cls} name="reason" required minLength={5} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" required />
        Confirmo a competência e a evidência econômica, sem inferir
        receita/custo a partir da baixa financeira.
      </label>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>
        {initial ? "Salvar ajuste auditável" : "Confirmar reconhecimento"}
      </Button>
    </form>
  );
}
export function DreEntriesPage() {
  const [p, setP] = useSearchParams(),
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    cache = useQueryClient(),
    navigate = useNavigate(),
    f = { ...scope(p), page: p.get("page") ?? "1" };
  const q = useQuery({
      queryKey: ["dre", "entries", user?.id, f],
      queryFn: () => dreApi.entries(f),
    }),
    sources = useQuery({
      queryKey: ["dre", "sources", user?.id, f],
      queryFn: () => dreApi.sources(f),
      enabled: hasPermission("dre:classify"),
    }),
    accounts = useQuery({
      queryKey: ["dre", "accounts", user?.id, scope(p, false)],
      queryFn: () => dreApi.accounts(scope(p, false)),
    });
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Source>();
  return (
    <div className="grid gap-4">
      <h3 className="font-semibold">Reconhecimentos econômicos</h3>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget),
            next = new URLSearchParams(p);
          const project = String(fd.get("project") ?? "");
          if (project) next.set("project_id", project);
          else next.delete("project_id");
          next.delete("page");
          setP(next);
        }}
      >
        <label className="text-sm">
          Projeto (ID)
          <input
            className={cls}
            name="project"
            type="number"
            min={1}
            defaultValue={p.get("project_id") ?? ""}
          />
        </label>
        <Button type="submit">Filtrar projeto</Button>
        {hasPermission("dre:classify") && (
          <Button
            type="button"
            onClick={() => {
              setSelected(undefined);
              setOpen(true);
            }}
          >
            Novo evento manual
          </Button>
        )}
      </form>
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={q.error.message} />
      ) : (
        q.data && (
          <>
            <DataTable
              items={q.data.items}
              getKey={(r) => r.id}
              columns={[
                {
                  header: "Fato",
                  cell: (r) => (
                    <Link
                      className="text-primary"
                      to={
                        navigationHref("/app/finance/dre/entries/" + r.id, p)
                      }
                    >
                      {r.data.description}
                    </Link>
                  ),
                },
                { header: "Chave econômica", cell: (r) => r.data.economic_key },
                {
                  header: "Origem",
                  cell: (r) => r.data.source.key ?? "Manual",
                },
                {
                  header: "Situação",
                  cell: (r) => statusLabels[r.data.status],
                },
                {
                  header: "Competências",
                  cell: (r) =>
                    r.data.allocations.map((a) => a.month).join(", "),
                },
                { header: "Revisão", cell: (r) => r.revision },
              ]}
            />
            <Pagination
              page={Number(f.page)}
              totalPages={Math.ceil(q.data.total / 20)}
              onPageChange={(page) => {
                const next = new URLSearchParams(p);
                next.set("page", String(page));
                setP(next);
              }}
            />
          </>
        )
      )}
      {hasPermission("dre:classify") && (
        <>
          <h3 className="font-semibold">
            Fontes elegíveis — classificação explícita
          </h3>
          <p className="text-sm text-muted-foreground">
            Não são receitas ou custos reconhecidos automaticamente. A data de
            origem não é a competência. Fontes exigem suas leituras específicas.
          </p>
          {sources.error ? (
            <ErrorState message={sources.error.message} />
          ) : (
            sources.data && (
              <>
                <p className="text-sm">{sources.data.note}</p>
                <DataTable
                  items={sources.data.items}
                  getKey={(s) => s.key!}
                  columns={[
                    { header: "Origem", cell: (s) => s.key },
                    { header: "Descrição", cell: (s) => s.description },
                    {
                      header: "Valor documental",
                      cell: (s) =>
                        s.currency && s.amount
                          ? money(s.amount, s.currency)
                          : s.amount + " · moeda não informada",
                    },
                    {
                      header: "Data de referência",
                      cell: (s) => s.hint_date ?? "Não informada",
                    },
                    {
                      header: "Ação",
                      cell: (s) =>
                        s.entry_id ? (
                          <Link
                            className="text-primary"
                            to={
                              navigationHref("/app/finance/dre/entries/" + s.entry_id, p)
                            }
                          >
                            Consultar classificação
                          </Link>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSelected(s);
                              setOpen(true);
                            }}
                          >
                            Classificar {s.key}
                          </Button>
                        ),
                    },
                  ]}
                />
              </>
            )
          )}
        </>
      )}
      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title="Reconhecer e classificar evento"
      >
        {accounts.error ? (
          <ErrorState message={accounts.error.message} />
        ) : accounts.data ? (
          <DreEntryForm
            source={selected}
            accounts={accounts.data}
            onSave={async (d) => {
              const r = await dreApi.saveEntry(undefined, d, scope(p, false));
              await cache.invalidateQueries({ queryKey: ["dre"] });
              setOpen(false);
              navigate(
                "/app/finance/dre/entries/" +
                  r.id +
                  "?" +
                  new URLSearchParams({
                    ...scope(p),
                    ...(r.projectId ? { project_id: String(r.projectId) } : {}),
                  }),
              );
            }}
          />
        ) : (
          <LoadingState />
        )}
      </ModalForm>
    </div>
  );
}
export function DreEntryDetailPage() {
  const { entryId = "" } = useParams(),
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    cache = useQueryClient(),
    [p] = useSearchParams(),
    [open, setOpen] = useState(false);
  const q = useQuery({
      queryKey: ["dre", "entry", user?.id, entryId],
      queryFn: () => dreApi.entry(Number(entryId)),
    }),
    accounts = useQuery({
      queryKey: ["dre", "accounts", user?.id, scope(p, false)],
      queryFn: () => dreApi.accounts(scope(p, false)),
    });
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState message={q.error?.message} />;
  const r = q.data;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{r.data.description}</h3>
        {hasPermission("dre:adjust") && hasPermission("dre:classify") && (
          <Button onClick={() => setOpen(true)}>Reclassificar / ajustar</Button>
        )}
      </div>
      <p className="text-sm">
        Fato #{r.id} · {statusLabels[r.data.status]} · Revisão {r.revision} ·{" "}
        {r.data.economic_key}
      </p>
      <p className="text-sm">
        Documento: {r.data.event_document} · Origem:{" "}
        {r.data.source.key ?? "Manual"}
      </p>
      <DataTable
        items={r.data.allocations}
        getKey={(a) => a.month + ":" + a.account?.id}
        columns={[
          { header: "Competência", cell: (a) => a.month },
          {
            header: "Conta",
            cell: (a) => a.account?.path.join(" / ") ?? "Não classificado",
          },
          { header: "Valor", cell: (a) => money(a.amount, r.data.currency) },
        ]}
      />
      <h3 className="font-semibold">Histórico imutável de ajustes</h3>
      <DataTable
        items={r.versions ?? []}
        getKey={(v) => v.id}
        columns={[
          { header: "Versão", cell: (v) => v.revision },
          { header: "Situação", cell: (v) => statusLabels[v.data.status] },
          {
            header: "Competências e contas",
            cell: (v) =>
              v.data.allocations
                .map(
                  (a) =>
                    `${a.month}: ${a.account?.name ?? "Não classificado"} ${money(a.amount, v.data.currency)}`,
                )
                .join(" · "),
          },
          { header: "Motivo", cell: (v) => v.reason },
          {
            header: "Auditoria",
            cell: (v) =>
              `Usuário #${v.actorId} · ${new Date(v.recordedAt).toLocaleString("pt-BR")}`,
          },
        ]}
      />
      <Link
        className="text-primary"
        to={
          "/app/finance/dre?" +
          new URLSearchParams({
            ...scope(p),
            ...(r.projectId ? { project_id: String(r.projectId) } : {}),
            start_month:
              r.data.allocations[0]?.month ??
              new Date().toISOString().slice(0, 7),
            end_month:
              r.data.allocations.at(-1)?.month ??
              new Date().toISOString().slice(0, 7),
          })
        }
      >
        Consultar demonstrativo por competência
      </Link>
      <Link
        className="text-primary"
        to={navigationHref("/app/finance/dre/entries", p)}
      >
        Voltar às classificações
      </Link>
      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title="Ajuste e reclassificação auditável"
      >
        {accounts.data ? (
          <DreEntryForm
            initial={r}
            accounts={accounts.data}
            onSave={async (d) => {
              await dreApi.saveEntry(r.id, d, scope(p, false));
              await cache.invalidateQueries({ queryKey: ["dre"] });
              setOpen(false);
            }}
          />
        ) : (
          <LoadingState />
        )}
      </ModalForm>
    </div>
  );
}
