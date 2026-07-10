import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { OrgRole } from '../../domain/entities/org-role';
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
import { CreateOrgRoleDto } from '../dto/create-org-role.dto';
import { OrgRoleResponseDto } from '../dto/org-role-response.dto';
import { ActorContext, UserScopeService } from '../services/user-scope.service';

@Injectable()
export class CreateOrgRoleUseCase {
  constructor(
    @Inject(ORG_ROLE_REPOSITORY)
    private readonly repository: OrgRoleRepository,
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissions: PermissionRepository,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepo: Repository<OrganizationEntity>,
    private readonly scope: UserScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateOrgRoleUseCase.name);
  }

  async execute(
    organizationId: number,
    dto: CreateOrgRoleDto,
    actor: ActorContext,
  ): Promise<OrgRoleResponseDto> {
    await this.assertOrganizationExists(organizationId);
    this.scope.assertCanAccessOrganization(actor, organizationId);

    const existing = await this.repository.findByNameInOrganization(
      organizationId,
      dto.name.trim(),
    );
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Org role name already exists in this organization',
      });
    }

    const permissionRecords = await this.permissions.findByIds(
      dto.permission_ids,
    );
    this.assertValidPermissions(permissionRecords, dto.permission_ids);

    const now = new Date();
    const role = new OrgRole({
      id: 0,
      organizationId,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      isActive: true,
      permissions: permissionRecords.map((permission) => ({
        id: permission.id,
        key: permission.key,
        resource: permission.resource,
        action: permission.action,
        scope: permission.scope,
        description: permission.description,
      })),
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.repository.saveWithAudit(
      role,
      dto.permission_ids,
      {
        orgRoleId: 0,
        operation: OrgRoleAuditOperation.CREATE,
        performedBy: actor.id,
        changes: {
          name: { before: null, after: role.name },
          permission_ids: { before: null, after: dto.permission_ids },
        },
      },
    );

    this.logger.info({
      operation: 'CREATE_ORG_ROLE',
      orgRoleId: saved.id,
      organizationId,
      result: 'SUCCESS',
    });

    return OrgRoleResponseDto.fromDomain(saved);
  }

  private async assertOrganizationExists(
    organizationId: number,
  ): Promise<void> {
    const exists = await this.organizationRepo.exist({
      where: { id: organizationId },
    });
    if (!exists) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Organization not found',
      });
    }
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
