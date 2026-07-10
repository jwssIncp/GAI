import { InventoryItemImage } from '../../../../src/modules/inventory-item-images/domain/entities/inventory-item-image';
import { InventoryItemImageStatus } from '../../../../src/modules/inventory-item-images/domain/enums/inventory-item-image-status.enum';

function makeImage(
  overrides: Partial<ConstructorParameters<typeof InventoryItemImage>[0]> = {},
): InventoryItemImage {
  const now = new Date('2026-07-07T12:00:00.000Z');
  return new InventoryItemImage({
    id: 1,
    organizationId: 1,
    inventoryItemId: 2,
    storageProvider: 's3',
    bucket: 'bucket',
    path: 'path/image.jpg',
    originalName: 'image.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    checksum: null,
    status: InventoryItemImageStatus.PENDING_UPLOAD,
    uploadedById: 5,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });
}

describe('InventoryItemImage', () => {
  it('confirms pending upload', () => {
    const image = makeImage();

    const changes = image.confirmUpload(7, {
      checksum: 'abc',
      sizeBytes: 1200,
    });

    expect(image.status).toBe(InventoryItemImageStatus.UPLOADED);
    expect(changes.status.after).toBe(InventoryItemImageStatus.UPLOADED);
    expect(changes.checksum.after).toBe('abc');
    expect(changes.size_bytes.after).toBe(1200);
  });

  it('rejects confirm when not pending', () => {
    const image = makeImage({ status: InventoryItemImageStatus.UPLOADED });

    expect(() => image.confirmUpload(7, {})).toThrow(
      'Only pending upload images can be confirmed',
    );
  });

  it('removes logically', () => {
    const image = makeImage({ status: InventoryItemImageStatus.UPLOADED });
    const now = new Date('2026-07-07T13:00:00.000Z');

    const changes = image.remove(7, now);

    expect(image.status).toBe(InventoryItemImageStatus.REMOVED);
    expect(changes.deleted_at.after).toBe(now);
  });
});
