import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../../src/modules/auth/domain/enums/user.enums';
import { CatalogAssetScopeService } from '../../../src/modules/catalog-assets/application/services/catalog-asset-scope.service';
import { CompanyScopeService } from '../../../src/modules/companies/application/services/company-scope.service';
import { FieldAgentScopeService } from '../../../src/modules/field-agents/application/services/field-agent-scope.service';
import { InventoryItemScopeService } from '../../../src/modules/inventory-items/application/services/inventory-item-scope.service';
import { ProjectScopeService } from '../../../src/modules/projects/application/services/project-scope.service';

describe('Organization-scoped list filters', () => {
  const actorWithoutOrganization = {
    id: 10,
    systemRoles: [] as UserRole[],
    organizationId: null,
  };

  const services = [
    new ProjectScopeService(),
    new CompanyScopeService(),
    new FieldAgentScopeService(),
    new CatalogAssetScopeService(),
    new InventoryItemScopeService(),
  ];

  it.each(services)(
    '$constructor.name rejects a missing organization instead of returning a global filter',
    (service) => {
      expect(() =>
        service.resolveOrganizationFilter(actorWithoutOrganization),
      ).toThrow(ForbiddenException);
    },
  );

  it.each(services)(
    '$constructor.name permits an explicit global filter only for PLATFORM_ADMIN',
    (service) => {
      expect(
        service.resolveOrganizationFilter({
          id: 1,
          systemRoles: [UserRole.PLATFORM_ADMIN],
          organizationId: null,
        }),
      ).toBeUndefined();
    },
  );
});
