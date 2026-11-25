import * as XLSX from 'xlsx';
import { applyFormats } from '../../../export-jobs/application/services/export-cell-format';
import { safeSpreadsheetText } from '../../../project-dashboard/presentation/organization-overview.controller';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { fromCents, toCents } from '../../domain/remuneration.formulas';
import type { ConsolidatedRow } from './field-agent-payments.service';

const OPEN = new Set<string>([PaymentStatus.PENDING, PaymentStatus.APPROVED]);
const STATUS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
};
const civil = (value: string) => value.split('-').reverse().join('/');

export interface DaySummaryAgent {
  field_agent_id: number;
  name: string;
  state: string | null;
  projects: string[];
  entries: number;
  final: string;
}

export interface DaySummary {
  date: string;
  agents: DaySummaryAgent[];
  items: ConsolidatedRow[];
  total: string;
}

/**
 * Pagamentos previstos para um dia (a planilha que vai ao financeiro na véspera): só os
 * lançamentos em aberto (pendente ou aprovado) com aquela data prevista, somados por
 * inventariante (quem está em mais de um projeto recebe um valor só).
 */
export function daySummary(date: string, rows: ConsolidatedRow[]): DaySummary {
  const items = rows
    .filter((r) => OPEN.has(r.status) && r.expected_payment_date === date)
    .sort(
      (a, b) =>
        a.field_agent_name.localeCompare(b.field_agent_name, 'pt-BR') ||
        a.project_name.localeCompare(b.project_name, 'pt-BR') ||
        a.start_date.localeCompare(b.start_date),
    );
  const byAgent = new Map<number, DaySummaryAgent & { cents: bigint }>();
  for (const item of items) {
    const agent = byAgent.get(item.field_agent_id) ?? {
      field_agent_id: item.field_agent_id,
      name: item.field_agent_name,
      state: item.state,
      projects: [],
      entries: 0,
      final: '0.00',
      cents: 0n,
    };
    if (!agent.projects.includes(item.project_name))
      agent.projects.push(item.project_name);
    agent.entries += 1;
    agent.cents += toCents(item.final_amount);
    agent.state = agent.state ?? item.state;
    byAgent.set(item.field_agent_id, agent);
  }
  const agents = [...byAgent.values()].map(({ cents, ...agent }) => ({
    ...agent,
    final: fromCents(cents),
  }));
  const total = fromCents(
    items.reduce((sum, item) => sum + toCents(item.final_amount), 0n),
  );
  return { date, agents, items, total };
}

/** Planilha do resumo do dia: "Por inventariante" (com total) e "Lançamentos". */
export function daySummaryWorkbook(summary: DaySummary): Buffer {
  const workbook = XLSX.utils.book_new();
  const title = `Pagamentos previstos para ${civil(summary.date)}`;

  const agentRows = summary.agents.map((a) => [
    safeSpreadsheetText(a.name),
    a.state ?? '',
    safeSpreadsheetText(a.projects.join('; ')),
    a.entries,
    Number(a.final),
  ]);
  const agentsSheet = XLSX.utils.aoa_to_sheet([
    [title],
    [],
    ['Inventariante', 'UF', 'Projetos', 'Lançamentos', 'Valor a pagar'],
    ...agentRows,
    ['Total', '', '', summary.items.length, Number(summary.total)],
  ]);
  // Linhas de dados começam na 4ª linha (título, linha vazia e cabeçalho antes).
  formatFrom(agentsSheet, 3, agentRows.length + 1, [
    null,
    null,
    null,
    'number',
    'money',
  ]);
  agentsSheet['!cols'] = [
    { wch: 32 },
    { wch: 5 },
    { wch: 40 },
    { wch: 12 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, agentsSheet, 'Por inventariante');

  const itemRows = summary.items.map((r) => [
    safeSpreadsheetText(r.field_agent_name),
    r.state ?? '',
    safeSpreadsheetText(r.project_name),
    r.start_date,
    r.end_date,
    r.days,
    Number(r.daily_rate),
    Number(r.additional_amount),
    Number(r.total_amount),
    Number(r.discount_amount),
    Number(r.final_amount),
    STATUS[r.status] ?? r.status,
  ]);
  const itemsSheet = XLSX.utils.aoa_to_sheet([
    [title],
    [],
    [
      'Inventariante',
      'UF',
      'Projeto',
      'Data inicial',
      'Data final',
      'Dias',
      'Diária',
      'Adicional',
      'Total',
      'Descontos',
      'Final',
      'Situação',
    ],
    ...itemRows,
  ]);
  formatFrom(itemsSheet, 3, itemRows.length, [
    null,
    null,
    null,
    'date',
    'date',
    'number',
    'money',
    'money',
    'money',
    'money',
    'money',
    null,
  ]);
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Lançamentos');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** applyFormats parte da 2ª linha; aqui os dados começam depois do título. */
function formatFrom(
  sheet: XLSX.WorkSheet,
  firstDataRow: number,
  rows: number,
  formats: Parameters<typeof applyFormats>[2],
) {
  const shifted: XLSX.WorkSheet = {};
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < (formats?.length ?? 0); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: firstDataRow + r, c })] as
        | XLSX.CellObject
        | undefined;
      if (cell) shifted[XLSX.utils.encode_cell({ r: r + 1, c })] = cell;
    }
  applyFormats(shifted, rows, formats);
}
