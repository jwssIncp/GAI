import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, UserStatus } from '../../../auth/domain/enums/user.enums';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { RoleType } from '../../domain/enums/role-type.enum';
import { ManagedUser } from '../../domain/entities/managed-user';
import {
  ListUsersParams,
  UserAuditEntry,
  UserManagementRepository,
} from '../../domain/ports/user-management.repository.port';
import { RoleEntity } from './role.entity';
import { UserAuditLogEntity } from './user-audit-log.entity';
import { UserRoleAssignmentEntity } from './user-role-assignment.entity';

@Injectable()
export class TypeOrmUserManagementRepository implements UserManagementRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserAuditLogEntity)
    private readonly auditRepo: Repository<UserAuditLogEntity>,
  ) {}

  async findById(id: number): Promise<ManagedUser | null> {
    const entity = await this.userRepo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByLogin(login: string): Promise<ManagedUser | null> {
    const entity = await this.userRepo.findOne({ where: { login } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<ManagedUser | null> {
    const entity = await this.userRepo.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : null;
  }

  async list(params: ListUsersParams): Promise<{
    items: ManagedUser[];
    total: number;
  }> {
    const qb = this.userRepo.createQueryBuilder('user');

    if (params.organizationId !== undefined) {
      qb.andWhere('user.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }

    if (params.status) {
      qb.andWhere('user.status = :status', { status: params.status });
    }

    if (params.role) {
      qb.innerJoin(
        UserRoleAssignmentEntity,
        'assignment',
        'assignment.user_id = user.id AND assignment.is_active = 1',
      ).innerJoin(
        RoleEntity,
        'role',
        'role.id = assignment.role_id AND role.type = :systemType AND role.key = :roleKey',
        { systemType: RoleType.SYSTEM, roleKey: params.role },
      );
    }

    if (params.search) {
      const term = `%${params.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(user.login) LIKE :term OR LOWER(user.email) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('user.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return {
      items: entities.map((entity) => this.toDomain(entity)),
      total,
    };
  }

  async countActivePlatformAdmins(excludeUserId?: number): Promise<number> {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .innerJoin(
        UserRoleAssignmentEntity,
        'assignment',
        'assignment.user_id = user.id AND assignment.is_active = 1',
      )
      .innerJoin(
        RoleEntity,
        'role',
        'role.id = assignment.role_id AND role.key = :roleKey AND role.type = :type',
        { roleKey: UserRole.PLATFORM_ADMIN, type: RoleType.SYSTEM },
      )
      .where('user.status = :status', { status: UserStatus.ACTIVE });

    if (excludeUserId !== undefined) {
      qb.andWhere('user.id != :excludeUserId', { excludeUserId });
    }

    return qb.getCount();
  }

  async saveWithAudit(
    user: ManagedUser,
    audit: UserAuditEntry,
  ): Promise<ManagedUser> {
    return this.userRepo.manager.transaction(async (manager) => {
      const userRepository = manager.getRepository(UserEntity);
      const auditRepository = manager.getRepository(UserAuditLogEntity);

      const props = user.toProps();
      let entity: UserEntity;

      if (props.id > 0) {
        const existing = await userRepository.findOne({
          where: { id: props.id },
        });
        if (!existing) {
          throw new Error(`User ${props.id} not found`);
        }
        entity = userRepository.merge(existing, {
          organizationId: props.organizationId,
          login: props.login,
          email: props.email,
          passwordHash: props.passwordHash,
          status: props.status,
          updatedAt: props.updatedAt,
        });
      } else {
        entity = userRepository.create({
          organizationId: props.organizationId,
          login: props.login,
          email: props.email,
          passwordHash: props.passwordHash,
          status: props.status,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          createdAt: props.createdAt,
          updatedAt: props.updatedAt,
        });
      }

      const saved = await userRepository.save(entity);

      await auditRepository.save({
        userId: audit.userId || saved.id,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toDomain(saved);
    });
  }

  private toDomain(entity: UserEntity): ManagedUser {
    return new ManagedUser({
      id: Number(entity.id),
      organizationId: entity.organizationId,
      login: entity.login,
      email: entity.email,
      passwordHash: entity.passwordHash,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
