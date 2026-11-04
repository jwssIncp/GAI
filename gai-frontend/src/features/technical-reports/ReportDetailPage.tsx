import { navigationHref } from "@/features/projects/navigationContext";
import { useState } from "react";
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
} from "./reportApi";
import { ReportField, SourceSelection } from "./ReportForms";
import { ReportPreview } from "./ReportPreview";
import { DocumentExport } from '@/features/documents/DocumentExport';
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
function ContentForm({
  r,
  responsibles,
  save,
}: {
  r: Report;
  responsibles: Responsible[];
  save: (d: object) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key] = useState(crypto.randomUUID());
  return (
    <form
      key={r.revision}
      className="grid gap-4"
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
      {r.data.sections.map((s) => (
        <div className="grid gap-2 rounded-xl border p-4" key={s.key}>
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
      <fieldset className="grid gap-2 rounded-xl border p-3">
        <legend>Responsáveis cadastrados e autorizados</legend>
        {responsibles.map((rp) => (
          <label key={rp.id} className="flex gap-2 text-sm">
            <input
              type="checkbox"
              name="responsible_ids"
              value={rp.id}
              defaultChecked={r.data.responsibles.some((v) => v.id === rp.id)}
            />
            {rp.data.display_name} · {rp.data.function}
          </label>
        ))}
        {!responsibles.length && (
          <p className="text-sm">
            Cadastre responsáveis na área correspondente antes de vinculá-los.
          </p>
        )}
      </fieldset>
      <ReportField label="Justificativa">
        <input className={cls} name="reason" required minLength={5} />
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
    [busy, setBusy] = useState(false);
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
      enabled: !!q.data && (view === "validation" || view === "preview"),
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
  const selectedData = versionId ? version.data?.data : r.data;
  return (
    <div className="grid gap-4">
      <Link to={navigationHref(root, navigationParams)} className="text-primary">
        Voltar aos laudos do projeto
      </Link>
      <div>
        <h3 className="text-lg font-semibold">{r.data.title}</h3>
        <p className="text-sm">
          Laudo #{r.id} · {reportStatuses[r.status]} · Revisão atual{" "}
          {r.revision} · Projeto #{p}
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
      </div>
      {view === "edit" &&
        (editable ? (
          <ContentForm
            key={r.revision}
            r={r}
            responsibles={profiles.data ?? []}
            save={async (d) => {
              await reportApi.save(p, id, d);
              await cache.invalidateQueries({
                queryKey: ["technical-reports"],
              });
            }}
          />
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
                  `Usuário #${v.actorId} · ${new Date(v.recordedAt).toLocaleString("pt-BR")}`,
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
                    Imprimir prévia
                  </Button>
                  {version.data?.status === "approved" &&
                    hasPermission("technical-reports:export") && (
                      <Button
                        onClick={async () => {
                          setError("");
                          try {
                            await reportApi.download(p, id, versionId!);
                          } catch (err) {
                            setError((err as Error).message);
                          }
                        }}
                      >
                        Exportar snapshot aprovado
                      </Button>
                    )}
                  {version.data?.status === 'approved' && hasPermission('technical-reports:export') && <DocumentExport key={versionId} endpoint={`/projects/${p}/technical-reports/${id}/versions/${versionId}/documents`} />}
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
