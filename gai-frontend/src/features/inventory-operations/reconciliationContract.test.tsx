import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { api, ApiError } from '@/api/http';
import { inventoryOperationsApi } from '@/api/endpoints';
import type { InventoryReconciliationRun } from '@/types/api';
import { projectKeys } from '@/features/projects/projectQueries';
import { inventoryOperationKeys, useRunReconciliation } from './inventoryOperationsQueries';

afterEach(() => vi.restoreAllMocks());

describe('reconciliation wire contract and cache', () => {
  it('preserves the actual backend envelope instead of declaring it an array', async () => {
    const envelope = { run_number: 2, records: [] } satisfies InventoryReconciliationRun;
    vi.spyOn(api, 'post').mockResolvedValue({ data: envelope });
    const response = await inventoryOperationsApi.reconcile(7, 9);
    expectTypeOf(response).toEqualTypeOf<InventoryReconciliationRun>();
    expect(response).toEqual(envelope);
    expect(api.post).toHaveBeenCalledWith('/projects/7/inventory-sessions/9/reconciliations');
  });

  function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const own = inventoryOperationKeys.reconciliations(7, 9, { run_number: 1 });
    const other = inventoryOperationKeys.reconciliations(8, 9, {});
    const dashboard = projectKeys.dashboard(7);
    [own, other, dashboard].forEach(key => client.setQueryData(key, { sentinel: true }));
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(() => useRunReconciliation(7, 9), { wrapper });
    return { client, hook, own, other, dashboard };
  }

  it('invalidates reconciliation pages and project dashboard after success, preserving other projects', async () => {
    vi.spyOn(inventoryOperationsApi, 'reconcile').mockResolvedValue({ run_number: 2, records: [] });
    const { client, hook, own, other, dashboard } = setup();
    await act(async () => { await hook.result.current.mutateAsync(undefined); });
    expect(client.getQueryState(own)?.isInvalidated).toBe(true);
    expect(client.getQueryState(dashboard)?.isInvalidated).toBe(true);
    expect(client.getQueryState(other)?.isInvalidated).toBe(false);
    client.clear();
  });

  it('propagates authorization errors and does not invalidate successful cached data on failure', async () => {
    const error = new ApiError(403, { code: 'FORBIDDEN', message: 'Insufficient permissions' });
    vi.spyOn(inventoryOperationsApi, 'reconcile').mockRejectedValue(error);
    const { client, hook, own } = setup();
    await act(async () => { await expect(hook.result.current.mutateAsync(undefined)).rejects.toBe(error); });
    expect(hook.result.current.error).toBe(error);
    expect(client.getQueryState(own)?.isInvalidated).toBe(false);
    client.clear();
  });
});
