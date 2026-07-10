import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { UserStatus } from '../../domain/enums/user.enums';
import { UserEntity } from './user.entity';
import { OrganizationStatus } from '../../../organizations/domain/enums/organization-status.enum';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { PermissionScope } from '../../../users/domain/enums/permission-scope.enum';
import { isRoleCompatibleWithUserOrganization } from '../../../users/domain/services/role-assignment-scope';
import { RolePermissionEntity } from '../../../users/infrastructure/persistence/role-permission.entity';
import { PermissionEntity } from '../../../users/infrastructure/persistence/permission.entity';
import { RoleEntity } from '../../../users/infrastructure/persistence/role.entity';
import { UserRoleAssignmentEntity } from '../../../users/infrastructure/persistence/user-role-assignment.entity';
import {
  PermissionResolver,
  ResolvedPermission,
} from '../../domain/ports/permission-resolver.port';

@Injectable()
export class TypeOrmPermissionResolver implements PermissionResolver {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permRepo: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermRepo: Repository<RolePermissionEntity>,
    @InjectRepository(UserRoleAssignmentEntity)
    private readonly assignmentRepo: Repository<UserRoleAssignmentEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepo: Repository<OrganizationEntity>,
  ) {}

  async resolveForUser(userId: number): Promise<ResolvedPermission[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId, status: UserStatus.ACTIVE },
    });
    if (!user) {
      return [];
    }

    if (user.organizationId !== null) {
      const organizationIsActive = await this.organizationRepo.exist({
        where: {
          id: user.organizationId,
          status: OrganizationStatus.ACTIVE,
        },
      });
      if (!organizationIsActive) {
        return [];
      }
    }

    const assignments = await this.assignmentRepo.find({
      where: { userId, isActive: true, revokedAt: IsNull() },
    });
    if (assignments.length === 0) {
      return [];
    }

    const roleIds = [...new Set(assignments.map((item) => item.roleId))];
    const roles = await this.roleRepo.find({
      where: { id: In(roleIds), isActive: true },
    });
    const eligibleRoleIds = roles
      .filter((role) =>
        isRoleCompatibleWithUserOrganization(
          {
            type: role.type,
            key: role.key,
            organizationId: role.organizationId,
          },
          user.organizationId,
        ),
      )
      .map((role) => Number(role.id));
    if (eligibleRoleIds.length === 0) {
      return [];
    }

    const links = await this.rolePermRepo.find({
      where: { roleId: In(eligibleRoleIds) },
    });
    if (links.length === 0) {
      return [];
    }

    const permissionIds = [...new Set(links.map((link) => link.permissionId))];
    const entities = await this.permRepo.find({
      where: { id: In(permissionIds) },
    });
    const allowedScope =
      user.organizationId === null
        ? PermissionScope.PLATFORM
        : PermissionScope.ORGANIZATION;

    const seen = new Set<string>();
    const resolved: ResolvedPermission[] = [];
    for (const entity of entities) {
      if (entity.scope !== allowedScope || seen.has(entity.key)) {
        continue;
      }
      seen.add(entity.key);
      resolved.push({ key: entity.key, scope: entity.scope });
    }

    return resolved;
  }

  async findScopesByKeys(
    keys: string[],
  ): Promise<Map<string, PermissionScope>> {
    if (keys.length === 0) {
      return new Map();
    }

    const entities = await this.permRepo.find({ where: { key: In(keys) } });
    return new Map(entities.map((entity) => [entity.key, entity.scope]));
  }
}
