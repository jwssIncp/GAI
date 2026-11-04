import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/http';
import { projectDashboardKeys } from '@/features/project-dashboard/projectDashboardQueries';
import { projectKeys } from '@/features/projects/projectQueries';
import { inventoryItemKeys, useChangeInventoryItemStatus, useCreateInventoryItem, useUpdateInventoryItem } from './inventoryItemsQueries';

afterEach(() => vi.restoreAllMocks());

describe('inventory changes invalidate the analytical dashboard', () => {
  it.each(['create', 'update', 'deactivate'] as const)('%s refreshes the affected project and preserves other projects', async action => {
    vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 11 } });
    vi.spyOn(api, 'patch').mockResolvedValue({ data: { id: 11 } });
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 }, mutations: { retry: false } } });
    const own = projectDashboardKeys.detail(7, { period: 'total' });
    const other = projectDashboardKeys.detail(8, { period: 'total' });
    const items = inventoryItemKeys.project(7);
    const summary = projectKeys.dashboard(7);
    [own, other, items, summary].forEach(key => client.setQueryData(key, { sentinel: true }));
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(() => ({ create: useCreateInventoryItem(7), update: useUpdateInventoryItem(7), deactivate: useChangeInventoryItemStatus(7, 'deactivate') }), { wrapper });
    await act(async () => {
      if (action === 'create') await hook.result.current.create.mutateAsync({ description: 'Synthetic' });
      else if (action === 'update') await hook.result.current.update.mutateAsync({ id: 11, payload: { description: 'Synthetic' } });
      else await hook.result.current.deactivate.mutateAsync(11);
    });
    expect(client.getQueryState(own)?.isInvalidated).toBe(true);
    expect(client.getQueryState(items)?.isInvalidated).toBe(true);
    expect(client.getQueryState(summary)?.isInvalidated).toBe(true);
    expect(client.getQueryState(other)?.isInvalidated).toBe(false);
    client.clear();
  });
});
