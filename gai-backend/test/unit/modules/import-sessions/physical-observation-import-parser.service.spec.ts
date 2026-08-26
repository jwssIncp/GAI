import * as XLSX from 'xlsx';
import { PhysicalObservationImportParserService } from '../../../../src/modules/import-sessions/application/services/physical-observation-import-parser.service';

describe('PhysicalObservationImportParserService', () => {
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
