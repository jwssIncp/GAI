import { formatValuationDate } from "./valuationFormatting";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Pagination } from "@/components/base/Pagination";
import { DataTable, type Column } from "@/components/base/DataTable";
import { PermissionGate } from "@/features/auth/PermissionGate";
import { exportJobsApi } from "@/api/endpoints";
import { ApiError } from "@/api/http";
import { formatDateTime, formatMoney } from "@/utils/format";
import { createIdempotencyKey } from "@/features/inventory-operations/idempotency";
import type { InventoryItem } from "@/types/api";
import {
  valuationBatchApi,
  type BatchSummary,
  type BatchInput,
  type ValuationBatchResult,
  type ValuationFilters,
  type ValuationSelection,
  type ValuationSnapshot,
} from "./valuationBatchApi";
export interface BatchSelectionState {
  contract: ValuationSelection;
  ids: number[];
}
export function ValuationBatchPanel({
  projectId: p,
  selection,
  currentItems,
  filters,
  onSelection,
  onViewItem,
}: {
  projectId: number;
  selection: BatchSelectionState;
  currentItems: InventoryItem[];
  filters: ValuationFilters;
  onSelection: (s: BatchSelectionState) => void;
  onViewItem: (id: number) => void;
}) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<ValuationSnapshot[]>([]),
    [mode, setMode] = useState<"common" | "individual">("common");
  const [source, setSource] = useState(""),
    [date, setDate] = useState(""),
    [newValue, setNew] = useState(""),
    [usedValue, setUsed] = useState(""),
    [notes, setNotes] = useState("");
  const [individual, setIndividual] = useState<
    Record<number, { new_value: string; used_value: string }>
  >({});
  const [batch, setBatch] = useState<ValuationBatchResult | null>(null),
    [command, setCommand] = useState(""),
    [historyPage, setHistoryPage] = useState(1);
  const qc = useQueryClient(),
    root = ["valuation-batches", p];
  const history = useQuery({
    queryKey: [...root, historyPage],
    queryFn: () => valuationBatchApi.list(p, historyPage),
  });
  const resolve = useMutation({
    mutationFn: ({
      contract,
      show,
    }: {
      contract: ValuationSelection;
      show: boolean;
    }) =>
      valuationBatchApi
        .selection(p, contract)
        .then((data) => ({ data, contract, show })),
    onSuccess: ({ data, contract, show }) => {
      onSelection({ contract, ids: data.items.map((i) => i.id) });
      setItems(data.items);
      setIndividual(
        Object.fromEntries(
          data.items.map((i) => [i.id, { new_value: "", used_value: "" }]),
        ),
      );
      if (show) {
        setBatch(null);
        setCommand(createIdempotencyKey());
        setOpen(true);
        preview.reset();
        confirm.reset();
      }
    },
  });
  const load = useMutation({
    mutationFn: (id: number) => valuationBatchApi.get(p, id),
    onSuccess: (data) => {
      setBatch(data);
      setItems(data.items.map((r) => r.snapshot));
      onSelection({
        contract: data.request.selection,
        ids: data.items.map((r) => r.inventoryItemId),
      });
      setMode(data.request.mode);
      setSource(data.request.common.source);
      setDate(data.request.common.valuation_date);
      setNew(data.request.common.new_value ?? "");
      setUsed(data.request.common.used_value ?? "");
      setNotes(data.request.common.notes ?? "");
      setIndividual(
        Object.fromEntries(
          data.items.map((r) => [
            r.inventoryItemId,
            {
              new_value: r.proposed.newValue ?? "",
              used_value: r.proposed.usedValue ?? "",
            },
          ]),
        ),
      );
      setOpen(true);
      confirm.reset();
    },
  });
  const preview = useMutation({
    mutationFn: () => {
      const dto: BatchInput = {
        selection: selection.contract,
        mode,
        common: {
          source,
          valuation_date: date,
          new_value: mode === "common" ? newValue || null : null,
          used_value: mode === "common" ? usedValue || null : null,
          notes: notes || null,
        },
        command_key: command,
      };
      if (mode === "individual")
        dto.values = items.map((i) => ({
          inventory_item_id: i.id,
          new_value: individual[i.id]?.new_value || null,
          used_value: individual[i.id]?.used_value || null,
        }));
      return valuationBatchApi.preview(p, dto);
    },
    onSuccess: (data) => {
      setBatch(data);
      void qc.invalidateQueries({ queryKey: root });
    },
  });
  const confirm = useMutation({
    mutationFn: () => valuationBatchApi.confirm(p, batch!),
    onSuccess: async (data) => {
      setBatch(data);
      onSelection({ contract: { kind: "ids", ids: [] }, ids: [] });
      await Promise.all([
        qc.invalidateQueries({ queryKey: root }),
        qc.invalidateQueries({ queryKey: ["asset-valuations", p] }),
        qc.invalidateQueries({ queryKey: ["inventory-items", "project", p] }),
      ]);
    },
  });
  const exportResult = useMutation({
    mutationFn: () => exportJobsApi.create(p, "valuation_batches_xlsx"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["export-jobs", p] });
    },
  });
  function change() {
    setBatch(null);
    setCommand(createIdempotencyKey());
    preview.reset();
    confirm.reset();
  }
  const resultColumns: Column<ValuationBatchResult["items"][number]>[] = [
    {
      header: "Item / patrimônio",
      cell: (r) => (
        <span>
          #{r.inventoryItemId} ·{" "}
          {r.snapshot.new_plate || r.snapshot.old_plate || "Sem placa"}
          <br />
          {r.snapshot.description || "Sem descrição"}
        </span>
      ),
    },
    {
      header: "Última avaliação",
      cell: (r) =>
        r.snapshot.last_valuation ? (
          <span>
            {formatValuationDate(r.snapshot.last_valuation.valuation_date)} ·{" "}
            {r.snapshot.last_valuation.source}
            <br />
            Novo {formatMoney(r.snapshot.last_valuation.new_value)} · usado{" "}
            {formatMoney(r.snapshot.last_valuation.used_value)}
          </span>
        ) : (
          "Sem histórico"
        ),
    },
    {
      header: "Nova avaliação",
      cell: (r) => (
        <span>
          {r.proposed.source} · {formatValuationDate(r.proposed.valuationDate)}
          <br />
          Novo {formatMoney(r.proposed.newValue)} · usado{" "}
          {formatMoney(r.proposed.usedValue)}
        </span>
      ),
    },
    {
      header: "Resultado",
      cell: (r) => (
        <span>
          {r.valuationId
            ? `Aprovado · avaliação #${r.valuationId}`
            : "Prévia · aguardando confirmação"}
          <br />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              onViewItem(r.inventoryItemId);
            }}
          >
            Histórico do item #{r.inventoryItemId}
          </Button>
        </span>
      ),
    },
  ];
  return (
    <section className="grid gap-3" aria-label="Avaliação patrimonial em lote">
      <div>
        <h2 className="text-lg font-bold">Avaliação patrimonial em lote</h2>
        <p className="text-sm text-muted-foreground">
          Novos registros históricos com fonte documentada. Cadastro mestre,
          observações e conciliações são preservados. Limite atual:{" "}
          {history.data?.limit ?? "…"} itens por operação.
        </p>
      </div>
      <PermissionGate
        permissions={[
          "asset-valuations:create",
          "asset-valuations:batch-create",
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span aria-live="polite" className="text-sm font-semibold">
            {selection.ids.length} itens selecionados
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              const ids = [
                ...new Set([
                  ...selection.ids,
                  ...currentItems.map((i) => i.id),
                ]),
              ];
              onSelection({ ids, contract: { kind: "ids", ids } });
            }}
          >
            Selecionar página
          </Button>
          <Button
            variant="secondary"
            disabled={resolve.isPending}
            onClick={() =>
              resolve.mutate({
                contract: { kind: "filters", filters, exclude_ids: [] },
                show: false,
              })
            }
          >
            Selecionar todos dos filtros
          </Button>
          <Button
            variant="ghost"
            disabled={!selection.ids.length}
            onClick={() =>
              onSelection({ ids: [], contract: { kind: "ids", ids: [] } })
            }
          >
            Limpar seleção
          </Button>
          <Button
            disabled={!selection.ids.length || resolve.isPending}
            onClick={() =>
              resolve.mutate({ contract: selection.contract, show: true })
            }
          >
            Avaliar selecionados
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Seleção atual:{" "}
          {selection.contract.kind === "filters"
            ? "todos dos filtros confirmados pelo servidor"
            : "IDs explícitos, preservados entre páginas"}
          . Alterar manualmente a seleção fixa os IDs; usar os filtros novamente
          exige selecionar todos outra vez.
        </p>
      </PermissionGate>
      {resolve.error ? <BatchError error={resolve.error} /> : null}
      {load.error ? <BatchError error={load.error} /> : null}
      <details className="premium-panel p-4">
        <summary className="cursor-pointer font-semibold">
          Operações anteriores
        </summary>
        {history.isLoading ? (
          <LoadingState label="Carregando operações de avaliação" />
        ) : history.error ? (
          <BatchError error={history.error} />
        ) : history.data?.items.length ? (
          <div className="mt-3 grid gap-2">
            {history.data.items.map((op) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                key={op.id}
              >
                <span>
                  Operação #{op.id} · {op.total} itens ·{" "}
                  {op.status === "applied" ? "Aplicada" : "Prévia"} ·{" "}
                  {formatDateTime(op.createdAt)}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={load.isPending}
                  onClick={() => load.mutate(op.id)}
                >
                  Consultar operação #{op.id}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm">Nenhuma operação registrada.</p>
        )}
        {(history.data?.total ?? 0) > 10 ? (
          <Pagination
            page={historyPage}
            totalPages={Math.max(1, Math.ceil((history.data?.total ?? 0) / 10))}
            onPageChange={setHistoryPage}
          />
        ) : null}
      </details>
      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title={
          batch?.status === "applied"
            ? `Resultado da avaliação · operação #${batch.id}`
            : "Avaliar itens selecionados"
        }
      >
        <div className="grid gap-4">
          {!batch ? (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                preview.mutate();
              }}
            >
              <p className="text-sm">
                Projeto #{p} · {items.length} itens. Gere a prévia e confira os
                dados antes de confirmar.
              </p>
              <label className="grid gap-1 text-sm">
                Modo de valores
                <select
                  aria-label="Modo de valores"
                  className="h-10 rounded-md border bg-background px-3"
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value as typeof mode);
                    change();
                  }}
                >
                  <option value="common">Valores comuns</option>
                  <option value="individual">Valores individualizados</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Fonte da avaliação em lote
                <input
                  required
                  maxLength={255}
                  className="h-10 rounded-md border bg-background px-3"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    change();
                  }}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Data da avaliação em lote
                <input
                  required
                  type="date"
                  className="h-10 rounded-md border bg-background px-3"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    change();
                  }}
                />
              </label>
              {mode === "common" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Money
                    label="Valor novo comum"
                    value={newValue}
                    onChange={(v) => {
                      setNew(v);
                      change();
                    }}
                  />
                  <Money
                    label="Valor usado comum"
                    value={usedValue}
                    onChange={(v) => {
                      setUsed(v);
                      change();
                    }}
                  />
                </div>
              ) : (
                <div className="grid max-h-80 gap-3 overflow-auto">
                  {items.map((item) => (
                    <fieldset className="rounded-md border p-3" key={item.id}>
                      <legend className="text-sm">
                        Item #{item.id} ·{" "}
                        {item.new_plate || item.old_plate || "Sem placa"} ·{" "}
                        {item.description}
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Money
                          label={`Valor novo do item ${item.id}`}
                          value={individual[item.id]?.new_value ?? ""}
                          onChange={(v) => {
                            setIndividual({
                              ...individual,
                              [item.id]: {
                                ...individual[item.id],
                                new_value: v,
                              },
                            });
                            change();
                          }}
                        />
                        <Money
                          label={`Valor usado do item ${item.id}`}
                          value={individual[item.id]?.used_value ?? ""}
                          onChange={(v) => {
                            setIndividual({
                              ...individual,
                              [item.id]: {
                                ...individual[item.id],
                                used_value: v,
                              },
                            });
                            change();
                          }}
                        />
                      </div>
                    </fieldset>
                  ))}
                </div>
              )}
              <label className="grid gap-1 text-sm">
                Observações da avaliação
                <textarea
                  maxLength={4000}
                  className="min-h-20 rounded-md border bg-background p-3"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    change();
                  }}
                />
              </label>
              <Button
                type="submit"
                disabled={preview.isPending || !source.trim() || !date}
              >
                Gerar prévia da avaliação
              </Button>
            </form>
          ) : (
            <>
              <p className="font-semibold">
                {batch.project.name} · Projeto #{batch.project.id} · Operação #
                {batch.id}
              </p>
              <div className="premium-panel grid grid-cols-2 gap-3 p-4 text-sm">
                {Object.entries(batch.summary)
                  .filter(([k]) => k !== "errors")
                  .map(([k, v]) => (
                    <p key={k}>
                      {
                        (
                          {
                            total_requested: "Solicitados",
                            total_processed: "Processados",
                            total_approved: "Aprovados",
                            total_rejected: "Rejeitados",
                          } as Record<string, string>
                        )[k]
                      }
                      : <strong>{String(v)}</strong>
                    </p>
                  ))}
              </div>
              <DataTable
                columns={resultColumns}
                items={batch.items}
                getKey={(r) => r.inventoryItemId}
              />
              {batch.status === "preview" ? (
                <PermissionGate
                  permissions={[
                    "asset-valuations:create",
                    "asset-valuations:batch-create",
                  ]}
                >
                  <p className="text-sm text-muted-foreground">
                    A confirmação é atômica: qualquer alteração nas fontes
                    bloqueia o lote inteiro. Nenhuma avaliação anterior será
                    substituída. Prévia válida por 30 minutos.
                  </p>
                  {batch.expired ? (
                    <p role="alert">Prévia expirada. Gere uma nova.</p>
                  ) : null}
                  <Button
                    disabled={confirm.isPending || batch.expired}
                    onClick={() => confirm.mutate()}
                  >
                    Confirmar e registrar {batch.total} avaliações
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={confirm.isPending}
                    onClick={() => {
                      setBatch(null);
                      setCommand(createIdempotencyKey());
                    }}
                  >
                    Voltar e gerar nova prévia
                  </Button>
                </PermissionGate>
              ) : (
                <>
                  <p className="text-sm">
                    Aplicação confirmada em {formatDateTime(batch.confirmedAt)}{" "}
                    pelo usuário #{batch.confirmedById}. Histórico individual
                    preservado.
                  </p>
                  <PermissionGate
                    permissions={[
                      "export-jobs:create",
                      "asset-valuations:read",
                      "inventory-items:read",
                    ]}
                  >
                    <Button
                      variant="secondary"
                      disabled={exportResult.isPending}
                      onClick={() => exportResult.mutate()}
                    >
                      Exportar resultados do projeto em XLSX
                    </Button>
                    <Link
                      className="text-sm text-primary underline"
                      to={`/app/projects/${p}/export-jobs`}
                    >
                      Consultar exportações e baixar arquivo
                    </Link>
                    {exportResult.isSuccess ? (
                      <p className="text-sm">
                        Exportação #{exportResult.data.id} solicitada. O arquivo
                        inclui as operações aplicadas deste projeto,
                        identificadas por ID.
                      </p>
                    ) : null}
                  </PermissionGate>
                </>
              )}
            </>
          )}
          {preview.error ? <BatchError error={preview.error} /> : null}
          {confirm.error ? <BatchError error={confirm.error} /> : null}
          {exportResult.error ? (
            <BatchError error={exportResult.error} />
          ) : null}
        </div>
      </ModalForm>
    </section>
  );
}
function Money({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        inputMode="decimal"
        pattern="\d{1,13}(\.\d{1,2})?"
        placeholder="1234.56"
        className="h-10 rounded-md border bg-background px-3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function BatchError({ error }: { error: unknown }) {
  const extra = error instanceof ApiError ? error.rawDetails : null;
  const details = extra as {
    summary?: Partial<BatchSummary>;
    errors?: unknown[];
  } | null;
  return (
    <div>
      <ErrorState
        message={
          error instanceof Error
            ? error.message
            : "Falha ao processar avaliação."
        }
      />
      {details?.summary ? (
        <p className="text-sm">
          Solicitados: {details.summary.total_requested} · Processados:{" "}
          {details.summary.total_processed} · Aprovados:{" "}
          {details.summary.total_approved} · Rejeitados:{" "}
          {details.summary.total_rejected}
        </p>
      ) : null}
      {Array.isArray(details?.errors)
        ? details.errors.map((e: unknown, i) => {
            const row = e as { inventory_item_id?: number; reason?: string };
            return row && typeof row.reason === "string" ? (
              <p className="text-sm" key={i}>
                Item #{row.inventory_item_id}: {row.reason}
              </p>
            ) : null;
          })
        : null}
    </div>
  );
}
