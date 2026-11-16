import * as XLSX from 'xlsx';
import { applyFormats } from '../../../../src/modules/export-jobs/application/services/export-cell-format';

/** Exportações: número como número (R$), data como data, mês e data e hora pt-BR. */
describe('Formato das colunas exportadas', () => {
  const sheet = () =>
    XLSX.utils.aoa_to_sheet([
      ['Valor', 'Data', 'Mês', 'Registrado em', '%', 'Texto'],
      [-123.45, '2026-03-10', '2026-11', '2026-11-15T23:30:00.000Z', 12.5, 'x'],
      ['1234.5', '', null, 'inválida', null, '2026-01-01'],
    ]);
  it('converte e aplica o formato pt-BR, sem virar texto', () => {
    const s = sheet();
    applyFormats(s, 2, ['money', 'date', 'month', 'datetime', 'percent', null]);
    expect(s.A2).toMatchObject({
      t: 'n',
      v: -123.45,
      z: '"R$" #,##0.00;-"R$" #,##0.00',
    });
    expect(s.A3).toMatchObject({ t: 'n', v: 1234.5 });
    // 10/03/2026 = serial 46091 no Excel
    expect(s.B2).toMatchObject({ t: 'n', v: 46091, z: 'dd/mm/yyyy' });
    expect(s.C2).toMatchObject({ t: 'n', z: 'mm/yyyy' });
    // 23h30 UTC = 20h30 em Brasília, no mesmo dia
    const at = s.D2 as XLSX.CellObject;
    expect(at.z).toBe('dd/mm/yyyy hh:mm');
    expect(XLSX.SSF.format('dd/mm/yyyy hh:mm', at.v as number)).toBe(
      '15/11/2026 20:30',
    );
    expect(s.E2).toMatchObject({ t: 'n', v: 0.125, z: '0.00%' });
    // o que não é do formato fica como estava
    expect(s.B3).toMatchObject({ t: 's', v: '' });
    expect(s.D3).toMatchObject({ t: 's', v: 'inválida' });
    expect(s.F3).toMatchObject({ t: 's', v: '2026-01-01' });
  });
});
