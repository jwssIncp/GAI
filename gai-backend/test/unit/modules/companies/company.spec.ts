import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';
import { Company } from '../../../../src/modules/companies/domain/entities/company';
import { CompanyUnit } from '../../../../src/modules/companies/domain/entities/company-unit';
import { CompanyStatus } from '../../../../src/modules/companies/domain/enums/company-status.enum';
import { CompanyUnitStatus } from '../../../../src/modules/companies/domain/enums/company-unit-status.enum';
import { CompanyScopeService } from '../../../../src/modules/companies/application/services/company-scope.service';

describe('Company domain and scope', () => {
  it('requires meaningful company and unit names', () => {
    expect(
      () =>
        new Company({
          id: 1,
          organizationId: 1,
          name: ' ',
          corporateName: null,
          document: null,
          status: CompanyStatus.ACTIVE,
          metadata: null,
          deletedAt: null,
        }),
    ).toThrow('name must have at least 2 characters');

    expect(
      () =>
        new CompanyUnit({
          id: 1,
          organizationId: 1,
          companyId: 1,
          name: 'A',
          code: null,
          status: CompanyUnitStatus.ACTIVE,
        }),
    ).toThrow('name must have at least 2 characters');
  });

  it('exposes status guards for project and unit assignment rules', () => {
    const activeCompany = new Company({
      id: 1,
      organizationId: 1,
      name: 'MAERSK',
      corporateName: null,
      document: null,
      status: CompanyStatus.ACTIVE,
      metadata: null,
      deletedAt: null,
    });
    const inactiveUnit = new CompanyUnit({
      id: 1,
      organizationId: 1,
      companyId: 1,
      name: 'Galpao 1',
      code: null,
      status: CompanyUnitStatus.INACTIVE,
    });

    expect(activeCompany.canReceiveProject()).toBe(true);
    expect(inactiveUnit.canBeAssigned()).toBe(false);
  });

  it('enforces organization scope unless actor is platform admin', () => {
    const service = new CompanyScopeService();

    expect(() =>
      service.assertCanAccessOrganization(
        { id: 1, organizationId: 10, systemRoles: [] },
        11,
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      service.assertCanAccessOrganization(
        {
          id: 1,
          organizationId: null,
          systemRoles: [UserRole.PLATFORM_ADMIN],
        },
        11,
      ),
    ).not.toThrow();
  });
});
