import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrgRole, type PermissionRef } from '../../domain/entities/org-role';
import { RoleType } from '../../domain/enums/role-type.enum';
import {
  OrgRoleAuditEntry,
  OrgRoleRepository,
} from '../../domain/ports/org-role.repository.port';
import { RoleAuditLogEntity } from './role-audit-log.entity';
import { RolePermissionEntity } from './role-permission.entity';
import { RoleEntity } from './role.entity';
import { PermissionEntity } from './permission.entity';
import { UserRoleAssignmentEntity } from './user-role-assignment.entity';

@Injectable()
export class TypeOrmOrgRoleRepository implements OrgRoleRepository {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermRepo: Repository<RolePermissionEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permRepo: Repository<PermissionEntity>,
    @InjectRepository(RoleAuditLogEntity)
    private readonly auditRepo: Repository<RoleAuditLogEntity>,
    @InjectRepository(UserRoleAssignmentEntity)
    private readonly assignmentRepo: Repository<UserRoleAssignmentEntity>,
  ) {}

  async findById(id: number): Promise<OrgRole | null> {
    const entity = await this.roleRepo.findOne({
      where: { id, type: RoleType.ORGANIZATION },
    });
    if (!entity) {
      return null;
    }
    const permissions = await this.loadPermissions(id);
    return this.toDomain(entity, permissions);
  }

  async findByIdAndOrganization(
    id: number,
    organizationId: number,
  ): Promise<OrgRole | null> {
    const entity = await this.roleRepo.findOne({
      where: { id, organizationId, type: RoleType.ORGANIZATION },
    });
    if (!entity) {
      return null;
    }
    const permissions = await this.loadPermissions(id);
    return this.toDomain(entity, permissions);
  }

  async findByNameInOrganization(
    organizationId: number,
    name: string,
  ): Promise<OrgRole | null> {
    const entity = await this.roleRepo.findOne({
      where: { organizationId, name, type: RoleType.ORGANIZATION },
    });
    if (!entity) {
      return null;
    }
    const permissions = await this.loadPermissions(entity.id);
    return this.toDomain(entity, permissions);
  }

  async listByOrganization(
    organizationId: number,
    includeInactive: boolean,
  ): Promise<OrgRole[]> {
    const qb = this.roleRepo
      .createQueryBuilder('role')
      .where('role.organizationId = :organizationId', { organizationId })
      .andWhere('role.type = :type', { type: RoleType.ORGANIZATION })
      .orderBy('role.name', 'ASC');

    if (!includeInactive) {
      qb.andWhere('role.isActive = :isActive', { isActive: true });
    }

    const entities = await qb.getMany();
    return Promise.all(
      entities.map(async (entity) => {
        const permissions = await this.loadPermissions(entity.id);
        return this.toDomain(entity, permissions);
      }),
    );
  }

  async countActiveUsersWithRole(orgRoleId: number): Promise<number> {
    return this.assignmentRepo.count({
      where: { roleId: orgRoleId, isActive: true },
    });
  }

  async saveWithAudit(
    role: OrgRole,
    permissionIds: number[],
    audit: OrgRoleAuditEntry,
  ): Promise<OrgRole> {
    return this.roleRepo.manager.transaction(async (manager) => {
      const roleRepository = manager.getRepository(RoleEntity);
      const rolePermRepository = manager.getRepository(RolePermissionEntity);
      const auditRepository = manager.getRepository(RoleAuditLogEntity);
      const permRepository = manager.getRepository(PermissionEntity);

      const props = role.toProps();
      let entity: RoleEntity;

      if (props.id > 0) {
        const existing = await roleRepository.findOne({
          where: { id: props.id, type: RoleType.ORGANIZATION },
        });
        if (!existing) {
          throw new Error(`Role ${props.id} not found`);
        }
        entity = roleRepository.merge(existing, {
          organizationId: props.organizationId,
          name: props.name,
          description: props.description,
          isActive: props.isActive,
          updatedAt: props.updatedAt,
        });
      } else {
        entity = roleRepository.create({
          key: null,
          type: RoleType.ORGANIZATION,
          organizationId: props.organizationId,
          name: props.name,
          description: props.description,
          isActive: props.isActive,
          createdAt: props.createdAt,
          updatedAt: props.updatedAt,
        });
      }

      const saved = await roleRepository.save(entity);

      await rolePermRepository.delete({ roleId: saved.id });
      if (permissionIds.length > 0) {
        await rolePermRepository.save(
          permissionIds.map((permissionId) => ({
            roleId: saved.id,
            permissionId,
          })),
        );
      }

      await auditRepository.save({
        roleId: audit.orgRoleId || saved.id,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      const permissions = await this.loadPermissionsWithRepo(
        permRepository,
        rolePermRepository,
        saved.id,
      );

      return this.toDomain(saved, permissions);
    });
  }

  private async loadPermissions(roleId: number): Promise<PermissionRef[]> {
    return this.loadPermissionsWithRepo(
      this.permRepo,
      this.rolePermRepo,
      roleId,
    );
  }

  private async loadPermissionsWithRepo(
    permRepo: Repository<PermissionEntity>,
    rolePermRepo: Repository<RolePermissionEntity>,
    roleId: number,
  ): Promise<PermissionRef[]> {
    const links = await rolePermRepo.find({ where: { roleId } });
    if (links.length === 0) {
      return [];
    }

    const permissionIds = links.map((link) => link.permissionId);
    const entities = await permRepo.find({ where: { id: In(permissionIds) } });
    return entities.map((entity) => this.toPermissionRef(entity));
  }

  private toDomain(entity: RoleEntity, permissions: PermissionRef[]): OrgRole {
    return new OrgRole({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      name: entity.name,
      description: entity.description,
      isActive: Boolean(entity.isActive),
      permissions,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private toPermissionRef(entity: PermissionEntity): PermissionRef {
    return {
      id: Number(entity.id),
      key: entity.key,
      resource: entity.resource,
      action: entity.action,
      scope: entity.scope,
      description: entity.description,
    };
  }
}
