import * as XLSX from 'xlsx';
import { PhysicalObservationImportParserService } from '../../../../src/modules/import-sessions/application/services/physical-observation-import-parser.service';
import { isExplicitInstant } from '../../../../src/common/validation/instant-date';

describe('PhysicalObservationImportParserService', () => {
  it.each(['2026-02-30T12:00:00Z', '2026-03-31T23:59:59'])(
    'preserves invalid CSV timestamps for rejection instead of normalizing: %s',
    (timestamp) => {
      const [row] = new PhysicalObservationImportParserService().parse(
        Buffer.from('inventory_item_id,captured_at\n42,' + timestamp),
      );
      expect(row.captured_at).toBe(timestamp);
      expect(isExplicitInstant(row.captured_at)).toBe(false);
    },
  );
  it('converts an explicit offset near midnight to the same UTC instant', () => {
    const [row] = new PhysicalObservationImportParserService().parse(
      Buffer.from(
        'inventory_item_id,captured_at\n42,2026-03-31T23:59:59-03:00',
      ),
    );
    expect(row.captured_at).toBe('2026-04-01T02:59:59.000Z');
    expect(isExplicitInstant(row.captured_at)).toBe(true);
  });
  it('normalizes legacy headers through the centralized alias catalogue', () => {
    const sheet = XLSX.utils.json_to_sheet([
      {
        'ID Ativo': 42,
        'Placa Física': 'abc-002',
        Inventariante_ID: 7,
        Resultado: 'Divergente',
        Setor: 'TI',
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Base fisica');
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;
    const [row] = new PhysicalObservationImportParserService().parse(buffer);
    expect(row).toMatchObject({
      inventory_item_id: 42,
      observed_plate: 'abc-002',
      field_agent_id: 7,
      observation_result: 'divergent',
      sector_text: 'TI',
    });
  });
});
