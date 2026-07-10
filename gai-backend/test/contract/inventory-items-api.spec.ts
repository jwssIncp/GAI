import { readFileSync } from 'fs';
import { join } from 'path';

describe('inventory-items-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/006-inventory-items/contracts/inventory-items-api.yaml',
    ),
    'utf8',
  );

  it('defines required inventory item endpoints', () => {
    for (const path of [
      '/projects/{projectId}/inventory-items:',
      '/projects/{projectId}/inventory-items/{id}:',
      '/projects/{projectId}/inventory-items/{id}/deactivate:',
      '/projects/{projectId}/inventory-items/{id}/reactivate:',
      '/inventory-items:',
      '/inventory-items/{id}:',
    ]) {
      expect(content).toContain(path);
    }
  });

  it('defines schemas, statuses and snake_case fields', () => {
    for (const item of [
      'CreateInventoryItemRequest',
      'UpdateInventoryItemRequest',
      'InventoryItemResponse',
      'InventoryItemListResponse',
      'pending',
      'evaluated',
      'divergent',
      'not_found',
      'duplicated',
      'removed',
      'inactive',
      'organization_id',
      'project_id',
      'old_plate',
      'new_plate',
      'used_value',
      'new_value',
      'page_size',
      'total_items',
      'total_pages',
    ]) {
      expect(content).toContain(item);
    }
  });

  it('documents required permissions', () => {
    for (const item of [
      'inventory-items:create',
      'inventory-items:read',
      'inventory-items:update',
      'inventory-items:deactivate',
      'inventory-items:reactivate',
    ]) {
      expect(content).toContain(item);
    }
  });
});
