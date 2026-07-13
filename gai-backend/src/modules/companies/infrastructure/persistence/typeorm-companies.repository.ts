import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { ProjectStatus } from '../../../projects/domain/enums/project-status.enum';
import { ProjectStatusTransitionPolicy } from '../../../projects/domain/services/project-status-transition.policy';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { JsonRecord } from '../../domain/entities/company';
import { CompanyAuditOperation } from '../../domain/enums/company-audit-operation.enum';
import { CompanyStatus } from '../../domain/enums/company-status.enum';
import { CompanyUnitStatus } from '../../domain/enums/company-unit-status.enum';
import { CompanyAuditLogEntity } from './company-audit-log.entity';
import { CompanyUnitAuditLogEntity } from './company-unit-audit-log.entity';
import { CompanyUnitEntity } from './company-unit.entity';
import { CompanyEntity } from './company.entity';
import { ProjectUnitAuditLogEntity } from './project-unit-audit-log.entity';
import { ProjectUnitEntity } from './project-unit.entity';

export interface CompanyListParams {
  page: number;
  pageSize: number;
  organizationId?: number;
  status?: CompanyStatus;
  document?: string;
  city?: string;
  state?: string;
  search?: string;
}

export interface CompanyUnitListParams {
  page: number;
  pageSize: number;
  companyId: number;
  organizationId: number;
  status?: CompanyUnitStatus;
  city?: string;
  state?: string;
  search?: string;
}

export interface ProjectUnitWithCompanyUnit {
  projectUnit: ProjectUnitEntity;
  companyUnit: CompanyUnitEntity;
}

export type AssignProjectUnitResult =
  | {
      kind: 'success';
      projectUnit: ProjectUnitEntity;
      companyUnit: CompanyUnitEntity;
    }
  | { kind: 'project_not_found' }
  | { kind: 'project_has_no_company' }
  | { kind: 'project_status_blocks'; currentStatus: ProjectStatus }
  | { kind: 'unit_not_found' }
  | { kind: 'unit_scope_mismatch' }
  | { kind: 'unit_inactive' }
  | { kind: 'already_assigned' };

export type RemoveProjectUnitResult =
  | {
      kind: 'success';
      projectUnit: ProjectUnitEntity;
      companyUnit: CompanyUnitEntity;
    }
  | { kind: 'project_not_found' }
  | { kind: 'project_status_blocks'; currentStatus: ProjectStatus }
  | { kind: 'assignment_not_found' }
  | { kind: 'already_removed' }
  | { kind: 'unit_not_found' }
  | { kind: 'unit_scope_mismatch' };

@Injectable()
export class TypeOrmCompaniesRepository {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companies: Repository<CompanyEntity>,
    @InjectRepository(CompanyUnitEntity)
    private readonly units: Repository<CompanyUnitEntity>,
    @InjectRepository(ProjectUnitEntity)
    private readonly projectUnits: Repository<ProjectUnitEntity>,
  ) {}

  findCompanyById(id: number): Promise<CompanyEntity | null> {
    return this.companies
      .createQueryBuilder('company')
      .withDeleted()
      .where('company.id = :id', { id })
      .getOne();
  }

  findCompanyByDocument(
    organizationId: number,
    document: string,
    excludeId?: number,
  ): Promise<CompanyEntity | null> {
    const qb = this.companies
      .createQueryBuilder('company')
      .withDeleted()
      .where('company.organizationId = :organizationId', { organizationId })
      .andWhere('company.document = :document', { document });

    if (excludeId !== undefined) {
      qb.andWhere('company.id <> :excludeId', { excludeId });
    }

    return qb.getOne();
  }

  async listCompanies(
    params: CompanyListParams,
  ): Promise<{ items: CompanyEntity[]; total: number }> {
    const qb = this.companies.createQueryBuilder('company').withDeleted();
    if (params.organizationId) {
      qb.andWhere('company.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }
    if (params.status) {
      qb.andWhere('company.status = :status', { status: params.status });
    }
    if (params.document) {
      qb.andWhere('company.document = :document', {
        document: this.normalizeDigits(params.document),
      });
    }
    if (params.city) {
      qb.andWhere('LOWER(company.city) = :city', {
        city: params.city.toLowerCase(),
      });
    }
    if (params.state) {
      qb.andWhere('LOWER(company.state) = :state', {
        state: params.state.toLowerCase(),
      });
    }
    if (params.search) {
      qb.andWhere(
        '(LOWER(company.name) LIKE :term OR LOWER(company.corporateName) LIKE :term OR LOWER(company.city) LIKE :term)',
        { term: `%${params.search.toLowerCase()}%` },
      );
    }
    qb.orderBy('company.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async saveCompanyWithAudit(
    company: CompanyEntity,
    audit: {
      operation: CompanyAuditOperation;
      performedBy: number | null;
      changes: JsonRecord;
    },
  ): Promise<CompanyEntity> {
    return this.companies.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(CompanyEntity).save(company);
      await manager.getRepository(CompanyAuditLogEntity).save({
        companyId: saved.id,
        organizationId: saved.organizationId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });
      return saved;
    });
  }

  findUnitById(id: number): Promise<CompanyUnitEntity | null> {
    return this.units
      .createQueryBuilder('unit')
      .withDeleted()
      .where('unit.id = :id', { id })
      .getOne();
  }

  async listUnits(
    params: CompanyUnitListParams,
  ): Promise<{ items: CompanyUnitEntity[]; total: number }> {
    const qb = this.units
      .createQueryBuilder('unit')
      .withDeleted()
      .where('unit.companyId = :companyId', { companyId: params.companyId })
      .andWhere('unit.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    if (params.status) {
      qb.andWhere('unit.status = :status', { status: params.status });
    }
    if (params.city) {
      qb.andWhere('LOWER(unit.city) = :city', {
        city: params.city.toLowerCase(),
      });
    }
    if (params.state) {
      qb.andWhere('LOWER(unit.state) = :state', {
        state: params.state.toLowerCase(),
      });
    }
    if (params.search) {
      qb.andWhere(
        '(LOWER(unit.name) LIKE :term OR LOWER(unit.code) LIKE :term OR LOWER(unit.city) LIKE :term)',
        { term: `%${params.search.toLowerCase()}%` },
      );
    }
    qb.orderBy('unit.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async saveUnitWithAudit(
    unit: CompanyUnitEntity,
    audit: {
      operation: CompanyAuditOperation;
      performedBy: number | null;
      changes: JsonRecord;
    },
  ): Promise<CompanyUnitEntity> {
    return this.units.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(CompanyUnitEntity).save(unit);
      await manager.getRepository(CompanyUnitAuditLogEntity).save({
        companyUnitId: saved.id,
        companyId: saved.companyId,
        organizationId: saved.organizationId,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });
      return saved;
    });
  }

  findProjectUnit(
    projectId: number,
    companyUnitId: number,
  ): Promise<ProjectUnitEntity | null> {
    return this.projectUnits.findOne({ where: { projectId, companyUnitId } });
  }

  findProjectUnitIncludingRemoved(
    projectId: number,
    companyUnitId: number,
  ): Promise<ProjectUnitEntity | null> {
    return this.projectUnits
      .createQueryBuilder('projectUnit')
      .withDeleted()
      .where('projectUnit.projectId = :projectId', { projectId })
      .andWhere('projectUnit.companyUnitId = :companyUnitId', {
        companyUnitId,
      })
      .getOne();
  }

  async listProjectUnits(
    projectId: number,
  ): Promise<ProjectUnitWithCompanyUnit[]> {
    const projectUnits = await this.projectUnits.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
    if (projectUnits.length === 0) {
      return [];
    }

    const companyUnits = await this.units
      .createQueryBuilder('unit')
      .withDeleted()
      .where({ id: In(projectUnits.map((item) => item.companyUnitId)) })
      .getMany();
    const unitsById = new Map(
      companyUnits.map((unit) => [Number(unit.id), unit]),
    );

    return projectUnits.map((projectUnit) => ({
      projectUnit,
      companyUnit: unitsById.get(Number(projectUnit.companyUnitId))!,
    }));
  }

  async assignProjectUnitWithAudit(params: {
    projectId: number;
    organizationId: number;
    companyUnitId: number;
    performedBy: number | null;
  }): Promise<AssignProjectUnitResult> {
    try {
      return await this.projectUnits.manager.transaction(async (manager) => {
        const project = await this.lockProject(
          manager,
          params.projectId,
          params.organizationId,
        );
        if (!project) {
          return { kind: 'project_not_found' };
        }
        if (!project.companyId) {
          return { kind: 'project_has_no_company' };
        }
        if (
          !ProjectStatusTransitionPolicy.allowsOperationalMutation(
            project.status,
          )
        ) {
          return {
            kind: 'project_status_blocks',
            currentStatus: project.status,
          };
        }

        const companyUnit = await this.lockCompanyUnit(
          manager,
          params.companyUnitId,
        );
        if (!companyUnit) {
          return { kind: 'unit_not_found' };
        }
        if (
          companyUnit.organizationId !== project.organizationId ||
          companyUnit.companyId !== project.companyId
        ) {
          return { kind: 'unit_scope_mismatch' };
        }
        if (companyUnit.status !== CompanyUnitStatus.ACTIVE) {
          return { kind: 'unit_inactive' };
        }

        const projectUnitRepository = manager.getRepository(ProjectUnitEntity);
        let assignmentQuery = projectUnitRepository
          .createQueryBuilder('projectUnit')
          .withDeleted()
          .where('projectUnit.projectId = :projectId', {
            projectId: project.id,
          })
          .andWhere('projectUnit.companyUnitId = :companyUnitId', {
            companyUnitId: companyUnit.id,
          });
        if (this.supportsPessimisticLock(manager)) {
          assignmentQuery = assignmentQuery.setLock('pessimistic_write');
        }
        const existing = await assignmentQuery.getOne();
        if (existing?.deletedAt === null) {
          return { kind: 'already_assigned' };
        }

        const wasRemoved = existing !== null;
        const projectUnit =
          existing ??
          projectUnitRepository.create({
            organizationId: project.organizationId,
            projectId: project.id,
            companyUnitId: companyUnit.id,
          });
        projectUnit.deletedAt = null;
        const saved = await projectUnitRepository.save(projectUnit);

        await manager.getRepository(ProjectUnitAuditLogEntity).save({
          projectId: saved.projectId,
          companyUnitId: saved.companyUnitId,
          organizationId: saved.organizationId,
          operation: CompanyAuditOperation.ASSIGN_PROJECT_UNIT,
          performedBy: params.performedBy,
          changes: wasRemoved
            ? { removed: { before: true, after: false } }
            : {
                project_id: { before: null, after: saved.projectId },
                company_unit_id: { before: null, after: saved.companyUnitId },
              },
        });

        return {
          kind: 'success',
          projectUnit: saved,
          companyUnit,
        };
      });
    } catch (error) {
      if (this.isProjectUnitDuplicate(error)) {
        return { kind: 'already_assigned' };
      }
      throw error;
    }
  }

  async removeProjectUnitWithAudit(params: {
    projectId: number;
    organizationId: number;
    companyUnitId: number;
    performedBy: number | null;
  }): Promise<RemoveProjectUnitResult> {
    return this.projectUnits.manager.transaction(async (manager) => {
      const project = await this.lockProject(
        manager,
        params.projectId,
        params.organizationId,
      );
      if (!project) {
        return { kind: 'project_not_found' };
      }
      if (
        !ProjectStatusTransitionPolicy.allowsOperationalMutation(project.status)
      ) {
        return {
          kind: 'project_status_blocks',
          currentStatus: project.status,
        };
      }

      const projectUnitRepository = manager.getRepository(ProjectUnitEntity);
      let assignmentQuery = projectUnitRepository
        .createQueryBuilder('projectUnit')
        .withDeleted()
        .where('projectUnit.projectId = :projectId', {
          projectId: project.id,
        })
        .andWhere('projectUnit.companyUnitId = :companyUnitId', {
          companyUnitId: params.companyUnitId,
        });
      if (this.supportsPessimisticLock(manager)) {
        assignmentQuery = assignmentQuery.setLock('pessimistic_write');
      }
      const projectUnit = await assignmentQuery.getOne();
      if (!projectUnit) {
        return { kind: 'assignment_not_found' };
      }
      if (projectUnit.organizationId !== project.organizationId) {
        return { kind: 'unit_scope_mismatch' };
      }
      if (projectUnit.deletedAt !== null) {
        return { kind: 'already_removed' };
      }

      const companyUnit = await this.findCompanyUnit(
        manager,
        projectUnit.companyUnitId,
      );
      if (!companyUnit) {
        return { kind: 'unit_not_found' };
      }
      if (companyUnit.organizationId !== project.organizationId) {
        return { kind: 'unit_scope_mismatch' };
      }

      const removed = await projectUnitRepository.softRemove(projectUnit);
      await manager.getRepository(ProjectUnitAuditLogEntity).save({
        projectId: removed.projectId,
        companyUnitId: removed.companyUnitId,
        organizationId: removed.organizationId,
        operation: CompanyAuditOperation.REMOVE_PROJECT_UNIT,
        performedBy: params.performedBy,
        changes: {
          removed: { before: false, after: true },
        },
      });

      return {
        kind: 'success',
        projectUnit: removed,
        companyUnit,
      };
    });
  }

  private async lockProject(
    manager: EntityManager,
    projectId: number,
    organizationId: number,
  ): Promise<ProjectEntity | null> {
    let query = manager
      .getRepository(ProjectEntity)
      .createQueryBuilder('project')
      .where('project.id = :projectId', { projectId })
      .andWhere('project.organizationId = :organizationId', {
        organizationId,
      });
    if (this.supportsPessimisticLock(manager)) {
      query = query.setLock('pessimistic_write');
    }
    return query.getOne();
  }

  private async lockCompanyUnit(
    manager: EntityManager,
    companyUnitId: number,
  ): Promise<CompanyUnitEntity | null> {
    let query = manager
      .getRepository(CompanyUnitEntity)
      .createQueryBuilder('unit')
      .withDeleted()
      .where('unit.id = :companyUnitId', { companyUnitId });
    if (this.supportsPessimisticLock(manager)) {
      query = query.setLock('pessimistic_write');
    }
    return query.getOne();
  }

  private findCompanyUnit(
    manager: EntityManager,
    companyUnitId: number,
  ): Promise<CompanyUnitEntity | null> {
    return manager
      .getRepository(CompanyUnitEntity)
      .createQueryBuilder('unit')
      .withDeleted()
      .where('unit.id = :companyUnitId', { companyUnitId })
      .getOne();
  }

  private supportsPessimisticLock(manager: EntityManager): boolean {
    return !['sqlite', 'better-sqlite3', 'sqljs'].includes(
      String(manager.connection.options.type),
    );
  }

  private isProjectUnitDuplicate(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as {
      code?: string;
      errno?: number;
      message?: string;
    };
    const message = driverError.message ?? error.message;
    if (driverError.code === 'ER_DUP_ENTRY' || driverError.errno === 1062) {
      return message.includes('uq_project_units_project_unit');
    }
    return (
      driverError.code?.startsWith('SQLITE_CONSTRAINT') === true &&
      message.includes('project_units.project_id') &&
      message.includes('project_units.company_unit_id')
    );
  }

  private normalizeDigits(value: string): string {
    return value.replace(/\D/g, '');
  }
}
