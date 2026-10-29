import {
  CommercialService,
  commercialTotals,
} from '../../../../src/modules/contracts/commercial.service';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';
import { PermissionScope } from '../../../../src/modules/users/domain/enums/permission-scope.enum';
import { ContractEntity } from '../../../../src/modules/contracts/contract.entity';
import {
  cents,
  money,
  normalizeContract,
  transition,
} from '../../../../src/modules/contracts/contract.policy';
const row = (value: string | null, recurring: boolean | null = null) =>
  ({
    data: {
      original_value: value,
      current_value: value,
      currency: 'BRL',
      recurring,
      status: 'draft',
    },
  }) as ContractEntity;
describe('Exact commercial amounts and unavailable metrics', () => {
  it('checks live source permissions again before reading a historical report', async () => {
    const report = {
      id: 1,
      payload: { operational_stages: [{ source: 'inventory_sessions' }] },
    };
    const scopes = jest.fn().mockResolvedValue(new Map());
    const service = new CommercialService(
      { getRepository: () => ({ findOneBy: async () => report }) } as never,
      { query: jest.fn() } as never,
      { findScopesByKeys: scopes } as never,
    );
    const actor = {
      id: 2,
      organizationId: 1,
      systemRoles: [UserRole.ORG_ADMIN],
    };
    await expect(service.report(1, actor)).rejects.toThrow(
      'A fonte operacional',
    );
    scopes.mockResolvedValue(
      new Map([['inventory-sessions:read', PermissionScope.ORGANIZATION]]),
    );
    expect(await service.report(1, actor)).toBe(report);
  });
  it('adds cents without binary floating point and rounds the annual ticket half-up', () => {
    expect(money(cents('0.10') + cents('0.20'))).toBe('0.30');
    expect(commercialTotals([row('0.00'), row('0.01')])[0].average).toBe(
      '0.01',
    );
  });
  it('allows aggregate amounts larger than one contract without losing cents', () => {
    const t = commercialTotals([
      row('9999999999999.99'),
      row('9999999999999.99'),
    ])[0];
    expect(t.current.value).toBe('19999999999999.98');
    expect(t.average).toBe('9999999999999.99');
  });
  it('distinguishes unknown recurrence and unknown amounts from true monetary zero', () => {
    const missing = commercialTotals([row(null)])[0];
    expect(missing.current.value).toBeNull();
    expect(missing.average).toBeNull();
    expect(missing.recurring_count).toBeNull();
    const zero = commercialTotals([row('0.00', false)])[0];
    expect(zero.current.value).toBe('0.00');
    expect(zero.recurring_count).toBe(0);
  });
  it('excludes unknown values from the known ticket denominator while reporting incompleteness', () => {
    const t = commercialTotals([row(null), row('0.10')])[0];
    expect(t.average).toBe('0.10');
    expect(t.current.missing).toBe(1);
    expect(t.count).toBe(2);
  });
  it('rejects invalid money and forbidden contract transitions', () => {
    expect(() => cents('1.001')).toThrow();
    expect(() => transition('completed', 'active')).toThrow();
    expect(() => transition('archived', 'draft')).toThrow();
    expect(() =>
      normalizeContract({
        number: ' ',
        company_id: 1,
        currency: 'BRL',
        services: [],
        status: 'draft',
      }),
    ).toThrow();
  });
});
