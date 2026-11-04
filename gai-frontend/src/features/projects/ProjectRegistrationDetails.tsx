import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/base/States";
import { formatDateTime } from "@/utils/format";
import type { Project } from "@/types/api";
import { formatProjectDate, projectTypeLabels } from "./projectFields";

export function ProjectRegistrationDetails({ project }: { project: Project }) {
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ["projects", "history", project.id, page],
    queryFn: () => projectsApi.history(project.id, page),
  });
  return (
    <div className="mb-6 grid gap-6">
      <section
        className="premium-panel p-5 sm:p-6"
        aria-labelledby="project-registration-heading"
      >
        <p className="eyebrow">Cadastro e planejamento</p>
        <h2
          id="project-registration-heading"
          className="mt-2 text-lg font-bold"
        >
          Informações do projeto
        </h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Detail
            label="Código"
            value={
              project.code || `#${project.id} · cadastro anterior sem código`
            }
          />
          <Detail
            label="Empresa contratante"
            value={project.company_name || "Empresa não disponível"}
          />
          <Detail
            label="Tipo"
            value={
              project.project_type
                ? projectTypeLabels[project.project_type]
                : "Não definido"
            }
          />
          <Detail
            label="Responsável pelo projeto"
            value={project.responsible_user_name || "Não definido"}
          />
          <Detail
            label="Responsável pelo planejamento"
            value={project.planning_responsible_user_name || "Não definido"}
          />
          <Detail
            label="Início previsto"
            value={formatProjectDate(project.start_date)}
          />
          <Detail
            label="Término previsto"
            value={formatProjectDate(project.end_date)}
          />
          <Detail
            label="Finalizado em"
            value={formatDateTime(project.finished_at)}
          />
          <Detail
            label="Observações de planejamento"
            value={project.planning_notes || "Não informadas"}
          />
        </dl>
      </section>
      <section
        id="historico"
        className="premium-panel p-5 sm:p-6"
        aria-labelledby="project-history-heading"
      >
        <p className="eyebrow">Auditoria</p>
        <h2 id="project-history-heading" className="mt-2 text-lg font-bold">
          Histórico do cadastro
        </h2>
        {history.isLoading ? (
          <LoadingState label="Carregando histórico" />
        ) : null}
        {history.isError ? (
          <ErrorState
            message="Não foi possível carregar o histórico."
            onRetry={() => void history.refetch()}
          />
        ) : null}
        {history.data?.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma alteração registrada.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3">
          {history.data?.items.map((entry) => (
            <details
              key={entry.id}
              className="min-w-0 rounded-xl border border-border/60 bg-muted/20 p-4"
            >
              <summary className="cursor-pointer text-sm font-semibold">
                {operationLabels[entry.operation] || entry.operation} ·{" "}
                {formatDateTime(entry.created_at)} ·{" "}
                {entry.performed_by
                  ? `Usuário #${entry.performed_by}`
                  : "Sistema"}
              </summary>
              <dl className="mt-4 grid gap-3 text-sm">
                {Object.entries(entry.changes).map(([key, change]) => (
                  <div
                    key={key}
                    className="min-w-0 border-t border-border/50 pt-3"
                  >
                    <dt className="font-semibold">{fieldLabels[key] || key}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                      {displayValue(change.before)} →{" "}
                      {displayValue(change.after)}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
        {(history.data?.total_pages ?? 0) > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1 || history.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <span>
              Página {page} de {history.data?.total_pages}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={
                page >= (history.data?.total_pages ?? 1) || history.isFetching
              }
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-muted/20 p-3">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-2 whitespace-pre-wrap break-words text-sm font-medium">
        {value}
      </dd>
    </div>
  );
}
function displayValue(value: unknown): string {
  return value == null
    ? "Não informado"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
const operationLabels: Record<string, string> = {
  CREATE: "Criação",
  UPDATE: "Atualização",
  ACTIVATE: "Ativação",
  PAUSE: "Pausa",
  RESUME: "Retomada",
  FINISH: "Finalização",
  CANCEL: "Cancelamento",
  ARCHIVE: "Arquivamento",
};
const fieldLabels: Record<string, string> = {
  project_id: "Projeto",
  organization_id: "Organização",
  company_id: "Empresa",
  name: "Nome",
  code: "Código",
  project_type: "Tipo",
  description: "Descrição",
  status: "Situação",
  start_date: "Início previsto",
  end_date: "Término previsto",
  finished_at: "Finalizado em",
  responsible_user_id: "Responsável pelo projeto",
  planning_responsible_user_id: "Responsável pelo planejamento",
  planning_notes: "Observações de planejamento",
  settings: "Configurações",
  metadata: "Metadados",
  created_by_id: "Criado por",
  created_at: "Criado em",
};
