import {
  EXPORT_HEADER,
  exportFileName,
  exportRows,
  type ExportInput,
} from '../../../../src/modules/project-preparation/domain/preparation.export';
import { applicability } from '../../../../src/modules/project-preparation/domain/preparation.policy';
import type {
  PolicyAnswer,
  PreparationQuestion,
} from '../../../../src/modules/project-preparation/domain/preparation.types';

const q = (
  id: string,
  order: number,
  extra: Partial<PreparationQuestion> = {},
): PreparationQuestion => ({
  id,
  label: id.toUpperCase(),
  category: 'RESUMO PROJETO',
  type: 'text',
  order,
  required: false,
  visible: true,
  allow_not_applicable: true,
  ...extra,
});
const a = (
  questionId: string,
  value: PolicyAnswer['value'],
  extra: Partial<PolicyAnswer> = {},
): PolicyAnswer => ({
  questionId,
  state: 'completed',
  value,
  notes: null,
  ...extra,
});

const questions = [
  q('system', 0, { type: 'select', options: ['NÃO INFORMADO', 'OUTRO'] }),
  q('system-name', 1, {
    display: 'inline',
    enabled_when: [
      { question_id: 'system', operator: 'equals', value: 'OUTRO' },
    ],
  }),
  q('manuals', 2, { visible: false }),
  q('audited', 3, { type: 'select', options: ['SIM', 'NÃO'] }),
  q('audit-firm', 4, {
    enabled_when: [
      { question_id: 'audited', operator: 'equals', value: 'SIM' },
    ],
  }),
  q('places', 5, { type: 'unit_allocations', category: 'ETIQUETAS' }),
];
const input = (answers: PolicyAnswer[]): ExportInput => ({
  title: 'Cliente Alfa',
  status: 'in_progress',
  scheduledDate: '2026-11-24',
  templateName: 'Kick-off',
  templateVersion: 3,
  questions,
  answers,
  applicable: applicability(questions, answers),
  realized: { done: 1, total: 4, percent: 25 },
  organizationName: 'Prestadora',
  units: [
    { id: 1, name: 'Matriz', city: 'São Paulo', state: 'SP' },
    { id: 2, name: 'Filial', city: 'Belo Horizonte', state: 'MG' },
  ],
});

describe('Exportação do kick-off', () => {
  it('uses the screen numbering, merges inline follow-ups, skips hidden items and keeps notes', () => {
    const rows = exportRows(
      input([
        a('system', 'OUTRO', { realized: true, notes: 'Confirmar versão' }),
        a('system-name', 'SAP', { notes: 'Módulo AA' }),
        a('manuals', 'oculto'),
        a('audited', 'NÃO'),
        // Fora de aplicabilidade (auditado = NÃO): não sai.
        a('audit-firm', 'Firma antiga'),
        a('places', [
          { unit_id: 1, quantity: 30 },
          { unit_id: 2, quantity: 70 },
        ]),
      ]),
    );
    expect(rows.slice(0, 6)).toEqual([
      ['KICK-OFF'],
      ['Cliente', 'Cliente Alfa'],
      ['Data da reunião', '24/11/2026'],
      ['Situação', 'Em andamento'],
      ['Modelo', 'Kick-off · versão 3'],
      ['Check list', '1 de 4 (25%)'],
    ]);
    expect(rows).toContainEqual(['RESUMO PROJETO']);
    expect(rows.filter((r) => r.join() === EXPORT_HEADER.join())).toHaveLength(
      2,
    );
    expect(rows).toContainEqual([
      '01',
      'OK',
      'SYSTEM',
      'REALIZADO',
      'OUTRO | SYSTEM-NAME SAP',
      'Confirmar versão | Módulo AA',
    ]);
    expect(rows).toContainEqual(['02', '', 'AUDITED', 'PENDENTE', 'NÃO', '']);
    expect(rows).toContainEqual(['03', '', 'AUDIT-FIRM', 'BLOQUEADO', '', '']);
    const places = rows.find((r) => r[2] === 'PLACES')!;
    expect(places[0]).toBe('04');
    expect(places[4]).toContain('Matriz: 30 itens (30%)');
    expect(places[4]).toContain('Estados (2): MG, SP');
    expect(JSON.stringify(rows)).not.toContain('oculto');
    expect(JSON.stringify(rows)).not.toContain('Firma antiga');
  });

  it('shows N/A for explicit not-applicable answers', () => {
    const rows = exportRows(
      input([a('audited', null, { state: 'not_applicable' })]),
    );
    expect(rows.find((r) => r[2] === 'AUDITED')![4]).toBe('N/A');
  });

  it('builds an ASCII file name from the title', () => {
    expect(exportFileName('Ação São João / 2026')).toBe(
      'kick-off-acao-sao-joao-2026.xlsx',
    );
    expect(exportFileName('***')).toBe('kick-off-sem-nome.xlsx');
  });
});
