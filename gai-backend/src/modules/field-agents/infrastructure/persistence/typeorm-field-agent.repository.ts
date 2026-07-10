import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { FieldAgent } from '../../domain/entities/field-agent';
import { ProjectFieldAgent } from '../../domain/entities/project-field-agent';
import { ProjectFieldAgentStatus } from '../../domain/enums/project-field-agent-status.enum';
import {
  FieldAgentAuditEntry,
  FieldAgentRepository,
  ListFieldAgentsParams,
  ListProjectFieldAgentsParams,
} from '../../domain/ports/field-agent.repository.port';
import { FieldAgentAuditLogEntity } from './field-agent-audit-log.entity';
import { FieldAgentEntity } from './field-agent.entity';
import { ProjectFieldAgentEntity } from './project-field-agent.entity';

@Injectable()
export class TypeOrmFieldAgentRepository implements FieldAgentRepository {
  constructor(
    @InjectRepository(FieldAgentEntity)
    private readonly fieldAgentRepo: Repository<FieldAgentEntity>,
    @InjectRepository(ProjectFieldAgentEntity)
    private readonly assignmentRepo: Repository<ProjectFieldAgentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findById(id: number): Promise<FieldAgent | null> {
    const entity = await this.fieldAgentRepo.findOne({ where: { id } });
    return entity ? this.toFieldAgentDomain(entity) : null;
  }

  async findAssignmentById(id: number): Promise<ProjectFieldAgent | null> {
    const entity = await this.assignmentRepo.findOne({ where: { id } });
    return entity ? this.toAssignmentDomain(entity) : null;
  }

  async findUserOrganizationId(
    userId: number,
  ): Promise<number | null | undefined> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return user ? user.organizationId : undefined;
  }

  async hasActiveAssignment(
    projectId: number,
    fieldAgentId: number,
  ): Promise<boolean> {
    const count = await this.assignmentRepo.count({
      where: {
        projectId,
        fieldAgentId,
        status: ProjectFieldAgentStatus.ACTIVE,
      },
    });
    return count > 0;
  }

  async list(
    params: ListFieldAgentsParams,
  ): Promise<{ items: FieldAgent[]; total: number }> {
    const qb = this.fieldAgentRepo.createQueryBuilder('fieldAgent');

    if (params.organizationId) {
      qb.andWhere('fieldAgent.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }
    if (params.status) {
      qb.andWhere('fieldAgent.status = :status', { status: params.status });
    }
    if (params.search) {
      qb.andWhere(
        '(LOWER(fieldAgent.name) LIKE :term OR LOWER(fieldAgent.email) LIKE :term OR LOWER(fieldAgent.document) LIKE :term)',
        { term: `%${params.search.toLowerCase()}%` },
      );
    }

    qb.orderBy('fieldAgent.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return {
      items: entities.map((entity) => this.toFieldAgentDomain(entity)),
      total,
    };
  }

  async listAssignments(
    params: ListProjectFieldAgentsParams,
  ): Promise<{ items: ProjectFieldAgent[]; total: number }> {
    const qb = this.assignmentRepo.createQueryBuilder('assignment');
    qb.andWhere('assignment.projectId = :projectId', {
      projectId: params.projectId,
    });
    if (params.status) {
      qb.andWhere('assignment.status = :status', { status: params.status });
    }
    qb.orderBy('assignment.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return {
      items: entities.map((entity) => this.toAssignmentDomain(entity)),
      total,
    };
  }

  async saveFieldAgentWithAudit(
    fieldAgent: FieldAgent,
    audit: FieldAgentAuditEntry,
  ): Promise<FieldAgent> {
    return this.fieldAgentRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(FieldAgentEntity);
      const auditRepo = manager.getRepository(FieldAgentAuditLogEntity);
      const saved = await repo.save(this.toFieldAgentEntity(fieldAgent));

      await auditRepo.save({
        organizationId: audit.organizationId,
        fieldAgentId: audit.fieldAgentId || saved.id,
        projectFieldAgentId: audit.projectFieldAgentId ?? null,
        projectId: audit.projectId ?? null,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toFieldAgentDomain(saved);
    });
  }

  async saveAssignmentWithAudit(
    assignment: ProjectFieldAgent,
    audit: FieldAgentAuditEntry,
  ): Promise<ProjectFieldAgent> {
    return this.assignmentRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(ProjectFieldAgentEntity);
      const auditRepo = manager.getRepository(FieldAgentAuditLogEntity);
      const saved = await repo.save(this.toAssignmentEntity(assignment));

      await auditRepo.save({
        organizationId: audit.organizationId,
        fieldAgentId: audit.fieldAgentId,
        projectFieldAgentId: audit.projectFieldAgentId || saved.id,
        projectId: audit.projectId ?? saved.projectId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toAssignmentDomain(saved);
    });
  }

  private toFieldAgentEntity(fieldAgent: FieldAgent): FieldAgentEntity {
    const props = fieldAgent.toProps();
    const entity = this.fieldAgentRepo.create({
      organizationId: props.organizationId,
      userId: props.userId,
      name: props.name,
      email: props.email,
      phone: props.phone,
      document: props.document,
      status: props.status,
      metadata: props.metadata,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      deletedAt: props.deletedAt,
    });
    if (props.id > 0) {
      entity.id = props.id;
    }
    return entity;
  }

  private toAssignmentEntity(
    assignment: ProjectFieldAgent,
  ): ProjectFieldAgentEntity {
    const props = assignment.toProps();
    const entity = this.assignmentRepo.create({
      organizationId: props.organizationId,
      projectId: props.projectId,
      fieldAgentId: props.fieldAgentId,
      role: props.role,
      status: props.status,
      startDate: props.startDate,
      endDate: props.endDate,
      notes: props.notes,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
    if (props.id > 0) {
      entity.id = props.id;
    }
    return entity;
  }

  private toFieldAgentDomain(entity: FieldAgentEntity): FieldAgent {
    return new FieldAgent({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      userId: entity.userId === null ? null : Number(entity.userId),
      name: entity.name,
      email: entity.email,
      phone: entity.phone,
      document: entity.document,
      status: entity.status,
      metadata: entity.metadata,
      createdAt: this.toDate(entity.createdAt),
      updatedAt: this.toDate(entity.updatedAt),
      deletedAt: this.toNullableDate(entity.deletedAt),
    });
  }

  private toAssignmentDomain(
    entity: ProjectFieldAgentEntity,
  ): ProjectFieldAgent {
    return new ProjectFieldAgent({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      projectId: Number(entity.projectId),
      fieldAgentId: Number(entity.fieldAgentId),
      role: entity.role,
      status: entity.status,
      startDate: this.toNullableDate(entity.startDate),
      endDate: this.toNullableDate(entity.endDate),
      notes: entity.notes,
      createdAt: this.toDate(entity.createdAt),
      updatedAt: this.toDate(entity.updatedAt),
    });
  }

  private toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private toNullableDate(value: Date | string | null): Date | null {
    return value === null ? null : this.toDate(value);
  }
}
