import { DataSource, In } from 'typeorm';
import { RoleEntity } from '../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { PermissionEntity } from '../../src/modules/users/infrastructure/persistence/permission.entity';
import { OrganizationEntity } from '../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { ProjectEntity } from '../../src/modules/projects/infrastructure/persistence/project.entity';
import { OrganizationStatus } from '../../src/modules/organizations/domain/enums/organization-status.enum';

export async function seedNavigationReader(ds: DataSource) {
  if (
    ds.options.type !== 'mysql' ||
    ds.options.database !== 'gai_navigation_disposable'
  )
    throw Error(
      'Navigation fixture requires its separate disposable browser schema',
    );
  if (
    process.env.GAI_TEST_MYSQL_WAVE2 !== '1' ||
    process.env.GAI_TEST_MYSQL_DISPOSABLE !== '1'
  )
    throw Error('Navigation fixture requires Wave 2 disposable MySQL');
  const role = await ds
    .getRepository(RoleEntity)
    .findOneByOrFail({ name: 'Operador', organizationId: 1 });
  const keys = [
    'projects:read',
    'companies:read',
    'project-units:read',
    'company-units:read',
    'project-field-agents:read',
    'budgets:read',
    'receivables:read',
    'cash-flow:read',
    'payments:read',
    'expenses:read',
    'expense-installments:read',
    'dre:read',
    'contracts:read',
    'technical-reports:read',
    'inventory-items:read',
    'inventory-sessions:read',
    'inventory-accounting-items:read',
    'inventory-pending-issues:read',
    'asset-valuations:read',
    'reconciliations:read',
    'assisted-reconciliation:read',
    'field-coordination:read',
    'project-preparation:read',
  ];
  await ds.getRepository(RolePermissionEntity).delete({ roleId: role.id });
  const permissions = await ds
    .getRepository(PermissionEntity)
    .findBy({ key: In(keys) });
  if (permissions.length !== keys.length)
    throw Error('Missing read permission fixture');
  await ds.getRepository(RolePermissionEntity).insert(
    permissions.map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    })),
  );
  const foreign = await ds.getRepository(OrganizationEntity).save(
    ds.getRepository(OrganizationEntity).create({
      legalName: 'SINTETICO Organização externa Onda 2',
      tradeName: 'SINTETICO externa',
      cnpj: '11444777000161',
      status: OrganizationStatus.ACTIVE,
    }),
  );
  const foreignProject = await ds.getRepository(ProjectEntity).save(
    ds.getRepository(ProjectEntity).create({
      organizationId: Number(foreign.id),
      name: 'SINTETICO PROJETO EXTERNO SIGILOSO',
    }),
  );
  const primary = await ds.getRepository(ProjectEntity).save(
    ds.getRepository(ProjectEntity).create({
      organizationId: 1,
      companyId: 1,
      name: 'SINTETICO Navegação contínua primário',
    }),
  );
  const secondary = await ds.getRepository(ProjectEntity).save(
    ds.getRepository(ProjectEntity).create({
      organizationId: 1,
      companyId: 1,
      name: 'SINTETICO Navegação contínua secundário',
    }),
  );
  return {
    database: ds.options.database,
    primary: Number(primary.id),
    secondary: Number(secondary.id),
    secondaryName: secondary.name,
    foreignProject: Number(foreignProject.id),
    reader: 'test.user',
  };
}
