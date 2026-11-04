import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { OrganizationStatus } from '../../../organizations/domain/enums/organization-status.enum';
import { RoleType } from '../../domain/enums/role-type.enum';
import { PermissionScope } from '../../domain/enums/permission-scope.enum';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type UserRoleAssignmentRepository,
} from '../../domain/ports/user-role-assignment.repository.port';
import { RoleEntity } from '../../infrastructure/persistence/role.entity';
import { PermissionEntity } from '../../infrastructure/persistence/permission.entity';
import { RolePermissionEntity } from '../../infrastructure/persistence/role-permission.entity';
import { UserRoleAssignmentEntity } from '../../infrastructure/persistence/user-role-assignment.entity';
import { RoleAssignmentResponseDto } from '../dto/user-response.dto';
import { ActorContext, UserScopeService } from './user-scope.service';

@Injectable()
export class AccessProfilesService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: UserScopeService,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
  ) {}

  async list(actor: ActorContext, requestedOrganizationId?: number) {
    const organizationId = this.scope.assertCanFilterByOrganization(
      actor,
      requestedOrganizationId,
    );
    if (organizationId !== undefined) {
      const organization = await this.db
        .getRepository(OrganizationEntity)
        .findOneBy({ id: organizationId, status: OrganizationStatus.ACTIVE });
      if (!organization)
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Active organization not found',
        });
    }
    const roles = await this.db.getRepository(RoleEntity).find({
      where:
        organizationId === undefined
          ? {
              type: RoleType.SYSTEM,
              key: UserRole.PLATFORM_ADMIN,
              organizationId: IsNull(),
              isActive: true,
            }
          : [
              {
                type: RoleType.SYSTEM,
                key: In([UserRole.ORG_ADMIN, UserRole.ORG_USER]),
                organizationId: IsNull(),
                isActive: true,
              },
              { type: RoleType.ORGANIZATION, organizationId, isActive: true },
            ],
      order: { type: 'DESC', name: 'ASC' },
    });
    const organizationalPermissions = await this.db
      .getRepository(PermissionEntity)
      .findBy({ scope: PermissionScope.ORGANIZATION });
    const result = await Promise.all(
      roles.map(async (role) => {
        const links = await this.db
          .getRepository(RolePermissionEntity)
          .findBy({ roleId: role.id });
        const permissions =
          role.key === UserRole.ORG_ADMIN
            ? organizationalPermissions
            : role.key === UserRole.PLATFORM_ADMIN
              ? await this.db.getRepository(PermissionEntity).find()
              : organizationalPermissions.filter((permission) =>
                  links.some(
                    (link) =>
                      Number(link.permissionId) === Number(permission.id),
                  ),
                );
        const count = await this.db
          .getRepository(UserRoleAssignmentEntity)
          .createQueryBuilder('assignment')
          .innerJoin(UserEntity, 'user', 'user.id = assignment.user_id')
          .select('COUNT(DISTINCT user.id)', 'total')
          .where(
            'assignment.role_id = :roleId AND assignment.is_active = 1 AND assignment.revoked_at IS NULL',
            { roleId: role.id },
          )
          .andWhere(
            organizationId === undefined
              ? 'user.organization_id IS NULL'
              : 'user.organization_id = :organizationId',
            { organizationId },
          )
          .getRawOne<{ total: string }>();
        return {
          id: Number(role.id),
          key: role.key,
          type: role.type,
          organization_id: organizationId ?? null,
          name:
            role.key === UserRole.ORG_ADMIN
              ? 'Administrador da organização'
              : role.key === UserRole.ORG_USER
                ? 'Usuário da organização'
                : role.key === UserRole.PLATFORM_ADMIN
                  ? 'Administrador da plataforma'
                  : role.name,
          description:
            role.key === UserRole.ORG_ADMIN
              ? 'Possui acesso administrativo aos recursos e configurações da organização, incluindo gerenciamento de usuários e perfis.'
              : role.key === UserRole.ORG_USER
                ? 'Perfil básico de acesso à organização, com funcionalidades definidas pelas permissões efetivamente associadas.'
                : role.description,
          user_count: Number(count?.total ?? 0),
          permission_count: permissions.length,
          access_areas: [
            ...new Set(permissions.map((permission) => permission.resource)),
          ],
          administrative:
            role.type === RoleType.SYSTEM &&
            [UserRole.ORG_ADMIN, UserRole.PLATFORM_ADMIN].includes(
              role.key as UserRole,
            ),
          editable: role.type === RoleType.ORGANIZATION,
        };
      }),
    );
    return result;
  }

  async replace(userId: number, roleIds: number[], actor: ActorContext) {
    this.scope.assertCanAssignRoles(actor);
    const user = await this.db
      .getRepository(UserEntity)
      .findOneBy({ id: userId });
    if (!user)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    this.scope.assertPlatformOnlyAssignment(actor, user.organizationId);
    this.scope.assertCanFilterByOrganization(
      actor,
      user.organizationId ?? undefined,
    );
    await this.assignments.replace(userId, roleIds, actor);
    return (await this.assignments.findActiveByUserId(userId)).map(
      (assignment) => RoleAssignmentResponseDto.fromAssignedRole(assignment),
    );
  }
}
