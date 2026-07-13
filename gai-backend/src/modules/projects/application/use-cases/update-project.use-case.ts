import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ProjectAuditOperation } from '../../domain/enums/project-audit-operation.enum';
import {
  PROJECT_REPOSITORY,
  type ProjectEditableFields,
  type ProjectRepository,
} from '../../domain/ports/project.repository.port';
import { ProjectResponseDto } from '../dto/project-response.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../services/project-scope.service';

@Injectable()
export class UpdateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly repository: ProjectRepository,
    private readonly scope: ProjectScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateProjectUseCase.name);
  }

  async execute(
    id: number,
    dto: UpdateProjectDto,
    actor: ProjectActorContext,
  ): Promise<ProjectResponseDto> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.scope.assertCanAccessProject(actor, project.organizationId);
    const expectedStatus = project.status;
    const expectedUpdatedAt = project.updatedAt;

    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes = project.updateFields({
        name: dto.name?.trim(),
        description:
          dto.description !== undefined
            ? (dto.description?.trim() ?? null)
            : undefined,
        startDate: this.parseDate(dto.start_date),
        endDate: this.parseDate(dto.end_date),
        updatedById: actor.id,
      });
    } catch (error) {
      throw this.toDomainError(error);
    }

    if (Object.keys(changes).length === 0) {
      return ProjectResponseDto.fromDomain(project);
    }

    const result = await this.repository.updateFieldsWithAudit({
      id: project.id,
      expectedStatus,
      expectedUpdatedAt,
      fields: this.toEditableFields(project, changes),
      actorId: actor.id,
      now: new Date(),
      audit: {
        projectId: project.id,
        organizationId: project.organizationId,
        operation: ProjectAuditOperation.UPDATE,
        performedBy: actor.id,
        changes,
      },
    });

    if (result.kind === 'not_found') {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    if (result.kind === 'concurrent_modification') {
      throw new ConflictException({
        code: 'PROJECT_CONCURRENT_MODIFICATION',
        message:
          'Project was modified by another operation. Reload it and try again.',
        details: {
          current_status: result.currentStatus,
          current_updated_at: result.currentUpdatedAt.toISOString(),
        },
      });
    }

    const saved = result.project;

    this.logger.info({
      operation: 'UPDATE_PROJECT',
      projectId: saved.id,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return ProjectResponseDto.fromDomain(saved);
  }

  private toEditableFields(
    project: {
      name: string;
      description: string | null;
      startDate: Date | null;
      endDate: Date | null;
    },
    changes: Record<string, { before: unknown; after: unknown }>,
  ): ProjectEditableFields {
    return {
      ...(changes.name ? { name: project.name } : {}),
      ...(changes.description ? { description: project.description } : {}),
      ...(changes.start_date ? { startDate: project.startDate } : {}),
      ...(changes.end_date ? { endDate: project.endDate } : {}),
    };
  }

  private parseDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    return value ? new Date(`${value}T00:00:00.000Z`) : null;
  }

  private toDomainError(
    error: unknown,
  ): BadRequestException | ConflictException {
    const message = error instanceof Error ? error.message : 'Invalid project';
    if (message === 'Project status blocks this operation') {
      return new ConflictException({
        code: 'PROJECT_STATUS_BLOCKS_OPERATION',
        message,
      });
    }
    return new BadRequestException({ code: 'VALIDATION_ERROR', message });
  }
}
