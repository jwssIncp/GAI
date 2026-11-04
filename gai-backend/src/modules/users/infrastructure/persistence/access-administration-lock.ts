import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { UserRole, UserStatus } from '../../../auth/domain/enums/user.enums';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { RoleType } from '../../domain/enums/role-type.enum';
import { RoleEntity } from './role.entity';
import { UserRoleAssignmentEntity } from './user-role-assignment.entity';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { OrganizationStatus } from '../../../organizations/domain/enums/organization-status.enum';
import type { ActorContext } from '../../application/services/user-scope.service';

export async function assertCurrentAccessAdministrator(
  manager: EntityManager,
  actor: ActorContext,
): Promise<void> {
  const user = await manager
    .getRepository(UserEntity)
    .findOneBy({ id: actor.id });
  if (
    user &&
    user.status === UserStatus.ACTIVE &&
    !user.mustChangePassword &&
    user.organizationId === actor.organizationId
  ) {
    const links = await manager
      .getRepository(UserRoleAssignmentEntity)
      .findBy({ userId: user.id, isActive: true, revokedAt: IsNull() });
    const key =
      user.organizationId === null
        ? UserRole.PLATFORM_ADMIN
        : UserRole.ORG_ADMIN;
    for (const link of links) {
      const role = await manager.getRepository(RoleEntity).findOneBy({
        id: link.roleId,
        key,
        type: RoleType.SYSTEM,
        organizationId: IsNull(),
        isActive: true,
      });
      if (role && actor.systemRoles.includes(key)) return;
    }
  }
  throw new ForbiddenException({
    code: 'FORBIDDEN',
    message: 'Seu acesso administrativo mudou. Entre novamente para continuar.',
  });
}

export async function assertActiveAccessOrganization(
  manager: EntityManager,
  organizationId: number | null,
): Promise<void> {
  if (
    organizationId !== null &&
    !(await manager
      .getRepository(OrganizationEntity)
      .existsBy({ id: organizationId, status: OrganizationStatus.ACTIVE }))
  ) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'A organização precisa estar ativa para conceder perfis.',
    });
  }
}

/** All access mutations take these locks first, in the same order. This also
 * serializes revocation against user deactivation and organization transfers.
 * SQLite tests use a single connection; MySQL uses real InnoDB row locks. */
export async function lockAccessAdministration(
  manager: EntityManager,
): Promise<void> {
  const query = manager
    .getRepository(RoleEntity)
    .createQueryBuilder('role')
    .where('role.type = :type', { type: RoleType.SYSTEM })
    .orderBy('role.id', 'ASC');
  if (manager.connection.options.type !== 'sqlite')
    query.setLock('pessimistic_write');
  await query.getMany();
}

export async function assertAdministratorSurvives(
  manager: EntityManager,
  user: UserEntity,
  remainingRoleIds: number[],
): Promise<void> {
  if (user.status !== UserStatus.ACTIVE) return;
  const assignments = await manager
    .getRepository(UserRoleAssignmentEntity)
    .findBy({
      userId: user.id,
      isActive: true,
      revokedAt: IsNull(),
    });
  for (const assignment of assignments) {
    if (remainingRoleIds.includes(Number(assignment.roleId))) continue;
    const role = await manager
      .getRepository(RoleEntity)
      .findOneBy({ id: assignment.roleId });
    if (
      !role?.isActive ||
      role.type !== RoleType.SYSTEM ||
      role.organizationId !== null
    )
      continue;
    const organizational =
      role.key === UserRole.ORG_ADMIN && user.organizationId !== null;
    const platform =
      role.key === UserRole.PLATFORM_ADMIN && user.organizationId === null;
    if (!organizational && !platform) continue;
    const others = await manager
      .getRepository(UserRoleAssignmentEntity)
      .createQueryBuilder('assignment')
      .innerJoin(UserEntity, 'user', 'user.id = assignment.user_id')
      .where('assignment.role_id = :roleId', { roleId: role.id })
      .andWhere('assignment.is_active = 1 AND assignment.revoked_at IS NULL')
      .andWhere('user.status = :status AND user.id != :userId', {
        status: UserStatus.ACTIVE,
        userId: user.id,
      })
      .andWhere(
        organizational
          ? 'user.organization_id = :organizationId'
          : 'user.organization_id IS NULL',
        { organizationId: user.organizationId },
      )
      .getCount();
    if (others === 0)
      throw new ConflictException({
        code: 'LAST_ACTIVE_ADMIN',
        message: organizational
          ? 'A organização precisa manter ao menos um administrador ativo.'
          : 'A plataforma precisa manter ao menos um administrador ativo.',
      });
  }
}
