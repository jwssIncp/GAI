import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../../organizations/domain/ports/organization.repository.port';
import { CompaniesService } from '../../../companies/application/services/companies.service';
import { Project } from '../../domain/entities/project';
import { ProjectAuditOperation } from '../../domain/enums/project-audit-operation.enum';
import { ProjectStatus } from '../../domain/enums/project-status.enum';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/ports/project.repository.port';
import { CreateProjectDto } from '../dto/create-project.dto';
import { ProjectResponseDto } from '../dto/project-response.dto';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../services/project-scope.service';

@Injectable()
export class CreateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly repository: ProjectRepository,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizations: OrganizationRepository,
    private readonly companies: CompaniesService,
    private readonly scope: ProjectScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateProjectUseCase.name);
  }

  async execute(
    dto: CreateProjectDto,
    actor: ProjectActorContext,
  ): Promise<ProjectResponseDto> {
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
        message: 'Project cannot be created for inactive organization',
      });
    }
    await this.companies.assertCompanyCanReceiveProject(
      organizationId,
      dto.company_id,
    );

    const now = new Date();
    let project: Project;
    try {
      project = new Project({
        id: 0,
        organizationId,
        companyId: dto.company_id,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        status: ProjectStatus.DRAFT,
        startDate: this.parseDate(dto.start_date),
        endDate: this.parseDate(dto.end_date),
        finishedAt: null,
        settings: dto.settings ?? null,
        metadata: dto.metadata ?? null,
        createdById: actor.id,
        updatedById: actor.id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    } catch (error) {
      throw this.toValidationError(error);
    }

    const saved = await this.repository.saveWithAudit(project, {
      projectId: 0,
      organizationId,
      operation: ProjectAuditOperation.CREATE,
      performedBy: actor.id,
      changes: {
        name: { before: null, after: project.name },
        organization_id: { before: null, after: organizationId },
        company_id: { before: null, after: dto.company_id },
        status: { before: null, after: project.status },
      },
    });

    this.logger.info({
      operation: 'CREATE_PROJECT',
      projectId: saved.id,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return ProjectResponseDto.fromDomain(saved);
  }

  private parseDate(value: string | null | undefined): Date | null {
    return value ? new Date(`${value}T00:00:00.000Z`) : null;
  }

  private toValidationError(error: unknown): BadRequestException {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Invalid project',
    });
  }
}
