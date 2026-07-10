import { readFileSync } from 'fs';
import { join } from 'path';

describe('catalog-assets-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/008-catalog-assets/contracts/catalog-assets-api.yaml',
    ),
    'utf8',
  );

  it('defines required catalog asset endpoints', () => {
    for (const path of [
      '/catalog-assets:',
      '/catalog-assets/{id}:',
      '/catalog-assets/{id}/deactivate:',
      '/catalog-assets/{id}/reactivate:',
    ]) {
      expect(content).toContain(path);
    }
  });

  it('defines schemas, statuses and snake_case fields', () => {
    for (const item of [
      'CreateCatalogAssetRequest',
      'UpdateCatalogAssetRequest',
      'CatalogAssetResponse',
      'CatalogAssetListResponse',
      'active',
      'inactive',
      'organization_id',
      'description_normalized',
      'created_by_id',
      'updated_by_id',
      'page_size',
      'total_items',
      'total_pages',
    ]) {
      expect(content).toContain(item);
    }
  });

  it('documents required permissions', () => {
    for (const item of [
      'catalog-assets:create',
      'catalog-assets:read',
      'catalog-assets:update',
      'catalog-assets:deactivate',
      'catalog-assets:reactivate',
    ]) {
      expect(content).toContain(item);
    }
  });
});
