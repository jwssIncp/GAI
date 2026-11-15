import { useQuery } from "@tanstack/react-query";
import { fieldAgentsApi, projectsApi } from "@/api/endpoints";
import { LoadingState } from "@/components/base/States";
import type { ProjectStatus } from "@/types/api";

/** Projetos que aceitam vínculo novo (mesma regra da API: rascunho, ativo ou pausado). */
const LINKABLE_PROJECT_STATUSES: ProjectStatus[] = ["draft", "active", "paused"];

const LINK_STATUS_LABEL: Record<string, string> = {
  active: "vínculo ativo",
  inactive: "vínculo inativo",
  finished: "concluído (preservado)",
};

/**
 * Seleção de projetos no cadastro do inventariante. No cadastro novo, os
 * projetos marcados são vinculados na mesma gravação. Na edição, os vínculos
 * atuais aparecem só para leitura (vínculos concluídos nunca são alterados aqui)
 * e é possível marcar projetos novos.
 */
export function FieldAgentProjectsPicker({
  fieldAgentId,
  value,
  onChange,
  disabled,
}: {
  fieldAgentId?: number;
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const projects = useQuery({
    queryKey: ["projects", "linkable-for-field-agent"],
    queryFn: () => projectsApi.list({ page: 1, page_size: 100 }),
  });
  const links = useQuery({
    queryKey: ["field-agents", "detail-projects", fieldAgentId],
    queryFn: () => fieldAgentsApi.projects(fieldAgentId!, { page: 1, page_size: 100 }),
    enabled: Boolean(fieldAgentId),
  });
  if (projects.isLoading || links.isLoading)
    return <LoadingState label="Carregando projetos" />;
  const current = links.data?.items ?? [];
  const activeIds = new Set(
    current.filter((link) => link.status === "active").map((link) => link.project_id),
  );
  const candidates = (projects.data?.items ?? []).filter(
    (project) =>
      LINKABLE_PROJECT_STATUSES.includes(project.status) && !activeIds.has(project.id),
  );
  const toggle = (id: number, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((item) => item !== id));
  return (
    <div className="grid gap-3">
      {current.length ? (
        <div>
          <p className="mb-1 text-sm font-medium">Vínculos atuais</p>
          <ul className="grid gap-1 text-sm">
            {current.map((link) => (
              <li key={link.id} className="flex justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5">
                <span className="truncate">{link.project_name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {LINK_STATUS_LABEL[link.status] ?? link.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">
            Para encerrar ou remover um vínculo, use Projeto › Campo › Equipe de campo.
          </p>
        </div>
      ) : null}
      <fieldset disabled={disabled} className="grid gap-1">
        <legend className="mb-1 text-sm font-medium">
          {fieldAgentId ? "Vincular a outros projetos" : "Projetos vinculados"}
        </legend>
        {candidates.length ? (
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2">
            {candidates.map((project) => (
              <label key={project.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.includes(project.id)}
                  onChange={(event) => toggle(project.id, event.target.checked)}
                />
                <span className="truncate">{project.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum projeto em aberto disponível para vínculo.
          </p>
        )}
      </fieldset>
    </div>
  );
}
