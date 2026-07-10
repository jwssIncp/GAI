import type { MetaPaginated, NormalizedPage, PaginatedItems } from '@/types/api';

export function normalizePage<T>(payload: PaginatedItems<T> | MetaPaginated<T>): NormalizedPage<T> {
  if ('items' in payload) {
    return {
      items: payload.items,
      page: payload.page,
      pageSize: payload.page_size,
      totalItems: payload.total_items,
      totalPages: payload.total_pages,
    };
  }

  return {
    items: payload.data,
    page: payload.meta.page,
    pageSize: payload.meta.page_size,
    totalItems: payload.meta.total,
    totalPages: payload.meta.total_pages,
  };
}
