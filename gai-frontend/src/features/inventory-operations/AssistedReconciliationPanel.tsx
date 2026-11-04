import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/base/DataTable";
import { Pagination } from "@/components/base/Pagination";
import { ErrorState, LoadingState } from "@/components/base/States";
import { PermissionGate } from "@/features/auth/PermissionGate";
import { formatDateTime } from "@/utils/format";
import {
  assistedApi,
  type AssistedCandidate,
  type MatchSource,
  type MatchingConfig,
} from "./assistedApi";
import { createIdempotencyKey } from "./idempotency";
import { getInventoryOperationErrorMessage } from "./inventoryOperationErrors";
const rules: Record<string, string> = {
  exact_plate: "Placa exata",
  exact_serial: "Série exata",
  description_location: "Descrição e localização",
  description: "Descrição semelhante",
};
const states: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
};
const fields: Record<string, string> = {
  plate: "Placa",
  serial: "Série",
  description: "Descrição",
  location: "Localização",
  unit: "Unidade",
};
export function AssistedReconciliationPanel({
  projectId: p,
  sessionId: s,
}: {
  projectId: number;
  sessionId: number;
}) {
  const qc = useQueryClient();
  const [runPage, setRunPage] = useState(1),
    [runId, setRunId] = useState<number | null>(null),
    [page, setPage] = useState(1),
    [status, setStatus] = useState("");
  const [target, setTarget] = useState<AssistedCandidate | null>(null),
    [reason, setReason] = useState(""),
    [action, setAction] = useState<"approved" | "rejected">("approved"),
    [commandKey, setCommandKey] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [config, setConfig] = useState<MatchingConfig>({
    version: 1,
    textThreshold: 0.92,
    localTextThreshold: 0.85,
    descriptionAlertThreshold: 0.25,
  });
  const prefix = ["assisted-reconciliation", p, s];
  const runs = useQuery({
    queryKey: [...prefix, "runs", runPage],
    queryFn: () => assistedApi.runs(p, s, runPage),
  });
  const selected = runId ?? runs.data?.items[0]?.id;
  const candidates = useQuery({
    queryKey: [...prefix, "candidates", selected, page, status],
    queryFn: () => assistedApi.candidates(p, s, selected!, page, status),
    enabled: !!selected,
  });
  const history = useQuery({
    queryKey: [...prefix, "history", target?.id, historyPage],
    queryFn: () => assistedApi.history(p, s, target!.id, historyPage),
    enabled: !!target,
  });
  const generate = useMutation({
    mutationFn: (after: number) => assistedApi.generate(p, s, after, config),
    onSuccess: async (run) => {
      setRunId(run.id);
      setPage(1);
      await qc.invalidateQueries({ queryKey: prefix });
    },
  });
  const decide = useMutation({
    mutationFn: () =>
      assistedApi.decide(p, s, target!.id, {
        revision: target!.revision,
        source_hash: candidates.data!.run.sourceHash,
        action,
        reason,
        command_key: commandKey,
      }),
    onSuccess: async () => {
      setTarget(null);
      setReason("");
      await qc.invalidateQueries({ queryKey: prefix });
      await qc.invalidateQueries({ queryKey: ["inventory-operations"] });
    },
  });
  const columns: Column<AssistedCandidate>[] = [
    {
      header: "Item físico",
      cell: (c) => (
        <span>
          #{c.physical.id} · {c.physical.plate || "Sem placa"}
          <br />
          {c.physical.description || "Sem descrição"}
        </span>
      ),
    },
    {
      header: "Candidato contábil",
      cell: (c) =>
        c.accounting ? (
          <span>
            #{c.accounting.id} · {c.accounting.plate || "Sem placa"}
            <br />
            {c.accounting.description || "Sem descrição"}
          </span>
        ) : (
          "Sem candidato"
        ),
    },
    {
      header: "Regra / indicador",
      cell: (c) =>
        c.evidence ? (
          <span>
            {rules[c.evidence.rule]}
            <br />
            {Math.round(c.evidence.score * 100)}% · texto{" "}
            {c.evidence.similarity === null
              ? "não comparável"
              : Math.round(c.evidence.similarity * 100) + "%"}
          </span>
        ) : (
          "Dados insuficientes"
        ),
    },
    {
      header: "Revisão",
      cell: (c) => (
        <span>
          {states[c.status]}
          <br />
          {c.warnings.length ? "Ambiguidade / alerta" : "Candidato provável"}
          {c.evidence?.alerts.some((a) => a.startsWith("Descrição")) ? (
            <span className="block text-amber-700">Descrição divergente</span>
          ) : null}
        </span>
      ),
    },
    {
      header: "Detalhes",
      cell: (c) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setTarget(c);
            setHistoryPage(1);
            setReason("");
            setCommandKey(createIdempotencyKey());
            decide.reset();
          }}
        >
          Comparar e revisar
        </Button>
      ),
    },
  ];
  const data = candidates.data;
  return (
    <section className="grid gap-4" aria-label="Conciliação assistida">
      <div>
        <p className="eyebrow">Revisão humana</p>
        <h2 className="mt-2 text-lg font-bold">
          Conciliação físico-contábil assistida
        </h2>
        <p className="text-sm text-muted-foreground">
          Sugestões preservam os dados originais. Aprovar registra uma nova
          conciliação e seu snapshot consolidado. Nenhuma placa mestre é
          alterada.
        </p>
      </div>
      <PermissionGate permissions={["assisted-reconciliation:generate"]}>
        <details className="premium-panel p-4">
          <summary className="cursor-pointer font-medium">
            Critérios da próxima execução · versão 1
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(
              [
                "textThreshold",
                "localTextThreshold",
                "descriptionAlertThreshold",
              ] as const
            ).map((key) => (
              <label className="grid gap-1 text-sm" key={key}>
                {key === "textThreshold"
                  ? "Similaridade textual mínima"
                  : key === "localTextThreshold"
                    ? "Similaridade com localização igual"
                    : "Alerta abaixo de"}
                <input
                  className="h-10 rounded-md border bg-background px-3"
                  type="number"
                  min={
                    key === "textThreshold"
                      ? 0.8
                      : key === "localTextThreshold"
                        ? 0.75
                        : 0
                  }
                  max={key === "descriptionAlertThreshold" ? 0.5 : 1}
                  step="0.01"
                  value={config[key]}
                  onChange={(e) =>
                    setConfig({ ...config, [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
        </details>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={generate.isPending}
            onClick={() => generate.mutate(0)}
          >
            Gerar sugestões · primeiros 20 itens
          </Button>
          {data?.run.nextItemId ? (
            <Button
              variant="secondary"
              disabled={generate.isPending}
              onClick={() => generate.mutate(data.run.nextItemId!)}
            >
              Gerar próximo lote de 20
            </Button>
          ) : null}
        </div>
      </PermissionGate>
      {generate.error ? (
        <ErrorState
          message={getInventoryOperationErrorMessage(generate.error)}
        />
      ) : null}
      {runs.isLoading ? (
        <LoadingState label="Carregando execuções assistidas" />
      ) : runs.error ? (
        <ErrorState message={getInventoryOperationErrorMessage(runs.error)} />
      ) : (
        <>
          <label className="grid gap-1 text-sm">
            Execução assistida
            <select
              aria-label="Execução assistida"
              className="h-10 rounded-md border bg-background px-3"
              value={selected ?? ""}
              onChange={(e) => {
                setRunId(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="" disabled>
                Selecione uma execução
              </option>
              {runs.data?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} · {formatDateTime(r.createdAt)} · após item{" "}
                  {r.afterItemId}
                </option>
              ))}
            </select>
          </label>
          <Pagination
            page={runPage}
            totalPages={Math.max(1, Math.ceil((runs.data?.total ?? 0) / 20))}
            onPageChange={(v) => {
              setRunPage(v);
              setRunId(null);
              setPage(1);
            }}
          />
        </>
      )}
      {candidates.isLoading ? (
        <LoadingState label="Carregando candidatos" />
      ) : candidates.error ? (
        <ErrorState
          message={getInventoryOperationErrorMessage(candidates.error)}
          onRetry={() => {
            void candidates.refetch();
          }}
        />
      ) : data ? (
        <>
          {data.stale ? (
            <p
              role="alert"
              className="rounded-md border border-amber-500 bg-amber-50 p-4 text-amber-900"
            >
              Fontes obsoletas. Gere novas sugestões antes de decidir.
            </p>
          ) : null}
          <div className="premium-panel grid gap-3 p-4 sm:grid-cols-3">
            {Object.entries(data.run.summary).map(([key, value]) => (
              <div key={key}>
                <span className="text-sm text-muted-foreground">
                  {
                    (
                      {
                        physical: "Itens físicos no lote",
                        candidates: "Candidatos",
                        probable: "Prováveis",
                        ambiguous: "Ambíguos",
                        descriptionAlerts: "Alertas de descrição",
                        withoutCandidates: "Sem candidato",
                      } as Record<string, string>
                    )[key]
                  }
                </span>
                <p className="text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Comparação entre candidatos dentro deste lote. A aprovação revalida
            vínculos em todo o projeto. Unidade/setor não são comparados por
            ausência de campos contábeis equivalentes. Série somente quando
            preenchida explicitamente.
            {" "}Os indicadores não são probabilidades. Descrição física vem do cadastro mestre, pois a observação não possui descrição própria.
          </p>
          <p className="text-xs text-muted-foreground">Critérios desta execução: versão {data.run.config.version}; texto ≥ {data.run.config.textThreshold}; texto com local igual ≥ {data.run.config.localTextThreshold}; alerta de descrição abaixo de {data.run.config.descriptionAlertThreshold}.</p>
          <label className="grid max-w-xs gap-1 text-sm">
            Situação da sugestão
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              {Object.entries(states).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <DataTable
            columns={columns}
            items={data.items}
            getKey={(c) => c.id}
          />
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(data.total / 20))}
            onPageChange={setPage}
          />
        </>
      ) : selected ? null : (
        <p className="text-sm text-muted-foreground">
          Nenhuma execução assistida gerada nesta sessão.
        </p>
      )}
      <ModalForm
        open={!!target}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title="Comparação físico versus contábil"
      >
        {target ? (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Source title="Físico observado" source={target.physical} />
              <Source
                title="Registro contábil original"
                source={target.accounting}
              />
            </div>
            <p className="text-sm">
              Regra:{" "}
              {target.evidence ? rules[target.evidence.rule] : "Sem candidato"}{" "}
              · revisão {target.revision} · {states[target.status]}
            </p>
            {target.evidence ? (
              <>
                <p className="text-sm">
                  Coincidem:{" "}
                  {target.evidence.coincident
                    .map((k) => fields[k])
                    .join(", ") || "—"}
                  . Divergem:{" "}
                  {target.evidence.divergent.map((k) => fields[k]).join(", ") ||
                    "—"}
                  .
                </p>
                {target.evidence.alerts.map((w, i) => (
                  <p className="text-sm text-amber-700" key={i}>
                    {w}
                  </p>
                ))}
              </>
            ) : null}
            <p className="break-all text-xs text-muted-foreground">
              Versão das fontes: {data?.run.sourceHash}
            </p>
            <PermissionGate
              permissions={[
                "assisted-reconciliation:review",
                "consolidations:create",
              ]}
            >
              {target.status === "pending" ? (
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    decide.mutate();
                  }}
                >
                  <label className="grid gap-1 text-sm">
                    Decisão
                    <select
                      className="h-10 rounded-md border bg-background px-3"
                      value={action}
                      onChange={(e) => {
                        setAction(e.target.value as typeof action);
                        setCommandKey(createIdempotencyKey());
                      }}
                    >
                      <option value="approved">
                        Aprovar e consolidar evidência
                      </option>
                      <option value="rejected">Rejeitar sugestão</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Justificativa
                    <textarea
                      required
                      minLength={5}
                      maxLength={2000}
                      className="min-h-24 rounded-md border bg-background p-3"
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        setCommandKey(createIdempotencyKey());
                      }}
                    />
                  </label>
                  <Button
                    type="submit"
                    disabled={
                      decide.isPending ||
                      data?.stale ||
                      reason.trim().length < 5 ||
                      (action === "approved" && !target.accounting)
                    }
                  >
                    Registrar decisão
                  </Button>
                </form>
              ) : null}
              {target.warnings.map((warning, i) => <p className="text-sm text-amber-700" key={i}>{warning}</p>)}
            </PermissionGate>
            {decide.error ? (
              <ErrorState
                message={getInventoryOperationErrorMessage(decide.error)}
              />
            ) : null}
            <h3 className="font-bold">Histórico de decisões</h3>
            {history.isLoading ? (
              <LoadingState label="Carregando histórico" />
            ) : history.error ? (
              <ErrorState
                message={getInventoryOperationErrorMessage(history.error)}
              />
            ) : history.data?.items.length ? (
              history.data.items.map((d) => (
                <article key={d.id} className="rounded-md border p-3 text-sm">
                  <p>
                    {states[d.action]} · usuário #{d.actorId} ·{" "}
                    {formatDateTime(d.createdAt)} · revisão {d.revision}
                  </p>
                  <p>{d.reason}</p>
                  {d.reconciliationId ? (
                    <p>Conciliação #{d.reconciliationId}</p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem decisões registradas.
              </p>
            )}
            <Pagination
              page={historyPage}
              totalPages={Math.max(
                1,
                Math.ceil((history.data?.total ?? 0) / 20),
              )}
              onPageChange={setHistoryPage}
            />
          </div>
        ) : null}
      </ModalForm>
    </section>
  );
}
function Source({
  title,
  source,
}: {
  title: string;
  source: MatchSource | null;
}) {
  return (
    <article className="min-w-0 rounded-lg border p-4">
      <h3 className="font-bold">{title}</h3>
      {source ? (
        <>
          <p className="text-sm">
            Item #{source.id}
            {source.roundId
              ? ` · rodada #${source.roundId} · observação #${source.observationId}`
              : ""}
          </p>
          <dl className="mt-3 grid gap-2">
            {(
              ["plate", "serial", "description", "location", "unit"] as const
            ).map((k) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{fields[k]}</dt>
                <dd className="break-words text-sm">
                  {source[k] || "Não informado"}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 break-all text-xs text-muted-foreground">
            Versão: {source.version}
          </p>
        </>
      ) : (
        <p className="text-sm">Sem candidato</p>
      )}
    </article>
  );
}
