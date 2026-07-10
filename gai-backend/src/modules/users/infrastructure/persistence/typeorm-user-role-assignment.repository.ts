import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
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
    const existing = await this.assignmentRepo.findOne({
      where: {
        userId: input.userId,
        roleId: input.roleId,
        isActive: true,
        revokedAt: IsNull(),
      },
    });
    if (existing) {
      const role = await this.roleRepo.findOneOrFail({
        where: { id: input.roleId },
      });
      return this.toAssignedRole(existing, role);
    }

    const now = new Date();
    const saved = await this.assignmentRepo.save(
      this.assignmentRepo.create({
        userId: input.userId,
        roleId: input.roleId,
        isActive: true,
        assignedBy: input.assignedBy,
        assignedAt: now,
        revokedAt: null,
      }),
    );
    const role = await this.roleRepo.findOneOrFail({
      where: { id: input.roleId },
    });
    return this.toAssignedRole(saved, role);
  }

  async revoke(assignmentId: number, revokedAt: Date): Promise<void> {
    await this.assignmentRepo.update(
      { id: assignmentId },
      { isActive: false, revokedAt },
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
