import * as XLSX from 'xlsx';

/**
 * Formato de uma coluna exportada. Valores vão como número/data do Excel (não
 * como texto), no padrão pt-BR da tela: R$ com vírgula, dd/mm/aaaa, mm/aaaa.
 */
export type CellFormat =
  | 'money'
  | 'number'
  | 'percent'
  | 'date'
  | 'month'
  | 'datetime';

export const EXCEL_FORMATS: Record<CellFormat, string> = {
  money: '"R$" #,##0.00;-"R$" #,##0.00',
  number: '#,##0.##',
  percent: '0.00%',
  date: 'dd/mm/yyyy',
  month: 'mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm',
};

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const DAY = 86_400_000;
/** Serial do Excel de uma data civil (sem fuso). */
const serial = (y: number, m: number, d: number, h = 0, min = 0) =>
  (Date.UTC(y, m - 1, d, h, min) - EXCEL_EPOCH) / DAY;

/** Data e hora de um instante no fuso da operação (America/Sao_Paulo). */
function saoPaulo(value: string) {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return serial(
    Number(parts.year),
    Number(parts.month),
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
}

/** Converte o valor de uma célula para o formato da coluna (ou deixa como está). */
export function formatCell(
  cell: XLSX.CellObject | undefined,
  format: CellFormat | null | undefined,
) {
  if (!cell || !format || cell.v === null || cell.v === undefined) return;
  const v = cell.v;
  if (format === 'money' || format === 'number' || format === 'percent') {
    const n = typeof v === 'number' ? v : Number(v);
    if (typeof v === 'boolean' || !Number.isFinite(n) || v === '') return;
    cell.t = 'n';
    cell.v = format === 'percent' ? n / 100 : n;
    cell.z = EXCEL_FORMATS[format];
    delete cell.w;
    return;
  }
  if (typeof v !== 'string') return;
  let n: number | null = null;
  let m: RegExpMatchArray | null;
  if (format === 'date' && (m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)))
    n = serial(Number(m[1]), Number(m[2]), Number(m[3]));
  else if (format === 'month' && (m = /^(\d{4})-(\d{2})$/.exec(v)))
    n = serial(Number(m[1]), Number(m[2]), 1);
  else if (format === 'datetime') n = saoPaulo(v);
  if (n === null) return;
  cell.t = 'n';
  cell.v = n;
  cell.z = EXCEL_FORMATS[format];
  delete cell.w;
}

/** Aplica os formatos de coluna a uma aba (a linha 0 é o cabeçalho). */
export function applyFormats(
  sheet: XLSX.WorkSheet,
  rows: number,
  formats: Array<CellFormat | null | undefined> | undefined,
) {
  if (!formats?.length) return;
  for (let r = 1; r <= rows; r++)
    formats.forEach((format, c) => {
      if (format)
        formatCell(
          sheet[XLSX.utils.encode_cell({ r, c })] as
            | XLSX.CellObject
            | undefined,
          format,
        );
    });
}
