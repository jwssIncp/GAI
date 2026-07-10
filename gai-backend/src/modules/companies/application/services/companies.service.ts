import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../../organizations/domain/ports/organization.repository.port';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { CompanyAuditOperation } from '../../domain/enums/company-audit-operation.enum';
import { CompanyStatus } from '../../domain/enums/company-status.enum';
import { CompanyUnitStatus } from '../../domain/enums/company-unit-status.enum';
import {
  AssignProjectUnitDto,
  CreateCompanyDto,
  CreateCompanyUnitDto,
  UpdateCompanyDto,
  UpdateCompanyUnitDto,
} from '../dto/company-inputs.dto';
import {
  ListCompaniesQueryDto,
  ListCompanyUnitsQueryDto,
} from '../dto/company-query.dto';
import {
  CompanyListResponseDto,
  CompanyResponseDto,
  CompanyUnitListResponseDto,
  CompanyUnitResponseDto,
  ProjectUnitListResponseDto,
  ProjectUnitResponseDto,
} from '../dto/company-response.dto';
import {
  CompanyActorContext,
  CompanyScopeService,
} from './company-scope.service';
import { CompanyEntity } from '../../infrastructure/persistence/company.entity';
import { CompanyUnitEntity } from '../../infrastructure/persistence/company-unit.entity';
import { ProjectUnitEntity } from '../../infrastructure/persistence/project-unit.entity';
import { TypeOrmCompaniesRepository } from '../../infrastructure/persistence/typeorm-companies.repository';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly repository: TypeOrmCompaniesRepository,
    private readonly scope: CompanyScopeService,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizations: OrganizationRepository,
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CompaniesService.name);
  }

  async createCompany(
    dto: CreateCompanyDto,
    actor: CompanyActorContext,
  ): Promise<CompanyResponseDto> {
    const organizationId = this.scope.resolveOrganizationForCreate(
      actor,
      dto.organization_id,
    );
    const organization = await this.organizations.findById(organizationId);
    if (!organization) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Organization not found',
      });
    }
    if (!organization.isActive()) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Company cannot be created for inactive organization',
      });
    }
    const document = this.normalizeDocument(dto.document);
    if (document) {
      await this.assertUniqueDocument(organizationId, document);
    }
    const company = new CompanyEntity();
    Object.assign(company, {
      organizationId,
      name: this.cleanRequired(dto.name, 'name'),
      corporateName: this.clean(dto.corporate_name),
      document,
      stateRegistration: this.clean(dto.state_registration),
      municipalRegistration: this.clean(dto.municipal_registration),
      email: this.clean(dto.email),
      phone: this.clean(dto.phone),
      zipcode: this.clean(dto.zipcode),
      address: this.clean(dto.address),
      number: this.clean(dto.number),
      complement: this.clean(dto.complement),
      district: this.clean(dto.district),
      city: this.clean(dto.city),
      state: this.clean(dto.state),
      country: this.clean(dto.country) ?? 'BR',
      status: CompanyStatus.ACTIVE,
      metadata: dto.metadata ?? null,
      createdById: actor.id,
      updatedById: actor.id,
    });
    const saved = await this.repository.saveCompanyWithAudit(company, {
      operation: CompanyAuditOperation.CREATE,
      performedBy: actor.id,
      changes: {
        organization_id: { before: null, after: organizationId },
        name: { before: null, after: company.name },
        document: { before: null, after: company.document },
        status: { before: null, after: company.status },
      },
    });
    this.logger.info({
      operation: 'CREATE_COMPANY',
      companyId: saved.id,
      organizationId,
    });
    return CompanyResponseDto.fromEntity(saved);
  }

  async listCompanies(
    query: ListCompaniesQueryDto,
    actor: CompanyActorContext,
  ): Promise<CompanyListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repository.listCompanies({
      page,
      pageSize,
      organizationId: this.scope.resolveOrganizationFilter(
        actor,
        query.organization_id,
      ),
      status: query.status,
      document: query.document,
      city: query.city,
      state: query.state,
      search: query.search,
    });
    return {
      items: items.map((item) => CompanyResponseDto.fromEntity(item)),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getCompany(
    id: number,
    actor: CompanyActorContext,
  ): Promise<CompanyResponseDto> {
    const company = await this.findCompanyOrFail(id);
    this.scope.assertCanAccessOrganization(actor, company.organizationId);
    return CompanyResponseDto.fromEntity(company);
  }

  async updateCompany(
    id: number,
    dto: UpdateCompanyDto,
    actor: CompanyActorContext,
  ): Promise<CompanyResponseDto> {
    const company = await this.findCompanyOrFail(id);
    this.scope.assertCanAccessOrganization(actor, company.organizationId);
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (dto.name !== undefined) {
      this.change(
        changes,
        company,
        'name',
        this.cleanRequired(dto.name, 'name'),
      );
    }
    if (dto.corporate_name !== undefined) {
      this.change(
        changes,
        company,
        'corporateName',
        this.clean(dto.corporate_name),
      );
    }
    if (dto.document !== undefined) {
      const document = this.normalizeDocument(dto.document);
      if (document) {
        await this.assertUniqueDocument(
          company.organizationId,
          document,
          company.id,
        );
      }
      this.change(changes, company, 'document', document);
    }
    if (dto.metadata !== undefined) {
      this.change(changes, company, 'metadata', dto.metadata ?? null);
    }
    if (Object.keys(changes).length === 0) {
      return CompanyResponseDto.fromEntity(company);
    }
    company.updatedById = actor.id;
    const saved = await this.repository.saveCompanyWithAudit(company, {
      operation: CompanyAuditOperation.UPDATE,
      performedBy: actor.id,
      changes,
    });
    return CompanyResponseDto.fromEntity(saved);
  }

  async changeCompanyStatus(
    id: number,
    action: 'deactivate' | 'reactivate',
    actor: CompanyActorContext,
  ): Promise<CompanyResponseDto> {
    const company = await this.findCompanyOrFail(id);
    this.scope.assertCanAccessOrganization(actor, company.organizationId);
    const nextStatus =
      action === 'deactivate' ? CompanyStatus.INACTIVE : CompanyStatus.ACTIVE;
    if (company.status === nextStatus) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Company status blocks this operation',
      });
    }
    const beforeStatus = company.status;
    const beforeDeletedAt = company.deletedAt;
    company.status = nextStatus;
    company.deletedAt =
      nextStatus === CompanyStatus.INACTIVE ? new Date() : null;
    company.updatedById = actor.id;
    const saved = await this.repository.saveCompanyWithAudit(company, {
      operation:
        action === 'deactivate'
          ? CompanyAuditOperation.DEACTIVATE
          : CompanyAuditOperation.REACTIVATE,
      performedBy: actor.id,
      changes: {
        status: { before: beforeStatus, after: company.status },
        deleted_at: {
          before: beforeDeletedAt?.toISOString() ?? null,
          after: company.deletedAt?.toISOString() ?? null,
        },
      },
    });
    return CompanyResponseDto.fromEntity(saved);
  }

  async createUnit(
    companyId: number,
    dto: CreateCompanyUnitDto,
    actor: CompanyActorContext,
  ): Promise<CompanyUnitResponseDto> {
    const company = await this.findCompanyOrFail(companyId);
    this.scope.assertCanAccessOrganization(actor, company.organizationId);
    if (company.status !== CompanyStatus.ACTIVE) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Company status blocks this operation',
      });
    }
    const unit = new CompanyUnitEntity();
    Object.assign(unit, {
      organizationId: company.organizationId,
      companyId,
      name: this.cleanRequired(dto.name, 'name'),
      code: this.clean(dto.code),
      zipcode: this.clean(dto.zipcode),
      address: this.clean(dto.address),
      number: this.clean(dto.number),
      complement: this.clean(dto.complement),
      district: this.clean(dto.district),
      city: this.clean(dto.city),
      state: this.clean(dto.state),
      country: this.clean(dto.country) ?? 'BR',
      status: CompanyUnitStatus.ACTIVE,
      metadata: dto.metadata ?? null,
      createdById: actor.id,
      updatedById: actor.id,
    });
    const saved = await this.repository.saveUnitWithAudit(unit, {
      operation: CompanyAuditOperation.CREATE,
      performedBy: actor.id,
      changes: {
        company_id: { before: null, after: companyId },
        name: { before: null, after: unit.name },
        status: { before: null, after: unit.status },
      },
    });
    return CompanyUnitResponseDto.fromEntity(saved);
  }

  async listUnits(
    companyId: number,
    query: ListCompanyUnitsQueryDto,
    actor: CompanyActorContext,
  ): Promise<CompanyUnitListResponseDto> {
    const company = await this.findCompanyOrFail(companyId);
    this.scope.assertCanAccessOrganization(actor, company.organizationId);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repository.listUnits({
      page,
      pageSize,
      companyId,
      organizationId: company.organizationId,
      status: query.status,
      city: query.city,
      state: query.state,
      search: query.search,
    });
    return {
      items: items.map((item) => CompanyUnitResponseDto.fromEntity(item)),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getUnit(
    companyId: number,
    unitId: number,
    actor: CompanyActorContext,
  ): Promise<CompanyUnitResponseDto> {
    const unit = await this.findUnitOrFail(companyId, unitId);
    this.scope.assertCanAccessOrganization(actor, unit.organizationId);
    return CompanyUnitResponseDto.fromEntity(unit);
  }

  async updateUnit(
    companyId: number,
    unitId: number,
    dto: UpdateCompanyUnitDto,
    actor: CompanyActorContext,
  ): Promise<CompanyUnitResponseDto> {
    const unit = await this.findUnitOrFail(companyId, unitId);
    this.scope.assertCanAccessOrganization(actor, unit.organizationId);
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (dto.name !== undefined) {
      this.change(changes, unit, 'name', this.cleanRequired(dto.name, 'name'));
    }
    if (dto.code !== undefined) {
      this.change(changes, unit, 'code', this.clean(dto.code));
    }
    if (dto.metadata !== undefined) {
      this.change(changes, unit, 'metadata', dto.metadata ?? null);
    }
    if (Object.keys(changes).length === 0) {
      return CompanyUnitResponseDto.fromEntity(unit);
    }
    unit.updatedById = actor.id;
    const saved = await this.repository.saveUnitWithAudit(unit, {
      operation: CompanyAuditOperation.UPDATE,
      performedBy: actor.id,
      changes,
    });
    return CompanyUnitResponseDto.fromEntity(saved);
  }

  async changeUnitStatus(
    companyId: number,
    unitId: number,
    action: 'deactivate' | 'reactivate',
    actor: CompanyActorContext,
  ): Promise<CompanyUnitResponseDto> {
    const unit = await this.findUnitOrFail(companyId, unitId);
    this.scope.assertCanAccessOrganization(actor, unit.organizationId);
    const nextStatus =
      action === 'deactivate'
        ? CompanyUnitStatus.INACTIVE
        : CompanyUnitStatus.ACTIVE;
    if (unit.status === nextStatus) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Company unit status blocks this operation',
      });
    }
    const beforeStatus = unit.status;
    const beforeDeletedAt = unit.deletedAt;
    unit.status = nextStatus;
    unit.deletedAt =
      nextStatus === CompanyUnitStatus.INACTIVE ? new Date() : null;
    unit.updatedById = actor.id;
    const saved = await this.repository.saveUnitWithAudit(unit, {
      operation:
        action === 'deactivate'
          ? CompanyAuditOperation.DEACTIVATE
          : CompanyAuditOperation.REACTIVATE,
      performedBy: actor.id,
      changes: {
        status: { before: beforeStatus, after: unit.status },
        deleted_at: {
          before: beforeDeletedAt?.toISOString() ?? null,
          after: unit.deletedAt?.toISOString() ?? null,
        },
      },
    });
    return CompanyUnitResponseDto.fromEntity(saved);
  }

  async assignProjectUnit(
    projectId: number,
    dto: AssignProjectUnitDto,
    actor: CompanyActorContext,
  ): Promise<ProjectUnitResponseDto> {
    const project = await this.findProjectOrFail(projectId);
    this.scope.assertCanAccessOrganization(actor, project.organizationId);
    const unit = await this.repository.findUnitById(dto.company_unit_id);
    if (!unit) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Company unit not found',
      });
    }
    if (
      unit.organizationId !== project.organizationId ||
      unit.companyId !== project.companyId
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          'Project and company unit must belong to the same company and organization',
      });
    }
    if (unit.status !== CompanyUnitStatus.ACTIVE) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Company unit status blocks this operation',
      });
    }
    const existing = await this.repository.findProjectUnit(projectId, unit.id);
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Company unit already assigned to project',
      });
    }
    const projectUnit = new ProjectUnitEntity();
    Object.assign(projectUnit, {
      organizationId: project.organizationId,
      projectId,
      companyUnitId: unit.id,
    });
    const saved = await this.repository.assignProjectUnitWithAudit(
      projectUnit,
      actor.id,
    );
    return ProjectUnitResponseDto.fromEntity(saved);
  }

  async listProjectUnits(
    projectId: number,
    actor: CompanyActorContext,
  ): Promise<ProjectUnitListResponseDto> {
    const project = await this.findProjectOrFail(projectId);
    this.scope.assertCanAccessOrganization(actor, project.organizationId);
    const items = await this.repository.listProjectUnits(projectId);
    return {
      items: items.map((item) => ProjectUnitResponseDto.fromEntity(item)),
    };
  }

  async removeProjectUnit(
    projectId: number,
    unitId: number,
    actor: CompanyActorContext,
  ): Promise<ProjectUnitResponseDto> {
    const project = await this.findProjectOrFail(projectId);
    this.scope.assertCanAccessOrganization(actor, project.organizationId);
    const projectUnit = await this.repository.findProjectUnit(
      projectId,
      unitId,
    );
    if (!projectUnit) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project unit assignment not found',
      });
    }
    const removed = await this.repository.removeProjectUnitWithAudit(
      projectUnit,
      actor.id,
    );
    return ProjectUnitResponseDto.fromEntity(removed);
  }

  async assertCompanyCanReceiveProject(
    organizationId: number,
    companyId: number,
  ): Promise<void> {
    const company = await this.findCompanyOrFail(companyId);
    if (company.organizationId !== organizationId) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          'Project cannot be linked to company from another organization',
      });
    }
    if (company.status !== CompanyStatus.ACTIVE) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Project cannot be created for inactive company',
      });
    }
  }

  private async findCompanyOrFail(id: number): Promise<CompanyEntity> {
    const company = await this.repository.findCompanyById(id);
    if (!company) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Company not found',
      });
    }
    return company;
  }

  private async findUnitOrFail(
    companyId: number,
    unitId: number,
  ): Promise<CompanyUnitEntity> {
    const unit = await this.repository.findUnitById(unitId);
    if (!unit || unit.companyId !== companyId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Company unit not found',
      });
    }
    return unit;
  }

  private async findProjectOrFail(projectId: number): Promise<ProjectEntity> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    if (!project.companyId) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Project has no company linked',
      });
    }
    return project;
  }

  private async assertUniqueDocument(
    organizationId: number,
    document: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.repository.findCompanyByDocument(
      organizationId,
      document,
      excludeId,
    );
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Company document already exists in organization',
      });
    }
  }

  private normalizeDocument(value: string | null | undefined): string | null {
    const digits = value?.replace(/\D/g, '') ?? '';
    if (!digits) {
      return null;
    }
    if (!this.isValidCnpj(digits)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'document must be a valid CNPJ',
      });
    }
    return digits;
  }

  private isValidCnpj(value: string): boolean {
    if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) {
      return false;
    }
    const calc = (length: number): number => {
      const weights =
        length === 12
          ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
          : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const sum = value
        .slice(0, length)
        .split('')
        .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
      const mod = sum % 11;
      return mod < 2 ? 0 : 11 - mod;
    };
    return calc(12) === Number(value[12]) && calc(13) === Number(value[13]);
  }

  private clean(value: string | null | undefined): string | null {
    const cleaned = value?.trim().replace(/\s+/g, ' ') ?? '';
    return cleaned.length > 0 ? cleaned : null;
  }

  private cleanRequired(value: string, field: string): string {
    const cleaned = this.clean(value);
    if (!cleaned) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${field} is required`,
      });
    }
    return cleaned;
  }

  private change<T extends object>(
    changes: Record<string, { before: unknown; after: unknown }>,
    target: T,
    key: keyof T & string,
    value: unknown,
  ): void {
    const before = target[key];
    if (JSON.stringify(before) === JSON.stringify(value)) {
      return;
    }
    changes[this.toSnake(key)] = { before, after: value };
    (target as Record<string, unknown>)[key] = value;
  }

  private toSnake(value: string): string {
    return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
  }
}
