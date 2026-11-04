import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { UserRole, UserStatus } from '../../../auth/domain/enums/user.enums';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { RoleType } from '../../domain/enums/role-type.enum';
import {
  AssignedRole,
  AssignRoleInput,
  UserRoleAssignmentRepository,
} from '../../domain/ports/user-role-assignment.repository.port';
import { RoleEntity } from './role.entity';
import { UserRoleAssignmentEntity } from './user-role-assignment.entity';
import { isRoleCompatibleWithUserOrganization } from '../../domain/services/role-assignment-scope';
import {
  assertAdministratorSurvives,
  assertCurrentAccessAdministrator,
  assertActiveAccessOrganization,
  lockAccessAdministration,
} from './access-administration-lock';
import { UserScopeService } from '../../application/services/user-scope.service';
import { ActorContext } from '../../application/services/user-scope.service';

@Injectable()
export class TypeOrmUserRoleAssignmentRepository implements UserRoleAssignmentRepository {
  constructor(
    @InjectRepository(UserRoleAssignmentEntity)
    private readonly assignmentRepo: Repository<UserRoleAssignmentEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findActiveByUserId(userId: number): Promise<AssignedRole[]> {
    return this.loadAssignments([userId], true).then(
      (map) => map.get(userId) ?? [],
    );
  }

  async findAllActiveByUserId(userId: number): Promise<AssignedRole[]> {
    return this.loadAssignments([userId], false).then(
      (map) => map.get(userId) ?? [],
    );
  }

  async findActiveByUserIds(
    userIds: number[],
  ): Promise<Map<number, AssignedRole[]>> {
    return this.loadAssignments(userIds, true);
  }

  async findActiveAssignment(
    userId: number,
    roleId: number,
  ): Promise<AssignedRole | null> {
    const assignments = await this.findActiveByUserId(userId);
    return (
      assignments.find((assignment) => assignment.roleId === roleId) ?? null
    );
  }

  async assign(input: AssignRoleInput): Promise<AssignedRole> {
    return this.assignmentRepo.manager.transaction(async (manager) => {
      await lockAccessAdministration(manager);
      const assignmentRepo = manager.getRepository(UserRoleAssignmentEntity);
      const role = await manager
        .getRepository(RoleEntity)
        .findOneByOrFail({ id: input.roleId });
      const user = await manager
        .getRepository(UserEntity)
        .findOneByOrFail({ id: input.userId });
      await assertActiveAccessOrganization(manager, user.organizationId);
      if (input.actor) {
        const scope = new UserScopeService();
        scope.assertCanAssignRoles(input.actor);
        scope.assertPlatformOnlyAssignment(input.actor, user.organizationId);
        scope.assertCanFilterByOrganization(
          input.actor,
          user.organizationId ?? undefined,
        );
        scope.assertCanAssignRole(input.actor, user.organizationId, role);
      }
      if (
        !role.isActive ||
        !isRoleCompatibleWithUserOrganization(role, user.organizationId)
      ) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid or inactive role',
        });
      }
      const existing = await assignmentRepo.findOne({
        where: {
          userId: input.userId,
          roleId: input.roleId,
          isActive: true,
          revokedAt: IsNull(),
        },
      });
      if (existing) {
        return this.toAssignedRole(existing, role);
      }

      const now = new Date();
      const saved = await assignmentRepo.save(
        assignmentRepo.create({
          userId: input.userId,
          roleId: input.roleId,
          isActive: true,
          assignedBy: input.assignedBy,
          assignedAt: now,
          revokedAt: null,
        }),
      );
      return this.toAssignedRole(saved, role);
    });
  }

  async revoke(
    assignmentId: number,
    revokedAt: Date,
    actor?: ActorContext,
  ): Promise<void> {
    await this.assignmentRepo.manager.transaction(async (manager) => {
      await lockAccessAdministration(manager);
      const repo = manager.getRepository(UserRoleAssignmentEntity);
      const assignment = await repo.findOneByOrFail({ id: assignmentId });
      const user = await manager
        .getRepository(UserEntity)
        .findOneByOrFail({ id: assignment.userId });
      if (actor) {
        const scope = new UserScopeService();
        scope.assertCanAssignRoles(actor);
        const role = await manager
          .getRepository(RoleEntity)
          .findOneByOrFail({ id: assignment.roleId });
        scope.assertCanRevokeRole(actor, user.organizationId, role);
      }
      const remaining = await repo.findBy({
        userId: user.id,
        isActive: true,
        revokedAt: IsNull(),
      });
      await assertAdministratorSurvives(
        manager,
        user,
        remaining
          .filter((item) => Number(item.id) !== Number(assignmentId))
          .map((item) => Number(item.roleId)),
      );
      await repo.update({ id: assignmentId }, { isActive: false, revokedAt });
    });
  }

  async replace(
    userId: number,
    roleIds: number[],
    actor: ActorContext,
  ): Promise<void> {
    await this.assignmentRepo.manager.transaction((manager) =>
      replaceUserRoles(manager, userId, roleIds, actor),
    );
  }

  async countActiveUsersWithSystemRole(
    roleKey: UserRole,
    excludeUserId?: number,
  ): Promise<number> {
    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .innerJoin(RoleEntity, 'role', 'role.id = assignment.role_id')
      .innerJoin(UserEntity, 'user', 'user.id = assignment.user_id')
      .where('assignment.is_active = :isActive', { isActive: true })
      .andWhere('assignment.revoked_at IS NULL')
      .andWhere('role.key = :roleKey', { roleKey })
      .andWhere('role.type = :type', { type: RoleType.SYSTEM })
      .andWhere('role.is_active = :roleIsActive', { roleIsActive: true })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE });

    if (roleKey === UserRole.PLATFORM_ADMIN) {
      qb.andWhere('user.organization_id IS NULL');
    } else {
      qb.andWhere('user.organization_id IS NOT NULL');
    }

    if (excludeUserId !== undefined) {
      qb.andWhere('user.id != :excludeUserId', { excludeUserId });
    }

    return qb.getCount();
  }

  async findUsersBySystemRole(roleKey: UserRole): Promise<number[]> {
    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .select('assignment.user_id', 'userId')
      .innerJoin(RoleEntity, 'role', 'role.id = assignment.role_id')
      .innerJoin(UserEntity, 'user', 'user.id = assignment.user_id')
      .where('assignment.is_active = :isActive', { isActive: true })
      .andWhere('assignment.revoked_at IS NULL')
      .andWhere('role.key = :roleKey', { roleKey })
      .andWhere('role.type = :type', { type: RoleType.SYSTEM })
      .andWhere('role.is_active = :roleIsActive', { roleIsActive: true });

    if (roleKey === UserRole.PLATFORM_ADMIN) {
      qb.andWhere('user.organization_id IS NULL');
    } else {
      qb.andWhere('user.organization_id IS NOT NULL');
    }

    const result = await qb.getRawMany<{ userId: string }>();

    return result.map((row) => Number(row.userId));
  }

  private async loadAssignments(
    userIds: number[],
    effectiveOnly: boolean,
  ): Promise<Map<number, AssignedRole[]>> {
    const result = new Map<number, AssignedRole[]>();
    if (userIds.length === 0) {
      return result;
    }

    const assignments = await this.assignmentRepo.find({
      where: { userId: In(userIds), isActive: true, revokedAt: IsNull() },
      order: { assignedAt: 'ASC' },
    });
    if (assignments.length === 0) {
      return result;
    }

    const roleIds = [...new Set(assignments.map((item) => item.roleId))];
    const roles = await this.roleRepo.find({ where: { id: In(roleIds) } });
    const roleMap = new Map(roles.map((role) => [Number(role.id), role]));
    const users = await this.userRepo.find({ where: { id: In(userIds) } });
    const userMap = new Map(users.map((user) => [Number(user.id), user]));

    for (const assignment of assignments) {
      const role = roleMap.get(Number(assignment.roleId));
      const user = userMap.get(Number(assignment.userId));
      if (!role || !user) {
        continue;
      }
      if (
        effectiveOnly &&
        (!role.isActive ||
          !isRoleCompatibleWithUserOrganization(
            {
              type: role.type,
              key: role.key,
              organizationId: role.organizationId,
            },
            user.organizationId,
          ))
      ) {
        continue;
      }
      const userId = Number(assignment.userId);
      const list = result.get(userId) ?? [];
      list.push(this.toAssignedRole(assignment, role));
      result.set(userId, list);
    }

    return result;
  }

  private toAssignedRole(
    assignment: UserRoleAssignmentEntity,
    role: RoleEntity,
  ): AssignedRole {
    return {
      assignmentId: Number(assignment.id),
      roleId: Number(role.id),
      roleKey: role.key,
      roleName: role.name,
      roleType: role.type,
      organizationId: role.organizationId,
      isActive: assignment.isActive,
      assignedAt: assignment.assignedAt,
    };
  }
}

export async function replaceUserRoles(
  manager: EntityManager,
  userId: number,
  roleIds: number[],
  actor: ActorContext,
): Promise<void> {
  await lockAccessAdministration(manager);
  await assertCurrentAccessAdministrator(manager, actor);
  const user = await manager
    .getRepository(UserEntity)
    .findOneByOrFail({ id: userId });
  await assertActiveAccessOrganization(manager, user.organizationId);
  const scope = new UserScopeService();
  scope.assertCanAssignRoles(actor);
  scope.assertPlatformOnlyAssignment(actor, user.organizationId);
  scope.assertCanFilterByOrganization(actor, user.organizationId ?? undefined);
  const roles = roleIds.length
    ? await manager.getRepository(RoleEntity).findBy({ id: In(roleIds) })
    : [];
  if (roles.length !== roleIds.length || roles.some((role) => !role.isActive)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid or inactive role',
    });
  }
  for (const role of roles)
    scope.assertCanAssignRole(actor, user.organizationId, role);
  const repo = manager.getRepository(UserRoleAssignmentEntity);
  const existing = await repo.findBy({
    userId,
    isActive: true,
    revokedAt: IsNull(),
  });
  // Revocation must also be authorized, including stale/incompatible links.
  for (const assignment of existing) {
    const role = await manager
      .getRepository(RoleEntity)
      .findOneByOrFail({ id: assignment.roleId });
    if (!roleIds.includes(Number(role.id)))
      scope.assertCanRevokeRole(actor, user.organizationId, role);
  }
  await assertAdministratorSurvives(manager, user, roleIds);
  const now = new Date();
  for (const assignment of existing) {
    if (!roleIds.includes(Number(assignment.roleId)))
      await repo.update(assignment.id, { isActive: false, revokedAt: now });
  }
  for (const roleId of roleIds) {
    if (!existing.some((assignment) => Number(assignment.roleId) === roleId))
      await repo.save(
        repo.create({
          userId,
          roleId,
          assignedBy: actor.id,
          assignedAt: now,
          revokedAt: null,
          isActive: true,
        }),
      );
  }
}
