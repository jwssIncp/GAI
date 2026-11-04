import { getMetadataArgsStorage } from 'typeorm';
import {
  InventoryConsolidationEntity,
  InventoryObservationEvidenceEntity,
} from '../../../../src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity';

describe('InventoryConsolidationEntity', () => {
  it('maps the evidence snapshot property to the migrated snake_case column', () => {
    const column = getMetadataArgsStorage().columns.find(
      ({ target, propertyName }) =>
        target === InventoryConsolidationEntity &&
        propertyName === 'evidenceSnapshot',
    );

    expect(column?.options.name).toBe('evidence_snapshot');
    expect(column?.options.type).toBe('json');
  });

  it('keeps storage-key collation database-agnostic in entity metadata', () => {
    const column = getMetadataArgsStorage().columns.find(
      ({ target, propertyName }) =>
        target === InventoryObservationEvidenceEntity &&
        propertyName === 'storageKey',
    );

    expect(column?.options.name).toBe('storage_key');
    expect(column?.options.length).toBe(1024);
    expect(column?.options.collation).toBeUndefined();
    expect(column?.options.charset).toBeUndefined();
  });
});
