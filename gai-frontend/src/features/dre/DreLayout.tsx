import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Tabs } from "@/components/base/Tabs";
import { dreTabs } from "@/constants/dreTabs";

/** Endereço antigo da DRE mensal: leva à abertura da DRE, mantendo os filtros. */
export function DreMonthlyRedirect() {
  const { search } = useLocation();
  return <Navigate to={"/app/finance/dre" + search} replace />;
}
export function DreLayout() {
  return (
    <section className="grid min-w-0 gap-4">
      <Tabs
        label="Navegação da DRE"
        tabs={dreTabs.map(([path, label]) => ({
          label,
          to: "/app/finance/dre" + (path ? "/" + path : ""),
          end: !path,
        }))}
      />
      <Outlet />
    </section>
  );
}
