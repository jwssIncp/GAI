import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "@/components/base/DataTable";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import { reportApi, reportInput as cls } from "./reportApi";
import { TemplateForm, ReportField } from "./ReportForms";
import { VisualTemplateEditor } from '@/features/documents/VisualTemplateEditor';
export function ReportTemplatesPage() {
  const p = Number(useParams().projectId),
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    q = useQuery({
      queryKey: ["technical-reports", "templates", user?.id, p],
      queryFn: () => reportApi.templates(p),
    });
  return (
    <div className="grid gap-4">
      <h3 className="font-semibold">Modelos versionados da organização</h3>
      {user?.organization_id && hasPermission('documents:templates') && <VisualTemplateEditor organizationId={user.organization_id} />}
      {hasPermission("technical-reports:templates") && (
        <Link className="text-primary font-semibold" to="new">
          Criar modelo de laudo
        </Link>
      )}
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={q.error.message} />
      ) : (
        <DataTable
          items={q.data ?? []}
          getKey={(r) => r.id}
          columns={[
            {
              header: "Modelo",
              cell: (r) => (
                <Link className="text-primary" to={String(r.id)}>
                  {r.data.name}
                </Link>
              ),
            },
            { header: "Tipo", cell: (r) => r.data.report_type },
            { header: "Revisão atual", cell: (r) => r.revision },
            {
              header: "Versão publicada ID",
              cell: (r) => r.publishedVersionId ?? "Não publicado",
            },
            {
              header: "Situação",
              cell: (r) => (r.archived ? "Arquivado" : "Disponível"),
            },
          ]}
        />
      )}
      <p className="text-sm text-muted-foreground">
        Alterar um rascunho não modifica versões publicadas nem laudos já
        criados. Modelos são compartilhados somente na organização.
      </p>
    </div>
  );
}
export function ReportTemplateEditorPage() {
  const params = useParams(),
    p = Number(params.projectId),
    id = params.templateId === "new" ? undefined : Number(params.templateId),
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    navigate = useNavigate(),
    cache = useQueryClient(),
    [action, setAction] = useState(""),
    [error, setError] = useState(""),
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["technical-reports", "template", user?.id, p, id],
    queryFn: () => reportApi.template(p, id!),
    enabled: !!id,
  });
  const root = `/app/projects/${p}/technical-reports/templates`;
  if (id && q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorState message={q.error.message} />;
  const t = q.data?.template;
  return (
    <div className="grid gap-4">
      <Link className="text-primary" to={root}>
        Voltar aos modelos
      </Link>
      <h3 className="font-semibold">
        {id ? "Editar modelo de laudo" : "Criar modelo de laudo"}
      </h3>
      {t && (
        <p className="text-sm">
          Revisão {t.revision} · Publicada ID{" "}
          {t.publishedVersionId ?? "nenhuma"} ·{" "}
          {t.archived ? "Arquivado" : "Ativo"}
        </p>
      )}
      {hasPermission("technical-reports:templates") && !t?.archived && (
        <>
          <div className="flex flex-wrap gap-2">
            {t &&
              ["publish", "archive"].map((a) => (
                <Button
                  key={a}
                  variant="secondary"
                  onClick={() => {
                    setAction(a);
                    setKey(crypto.randomUUID());
                    setError("");
                  }}
                >
                  {a === "publish" ? "Publicar nova versão" : "Arquivar modelo"}
                </Button>
              ))}
          </div>
          <TemplateForm
            key={t?.revision ?? "new"}
            initial={t?.data}
            onSave={async (data, reason) => {
              const saved = await reportApi.saveTemplate(p, id, {
                data,
                reason,
                command_key: crypto.randomUUID(),
                ...(t ? { revision: t.revision } : {}),
              });
              await cache.invalidateQueries({
                queryKey: ["technical-reports"],
              });
              if (!id) navigate(root + "/" + saved.id);
            }}
          />
        </>
      )}
      {q.data && (
        <section className="grid gap-3">
          <h4 className="font-semibold">Histórico imutável do modelo</h4>
          {q.data.versions.map((v) => (
            <details key={v.id} className="rounded-xl border p-3">
              <summary>
                Revisão {v.revision} · {v.operation} · Usuário #{v.actorId} ·{" "}
                {new Date(v.recordedAt).toLocaleString("pt-BR")}
              </summary>
              <p className="break-all text-xs">SHA-256 {v.hash}</p>
              <p>{v.reason}</p>
              <pre className="overflow-auto whitespace-pre-wrap text-xs">
                {JSON.stringify(v.data, null, 2)}
              </pre>
            </details>
          ))}
        </section>
      )}
      <ModalForm
        open={!!action}
        onOpenChange={(v) => {
          if (!v) setAction("");
        }}
        title={
          action === "publish" ? "Publicar versão imutável" : "Arquivar modelo"
        }
      >
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!t) return;
            setBusy(true);
            try {
              await reportApi.templateAction(p, t.id, action, {
                revision: t.revision,
                command_key: key,
                reason: String(new FormData(e.currentTarget).get("reason")),
              });
              await cache.invalidateQueries({
                queryKey: ["technical-reports"],
              });
              setAction("");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm">
            A versão publicada será preservada. Laudos anteriores permanecem
            ligados aos snapshots originais.
          </p>
          <ReportField label="Justificativa">
            <input className={cls} name="reason" required minLength={5} />
          </ReportField>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" required />
            Confirmo a operação documental
          </label>
          {error && <p role="alert">{error}</p>}
          <Button disabled={busy}>
            Confirmar {action === "publish" ? "publicação" : "arquivamento"}
          </Button>
        </form>
      </ModalForm>
    </div>
  );
}
export function ReportResponsiblesPage() {
  const p = Number(useParams().projectId),
    { user } = useAuth(),
    cache = useQueryClient(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(crypto.randomUUID()),
    q = useQuery({
      queryKey: ["technical-reports", "responsibles", user?.id, p],
      queryFn: () => reportApi.responsibles(p),
    });
  return (
    <div className="grid gap-4">
      <h3 className="font-semibold">Responsáveis previamente cadastrados</h3>
      <p className="text-sm">
        Somente usuários ativos da organização e com atribuição ativa podem ser
        vinculados. Cadastro não comprova habilitação; registro e referência
        documental são informações explícitas do administrador.
      </p>
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message={q.error.message} />
      ) : (
        <DataTable
          items={q.data ?? []}
          getKey={(r) => r.id}
          columns={[
            { header: "Nome", cell: (r) => r.data.display_name },
            { header: "Usuário ID", cell: (r) => r.data.user_id },
            { header: "Função", cell: (r) => r.data.function },
            {
              header: "Registro declarado",
              cell: (r) => r.data.professional_registration || "Não informado",
            },
            {
              header: "Evidência informada",
              cell: (r) => r.data.registration_evidence || "Não informada",
            },
          ]}
        />
      )}
      <h4 className="font-semibold">Cadastrar responsável autorizado</h4>
      <form
        className="premium-panel grid gap-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form),
            v = (k: string) => String(f.get(k) ?? "");
          setBusy(true);
          setError("");
          try {
            await reportApi.responsible(p, {
              user_id: Number(v("user_id")),
              display_name: v("display_name"),
              function: v("function"),
              professional_registration: v("professional_registration"),
              registration_evidence: v("registration_evidence"),
              reason: v("reason"),
              command_key: key,
            });
            setKey(crypto.randomUUID());
            form.reset();
            await cache.invalidateQueries({ queryKey: ["technical-reports"] });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          ["user_id", "Usuário da organização (ID)"],
          ["display_name", "Nome para identificação no documento"],
          ["function", "Função declarada"],
          ["professional_registration", "Registro profissional (opcional)"],
          [
            "registration_evidence",
            "Referência comprobatória do registro (opcional)",
          ],
          ["reason", "Justificativa"],
        ].map(([k, l]) => (
          <ReportField key={k} label={l}>
            <input
              className={cls}
              type={k === "user_id" ? "number" : "text"}
              min={k === "user_id" ? 1 : undefined}
              name={k}
              required={
                ![
                  "professional_registration",
                  "registration_evidence",
                ].includes(k)
              }
              defaultValue={k === "user_id" ? user?.id : undefined}
            />
          </ReportField>
        ))}
        <label className="flex gap-2 text-sm">
          <input type="checkbox" required />
          Confirmo a autorização e a identificação informadas
        </label>
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy}>Cadastrar responsável</Button>
      </form>
    </div>
  );
}
