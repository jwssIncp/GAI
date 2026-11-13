import { usePermissions } from "@/features/auth/usePermissions";
import { useProject } from "./projectQueries";

/**
 * Nome do projeto para subtítulos das telas do workspace, igual ao breadcrumb do topo.
 * Usa a mesma consulta (mesma chave de cache) de GET /projects/:id; sem projects:read,
 * não consulta e mostra "Projeto #id".
 */
export function useProjectLabel(projectId: number | string | undefined): string {
  const { hasPermission } = usePermissions();
  const id = Number(projectId);
  const canRead = hasPermission("projects:read") && Number.isSafeInteger(id) && id > 0;
  const project = useProject(canRead ? id : undefined);
  return canRead && project.data && project.data.id === id ? project.data.name : `Projeto #${projectId}`;
}
