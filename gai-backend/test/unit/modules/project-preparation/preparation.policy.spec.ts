import { BadRequestException } from '@nestjs/common';
import {
  applicability,
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
