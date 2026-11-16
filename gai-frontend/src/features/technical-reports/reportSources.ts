import { api } from "@/api/http";
import type { EntityOption, EntitySource } from "@/components/base/EntityCombobox";
import { clientFilter, named, pageOf, PAGE_SIZE } from "@/components/base/entitySources";
import { formatDateTime } from "@/utils/format";

/**
 * Fontes do EntityCombobox usadas nos laudos: sessões de inventário e lotes
 * confirmados de avaliação do projeto (endpoints sem busca por texto, filtrados
 * no cliente) e usuários elegíveis a responsável (busca no servidor, sob a
 * permissão de modelos de laudo, sem exigir users:read).
 */
type ProjectContext = { project_id: number | null | undefined };

/** Lê todas as páginas de um endpoint paginado (page_size máximo 100). */
async function allPages<T>(url: string, rowsOf: (body: Record<string, unknown>) => { rows: T[]; pages: number }) {
  const rows: T[] = [];
  for (let page = 1; page <= 20; page++) {
    const body = (await api.get<Record<string, unknown>>(url, { params: { page, page_size: 100 } })).data;
    const r = rowsOf(body);
    rows.push(...r.rows);
    if (page >= r.pages || !r.rows.length) break;
  }
  return rows;
}

const ignoreError = async <T,>(p: Promise<T>) => {
  try {
    return await p;
  } catch {
    return null;
  }
};

export const sessionStatusLabels: Record<string, string> = {
  draft: "Rascunho",
  active: "Em andamento",
  finished: "Concluída",
  cancelled: "Cancelada",
};
type Session = { id: number; name: string; status: string };
const session = (s: Session): EntityOption => ({
  id: s.id,
  label: s.name,
  description: sessionStatusLabels[s.status] ?? s.status,
});
/** Sessões de inventário do projeto (GET /projects/:p/inventory-sessions). */
export const inventorySessionSource: EntitySource<ProjectContext> = {
  key: "report-inventory-sessions",
  search: async ({ search, page, context }) => {
    const rows = await allPages<Session>(`/projects/${context.project_id}/inventory-sessions`, (b) => ({
      rows: (b.items as Session[]) ?? [],
      pages: Number(b.total_pages ?? 1),
    }));
    return clientFilter(rows.map(session), search, page);
  },
  one: async (id, context) => {
    if (!context.project_id) return null;
    const r = await ignoreError(api.get<Session>(`/projects/${context.project_id}/inventory-sessions/${id}`));
    return r ? session(r.data) : null;
  },
};

/**
 * Lote de avaliação em massa. A listagem devolve a entidade (camelCase); um lote
 * confirmado tem status "applied" e confirmedAt preenchido.
 */
type Batch = { id: number; status: string; total: number; confirmedAt: string | null; createdAt?: string };
const confirmed = (b: Batch) => b.status === "applied" && Boolean(b.confirmedAt);
const batch = (b: Batch): EntityOption => ({
  id: b.id,
  label: `Lote confirmado em ${formatDateTime(b.confirmedAt)}`,
  description: `${b.total} ${b.total === 1 ? "item avaliado" : "itens avaliados"}`,
});
/** Só os lotes confirmados do projeto (GET /projects/:p/valuation-batches). */
export const confirmedValuationBatchSource: EntitySource<ProjectContext> = {
  key: "report-valuation-batches",
  search: async ({ search, page, context }) => {
    const rows = await allPages<Batch>(`/projects/${context.project_id}/valuation-batches`, (b) => ({
      rows: (b.items as Batch[]) ?? [],
      pages: Math.ceil(Number(b.total ?? 0) / Number(b.page_size ?? 100)) || 1,
    }));
    return clientFilter(rows.filter(confirmed).map(batch), search, page);
  },
  one: async (id, context) => {
    if (!context.project_id) return null;
    const r = await ignoreError(api.get<Batch>(`/projects/${context.project_id}/valuation-batches/${id}`));
    return r && confirmed(r.data) ? batch(r.data) : null;
  },
};

type OptionUser = { id: number; full_name: string | null; login: string };
const optionUser = (u: OptionUser): EntityOption => ({
  id: u.id,
  label: named(u.full_name || u.login, u.full_name ? u.login : null),
});
type OptionsPage = { items: OptionUser[]; total_pages: number };
const optionsUrl = (p: number | null | undefined) => `/projects/${p}/technical-reports/responsible-user-options`;
/**
 * Usuários ativos da organização com atribuição ativa, que podem ser
 * responsáveis (GET /projects/:p/technical-reports/responsible-user-options).
 */
export const responsibleUserSource: EntitySource<ProjectContext> = {
  key: "report-responsible-users",
  search: async ({ search, page, context }) =>
    pageOf(
      (await api.get<OptionsPage>(optionsUrl(context.project_id), { params: { page, page_size: PAGE_SIZE, search: search || undefined } })).data,
      page,
      optionUser,
    ),
  // Sem leitura por ID: procura o usuário nas páginas de opções (poucas, por organização).
  one: async (id, context) => {
    if (!context.project_id) return null;
    for (let page = 1; page <= 10; page++) {
      const r = await ignoreError(api.get<OptionsPage>(optionsUrl(context.project_id), { params: { page, page_size: 50 } }));
      const hit = r?.data.items.find((u) => u.id === id);
      if (hit) return optionUser(hit);
      if (!r || page >= r.data.total_pages) return null;
    }
    return null;
  },
};
