import { api } from "@/api/http";
import type { EntityOption, EntitySource } from "./EntityCombobox";

/**
 * Fontes do EntityCombobox para as entidades comuns. Cada fonte normaliza a
 * resposta da sua API (paginada em items/total_pages, em data/meta, ou lista
 * simples) para { items, hasMore }. Rótulo = nome e, quando houver, o código
 * entre parênteses; o ID nunca é o rótulo.
 */
export const PAGE_SIZE = 20;

type Page<T> = {
  items?: T[];
  data?: T[];
  total_pages?: number;
  total?: number;
  page_size?: number;
  page?: number;
  meta?: { total_pages?: number; totalPages?: number; page?: number };
};

/** { items, hasMore } a partir dos formatos de paginação usados pela API. */
export function pageOf<T>(payload: Page<T> | T[], page: number, map: (t: T) => EntityOption) {
  if (Array.isArray(payload)) return { items: payload.map(map), hasMore: false };
  const rows = payload.items ?? payload.data ?? [];
  const total =
    payload.total_pages ??
    payload.meta?.total_pages ??
    payload.meta?.totalPages ??
    (payload.total !== undefined && payload.page_size ? Math.ceil(payload.total / payload.page_size) : page);
  return { items: rows.map(map), hasMore: page < total };
}

/** Busca no cliente, para endpoints que não filtram por texto. */
export function clientFilter(items: EntityOption[], search: string, page: number) {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = fold(search.trim());
  const hit = q ? items.filter((o) => fold(`${o.label} ${o.description ?? ""}`).includes(q)) : items;
  return { items: hit.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), hasMore: hit.length > page * PAGE_SIZE };
}

/** "Nome (código)" quando houver código. */
export const named = (name: string, code?: string | null) => (code ? `${name} (${code})` : name);

const ignore404 = async <T,>(p: Promise<T>) => {
  try {
    return await p;
  } catch {
    return null;
  }
};

type Company = { id: number; name: string; corporate_name?: string | null; document?: string | null };
const company = (c: Company): EntityOption => ({
  id: c.id,
  label: c.name,
  description: [c.corporate_name, c.document].filter(Boolean).join(" · ") || null,
});
/** Clientes (empresas) da organização. */
export const companySource: EntitySource<{ organization_id?: number | null }> = {
  key: "companies",
  search: async ({ search, page, context }) =>
    pageOf(
      (
        await api.get<Page<Company>>("/companies", {
          params: { page, page_size: PAGE_SIZE, search: search || undefined, organization_id: context.organization_id ?? undefined },
        })
      ).data,
      page,
      company,
    ),
  one: async (id) => {
    const c = await ignore404(api.get<Company>(`/companies/${id}`));
    return c ? company(c.data) : null;
  },
};

type Project = { id: number; name: string; code?: string | null; company_name?: string | null };
const project = (p: Project): EntityOption => ({ id: p.id, label: named(p.name, p.code), description: p.company_name ?? null });
/** Projetos (filtra pelo cliente quando o contexto traz company_id). */
export const projectSource: EntitySource<{ company_id?: number | null }> = {
  key: "projects",
  search: async ({ search, page, context }) =>
    pageOf(
      (
        await api.get<Page<Project>>("/projects", {
          params: { page, page_size: PAGE_SIZE, search: search || undefined, company_id: context.company_id ?? undefined },
        })
      ).data,
      page,
      project,
    ),
  one: async (id) => {
    const p = await ignore404(api.get<Project>(`/projects/${id}`));
    return p ? project(p.data) : null;
  },
};

type Contract = { id: number; number: string; data?: { status?: string; current_value?: string | null } };
const contract = (c: Contract): EntityOption => ({ id: c.id, label: `Contrato ${c.number}`, description: c.data?.status ? `Situação: ${c.data.status}` : null });
/** Contratos do projeto escolhido (o endpoint não busca por texto: filtra no cliente). */
export const contractSource: EntitySource<{ project_id: number | null | undefined }> = {
  key: "contracts",
  search: async ({ search, page, context }) => {
    const rows = (await api.get<Contract[]>(`/projects/${context.project_id}/contracts`)).data;
    return clientFilter(rows.map(contract), search, page);
  },
  one: async (id, context) => {
    if (!context.project_id) return null;
    const c = await ignore404(api.get<Contract>(`/projects/${context.project_id}/contracts/${id}`));
    return c ? contract(c.data) : null;
  },
};

type Amendment = { id: number; identifier?: string | null; number?: string | null; data?: { identifier?: string; value?: string } };
const amendment = (a: Amendment): EntityOption => ({ id: a.id, label: `Aditivo ${a.identifier ?? a.data?.identifier ?? a.number ?? ""}`.trim() });
/** Aditivos do contrato escolhido. */
export const amendmentSource: EntitySource<{ project_id: number | null | undefined; contract_id: number | null | undefined }> = {
  key: "amendments",
  search: async ({ search, page, context }) => {
    const c = (await api.get<{ amendments?: Amendment[] }>(`/projects/${context.project_id}/contracts/${context.contract_id}`)).data;
    return clientFilter((c.amendments ?? []).map(amendment), search, page);
  },
  one: async (id, context) => {
    if (!context.project_id || !context.contract_id) return null;
    const c = await ignore404(api.get<{ amendments?: Amendment[] }>(`/projects/${context.project_id}/contracts/${context.contract_id}`));
    const a = c?.data.amendments?.find((x) => x.id === id);
    return a ? amendment(a) : null;
  },
};

type Budget = { id: number; number: string; company_name?: string | null; project_name?: string | null };
const budget = (b: Budget): EntityOption => ({ id: b.id, label: `Orçamento ${b.number}`, description: [b.company_name, b.project_name].filter(Boolean).join(" · ") || null });
/** Orçamentos aprovados (busca pelo número). */
export const approvedBudgetSource: EntitySource<{ company_id?: number | null; project_id?: number | null }> = {
  key: "budgets-approved",
  search: async ({ search, page, context }) =>
    pageOf(
      (
        await api.get<Page<Budget>>("/budgets", {
          params: {
            page,
            status: "approved",
            search: search || undefined,
            company_id: context.company_id ?? undefined,
            project_id: context.project_id ?? undefined,
          },
        })
      ).data,
      page,
      budget,
    ),
  one: async (id) => {
    const b = await ignore404(api.get<Budget>(`/budgets/${id}`));
    return b ? budget(b.data) : null;
  },
};

type Organization = { id: number; legal_name: string; trade_name?: string | null };
const organization = (o: Organization): EntityOption => ({ id: o.id, label: o.trade_name || o.legal_name, description: o.trade_name ? o.legal_name : null });
/** Organizações (só administração da plataforma). */
export const organizationSource: EntitySource = {
  key: "organizations",
  search: async ({ search, page }) =>
    pageOf(
      (await api.get<Page<Organization>>("/organizations", { params: { page, page_size: PAGE_SIZE, search: search || undefined } })).data,
      page,
      organization,
    ),
  one: async (id) => {
    const o = await ignore404(api.get<Organization>(`/organizations/${id}`));
    return o ? organization(o.data) : null;
  },
};

type User = { id: number; full_name?: string | null; login: string; email?: string | null };
const user = (u: User): EntityOption => ({ id: u.id, label: named(u.full_name || u.login, u.full_name ? u.login : null), description: u.email ?? null });
/** Usuários da organização (busca por nome, login e e-mail). */
export const userSource: EntitySource<{ organization_id?: number | null }> = {
  key: "users",
  search: async ({ search, page, context }) =>
    pageOf(
      (
        await api.get<Page<User>>("/users", {
          params: { page, page_size: PAGE_SIZE, search: search || undefined, organization_id: context.organization_id ?? undefined },
        })
      ).data,
      page,
      user,
    ),
  one: async (id) => {
    const u = await ignore404(api.get<User>(`/users/${id}`));
    return u ? user(u.data) : null;
  },
};
