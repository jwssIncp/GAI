import { navigationHref } from "@/features/projects/navigationContext";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams , useSearchParams } from "react-router-dom";
import { DataTable } from "@/components/base/DataTable";
import {
  DataPanel,
  DataPanelFilters,
  ViewToggle,
} from "@/components/base/DataPanel";
import { StatusBadge } from "@/components/base/StatusBadge";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import {
  reportApi,
  reportCode,
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
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const q = useQuery({
      queryKey: ["technical-reports", "list", user?.id, p],
      queryFn: () => reportApi.list(p),
    }),
    templates = useQuery({
      queryKey: ["technical-reports", "templates", user?.id, p],
      queryFn: () => reportApi.templates(p),
    });
  const all = q.data ?? [],
    term = search.trim().toLocaleLowerCase("pt-BR"),
    rows = all.filter(
      (r) =>
        (!status || r.status === status) &&
        (!term ||
          `${reportCode(r.id)} ${r.title} ${r.report_type}`
            .toLocaleLowerCase("pt-BR")
            .includes(term)),
    ),
    href = (id: number) =>
      navigationHref(
        `/app/projects/${p}/technical-reports/${id}`,
        navigationParams,
      );
  return (
    <div className="grid gap-4">
      <DataPanel
        title="Laudos do projeto"
        titleId="reports-list-title"
        count={q.data ? `${rows.length} de ${all.length}` : undefined}
        extra={
          hasPermission("technical-reports:edit") ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setKey(crypto.randomUUID());
                setError("");
                setOpen(true);
              }}
            >
              ＋ Novo laudo
            </Button>
          ) : undefined
        }
      >
        <DataPanelFilters label="Filtros dos laudos">
          <input
            type="search"
            aria-label="Buscar laudo"
            placeholder="Buscar por código, título ou tipo"
            className="min-h-8 rounded-[6px] border border-input bg-background px-3 text-sm md:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ViewToggle on={!status} onClick={() => setStatus("")}>
            Todos
          </ViewToggle>
          {Object.entries(reportStatuses).map(([value, label]) => (
            <ViewToggle
              key={value}
              on={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
            </ViewToggle>
          ))}
        </DataPanelFilters>
        {q.isLoading ? (
          <LoadingState />
        ) : q.error ? (
          <ErrorState message={q.error.message} />
        ) : !all.length ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Nenhum laudo. Clique em “Novo laudo” para começar.
          </p>
        ) : (
          <DataTable
            bare
            caption="Laudos do projeto"
            items={rows}
            getKey={(r) => r.id}
            columns={[
              { header: "Código", cell: (r) => reportCode(r.id) },
              {
                header: "Laudo",
                cell: (r) => (
                  <Link className="font-medium text-primary" to={href(r.id)}>
                    {r.title}
                  </Link>
                ),
              },
              { header: "Tipo", cell: (r) => r.report_type },
              {
                header: "Status",
                cell: (r) => (
                  <StatusBadge
                    value={r.status}
                    label={reportStatuses[r.status] ?? r.status}
                  />
                ),
              },
              { header: "Revisão", cell: (r) => r.revision },
              {
                header: "Ações",
                cell: (r) => (
                  <Link
                    className="text-sm font-semibold text-primary"
                    to={href(r.id)}
                    aria-label={`Abrir ${r.title}`}
                  >
                    Abrir
                  </Link>
                ),
              },
            ]}
          />
        )}
      </DataPanel>
      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title="Novo laudo"
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
