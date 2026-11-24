import { BadRequestException } from '@nestjs/common';
import {
  firstFridayAfter,
  greetingAt,
  renderEmail,
  validateEmailTemplate,
  type EmailContext,
} from '../../../../src/modules/project-preparation/domain/preparation.email';
import { applicability } from '../../../../src/modules/project-preparation/domain/preparation.policy';
import {
  ORGANIZATION_OPTION,
  type EmailTemplate,
  type PolicyAnswer,
  type PreparationQuestion,
} from '../../../../src/modules/project-preparation/domain/preparation.types';

const q = (
  id: string,
  extra: Partial<PreparationQuestion> = {},
): PreparationQuestion => ({
  id,
  label: id,
  category: 'Geral',
  type: 'text',
  order: 1,
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
  q('contact', { type: 'contact' }),
  q('scope', { type: 'multi_select', options: ['INVENTÁRIO', 'CONCILIAÇÃO'] }),
  q('count', { type: 'number' }),
  q('places', { type: 'unit_allocations' }),
  q('vehicles', { type: 'select', options: ['SIM', 'NÃO'] }),
  q('safety', { type: 'select', options: ['SIM', 'NÃO', 'N/A'] }),
  q('supplier', {
    type: 'select',
    options: [ORGANIZATION_OPTION, 'CLIENTE', 'N/A'],
  }),
  q('base', { type: 'select', options: ['POSSUI', 'NÃO POSSUI'] }),
  q('period', { type: 'date_range' }),
  q('hidden', { visible: false }),
];
const template: EmailTemplate = {
  subject: 'Kick-off {client}',
  header: [
    {
      first: true,
      lines: [
        { text: '{q:contact.name}, {greeting}.' },
        { text: 'Prezados, {greeting}.' },
      ],
    },
    { strong: true, lines: [{ text: 'RESUMO DO PROJETO:' }] },
  ],
  topics: [
    {
      title: 'Escopo',
      inline: true,
      empty: '—',
      lines: [{ text: '{q:scope}' }],
    },
    {
      title: 'Quantidade',
      empty: '* —',
      lines: [{ text: '* {q:count} bens' }],
    },
    { title: 'Endereços', lines: [{ text: '{addresses:places}' }] },
    {
      first: true,
      lines: [
        {
          text: 'Possui veículos: "{notes:vehicles}"',
          when: [{ question_id: 'vehicles', operator: 'equals', value: 'SIM' }],
        },
        {
          text: 'Não possui veículos.',
          when: [{ question_id: 'vehicles', operator: 'equals', value: 'NÃO' }],
        },
      ],
    },
    {
      lines: [
        {
          text: 'Não será necessário EPI.',
          when: [
            { question_id: 'safety', operator: 'in', value: ['NÃO', 'N/A'] },
          ],
        },
      ],
    },
    { title: 'Oculta', inline: true, lines: [{ text: '{q:hidden}' }] },
    {
      title: 'Cronograma',
      inline: true,
      lines: [{ text: '{q:period.start} A {q:period.end}' }],
    },
  ],
  footer: [{ lines: [{ text: 'Att,' }] }],
  pending_title: 'PENDÊNCIAS:',
  pendings: [
    {
      text: 'Base contábil – {deadline} - ({client})',
      unless_realized: 'base',
    },
    {
      text: 'Compra de etiquetas "{organization}"',
      when: [
        {
          question_id: 'supplier',
          operator: 'equals',
          value: ORGANIZATION_OPTION,
        },
      ],
    },
    {
      text: 'Escopo com conciliação',
      when: [
        {
          question_id: 'scope',
          operator: 'contains',
          value: ['VIDA ÚTIL', 'CONCILIAÇÃO'],
        },
      ],
    },
  ],
};
const units = Array.from({ length: 7 }, (_, i) => ({
  id: i + 1,
  name: `Unidade ${i + 1}`,
  address: `Rua ${i + 1}, Cidade`,
  city: 'Cidade',
  state: i < 4 ? 'SP' : i < 6 ? 'MG' : null,
}));
const context = (
  answers: PolicyAnswer[],
  extra: Partial<EmailContext> = {},
): EmailContext => ({
  questions,
  answers,
  applicable: applicability(questions, answers),
  organizationName: 'Prestadora Exemplo',
  clientName: 'Cliente Alfa',
  meetingDate: '2026-11-24',
  // 10h em Brasília.
  now: new Date('2026-11-24T13:00:00Z'),
  units,
  ...extra,
});

describe('E-mail ao cliente (modelo da organização)', () => {
  it('computes the deadline as the first Friday after the meeting and greets in Brasília time', () => {
    expect(firstFridayAfter('2026-11-24')).toBe('27/11');
    // Na própria sexta, o prazo é a sexta seguinte.
    expect(firstFridayAfter('2026-11-27')).toBe('04/12');
    expect(greetingAt(new Date('2026-11-24T13:00:00Z'))).toBe('bom dia');
    expect(greetingAt(new Date('2026-11-24T18:00:00Z'))).toBe('boa tarde');
    expect(greetingAt(new Date('2026-11-24T23:30:00Z'))).toBe('boa noite');
  });

  it('renders topics in order, omits empty lines and hidden answers, and lists pendings', () => {
    const result = renderEmail(
      validateEmailTemplate(template, questions)!,
      context([
        a('contact', { name: 'Ana', phone: '11 99999-0000' }),
        a('scope', ['INVENTÁRIO', 'CONCILIAÇÃO']),
        a('count', 12500),
        a('places', [
          { unit_id: 1, quantity: 30 },
          { unit_id: 2, quantity: 70 },
        ]),
        a('vehicles', 'NÃO'),
        a('safety', 'N/A'),
        a('supplier', ORGANIZATION_OPTION),
        a('hidden', 'não deve aparecer'),
        a('period', { start: '2026-12-01', end: '2026-12-05' }),
      ]),
    );
    expect(result.subject).toBe('Kick-off CLIENTE ALFA');
    expect(result.text).toBe(
      [
        'Ana, bom dia.',
        '',
        'RESUMO DO PROJETO:',
        '',
        '01- Escopo: INVENTÁRIO / CONCILIAÇÃO',
        '',
        '02- Quantidade:',
        '* 12.500 bens',
        '',
        '03- Endereços:',
        '•\tRua 1, Cidade - 30%',
        '•\tRua 2, Cidade - 70%',
        '',
        '04- Não possui veículos.',
        '',
        '05- Não será necessário EPI.',
        '',
        '06- Cronograma: 01/12/2026 A 05/12/2026',
        '',
        'Att,',
        '',
        'PENDÊNCIAS:',
        '01- Base contábil – 27/11 - (CLIENTE ALFA)',
        '02- Compra de etiquetas "PRESTADORA EXEMPLO"',
        '03- Escopo com conciliação',
      ].join('\n'),
    );
    expect(result.strong_lines).toEqual(['RESUMO DO PROJETO:', 'PENDÊNCIAS:']);
    expect(result.pendings).toBe(3);
  });

  it('uses fallbacks, summarizes more than five addresses by state and skips realized pendings', () => {
    const result = renderEmail(
      template,
      context([
        a(
          'places',
          units.map((u) => ({ unit_id: u.id, quantity: 1 })),
        ),
        a('base', 'POSSUI', { realized: true }),
        a('supplier', 'N/A'),
        a('scope', ['INVENTÁRIO']),
        // Pendente: não conta, como se não houvesse resposta.
        a('vehicles', 'SIM', { state: 'pending' }),
      ]),
    );
    expect(result.text).toContain('Prezados, bom dia.');
    expect(result.text).toContain(
      '03- Endereços:\nSP - 4 ENDEREÇOS\nMG - 2 ENDEREÇOS\n1 ENDEREÇO',
    );
    expect(result.text).toContain('02- Quantidade:\n* —');
    expect(result.text).not.toContain('veículos');
    expect(result.text).not.toContain('PENDÊNCIAS');
    expect(result.pendings).toBe(0);
  });

  it('rejects unknown placeholders, missing questions and invalid conditions', () => {
    const bad = (patch: Partial<EmailTemplate>) => () =>
      validateEmailTemplate({ ...template, ...patch }, questions);
    expect(bad({ subject: 'Olá {senha}' })).toThrow(BadRequestException);
    expect(bad({ pendings: [{ text: '{q:inexistente}' }] })).toThrow(
      BadRequestException,
    );
    expect(bad({ pendings: [{ text: '{addresses:count}' }] })).toThrow(
      BadRequestException,
    );
    expect(bad({ pendings: [{ text: '{q:count.name}' }] })).toThrow(
      BadRequestException,
    );
    expect(
      bad({
        pendings: [
          {
            text: 'x',
            when: [{ question_id: 'count', operator: 'contains', value: 1 }],
          },
        ],
      }),
    ).toThrow(BadRequestException);
    expect(bad({ topics: [{ inline: true, lines: [] }] })).toThrow(
      BadRequestException,
    );
    expect(validateEmailTemplate(null, questions)).toBeNull();
  });

  it('drops unknown keys when normalizing', () => {
    const normalized = validateEmailTemplate(
      {
        ...template,
        extra: 'x',
        footer: [{ lines: [{ text: 'Att,', html: '<b>x</b>' }], foo: 1 }],
      },
      questions,
    );
    expect(normalized).not.toHaveProperty('extra');
    expect(normalized!.footer).toEqual([{ lines: [{ text: 'Att,' }] }]);
  });
});
