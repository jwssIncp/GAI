import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../domain/entities/project';
import {
  ListProjectsParams,
  ProjectAuditEntry,
  ProjectRepository,
} from '../../domain/ports/project.repository.port';
import { ProjectAuditLogEntity } from './project-audit-log.entity';
import { ProjectEntity } from './project.entity';

@Injectable()
export class TypeOrmProjectRepository implements ProjectRepository {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
  ) {}

  async findById(id: number): Promise<Project | null> {
    const entity = await this.projectRepo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async list(
    params: ListProjectsParams,
  ): Promise<{ items: Project[]; total: number }> {
    const qb = this.projectRepo.createQueryBuilder('project');

    if (params.organizationId) {
      qb.andWhere('project.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }
    if (params.status) {
      qb.andWhere('project.status = :status', { status: params.status });
    }
    if (params.companyId) {
      qb.andWhere('project.companyId = :companyId', {
        companyId: params.companyId,
      });
    }
    if (params.search) {
      qb.andWhere(
        '(LOWER(project.name) LIKE :term OR LOWER(project.description) LIKE :term)',
        { term: `%${params.search.toLowerCase()}%` },
      );
    }

    qb.orderBy('project.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((entity) => this.toDomain(entity)), total };
  }

  async saveWithAudit(
    project: Project,
    audit: ProjectAuditEntry,
  ): Promise<Project> {
    return this.projectRepo.manager.transaction(async (manager) => {
      const projectRepository = manager.getRepository(ProjectEntity);
      const auditRepository = manager.getRepository(ProjectAuditLogEntity);

      const saved = await projectRepository.save(this.toEntity(project));
      await auditRepository.save({
        projectId: audit.projectId || saved.id,
        organizationId: audit.organizationId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toDomain(saved);
    });
  }

  private toEntity(project: Project): ProjectEntity {
    const props = project.toProps();
    const entity = this.projectRepo.create({
      organizationId: props.organizationId,
      companyId: props.companyId,
      name: props.name,
      description: props.description,
      status: props.status,
      startDate: props.startDate,
      endDate: props.endDate,
      finishedAt: props.finishedAt,
      settings: props.settings,
      metadata: props.metadata,
      createdById: props.createdById,
      updatedById: props.updatedById,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      deletedAt: props.deletedAt,
    });
    if (props.id > 0) {
      entity.id = props.id;
    }
    return entity;
  }

  private toDomain(entity: ProjectEntity): Project {
    return new Project({
      id: Number(entity.id),
      organizationId: Number(entity.organizationId),
      companyId: entity.companyId === null ? null : Number(entity.companyId),
      name: entity.name,
      description: entity.description,
      status: entity.status,
      startDate: this.toNullableDate(entity.startDate),
      endDate: this.toNullableDate(entity.endDate),
      finishedAt: this.toNullableDate(entity.finishedAt),
      settings: entity.settings,
      metadata: entity.metadata,
      createdById:
        entity.createdById === null ? null : Number(entity.createdById),
      updatedById:
        entity.updatedById === null ? null : Number(entity.updatedById),
      createdAt: this.toDate(entity.createdAt),
      updatedAt: this.toDate(entity.updatedAt),
      deletedAt: this.toNullableDate(entity.deletedAt),
    });
  }

  private toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private toNullableDate(value: Date | string | null): Date | null {
    return value === null ? null : this.toDate(value);
  }
}
