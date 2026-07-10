import { InventoryItem } from '../../../../src/modules/inventory-items/domain/entities/inventory-item';
import { InventoryItemStatus } from '../../../../src/modules/inventory-items/domain/enums/inventory-item-status.enum';

function makeItem(status = InventoryItemStatus.PENDING): InventoryItem {
  const now = new Date('2026-07-07T12:00:00.000Z');
  return new InventoryItem({
    id: 1,
    organizationId: 1,
    projectId: 1,
    externalItemId: null,
    sequence: null,
    oldPlate: 'ABC123',
    newPlate: null,
    unitText: null,
    addressText: null,
    locationText: null,
    description: 'Notebook',
    brand: null,
    model: null,
    serialNumber: null,
    capacity: null,
    year: null,
    notes: null,
    source: 'manual',
    usedValue: '1200.50',
    newValue: null,
    status,
    metadata: null,
    createdById: 1,
    updatedById: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('InventoryItem domain', () => {
  it('rejects invalid decimal strings', () => {
    expect(
      () =>
        new InventoryItem({
          ...makeItem().toProps(),
          usedValue: '12.345',
        }),
    ).toThrow('monetary values must be decimal strings');
  });

  it('updates fields and records changes', () => {
    const item = makeItem();

    const changes = item.updateFields({
      description: 'Notebook Dell',
      newValue: '2000.00',
      updatedById: 2,
    });

    expect(changes).toHaveProperty('description');
    expect(changes).toHaveProperty('new_value');
    expect(item.toProps().updatedById).toBe(2);
  });

  it('deactivates and reactivates without physical deletion', () => {
    const item = makeItem();
    const deletedAt = new Date('2026-07-08T10:00:00.000Z');

    const deactivateChanges = item.deactivate(2, deletedAt);

    expect(item.status).toBe(InventoryItemStatus.INACTIVE);
    expect(item.deletedAt).toBe(deletedAt);
    expect(deactivateChanges).toHaveProperty('deleted_at');

    const reactivateChanges = item.reactivate(2);

    expect(item.status).toBe(InventoryItemStatus.PENDING);
    expect(item.deletedAt).toBeNull();
    expect(reactivateChanges).toHaveProperty('status');
  });
});
