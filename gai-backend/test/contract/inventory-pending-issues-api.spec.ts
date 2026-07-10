import { readFileSync } from 'fs';
import { join } from 'path';

describe('inventory-pending-issues-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/010-inventory-pending-issues/contracts/inventory-pending-issues-api.yaml',
    ),
    'utf8',
  );

  it('defines required pending issue endpoints', () => {
    for (const path of [
      '/projects/{projectId}/pending-issues:',
      '/projects/{projectId}/pending-issues/generate:',
      '/projects/{projectId}/pending-issues/{id}:',
      '/projects/{projectId}/pending-issues/{id}/resolve:',
      '/projects/{projectId}/pending-issues/{id}/ignore:',
      '/projects/{projectId}/pending-issues/{id}/cancel:',
    ]) {
      expect(content).toContain(path);
    }
  });

  it('defines schemas, statuses, types and snake_case fields', () => {
    for (const item of [
      'InventoryPendingIssue',
      'InventoryPendingIssueList',
      'GenerateInventoryPendingIssuesResponse',
      'missing_plate',
      'accounting_item_not_found',
      'physical_item_without_accounting_match',
      'description_divergence',
      'open',
      'resolved',
      'ignored',
      'critical',
      'inventory_item_id',
      'accounting_item_id',
      'resolution_notes',
      'resolved_by_id',
      'ignored_by_id',
      'page_size',
      'total_items',
    ]) {
      expect(content).toContain(item);
    }
  });

  it('documents required permissions', () => {
    for (const item of [
      'inventory-pending-issues:create',
      'inventory-pending-issues:read',
      'inventory-pending-issues:update',
      'inventory-pending-issues:resolve',
      'inventory-pending-issues:ignore',
      'inventory-pending-issues:cancel',
      'inventory-pending-issues:generate',
    ]) {
      expect(content).toContain(item);
    }
  });
});
