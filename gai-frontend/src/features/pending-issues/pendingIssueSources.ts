import { api } from '@/api/http';
import type { EntityOption, EntitySource } from '@/components/base/EntityCombobox';
import { named, pageOf, PAGE_SIZE } from '@/components/base/entitySources';
import type { InventoryAccountingItem, PaginatedItems } from '@/types/api';

export { inventoryItemSource } from '@/features/inventory-operations/inventorySources';

type ProjectContext = { project_id: number | null | undefined };

export const accountingItemOption = (item: InventoryAccountingItem): EntityOption => ({
  id: item.id,
  label: named(item.description || 'Item sem descrição', item.plate),
  description:
    [item.base_code ? `Cód. base ${item.base_code}` : null, item.investor_code ? `Investor ${item.investor_code}` : null, item.location].filter(Boolean).join(' · ') || null,
});

/**
 * Itens da base contábil do projeto (GET /projects/:p/inventory-accounting-items,
 * busca por descrição, placa, cód. base, investor e localização). Exige
 * inventory-accounting-items:read.
 */
export const accountingItemSource: EntitySource<ProjectContext> = {
  key: 'project-accounting-items',
  search: async ({ search, page, context }) =>
    pageOf(
      (
        await api.get<PaginatedItems<InventoryAccountingItem>>(`/projects/${context.project_id}/inventory-accounting-items`, {
          params: { page, page_size: PAGE_SIZE, search: search || undefined },
        })
      ).data,
      page,
      accountingItemOption,
    ),
  one: async (id, context) => {
    if (!context.project_id) return null;
    try {
      return accountingItemOption((await api.get<InventoryAccountingItem>(`/projects/${context.project_id}/inventory-accounting-items/${id}`)).data);
    } catch {
      return null;
    }
  },
};
