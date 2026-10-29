import { navigationHref } from "@/features/projects/navigationContext";
import { NavLink, Outlet, useSearchParams } from "react-router-dom";
export function DreLayout() {
  const [p] = useSearchParams();
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-xl font-semibold">DRE Gerencial</h2>
        <p className="text-sm text-muted-foreground">
          Resultado por competência explícita, com cobertura das fontes e
          histórico. Não é DRE contábil oficial.
        </p>
      </div>
      <nav
        className="section-navigation"
        aria-label="Navegação da DRE"
      >
        {[
          ["", "Demonstrativo"],
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
