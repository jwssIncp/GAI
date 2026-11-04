import {
  isValidCnpj,
  normalizeCnpj,
} from '../../../src/modules/companies/domain/cnpj';
import { CompanyScopeService } from '../../../src/modules/companies/application/services/company-scope.service';
import { UserRole } from '../../../src/modules/auth/domain/enums/user.enums';

describe('CNPJ and authenticated company context', () => {
  it.each([
    '12.ABC.345/01DE-35',
    '12.abc.345/01de-35',
    '11.444.777/0001-61',
    '04.252.011/0001-10',
  ])(
    'validates official algorithm and keeps existing numeric documents: %s',
    (value) => expect(isValidCnpj(value)).toBe(true),
  );
  it.each([
    '',
    '00000000000000',
    '11111111111111',
    '12ABC34501DE36',
    '12ABC34501DEAA',
    '12!ABC34501DE35',
    '12ÁBC34501DE35',
  ])('rejects invalid document %s', (value) =>
    expect(isValidCnpj(value)).toBe(false),
  );
  it('preserves leading zeros and letters', () =>
    expect(normalizeCnpj('04.abc.011/0001-10')).toBe('04ABC011000110'));
  it('uses the organization from the server and fails closed without it', () => {
    const scope = new CompanyScopeService();
    const actor = {
      id: 1,
      systemRoles: [UserRole.ORG_ADMIN],
      organizationId: 7,
    };
    expect(scope.resolveOrganizationForCreate(actor)).toBe(7);
    expect(() => scope.resolveOrganizationForCreate(actor, 8)).toThrow();
    expect(() =>
      scope.resolveOrganizationForCreate({ ...actor, organizationId: null }),
    ).toThrow();
    expect(() =>
      scope.resolveOrganizationForCreate({
        ...actor,
        systemRoles: [UserRole.PLATFORM_ADMIN],
      }),
    ).toThrow();
  });
});
