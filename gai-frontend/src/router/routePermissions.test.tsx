import { isValidElement, type ReactElement } from "react";
import type { RouteObject } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { navigation } from "@/constants/navigation";
import { ProtectedRoute } from "./ProtectedRoute";
import { router } from "./router";

/** Caminho completo → permissões exigidas pelas rotas protegidas no caminho. */
function required(routes: RouteObject[], base = "", inherited: string[] = [], out = new Map<string, string[]>()) {
  for (const route of routes) {
    const element = route.element as ReactElement<{ permissions?: string[] }> | undefined;
    const own = isValidElement(element) && element.type === ProtectedRoute ? (element.props.permissions ?? []) : [];
    const perms = [...inherited, ...own];
    const path = route.path ? (route.path.startsWith("/") ? route.path : `${base}/${route.path}`) : base;
    if (route.path || route.index) out.set(path.replace(/\/+/g, "/"), perms);
    if (route.children) required(route.children, path, perms, out);
  }
  return out;
}

describe("Rotas × menu lateral", () => {
  const routes = required(router.routes);

  it("cada item do menu tem rota com exatamente as permissões do item (nada de item que cai em acesso negado)", () => {
    for (const item of navigation)
      expect({ to: item.to, permissions: [...new Set(routes.get(item.to))].sort() }).toEqual({
        to: item.to,
        permissions: [...(item.permissions ?? [])].sort(),
      });
  });

  it("Despesas, Placas e Comissões não exigem mais pagamentos:read (só a permissão do próprio módulo)", () => {
    expect(routes.get("/app/finance/expenses")).toEqual(["expenses:read"]);
    expect(routes.get("/app/finance/asset-tags")).toEqual(["asset-tag-orders:read"]);
    expect(routes.get("/app/finance/commissions")).toEqual(["commissions:read"]);
  });
});
