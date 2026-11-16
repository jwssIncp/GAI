import { api } from '@/api/http';
import type { EntityOption, EntitySource } from '@/components/base/EntityCombobox';
import { clientFilter, named, pageOf, PAGE_SIZE } from '@/components/base/entitySources';
import type { InventoryItem, InventoryRound, PaginatedItems } from '@/types/api';

/**
 * Fontes do EntityCombobox para as telas do Inventário (rotas sob
 * /app/projects/:projectId). Rótulo = nome e, quando houver, placa/código entre
 * parênteses; o ID nunca é o rótulo.
 */

type ProjectContext = { project_id: number | null | undefined };

const orNull = async <T,>(p: Promise<T>) => {
  try {
    return await p;
  } catch {
    return null;
  }
};

/** Vínculo de inventariante com o projeto (GET /projects/:p/field-agents traz o nome em field_agent_name). */
export type ProjectFieldAgentLink = {
  id: number;
  field_agent_id: number;
  field_agent_name?: string | null;
  role?: string | null;
  status: 'active' | 'inactive' | 'finished';
};

const linkStatus: Record<ProjectFieldAgentLink['status'], string> = { active: 'Ativo no projeto', inactive: 'Inativo no projeto', finished: 'Vínculo encerrado' };

export const fieldAgentOption = (link: ProjectFieldAgentLink): EntityOption => ({
  id: link.field_agent_id,
  label: link.field_agent_name || 'Inventariante sem nome',
  description: [link.role, linkStatus[link.status]].filter(Boolean).join(' · ') || null,
});

/** Todos os vínculos do projeto (página a página, 100 por vez), um por inventariante. */
export async function loadProjectFieldAgents(projectId: number): Promise<ProjectFieldAgentLink[]> {
  const seen = new Map<number, ProjectFieldAgentLink>();
  for (let page = 1; page <= 50; page++) {
    const r = (await api.get<PaginatedItems<ProjectFieldAgentLink>>(`/projects/${projectId}/field-agents`, { params: { page, page_size: 100 } })).data;
    // A lista vem do vínculo mais recente para o mais antigo: fica o mais recente de cada inventariante.
    for (const link of r.items) if (!seen.has(link.field_agent_id)) seen.set(link.field_agent_id, link);
    if (page >= (r.total_pages ?? 1)) break;
  }
  return [...seen.values()];
}

/** Inventariantes vinculados ao projeto (busca no servidor por nome e e-mail). Exige project-field-agents:read. */
export const projectFieldAgentSource: EntitySource<ProjectContext> = {
  key: 'project-field-agents',
  search: async ({ search, page, context }) => {
    const result = pageOf(
      (
        await api.get<PaginatedItems<ProjectFieldAgentLink>>(`/projects/${context.project_id}/field-agents`, {
          params: { page, page_size: PAGE_SIZE, search: search || undefined },
        })
      ).data,
      page,
      fieldAgentOption,
    );
    return { ...result, items: result.items.filter((o, i, all) => all.findIndex((x) => x.id === o.id) === i) };
  },
  one: async (id, context) => {
    if (!context.project_id) return null;
    const links = await orNull(loadProjectFieldAgents(context.project_id));
    const link = links?.find((l) => l.field_agent_id === id);
    return link ? fieldAgentOption(link) : null;
  },
};

const plateOf = (item: Pick<InventoryItem, 'new_plate' | 'old_plate'>) => item.new_plate || item.old_plate || null;

export const inventoryItemOption = (item: InventoryItem): EntityOption => ({
  id: item.id,
  label: named(item.description || 'Item sem descrição', plateOf(item)),
  description: [item.brand, item.model, item.serial_number ? `Série ${item.serial_number}` : null].filter(Boolean).join(' · ') || null,
});

/** Itens inventariados do projeto (busca por placas, descrição, marca, modelo e série). Exige inventory-items:read. */
export const inventoryItemSource: EntitySource<ProjectContext> = {
  key: 'project-inventory-items',
  search: async ({ search, page, context }) =>
    pageOf(
      (
        await api.get<PaginatedItems<InventoryItem>>(`/projects/${context.project_id}/inventory-items`, {
          params: { page, page_size: PAGE_SIZE, search: search || undefined },
        })
      ).data,
      page,
      inventoryItemOption,
    ),
  one: async (id, context) => {
    if (!context.project_id) return null;
    const r = await orNull(api.get<InventoryItem>(`/projects/${context.project_id}/inventory-items/${id}`));
    return r ? inventoryItemOption(r.data) : null;
  },
};

const roundKind: Record<InventoryRound['type'], string> = { initial: 'Inicial', reinventory: 'Reinventário' };
const roundStatus: Record<InventoryRound['status'], string> = { active: 'Ativa', finished: 'Finalizada', cancelled: 'Cancelada' };

export const roundOption = (round: InventoryRound): EntityOption => ({
  id: round.id,
  label: `Rodada ${round.round_number}`,
  description: [roundKind[round.type], roundStatus[round.status], round.reason].filter(Boolean).join(' · ') || null,
});

type SessionContext = ProjectContext & { session_id: number | null | undefined };

async function loadRounds(context: SessionContext) {
  const all: InventoryRound[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = (await api.get<PaginatedItems<InventoryRound>>(`/projects/${context.project_id}/inventory-sessions/${context.session_id}/rounds`, { params: { page, page_size: 100 } })).data;
    all.push(...r.items);
    if (page >= (r.total_pages ?? 1)) break;
  }
  return all.map(roundOption);
}

/** Rodadas da sessão (o endpoint não busca por texto: filtra no cliente). */
export const roundSource: EntitySource<SessionContext> = {
  key: 'inventory-session-rounds',
  search: async ({ search, page, context }) => clientFilter(await loadRounds(context), search, page),
  one: async (id, context) => {
    if (!context.project_id || !context.session_id) return null;
    return (await orNull(loadRounds(context)))?.find((o) => o.id === id) ?? null;
  },
};
