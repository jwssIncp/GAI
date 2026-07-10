import { ForbiddenException } from '@nestjs/common';
import { CatalogAssetScopeService } from '../../../../src/modules/catalog-assets/application/services/catalog-asset-scope.service';
import { CatalogAsset } from '../../../../src/modules/catalog-assets/domain/entities/catalog-asset';
import { CatalogAssetStatus } from '../../../../src/modules/catalog-assets/domain/enums/catalog-asset-status.enum';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';

describe('CatalogAsset domain', () => {
  const baseProps = {
    id: 1,
    organizationId: 10,
    description: 'Notebook Dell',
    descriptionNormalized: 'notebook dell',
    category: null,
    status: CatalogAssetStatus.ACTIVE,
    metadata: null,
    createdById: 7,
    updatedById: 7,
    createdAt: new Date('2026-07-07T00:00:00.000Z'),
    updatedAt: new Date('2026-07-07T00:00:00.000Z'),
    deletedAt: null,
  };

  it('requires description', () => {
    expect(
      () => new CatalogAsset({ ...baseProps, description: '   ' }),
    ).toThrow('description is required');
  });

  it('deactivates and reactivates without physical delete', () => {
    const asset = new CatalogAsset(baseProps);
    const changes = asset.deactivate(8, new Date('2026-07-07T01:00:00.000Z'));

    expect(asset.status).toBe(CatalogAssetStatus.INACTIVE);
    expect(asset.deletedAt).toEqual(new Date('2026-07-07T01:00:00.000Z'));
    expect(changes.status.after).toBe(CatalogAssetStatus.INACTIVE);

    const reactivation = asset.reactivate(8);
    expect(asset.status).toBe(CatalogAssetStatus.ACTIVE);
    expect(asset.deletedAt).toBeNull();
    expect(reactivation.deleted_at.after).toBeNull();
  });

  it('blocks repeated deactivation', () => {
    const asset = new CatalogAsset({
      ...baseProps,
      status: CatalogAssetStatus.INACTIVE,
      deletedAt: new Date(),
    });

    expect(() => asset.deactivate(8)).toThrow(
      'Catalog asset is already inactive',
    );
  });
});

describe('CatalogAssetScopeService', () => {
  const service = new CatalogAssetScopeService();

  it('normalizes descriptions ignoring case, accents and extra spaces', () => {
    expect(service.normalizeDescription('  MÁQUINA   de  Café  ')).toBe(
      'maquina de cafe',
    );
  });

  it('allows platform admin to target any organization', () => {
    expect(
      service.resolveOrganizationForCreate(
        {
          id: 1,
          systemRoles: [UserRole.PLATFORM_ADMIN],
          organizationId: null,
        },
        99,
      ),
    ).toBe(99);
  });

  it('blocks organization user from accessing another organization', () => {
    expect(() =>
      service.assertCanAccessOrganization(
        { id: 1, systemRoles: [], organizationId: 10 },
        11,
      ),
    ).toThrow(ForbiddenException);
  });
});
