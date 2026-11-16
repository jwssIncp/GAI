import { Navigate, useLocation } from "react-router-dom";
import { navigation, type NavigationSection } from "@/constants/navigation";
import { usePermissions } from "@/features/auth/usePermissions";
import { navigationHref, projectContextId } from "@/features/projects/navigationContext";

/**
 * Raiz de um módulo sem tela própria (ex.: /app/finance): abre a 1ª tela do menu
 * daquele módulo permitida ao perfil, mantendo o contexto (projeto, retorno).
 * Sem nenhuma permitida: acesso negado.
 */
export function FirstAllowedRedirect({ section, prefix }: { section: NavigationSection; prefix: string }) {
  const { canAccess } = usePermissions();
  const { search } = useLocation();
  const first = navigation.find((item) => item.section === section && item.to.startsWith(prefix + "/") && canAccess(item.permissions));
  return <Navigate to={first ? navigationHref(first.to, search) : "/app/access-denied"} replace />;
}

/**
 * Endereço reservado antigo (em inglês) que nunca teve tela: leva à tela atual
 * equivalente. Com projeto no contexto (?project_id=) e `projectTab`, abre a aba do
 * projeto; sem projeto, `to` (ex.: a lista de projetos). Lista em `legacyRedirects` (router).
 */
export function LegacyRedirect({ to, projectTab }: { to: string; projectTab?: string }) {
  const { search } = useLocation();
  const project = projectTab ? projectContextId(new URLSearchParams(search)) : null;
  const target = project ? `/app/projects/${project}/${projectTab}` : to;
  return <Navigate to={navigationHref(target, search)} replace />;
}
