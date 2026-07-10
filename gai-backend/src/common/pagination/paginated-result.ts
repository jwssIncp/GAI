export interface PaginatedResult<T> {
  items: T[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export function buildPaginatedResult<T>(
  items: T[],
  page: number,
  pageSize: number,
  totalItems: number,
): PaginatedResult<T> {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  return {
    items,
    page,
    page_size: pageSize,
    total_items: totalItems,
    total_pages: totalPages,
  };
}
