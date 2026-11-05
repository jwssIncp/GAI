import {
  assertAssignmentPeriod,
  assertOperationalActor,
  operationalDay,
  requireOperationalAssignment,
} from '../../../../src/modules/field-agents/application/services/operational-eligibility';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';
import { EntityManager } from 'typeorm';
import { FieldAgentEntity } from '../../../../src/modules/field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectEntity } from '../../../../src/modules/projects/infrastructure/persistence/project.entity';
import { fieldAgentAuditChanges } from '../../../../src/modules/field-agents/application/services/field-agent-audit';

describe('operational eligibility', () => {
  it.each([
    { systemRoles: [UserRole.PLATFORM_ADMIN] },
    { systemRoles: [UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN] },
  ])('prohibits platform including combined roles %s', ({ systemRoles }) => {
    expect(() =>
      assertOperationalActor({ systemRoles, organizationId: 1 }),
    ).toThrow();
  });
  it('derives organization only from authenticated context', () =>
    expect(
      assertOperationalActor({
        systemRoles: [UserRole.ORG_ADMIN],
        organizationId: 9,
      }),
    ).toBe(9));
  it.each([
    ['2026-11-05', null],
    [null, '2026-11-03'],
  ])('rejects outside dates', (start, end) =>
    expect(() => assertAssignmentPeriod(start, end, '2026-11-04')).toThrow(),
  );
  it('allows inclusive boundaries and open periods', () => {
    expect(() =>
      assertAssignmentPeriod('2026-11-04', '2026-11-04', '2026-11-04'),
    ).not.toThrow();
    expect(() => assertAssignmentPeriod(null, null)).not.toThrow();
    expect(operationalDay(new Date('2026-11-05T01:00:00Z'))).toBe('2026-11-04');
  });
  it.each(['inactive', 'blocked', 'deleted'])(
    'rejects %s before loading an assignment',
    async (status) => {
      const findOne = jest
        .fn()
        .mockResolvedValue(status === 'deleted' ? null : { status });
      const manager = {
        connection: { options: { type: 'mysql' } },
        getRepository: (entity: unknown) =>
          entity === ProjectEntity
            ? { findOne: async () => ({ status: 'active' }) }
            : { findOne },
      } as unknown as EntityManager;
      await expect(
        requireOperationalAssignment(manager, 1, 3, 7),
      ).rejects.toThrow();
      expect(findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7, organizationId: 1 },
          lock: { mode: 'pessimistic_write' },
        }),
      );
    },
  );
  it('requires an active link even when the agent is active', async () => {
    const manager = {
      connection: { options: { type: 'mysql' } },
      getRepository: (entity: unknown) => ({
        findOne: async () =>
          entity === ProjectEntity || entity === FieldAgentEntity
            ? { status: 'active' }
            : null,
      }),
    } as unknown as EntityManager;
    await expect(
      requireOperationalAssignment(manager, 1, 3, 7),
    ).rejects.toThrow();
  });
  it('does not audit arbitrary JSON or credentials', () =>
    expect(
      fieldAgentAuditChanges({
        name: { before: 'Old', after: 'New' },
        metadata: { before: null, after: { token: 'secret' } },
        password: { before: null, after: 'secret' },
      }),
    ).toEqual({ name: { before: 'Old', after: 'New' } }));
});
