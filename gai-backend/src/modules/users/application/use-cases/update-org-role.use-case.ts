import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { OrgRoleAuditOperation } from '../../domain/enums/org-role-audit-operation.enum';
import { PermissionScope } from '../../domain/enums/permission-scope.enum';
import {
  ORG_ROLE_REPOSITORY,
  type OrgRoleRepository,
} from '../../domain/ports/org-role.repository.port';
import {
  PERMISSION_REPOSITORY,
  type PermissionRepository,
} from '../../domain/ports/permission.repository.port';
import { OrgRoleResponseDto } from '../dto/org-role-response.dto';
import { UpdateOrgRoleDto } from '../dto/update-org-role.dto';
import { ActorContext, UserScopeService } from '../services/user-scope.service';

@Injectable()
export class UpdateOrgRoleUseCase {
  constructor(
    @Inject(ORG_ROLE_REPOSITORY)
    private readonly repository: OrgRoleRepository,
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissions: PermissionRepository,
    private readonly scope: UserScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateOrgRoleUseCase.name);
  }

  async execute(
    organizationId: number,
    roleId: number,
    dto: UpdateOrgRoleDto,
    actor: ActorContext,
  ): Promise<OrgRoleResponseDto> {
    this.scope.assertCanAccessOrganization(actor, organizationId);

    const role = await this.repository.findByIdAndOrganization(
      roleId,
      organizationId,
    );
    if (!role) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Org role not found',
      });
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    let permissionIds = role.permissions.map((permission) => permission.id);

    if (dto.name !== undefined && dto.name.trim() !== role.name) {
      const existing = await this.repository.findByNameInOrganization(
        organizationId,
        dto.name.trim(),
      );
      if (existing && existing.id !== role.id) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Org role name already exists in this organization',
        });
      }
      changes.name = { before: role.name, after: dto.name.trim() };
    }

    if (dto.description !== undefined) {
      changes.description = {
        before: role.description,
        after: dto.description,
      };
    }

    if (dto.is_active !== undefined) {
      changes.is_active = { before: role.isActive, after: dto.is_active };
    }

    if (dto.permission_ids !== undefined) {
      const permissionRecords = await this.permissions.findByIds(
        dto.permission_ids,
      );
      this.assertValidPermissions(permissionRecords, dto.permission_ids);
      permissionIds = dto.permission_ids;
      changes.permission_ids = {
        before: role.permissions.map((permission) => permission.id),
        after: dto.permission_ids,
      };
      role.update({
        permissions: permissionRecords.map((permission) => ({
          id: permission.id,
          key: permission.key,
          resource: permission.resource,
          action: permission.action,
          scope: permission.scope,
          description: permission.description,
        })),
      });
    }

    role.update({
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() || null }
        : {}),
      ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
    });

    if (Object.keys(changes).length === 0) {
      return OrgRoleResponseDto.fromDomain(role);
    }

    const saved = await this.repository.saveWithAudit(role, permissionIds, {
      orgRoleId: role.id,
      operation: OrgRoleAuditOperation.UPDATE,
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: 'UPDATE_ORG_ROLE',
      orgRoleId: saved.id,
      organizationId,
      result: 'SUCCESS',
    });

    return OrgRoleResponseDto.fromDomain(saved);
  }

  private assertValidPermissions(
    found: Awaited<ReturnType<PermissionRepository['findByIds']>>,
    requestedIds: number[],
  ): void {
    if (found.length !== requestedIds.length) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'One or more permissions not found',
      });
    }

    const invalid = found.some(
      (permission) => permission.scope !== PermissionScope.ORGANIZATION,
    );
    if (invalid) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Org roles can only include ORGANIZATION-scoped permissions',
      });
    }
  }
}
