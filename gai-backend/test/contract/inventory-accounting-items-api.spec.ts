import { readFileSync } from 'fs';
import { join } from 'path';

describe('inventory-accounting-items-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/009-inventory-accounting-items/contracts/inventory-accounting-items-api.yaml',
    ),
    'utf8',
  );

  it('defines required accounting import and accounting item endpoints', () => {
    for (const path of [
      '/projects/{projectId}/accounting-imports:',
      '/projects/{projectId}/accounting-imports/{batchId}:',
      '/projects/{projectId}/accounting-imports/{batchId}/errors:',
      '/projects/{projectId}/inventory-accounting-items:',
      '/projects/{projectId}/inventory-accounting-items/{id}:',
      '/projects/{projectId}/inventory-accounting-items/{id}/deactivate:',
      '/projects/{projectId}/inventory-accounting-items/{id}/reactivate:',
    ]) {
      expect(content).toContain(path);
    }
  });

  it('defines schemas, statuses and snake_case fields', () => {
    for (const item of [
      'InventoryAccountingItem',
      'InventoryAccountingItemList',
      'AccountingImportBatch',
      'pending',
      'matched',
      'divergent',
      'not_found',
      'ignored',
      'inactive',
      'processing',
      'finished',
      'failed',
      'organization_id',
      'project_id',
      'acquisition_value',
      'import_batch_id',
      'page_size',
      'total_items',
      'total_pages',
    ]) {
      expect(content).toContain(item);
    }
  });

  it('documents required permissions', () => {
    for (const item of [
      'inventory-accounting-items:read',
      'inventory-accounting-items:update',
      'inventory-accounting-items:deactivate',
      'inventory-accounting-items:reactivate',
      'inventory-accounting-items:import',
      'inventory-accounting-items:export-errors',
    ]) {
      expect(content).toContain(item);
    }
  });
});
