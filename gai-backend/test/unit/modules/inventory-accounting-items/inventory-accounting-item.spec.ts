import * as XLSX from 'xlsx';
import { InventoryAccountingItem } from '../../../../src/modules/inventory-accounting-items/domain/entities/inventory-accounting-item';
import { InventoryAccountingItemStatus } from '../../../../src/modules/inventory-accounting-items/domain/enums/inventory-accounting-item-status.enum';
import { AccountingImportParserService } from '../../../../src/modules/inventory-accounting-items/application/services/accounting-import-parser.service';
import { InventoryAccountingItemScopeService } from '../../../../src/modules/inventory-accounting-items/application/services/inventory-accounting-item-scope.service';

function makeItem(
  status = InventoryAccountingItemStatus.PENDING,
): InventoryAccountingItem {
  const now = new Date('2026-07-08T12:00:00.000Z');
  return new InventoryAccountingItem({
    id: 1,
    organizationId: 1,
    projectId: 1,
    plate: 'ABC1234',
    description: 'Notebook',
    accountingAccountDescription: 'Computadores',
    location: 'Sala 1',
    acquisitionDate: new Date('2024-01-15T00:00:00.000Z'),
    acquisitionValue: '1200.50',
    baseCode: 'B001',
    status,
    investorCode: 'INV001',
    note1: null,
    note2: null,
    newInventoryPlate: null,
    inventoryDescription: null,
    inventoryLocation: null,
    metadata: null,
    importedById: 1,
    importBatchId: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('InventoryAccountingItem domain', () => {
  it('rejects invalid decimal strings', () => {
    expect(
      () =>
        new InventoryAccountingItem({
          ...makeItem().toProps(),
          acquisitionValue: '12.345',
        }),
    ).toThrow('acquisition_value must be a decimal string');
  });

  it('updates fields and records changes', () => {
    const item = makeItem();

    const changes = item.updateFields({
      description: 'Notebook Dell',
      acquisitionValue: '2000.00',
    });

    expect(changes).toHaveProperty('description');
    expect(changes).toHaveProperty('acquisition_value');
  });

  it('deactivates and reactivates without physical deletion', () => {
    const item = makeItem();
    const deletedAt = new Date('2026-07-08T13:00:00.000Z');

    item.deactivate(deletedAt);

    expect(item.status).toBe(InventoryAccountingItemStatus.INACTIVE);
    expect(item.deletedAt).toBe(deletedAt);

    item.reactivate();

    expect(item.status).toBe(InventoryAccountingItemStatus.PENDING);
    expect(item.deletedAt).toBeNull();
  });
});

describe('InventoryAccountingItemScopeService', () => {
  const scope = new InventoryAccountingItemScopeService();

  it('normalizes plates and trims empty text to null', () => {
    expect(scope.normalizePlate(' ab-123 c ')).toBe('AB123C');
    expect(scope.cleanText('   ')).toBeNull();
  });

  it('validates real ISO dates and normalizes Brazilian money strings', () => {
    expect(scope.parseDate('2024-02-29')?.toISOString().slice(0, 10)).toBe(
      '2024-02-29',
    );
    expect(scope.parseDate('2024-02-30')).toBeNull();
    expect(scope.normalizeMoney('1.234,50')).toBe('1234.50');
  });
});

describe('AccountingImportParserService', () => {
  it('parses XLSX rows, aliases and extra metadata', () => {
    const scope = new InventoryAccountingItemScopeService();
    const parser = new AccountingImportParserService(scope);
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        placa: ' ab-123 ',
        descricao_01: ' Notebook ',
        descricao_conta_contabil: ' Computadores ',
        localizacao: ' Sala 1 ',
        data_aquisicao: '2024-01-15',
        valor_aquisicao: '1.234,50',
        cod_base: ' B001 ',
        status: 'pending',
        codigo_investor: ' INV001 ',
        coluna_extra: 'valor extra',
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Base');
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    const rows = parser.parse(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].data.plate).toBe('AB123');
    expect(rows[0].data.acquisitionValue).toBe('1234.50');
    expect(rows[0].data.metadata).toEqual({ coluna_extra: 'valor extra' });
  });
});
