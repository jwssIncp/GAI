import { navigationHref } from "@/features/projects/navigationContext";
import { useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/base/StatusBadge";
import { cn } from "@/utils/cn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { DataTable } from "@/components/base/DataTable";
import { ErrorState, LoadingState } from "@/components/base/States";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import {
  reportApi,
  reportInput as cls,
  reportStatuses,
  selectionFrom,
  type Report,
  type Responsible,
  type Validation,
  type Content,
  reportCode,
} from "./reportApi";
import { ReportField, SourceSelection } from "./ReportForms";
import { ReportPreview } from "./ReportPreview";
import { DocumentExport } from '@/features/documents/DocumentExport';
import { userLabel } from "@/utils/userName";
function ValidationPanel({ validation }: { validation: Validation }) {
  return (
    <section className="grid gap-3">
      <h4 className="font-semibold">
        {validation.valid
          ? "Sem bloqueios na validação atual"
          : "Há bloqueios para aprovação"}
      </h4>
      <DataTable
        items={validation.issues}
        getKey={(v) => v.code + ":" + (v.key ?? "") + ":" + v.message}
        columns={[
          {
            header: "Nível",
            cell: (v) => (v.severity === "block" ? "Bloqueio" : "Aviso"),
          },
          { header: "Código", cell: (v) => v.code },
          { header: "Verificação", cell: (v) => v.message },
        ]}
      />
    </section>
  );
}
/** Rascunho do formulário como conteúdo do laudo, para a prévia ao lado atualizar enquanto se digita. */
function draftFrom(
  form: HTMLFormElement,
  r: Report,
  responsibles: Responsible[],
): Content {
  const f = new FormData(form),
    text = (k: string, fallback: string) => {
      const v = f.get(k);
      return v === null ? fallback : String(v);
    },
    ids = f.getAll("responsible_ids").map(Number);
  return {
    ...r.data,
    title: text("title", r.data.title),
    sections: r.data.sections.map((s) => {
      const value = text("section." + s.key, s.text);
      return {
        ...s,
        text: value,
        origin: value === s.text ? s.origin : "manual",
      };
    }),
    fields: r.data.fields.map((c) => {
      const value = text("field." + c.key, c.value);
      return {
        ...c,
        value,
        origin: value === c.value ? c.origin : value ? "manual" : "empty",
      };
    }),
    technical_notes: text("technical_notes", r.data.technical_notes),
    conclusion: text("conclusion", r.data.conclusion),
    responsibles: responsibles
      .filter((rp) => ids.includes(rp.id))
      .map((rp) => rp.data),
  };
}
/** Bloco numerado do formulário, como os blocos do editor do sistema anterior. */
function FormBlock({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-3 rounded-xl border bg-card p-4">
      <legend className="px-1 text-sm font-bold uppercase tracking-wide text-navy dark:text-steel-light">
        {n}. {title}
      </legend>
      {children}
    </fieldset>
  );
}
/** "Pendências antes de emitir": resumo da validação do servidor dentro do formulário. */
function PendingChecks({
  validation,
  loading,
}: {
  validation?: Validation;
  loading: boolean;
}) {
  const blocks =
      validation?.issues.filter((i) => i.severity === "block") ?? [],
    warnings =
      validation?.issues.filter((i) => i.severity !== "block") ?? [];
  return (
    <section
      aria-labelledby="report-pending-title"
      className={cn(
        "grid gap-2 rounded-xl border p-4 text-sm",
        blocks.length
          ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
      )}
    >
      <h4 id="report-pending-title" className="font-bold">
        Pendências antes de emitir
        {validation
          ? ` · ${blocks.length} bloqueio(s), ${warnings.length} aviso(s)`
          : ""}
      </h4>
      {loading ? (
        <p className="text-muted-foreground">Verificando pendências…</p>
      ) : !validation ? (
        <p className="text-muted-foreground">Verificação indisponível.</p>
      ) : !validation.issues.length ? (
        <p>Nenhuma pendência. O laudo pode seguir para revisão.</p>
      ) : (
        <ul className="grid gap-1">
          {[...blocks, ...warnings].map((v) => (
            <li
              key={v.code + ":" + (v.key ?? "") + ":" + v.message}
              className="flex gap-2"
            >
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 text-xs font-bold",
                  v.severity === "block"
                    ? "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-50"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {v.severity === "block" ? "Bloqueio" : "Aviso"}
              </span>
              {v.message}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Conforme a última revisão salva. Salve o rascunho para atualizar.
      </p>
    </section>
  );
}
function ContentForm({
  r,
  responsibles,
  save,
  onDraft,
  pending,
}: {
  r: Report;
  responsibles: Responsible[];
  save: (d: object) => Promise<void>;
  onDraft: (c: Content) => void;
  pending: ReactNode;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key] = useState(crypto.randomUUID());
  return (
    <form
      key={r.revision}
      aria-label="Formulário do laudo"
      className="grid gap-4"
      onChange={(e) => onDraft(draftFrom(e.currentTarget, r, responsibles))}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await save({
            title: String(f.get("title")),
            sections: r.data.sections.map((s) => ({
              key: s.key,
              text: String(f.get("section." + s.key)),
            })),
            fields: r.data.fields.map((c) => ({
              key: c.key,
              value: String(f.get("field." + c.key)),
            })),
            responsible_ids: f.getAll("responsible_ids").map(Number),
            technical_notes: String(f.get("technical_notes")),
            conclusion: String(f.get("conclusion")),
            reason: String(f.get("reason")),
            command_key: key,
            revision: r.revision,
          });
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {pending}
      <FormBlock n={1} title="Identificação">
      <ReportField label="Título do laudo">
        <input
          className={cls}
          name="title"
          required
          minLength={3}
          defaultValue={r.data.title}
        />
      </ReportField>
      {r.data.fields.map((f) => (
        <div className="grid gap-1" key={f.key}>
          <ReportField label={"Campo: " + f.label}>
            <input
              className={cls}
              name={"field." + f.key}
              defaultValue={f.value}
              maxLength={2000}
            />
          </ReportField>
          <p className="text-xs text-muted-foreground">
            {f.origin === "system"
              ? "Extraído do sistema"
              : f.origin === "manual"
                ? "Alteração manual identificada"
                : "Não preenchido"}
            {f.source_key
              ? " · " +
                f.source_key +
                " · original: " +
                (f.original_value ?? "não informado")
              : ""}
          </p>
        </div>
      ))}
      </FormBlock>
      <FormBlock n={2} title="Seções do laudo">
      {r.data.sections.map((s) => (
        <div className="grid gap-2" key={s.key}>
          <ReportField label={"Seção: " + s.title}>
            <textarea
              className={cls}
              rows={7}
              maxLength={20000}
              name={"section." + s.key}
              defaultValue={s.text}
            />
          </ReportField>
          <p className="text-xs text-muted-foreground">
            {s.origin === "template"
              ? "Texto do modelo versionado"
              : "Editado manualmente"}{" "}
            · Chave {s.key}
          </p>
        </div>
      ))}
      </FormBlock>
      <FormBlock n={3} title="Conclusão">
      <ReportField label="Observações técnicas">
        <textarea
          className={cls}
          rows={4}
          name="technical_notes"
          maxLength={10000}
          defaultValue={r.data.technical_notes}
        />
      </ReportField>
      <ReportField label="Conclusão técnica">
        <textarea
          className={cls}
          rows={6}
          name="conclusion"
          maxLength={20000}
          defaultValue={r.data.conclusion}
        />
      </ReportField>
      </FormBlock>
      <FormBlock n={4} title="Responsáveis e assinaturas">
        <p className="text-xs text-muted-foreground">
          Responsáveis cadastrados e autorizados. Cada um vira uma linha de
          assinatura na prévia, com função e registro profissional (CREA/ART,
          CRC).
        </p>
        {responsibles.map((rp) => (
          <label key={rp.id} className="flex gap-2 text-sm">
            <input
              type="checkbox"
              name="responsible_ids"
              value={rp.id}
              defaultChecked={r.data.responsibles.some((v) => v.id === rp.id)}
            />
            {rp.data.display_name} · {rp.data.function}
            {rp.data.professional_registration
              ? ` · ${rp.data.professional_registration}`
              : ""}
          </label>
        ))}
        {!responsibles.length && (
          <p className="text-sm">
            Cadastre responsáveis na área correspondente antes de vinculá-los.
          </p>
        )}
      </FormBlock>
      <ReportField label="Justificativa">
        <input
          className={cls}
          name="reason"
          required
          minLength={5}
          defaultValue="Atualização do rascunho do laudo"
        />
      </ReportField>
      {error && <p role="alert">{error}</p>}
      <Button disabled={busy}>Salvar rascunho do laudo</Button>
    </form>
  );
}
export function ReportDetailPage() {
  const [navigationParams] = useSearchParams();
  const params = useParams(),
    p = Number(params.projectId),
    id = Number(params.reportId),
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    cache = useQueryClient(),
    [search, setSearch] = useSearchParams(),
    view = search.get("view") ?? "edit",
    versionId = Number(search.get("version")) || null,
    [action, setAction] = useState(""),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<{ revision: number; data: Content } | null>(
      null,
    );
  const q = useQuery({
      queryKey: ["technical-reports", "detail", user?.id, p, id],
      queryFn: () => reportApi.detail(p, id),
    }),
    profiles = useQuery({
      queryKey: ["technical-reports", "responsibles", user?.id, p],
      queryFn: () => reportApi.responsibles(p),
    }),
    validation = useQuery({
      queryKey: [
        "technical-reports",
        "validation",
        user?.id,
        p,
        id,
        q.data?.revision,
      ],
      queryFn: () => reportApi.validate(p, id),
      enabled:
        !!q.data &&
        (view === "validation" || view === "preview" || view === "edit"),
    }),
    version = useQuery({
      queryKey: ["technical-reports", "version", user?.id, p, id, versionId],
      queryFn: () => reportApi.version(p, id, versionId!),
      enabled: !!versionId,
    });
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState message={q.error?.message} />;
  const r = q.data,
    editable =
      ["draft", "reopened"].includes(r.status) &&
      hasPermission("technical-reports:edit"),
    root = `/app/projects/${p}/technical-reports`;
  const changeView = (v: string, ver?: number) => {
    const next = new URLSearchParams(search);
    next.set("view", v);
    if (ver) next.set("version", String(ver)); else next.delete("version");
    setSearch(next);
  };
  const open = (a: string) => {
    setAction(a);
    setKey(crypto.randomUUID());
    setError("");
  };
  const selectedData = versionId ? version.data?.data : r.data,
    liveData =
      draft && draft.revision === r.revision ? draft.data : r.data,
    blocking =
      validation.data?.issues.filter((i) => i.severity === "block").length ??
      0;
  return (
    <div className="grid gap-4">
      <Link to={navigationHref(root, navigationParams)} className="text-primary">
        Voltar aos laudos do projeto
      </Link>
      <div>
        <h3 className="text-lg font-semibold">{r.data.title}</h3>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{reportCode(r.id)}</span>
          <StatusBadge
            value={r.status}
            label={reportStatuses[r.status] ?? r.status}
          />
          <span>
            Revisão atual {r.revision} · Projeto #{p}
          </span>
        </p>
      </div>
      <nav
        aria-label="Navegação do laudo"
        className="flex flex-wrap gap-3 border-b pb-3 text-sm"
      >
        {[
          ["edit", "Conteúdo"],
          ["validation", "Validação prévia"],
          ["history", "Histórico"],
          ["preview", "Prévia do laudo"],
        ].map(([v, l]) => (
          <Button
            key={v}
            variant={view === v ? "primary" : "secondary"}
            onClick={() => changeView(v)}
          >
            {l}
          </Button>
        ))}
        {r.approvedVersionId && (
          <Button
            variant="secondary"
            onClick={() => changeView("preview", r.approvedVersionId!)}
          >
            Versão aprovada preservada
          </Button>
        )}
      </nav>
      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button variant="secondary" onClick={() => open("refresh")}>
            Atualizar fontes explicitamente
          </Button>
        )}
        {hasPermission("technical-reports:approve") && (
          <>
            {["draft", "reopened"].includes(r.status) && (
              <Button onClick={() => open("review")}>
                Preparar para revisão
              </Button>
            )}
            {r.status === "in_review" && (
              <Button onClick={() => open("approve")}>Aprovar laudo</Button>
            )}
            {["approved", "in_review"].includes(r.status) && (
              <Button variant="secondary" onClick={() => open("reopen")}>
                Reabrir laudo
              </Button>
            )}
            {["draft", "reopened", "approved"].includes(r.status) && (
              <Button variant="secondary" onClick={() => open("archive")}>
                Arquivar laudo
              </Button>
            )}
          </>
        )}
        {validation.data && ["draft", "reopened", "in_review"].includes(r.status) ? (
          <span
            className={cn(
              "self-center text-sm font-semibold",
              blocking ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300",
            )}
          >
            {blocking
              ? `${blocking} pendência(s) antes de emitir`
              : "Sem pendências para emitir"}
          </span>
        ) : null}
      </div>
      {view === "edit" &&
        (editable ? (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <ContentForm
              key={r.revision}
              r={r}
              responsibles={profiles.data ?? []}
              onDraft={(data) => setDraft({ revision: r.revision, data })}
              pending={
                <PendingChecks
                  validation={validation.data}
                  loading={validation.isLoading}
                />
              }
              save={async (d) => {
                await reportApi.save(p, id, d);
                await cache.invalidateQueries({
                  queryKey: ["technical-reports"],
                });
              }}
            />
            <section
              aria-label="Prévia ao vivo do laudo"
              className="grid gap-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  Prévia A4 · atualiza enquanto você digita
                </p>
                <Button variant="secondary" size="sm" onClick={() => window.print()}>
                  Visualizar impressão
                </Button>
              </div>
              <ReportPreview data={liveData} revision={r.revision} status={r.status} />
            </section>
          </div>
        ) : (
          <p className="premium-panel p-5">
            Conteúdo preservado neste estado. Consulte a prévia ou reabra com
            autorização para elaborar uma nova revisão.
          </p>
        ))}
      {view === "validation" &&
        (validation.isLoading ? (
          <LoadingState />
        ) : validation.error ? (
          <ErrorState message={validation.error.message} />
        ) : validation.data ? (
          <ValidationPanel validation={validation.data} />
        ) : null)}
      {view === "history" && (
        <>
          <h4 className="font-semibold">Histórico imutável de revisões</h4>
          <DataTable
            items={r.versions}
            getKey={(v) => v.id}
            columns={[
              { header: "Revisão", cell: (v) => v.revision },
              { header: "Situação", cell: (v) => reportStatuses[v.status] },
              {
                header: "Autor / data",
                cell: (v) =>
                  `${userLabel(v.actor_name)} · ${new Date(v.recordedAt).toLocaleString("pt-BR")}`,
              },
              { header: "Motivo", cell: (v) => v.reason },
              {
                header: "Ação",
                cell: (v) => (
                  <Button
                    variant="secondary"
                    onClick={() => changeView("preview", v.id)}
                  >
                    Ver revisão {v.revision}
                  </Button>
                ),
              },
            ]}
          />
        </>
      )}
      {view === "preview" && (
        <>
          {version.error ? (
            <ErrorState message={version.error.message} />
          ) : versionId && version.isLoading ? (
            <LoadingState />
          ) : (
            selectedData && (
              <>
                {validation.data?.issues.some(
                  (i) => i.code === "STALE_SOURCES",
                ) && (
                  <p className="premium-panel p-4 text-sm">
                    Novas fontes disponíveis no projeto. Esta versão continua
                    preservada; uma atualização exige nova revisão explícita.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" onClick={() => window.print()}>
                    Visualizar impressão
                  </Button>
                  {version.data?.status === 'approved' && hasPermission('technical-reports:export') && <DocumentExport key={versionId} endpoint={`/projects/${p}/technical-reports/${id}/versions/${versionId}/documents`} />}
                  {version.data?.status !== "approved" ? (
                    <span className="text-xs text-muted-foreground">
                      PDF e Word ficam disponíveis na versão aprovada. Antes
                      disso, use “Visualizar impressão” para salvar em PDF.
                    </span>
                  ) : null}
                  {version.data?.status === "approved" &&
                    hasPermission("technical-reports:export") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          setError("");
                          try {
                            await reportApi.download(p, id, versionId!);
                          } catch (err) {
                            setError((err as Error).message);
                          }
                        }}
                      >
                        Exportar dados (JSON)
                      </Button>
                    )}
                </div>
                <ReportPreview
                  data={selectedData}
                  revision={version.data?.revision ?? r.revision}
                  status={version.data?.status ?? r.status}
                  hash={version.data?.hash}
                />
              </>
            )
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <ModalForm
        open={!!action}
        onOpenChange={(v) => {
          if (!v) setAction("");
        }}
        title={
          action === "refresh"
            ? "Atualizar fontes do rascunho"
            : "Confirmar operação do laudo"
        }
      >
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              d = {
                revision: r.revision,
                command_key: key,
                reason: String(f.get("reason")),
              };
            setBusy(true);
            setError("");
            try {
              if (action === "refresh")
                await reportApi.refresh(p, id, {
                  ...d,
                  selection: selectionFrom(f),
                });
              else await reportApi.transition(p, id, { ...d, action });
              await cache.invalidateQueries({
                queryKey: ["technical-reports"],
              });
              setAction("");
              if (action === "approve") changeView("history");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm">
            {action === "refresh"
              ? "A nova extração gera revisão auditável e preserva alterações manuais identificadas."
              : action === "reopen"
                ? "Informe o motivo para nova revisão. A versão aprovada anterior não será sobrescrita."
                : "A operação será validada no servidor e preservará autor, motivo, revisão e snapshot. Aprovação interna não equivale a assinatura digital."}
          </p>
          {action === "refresh" && (
            <SourceSelection initial={r.data.sources.selection} />
          )}
          <ReportField label="Justificativa">
            <input className={cls} name="reason" minLength={5} required />
          </ReportField>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" required />
            Confirmo a operação e as limitações documentais
          </label>
          {error && <p role="alert">{error}</p>}
          <Button disabled={busy}>Confirmar operação</Button>
        </form>
      </ModalForm>
    </div>
  );
}
