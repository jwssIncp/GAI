import { BadRequestException } from '@nestjs/common';
import {
  applicability,
  addressSummary,
  allocations,
  progress,
  validateAnswer,
  validateQuestions,
  validDate,
} from '../../../../src/modules/project-preparation/domain/preparation.policy';
import {
  PolicyAnswer,
  PreparationQuestion,
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
  allow_not_applicable: false,
  ...extra,
});
const a = (
  questionId: string,
  value: PolicyAnswer['value'],
  state: PolicyAnswer['state'] = 'completed',
): PolicyAnswer => ({ questionId, state, value, notes: null });
describe('Preparation domain rules', () => {
  it('evaluates chained AND conditions independently of array order and distinguishes false/zero from missing', () => {
    const questions = validateQuestions([
      q('child', {
        enabled_when: [
          { question_id: 'flag', operator: 'equals', value: false },
          { question_id: 'zero', operator: 'in', value: [0, 1] },
        ],
      }),
      q('grandchild', {
        enabled_when: [{ question_id: 'child', operator: 'answered' }],
      }),
      q('zero', { type: 'number' }),
      q('flag', { type: 'boolean' }),
    ]);
    const values = [a('flag', false), a('zero', 0), a('child', 'Sim')];
    expect(applicability(questions, values).get('grandchild')).toBe(true);
    expect(
      applicability(
        questions,
        values.filter((item) => item.questionId !== 'zero'),
      ).get('grandchild'),
    ).toBe(false);
    expect(
      applicability(questions, [
        a('flag', null, 'not_applicable'),
        a('zero', 0),
      ]).get('child'),
    ).toBe(false);
  });
  it('does not treat an unanswered supplier as different from N/A', () => {
    const questions = validateQuestions([
      q('supplier', { type: 'select', options: ['Cliente', 'GAI', 'N/A'] }),
      q('quantity', {
        type: 'number',
        enabled_when: [
          { question_id: 'supplier', operator: 'not_equals', value: 'N/A' },
        ],
      }),
    ]);
    expect(applicability(questions, []).get('quantity')).toBe(false);
    expect(
      applicability(questions, [a('supplier', 'N/A')]).get('quantity'),
    ).toBe(false);
    expect(
      applicability(questions, [a('supplier', 'Cliente')]).get('quantity'),
    ).toBe(true);
  });
  it.each([
    '2026-02-29',
    '2028-02-30',
    '2026-13-01',
    'not-a-date',
    '2026-01-01T00:00:00Z',
  ])('rejects invalid civil date %s', (value) => {
    expect(() => validDate(value)).toThrow(BadRequestException);
  });
  it.each(['2028-02-29', '2026-01-31', '2026-04-30'])(
    'accepts valid civil date %s',
    (value) => {
      expect(() => validDate(value)).not.toThrow();
    },
  );
  it('calculates a documented denominator including explicit N/A, excluding hidden and disabled, with one decimal', () => {
    const questions = [
      q('required', { required: true }),
      q('na', { allow_not_applicable: true }),
      q('pending'),
      q('hidden', { visible: false }),
      q('disabled', {
        enabled_when: [
          { question_id: 'required', operator: 'equals', value: 'other' },
        ],
      }),
    ];
    const answers = [
      a('required', 'Resolved'),
      { ...a('na', null, 'not_applicable'), notes: 'Fora do escopo' },
    ];
    expect(progress(questions, answers)).toEqual({
      total: 3,
      completed: 1,
      not_applicable: 1,
      pending: 1,
      hidden: 1,
      conditionally_disabled: 1,
      percent: 66.7,
      missing_required: [],
      realized: 0,
      realized_percent: 0,
    });
    expect(progress([q('hidden', { visible: false })], []).percent).toBe(0);
  });
  it.each([
    [q('bool', { type: 'boolean' }), a('bool', 'false')],
    [q('num', { type: 'number' }), a('num', -1)],
    [q('text'), a('text', '   ')],
    [q('choice', { type: 'select', options: ['A'] }), a('choice', 'B')],
    [q('pending'), a('pending', 'Stale value', 'pending')],
    [q('na', { allow_not_applicable: true }), a('na', null, 'not_applicable')],
  ])('rejects invalid typed/state value %#', (question, answer) => {
    expect(() => validateAnswer(question, answer, [answer])).toThrow(
      BadRequestException,
    );
  });
  it('accepts false, zero and justified N/A without conflating them with missing data', () => {
    const bool = a('bool', false);
    const zero = a('zero', 0);
    expect(() =>
      validateAnswer(q('bool', { type: 'boolean' }), bool, [bool]),
    ).not.toThrow();
    expect(() =>
      validateAnswer(q('zero', { type: 'number' }), zero, [zero]),
    ).not.toThrow();
    expect(() =>
      validateAnswer(
        q('na', { required: true, allow_not_applicable: true }),
        { ...a('na', null, 'not_applicable'), notes: 'Não pertence ao escopo' },
        [],
      ),
    ).not.toThrow();
  });
  it('calculates unit shares reproducibly without inventing units or rounding persisted quantities', () => {
    expect(
      allocations([
        { unit_id: 1, quantity: 1 },
        { unit_id: 2, quantity: 2 },
      ]).map((row) => row.participation_percent),
    ).toEqual([33.3, 66.7]);
    expect(
      allocations([{ unit_id: 1, quantity: 0 }])[0].participation_percent,
    ).toBe(0);
  });
});

describe('Tipos de resposta do kick-off do sistema anterior', () => {
  const ok = (
    question: PreparationQuestion,
    value: unknown,
    answers: PolicyAnswer[] = [],
  ) =>
    validateAnswer(
      question,
      {
        questionId: question.id,
        state: 'completed',
        value: value as never,
        notes: null,
      },
      answers,
    );
  const bad = (
    question: PreparationQuestion,
    value: unknown,
    answers: PolicyAnswer[] = [],
  ) => expect(() => ok(question, value, answers)).toThrow(BadRequestException);

  it('valida escolha múltipla, contato, período, horário e item sem resposta', () => {
    const chips = q('scope', {
      type: 'multi_select',
      options: ['VISTORIA', 'OUTROS'],
    });
    ok(chips, ['VISTORIA', 'OUTROS']);
    bad(chips, []);
    bad(chips, ['VISTORIA', 'VISTORIA']);
    bad(chips, ['INEXISTENTE']);
    const contact = q('focal', { type: 'contact' });
    ok(contact, { name: 'Maria', phone: '(11) 91234-5678' });
    ok(contact, { name: 'Maria', phone: null });
    ok(contact, { name: 'Maria', phone: '+55 11 3123-4567' });
    bad(contact, { name: '', phone: '(11) 91234-5678' });
    bad(contact, { name: 'Maria', phone: '1234' });
    bad(contact, { name: 'Maria', phone: null, email: 'x' });
    const period = q('periodo', { type: 'date_range' });
    ok(period, { start: '2026-01-10', end: '2026-01-20' });
    bad(period, { start: '2026-01-20', end: '2026-01-10' });
    bad(period, { start: '2026-02-30', end: '2026-03-01' });
    const hours = q('horario', { type: 'schedule' });
    ok(hours, { start: '07:00', end: '16:00', weekends: true });
    bad(hours, { start: '7h', end: '16:00', weekends: false });
    bad(hours, { start: '07:00', end: '07:00', weekends: false });
    const none = q('call', { type: 'none' });
    expect(() => ok(none, null)).toThrow(BadRequestException);
    validateAnswer(
      none,
      {
        questionId: 'call',
        state: 'pending',
        value: null,
        notes: null,
        realized: true,
      },
      [],
    );
  });

  it('lista de sequências segue a quantidade de modelos declarada', () => {
    const models = q('modelos', { type: 'number' });
    const list = q('sequencias', {
      type: 'sequence_list',
      quantity_question_id: 'modelos',
    });
    validateQuestions([models, list]);
    const two: PolicyAnswer[] = [
      { questionId: 'modelos', state: 'completed', value: 2, notes: null },
    ];
    ok(
      list,
      [
        { start: 1, end: 10 },
        { start: 20, end: 30 },
      ],
      two,
    );
    bad(list, [{ start: 1, end: 10 }], two);
    bad(
      list,
      [
        { start: 10, end: 1 },
        { start: 20, end: 30 },
      ],
      two,
    );
  });

  it('"contém" vale só para escolha múltipla e habilita o complemento na linha', () => {
    const chips = q('perfil', {
      type: 'multi_select',
      options: ['MÓVEIS', 'OUTROS'],
    });
    const other = q('outros', {
      type: 'text',
      display: 'inline',
      enabled_when: [
        { question_id: 'perfil', operator: 'contains', value: 'OUTROS' },
      ],
    });
    validateQuestions([chips, other]);
    expect(() =>
      validateQuestions([
        chips,
        {
          ...other,
          enabled_when: [
            { question_id: 'perfil', operator: 'equals', value: 'OUTROS' },
          ],
        },
      ]),
    ).toThrow(BadRequestException);
    const answer = (value: string[]): PolicyAnswer[] => [
      { questionId: 'perfil', state: 'completed', value, notes: null },
    ];
    expect(
      applicability([chips, other], answer(['OUTROS'])).get('outros'),
    ).toBe(true);
    expect(
      applicability([chips, other], answer(['MÓVEIS'])).get('outros'),
    ).toBe(false);
  });
});

describe('Resumo dos endereços do kick-off (unidades do projeto)', () => {
  it('conta endereços, cidades e estados e ordena por quantidade', () => {
    const units = [
      { id: 1, city: 'São Paulo', state: 'SP' },
      { id: 2, city: 'Campinas', state: 'SP' },
      { id: 3, city: 'Belo Horizonte', state: 'MG' },
      { id: 4, city: null, state: null },
    ];
    const value = [1, 2, 3, 4].map((unit_id) => ({ unit_id, quantity: 10 }));
    expect(addressSummary(value, units)).toEqual({
      addresses: 4,
      cities: 3,
      states: [
        { state: 'SP', count: 2 },
        { state: 'MG', count: 1 },
      ],
      without_state: 1,
    });
    expect(addressSummary(null, units).addresses).toBe(0);
  });
});
