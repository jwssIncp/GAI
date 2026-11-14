import { navigationHref } from "@/features/projects/navigationContext";
import { Navigate, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";

/** Endereço antigo da DRE mensal: leva à abertura da DRE, mantendo os filtros. */
export function DreMonthlyRedirect() {
  const { search } = useLocation();
  return <Navigate to={"/app/finance/dre" + search} replace />;
}
export function DreLayout() {
  const [p] = useSearchParams();
  return (
    <section className="grid min-w-0 gap-4">
      <nav
        className="section-navigation"
        aria-label="Navegação da DRE"
      >
        {[
          ["", "DRE mensal"],
          ["statement", "Demonstrativo"],
          ["entries", "Classificações e ajustes"],
          ["accounts", "Plano de contas"],
          ["periods", "Competências"],
        ].map(([path, label]) => (
          <NavLink
            end={!path}
            key={path}
            className={({ isActive }) =>
              isActive ? "font-semibold text-primary" : "text-muted-foreground"
            }
            to={
              navigationHref("/app/finance/dre" + (path ? "/" + path : ""), p)
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </section>
  );
}
