import {
  fieldToday,
  applicability,
  civilDate,
  validateDefinition,
  validateTransition,
  type FieldDefinition,
} from '../../../../src/modules/field-coordination/field.policy';
const task = (id: string, group = 'third') => ({
  id,
  group_id: group,
  title: id,
  order: 0,
  required: true,
  allow_not_applicable: true,
  requires_responsible: false,
  requires_due_date: false,
  requires_notes: false,
  requires_approval: false,
  requires_issue_resolved: false,
});
const definition = (): FieldDefinition => ({
  groups: [{ id: 'third', title: 'Todas as etapas', required: true, order: 3 }],
  tasks: [
    task('a'),
    { ...task('b'), applicable_if: [{ task_id: 'a', states: ['completed'] }] },
  ],
});
describe('Field coordination policy', () => {
  it('uses the Brazilian civil day for overdue tasks around UTC midnight', () => {
    expect(fieldToday(new Date('2026-10-28T01:00:00Z'))).toBe('2026-10-27');
    expect(fieldToday(new Date('2026-10-28T03:00:00Z'))).toBe('2026-10-28');
  });
  it('validates all groups, stable IDs and non-positional conditions', () => {
    expect(validateDefinition(definition()).groups[0].order).toBe(3);
    expect(
      applicability(definition(), [
        { stableId: 'a', state: 'pending' },
        { stableId: 'b', state: 'completed' },
      ]).get('b'),
    ).toBe(false);
    expect(
      applicability(definition(), [{ stableId: 'a', state: 'completed' }]).get(
        'b',
      ),
    ).toBe(true);
  });
  it('rejects duplicate IDs, unknown references, empty groups and cyclic dependencies', () => {
    const duplicate = definition();
    duplicate.tasks.push(task('a'));
    expect(() => validateDefinition(duplicate)).toThrow();
    const unknown = definition();
    unknown.tasks[1].group_id = 'foreign';
    expect(() => validateDefinition(unknown)).toThrow();
    const cycle = definition();
    cycle.tasks[0].applicable_if = [{ task_id: 'b', states: ['completed'] }];
    expect(() => validateDefinition(cycle)).toThrow();
    const empty = definition();
    empty.tasks = [];
    expect(() => validateDefinition(empty)).toThrow();
  });
  it('rejects group/task applicability cycles and bad requirement types', () => {
    const group = definition();
    group.groups[0].applicable_if = [{ task_id: 'a', states: ['completed'] }];
    expect(() => validateDefinition(group)).toThrow();
    const bad = definition();
    bad.tasks[0].requires_approval = 1 as unknown as boolean;
    expect(() => validateDefinition(bad)).toThrow();
  });
  it('requires explicit reason and valid destination for reopening and N/A', () => {
    expect(() => validateTransition('completed', 'pending')).toThrow();
    expect(() =>
      validateTransition('completed', 'blocked', 'reason'),
    ).toThrow();
    expect(
      validateTransition('completed', 'in_progress', 'correction'),
    ).toEqual({ reopens: true });
    expect(() =>
      validateTransition('pending', 'not_applicable', ' '),
    ).toThrow();
  });
  it('validates real civil dates including leap days without throwing RangeError', () => {
    expect(civilDate('2028-02-29')).toBe('2028-02-29');
    for (const date of ['2026-02-29', '2026-99-99', 'tomorrow'])
      expect(() => civilDate(date)).toThrow('Data civil inválida');
    expect(civilDate(null)).toBeNull();
  });
});
