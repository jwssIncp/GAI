import { navigationHref } from "@/features/projects/navigationContext";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams , useSearchParams } from "react-router-dom";
import { DataTable } from "@/components/base/DataTable";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import {
  reportApi,
  reportInput as cls,
  reportStatuses,
  selectionFrom,
} from "./reportApi";
import { ReportField, SourceSelection } from "./ReportForms";
export function ReportsPage() {
  const [navigationParams] = useSearchParams();
  const p = Number(useParams().projectId),
    { user } = useAuth(),
    { hasPermission } = usePermissions(),
    cache = useQueryClient(),
    navigate = useNavigate(),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false);
  const q = useQuery({
      queryKey: ["technical-reports", "list", user?.id, p],
      queryFn: () => reportApi.list(p),
    }),
    templates = useQuery({
      queryKey: ["technical-reports", "templates", user?.id, p],
      queryFn: () => reportApi.templates(p),
    });
  return (
    <div className="grid gap-4">
      <h3 className="font-semibold">Laudos do projeto</h3>
      {hasPermission("technical-reports:edit") && (
        <div>
          <Button
            onClick={() => {
              setKey(crypto.randomUUID());
              setError("");
              setOpen(true);
            }}
          >
            Criar laudo
          </Button>
        </div>
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
              header: "Laudo",
              cell: (r) => (
                <Link className="text-primary" to={navigationHref(`/app/projects/${p}/technical-reports/${r.id}`, navigationParams)}>
                  {r.title}
                </Link>
              ),
            },
            { header: "Tipo", cell: (r) => r.report_type },
            {
              header: "Situação",
              cell: (r) => reportStatuses[r.status] ?? r.status,
            },
            { header: "Revisão", cell: (r) => r.revision },
            {
              header: "Versão aprovada ID",
              cell: (r) => r.approvedVersionId ?? "Nenhuma",
            },
          ]}
        />
      )}
      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title="Criar laudo do projeto"
      >
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const r = await reportApi.create(p, {
                template_version_id: Number(f.get("template_version_id")),
                title: String(f.get("title")),
                selection: selectionFrom(f),
                reason: String(f.get("reason")),
                command_key: key,
              });
              await cache.invalidateQueries({
                queryKey: ["technical-reports"],
              });
              setOpen(false);
              navigate(navigationHref(`/app/projects/${p}/technical-reports/${r.id}`, navigationParams));
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ReportField label="Título do laudo">
            <input className={cls} name="title" required minLength={3} />
          </ReportField>
          <ReportField label="Modelo publicado">
            <select className={cls} name="template_version_id" required>
              <option value="">Selecione uma versão publicada</option>
              {templates.data
                ?.filter((t) => !t.archived && t.publishedVersionId)
                .map((t) => (
                  <option key={t.id} value={t.publishedVersionId!}>
                    {t.data.name} · versão ID {t.publishedVersionId}
                  </option>
                ))}
            </select>
          </ReportField>
          {templates.error && <ErrorState message={templates.error.message} />}
          <SourceSelection />
          <ReportField label="Justificativa">
            <input className={cls} name="reason" required minLength={5} />
          </ReportField>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" required />
            Confirmo o modelo e as fontes documentais selecionadas
          </label>
          {error && <p role="alert">{error}</p>}
          <Button disabled={busy}>Gerar rascunho do laudo</Button>
        </form>
      </ModalForm>
    </div>
  );
}
