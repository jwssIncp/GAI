import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/api/http";
import { useAuth } from "@/features/auth/AuthContext";
import { usePermissions } from "@/features/auth/usePermissions";
import { navigationHref, projectContextId } from "./navigationContext";

export function ProjectContextLink() {
  const [params] = useSearchParams(), { user } = useAuth(), { hasPermission } = usePermissions();
  const id = projectContextId(params);
  const project = useQuery({
    queryKey: ["navigation-project", user?.id, user?.organization_id, id],
    queryFn: async () => (await api.get<{ id: number; name: string }>(`/projects/${id}`)).data,
    enabled: !!id && hasPermission("projects:read"), retry: false,
  });
  // The URL is navigation intent only. Never reveal project identity from it,
  // browser storage or an unscoped cache entry.
  if (!id || !hasPermission("projects:read") || !project.data || String(project.data.id) !== id || project.isError) return null;
  return <nav aria-label="Contexto do projeto" className="flex flex-wrap items-center gap-3 text-sm">
    <span>Projeto de origem: {project.data.name}</span>
    <Link className="text-primary underline" to={navigationHref(`/app/projects/${id}/summary`, params)}>Retornar ao projeto</Link>
  </nav>;
}
