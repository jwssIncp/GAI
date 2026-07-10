import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  listProjectUnits(projectId: number): Promise<ProjectUnitEntity[]> {
    return this.projectUnits.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async assignProjectUnitWithAudit(
    projectUnit: ProjectUnitEntity,
    performedBy: number | null,
  ): Promise<ProjectUnitEntity> {
    return this.projectUnits.manager.transaction(async (manager) => {
      const saved = await manager
        .getRepository(ProjectUnitEntity)
        .save(projectUnit);
      await manager.getRepository(ProjectUnitAuditLogEntity).save({
        projectId: saved.projectId,
        companyUnitId: saved.companyUnitId,
        organizationId: saved.organizationId,
        operation: CompanyAuditOperation.ASSIGN_PROJECT_UNIT,
        performedBy,
        changes: {
          project_id: { before: null, after: saved.projectId },
          company_unit_id: { before: null, after: saved.companyUnitId },
        },
      });
      return saved;
    });
  }

  async removeProjectUnitWithAudit(
    projectUnit: ProjectUnitEntity,
    performedBy: number | null,
  ): Promise<ProjectUnitEntity> {
    return this.projectUnits.manager.transaction(async (manager) => {
      await manager.getRepository(ProjectUnitEntity).delete(projectUnit.id);
      await manager.getRepository(ProjectUnitAuditLogEntity).save({
        projectId: projectUnit.projectId,
        companyUnitId: projectUnit.companyUnitId,
        organizationId: projectUnit.organizationId,
        operation: CompanyAuditOperation.REMOVE_PROJECT_UNIT,
        performedBy,
        changes: {
          removed: { before: false, after: true },
        },
      });
      return projectUnit;
    });
  }

  private normalizeDigits(value: string): string {
    return value.replace(/\D/g, '');
  }
}
