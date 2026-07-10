import { readFileSync } from 'fs';
import { join } from 'path';

describe('inventory-item-images-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/007-inventory-item-images/contracts/inventory-item-images-api.yaml',
    ),
    'utf8',
  );

  it('defines required inventory item image endpoints', () => {
    for (const path of [
      '/projects/{projectId}/inventory-items/{itemId}/images/upload-url:',
      '/projects/{projectId}/inventory-items/{itemId}/images:',
      '/projects/{projectId}/inventory-items/{itemId}/images/{imageId}:',
      '/projects/{projectId}/inventory-items/{itemId}/images/{imageId}/confirm-upload:',
      '/projects/{projectId}/inventory-items/{itemId}/images/{imageId}/download-url:',
      '/projects/{projectId}/inventory-items/{itemId}/images/{imageId}/remove:',
      '/inventory-item-images/{id}:',
      '/inventory-item-images/{id}/download-url:',
    ]) {
      expect(content).toContain(path);
    }
  });

  it('defines schemas, statuses and public fields', () => {
    for (const item of [
      'CreateInventoryItemImageUploadRequest',
      'ConfirmInventoryItemImageUploadRequest',
      'InventoryItemImageResponse',
      'InventoryItemImageUploadUrlResponse',
      'InventoryItemImageDownloadUrlResponse',
      'InventoryItemImageListResponse',
      'pending_upload',
      'uploaded',
      'failed',
      'removed',
      'organization_id',
      'inventory_item_id',
      'original_name',
      'mime_type',
      'size_bytes',
      'uploaded_by_id',
      'page_size',
      'total_items',
      'total_pages',
    ]) {
      expect(content).toContain(item);
    }
    expect(content).not.toContain('bucket:');
    expect(content).not.toContain('path:');
  });

  it('documents required permissions', () => {
    for (const item of [
      'inventory-item-images:create',
      'inventory-item-images:read',
      'inventory-item-images:update',
      'inventory-item-images:remove',
      'inventory-item-images:download',
    ]) {
      expect(content).toContain(item);
    }
  });
});
