import 'reflect-metadata';
import { DataSource, Like } from 'typeorm';
import {
  FIELD_ACCESS_PERMISSIONS,
  FIELD_AGENT_ROLE_PREFIX,
} from '../../modules/field-agents/domain/field-access-permissions';
import { OrgRoleAuditOperation } from '../../modules/users/domain/enums/org-role-audit-operation.enum';
import { PermissionScope } from '../../modules/users/domain/enums/permission-scope.enum';
import { RoleType } from '../../modules/users/domain/enums/role-type.enum';
import { PermissionEntity } from '../../modules/users/infrastructure/persistence/permission.entity';
import { RoleAuditLogEntity } from '../../modules/users/infrastructure/persistence/role-audit-log.entity';
import { RolePermissionEntity } from '../../modules/users/infrastructure/persistence/role-permission.entity';
import { RoleEntity } from '../../modules/users/infrastructure/persistence/role.entity';

export interface FieldRoleUpgradeReport {
  roleId: number;
  key: string | null;
  action: 'upgrade' | 'up-to-date' | 'skipped-foreign-permissions';
  missing: string[];
  foreign: string[];
}

/**
 * Explicit, operator-triggered upgrade of existing field-agent roles to the
 * current least-privilege set. Never runs automatically (not part of
 * release:prod). Dry-run unless `apply` is true. Roles holding permissions
 * outside the field set were customized by someone and are left untouched.
 */
export async function upgradeFieldAgentRoles(
  dataSource: DataSource,
  apply: boolean,
): Promise<FieldRoleUpgradeReport[]> {
  const catalog = await dataSource.getRepository(PermissionEntity).find();
  const wanted = catalog.filter(
    (p) =>
      FIELD_ACCESS_PERMISSIONS.includes(p.key) &&
      p.scope === PermissionScope.ORGANIZATION,
  );
  if (wanted.length !== FIELD_ACCESS_PERMISSIONS.length)
    throw new Error(
      'Permission catalog is missing field permissions; run permissions:sync first.',
    );
  const roles = await dataSource.getRepository(RoleEntity).find({
    where: {
      key: Like(`${FIELD_AGENT_ROLE_PREFIX}%`),
      type: RoleType.ORGANIZATION,
    },
  });
  const reports: FieldRoleUpgradeReport[] = [];
  for (const role of roles) {
    const grants = await dataSource
      .getRepository(PermissionEntity)
      .createQueryBuilder('permission')
      .innerJoin(
        RolePermissionEntity,
        'grant',
        'grant.permissionId=permission.id',
      )
      .where('grant.roleId = :id', { id: role.id })
      .getMany();
    const held = new Set(grants.map((p) => p.key));
    const foreign = grants
      .filter(
        (p) =>
          !FIELD_ACCESS_PERMISSIONS.includes(p.key) ||
          p.scope !== PermissionScope.ORGANIZATION,
      )
      .map((p) => p.key);
    const missing = wanted.filter((p) => !held.has(p.key));
    const report: FieldRoleUpgradeReport = {
      roleId: role.id,
      key: role.key,
      action: foreign.length
        ? 'skipped-foreign-permissions'
        : missing.length
          ? 'upgrade'
          : 'up-to-date',
      missing: missing.map((p) => p.key),
      foreign,
    };
    reports.push(report);
    if (!apply || report.action !== 'upgrade') continue;
    await dataSource.transaction(async (manager) => {
      for (const permission of missing)
        await manager
          .getRepository(RolePermissionEntity)
          .save({ roleId: role.id, permissionId: permission.id });
      await manager.getRepository(RoleAuditLogEntity).save({
        roleId: role.id,
        operation: OrgRoleAuditOperation.UPDATE,
        performedBy: null,
        changes: {
          permissions: {
            before: [...held].sort(),
            after: [...held, ...report.missing].sort(),
          },
        },
      });
    });
  }
  return reports;
}
