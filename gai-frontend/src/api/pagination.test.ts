import { describe, expect, it } from 'vitest';
import { normalizePage } from './pagination';

describe('normalizePage', () => {
  it('normaliza respostas com items', () => {
    expect(normalizePage({ items: ['a'], page: 2, page_size: 20, total_items: 41, total_pages: 3 })).toEqual({
      items: ['a'],
      page: 2,
      pageSize: 20,
      totalItems: 41,
      totalPages: 3,
    });
  });

  it('normaliza respostas com data/meta', () => {
    expect(normalizePage({ data: ['a'], meta: { page: 1, page_size: 10, total: 11, total_pages: 2 } })).toEqual({
      items: ['a'],
      page: 1,
      pageSize: 10,
      totalItems: 11,
      totalPages: 2,
    });
  });
});
