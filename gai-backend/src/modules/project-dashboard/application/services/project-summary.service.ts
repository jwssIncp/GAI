import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../../../projects/application/services/project-scope.service';
import { ProjectSummaryQueryDto } from '../dto/project-summary-query.dto';
import {
  ProjectAccountingSummaryDto,
  ProjectFieldAgentsSummaryDto,
  ProjectImagesSummaryDto,
  ProjectInventorySummaryDto,
  ProjectPendingIssuesSummaryDto,
  ProjectSummaryProjectDto,
  ProjectSummaryResponseDto,
} from '../dto/project-summary-response.dto';
import {
  PROJECT_SUMMARY_REPOSITORY,
  type ProjectSummaryRepository,
} from '../../domain/ports/project-summary.repository.port';

@Injectable()
export class ProjectSummaryService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    @Inject(PROJECT_SUMMARY_REPOSITORY)
    private readonly summaries: ProjectSummaryRepository,
    private readonly scope: ProjectScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProjectSummaryService.name);
  }

  async getSummary(
    projectId: number,
    query: ProjectSummaryQueryDto,
    actor: ProjectActorContext,
  ): Promise<ProjectSummaryResponseDto> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      this.logger.warn(
        { projectId, actorId: actor.id },
        'project_summary_not_found',
      );
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }

    this.scope.assertCanAccessProject(actor, project.organizationId);
    this.logger.info(
      {
        projectId,
        actorId: actor.id,
        includeFinancial: Boolean(query.include_financial),
        includeImports: Boolean(query.include_imports),
        includeExports: Boolean(query.include_exports),
        includeRecentActivity: Boolean(query.include_recent_activity),
      },
      'project_summary_requested',
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mandatorySummaryPromises: [
      Promise<ProjectInventorySummaryDto>,
      Promise<ProjectImagesSummaryDto>,
      Promise<ProjectAccountingSummaryDto>,
      Promise<ProjectPendingIssuesSummaryDto>,
      Promise<ProjectFieldAgentsSummaryDto>,
    ] = [
      this.summaries.getInventorySummary(projectId),
      this.summaries.getImagesSummary(projectId),
      this.summaries.getAccountingSummary(projectId),
      this.summaries.getPendingIssuesSummary(projectId),
      this.summaries.getFieldAgentsSummary(projectId),
    ];
    const [inventory, images, accounting, pendingIssues, fieldAgents] =
      await Promise.all(mandatorySummaryPromises);

    const response: ProjectSummaryResponseDto = {
      project: this.toProjectDto(project),
      inventory,
      images,
      accounting,
      pending_issues: pendingIssues,
      field_agents: fieldAgents,
    };

    if (query.include_financial) {
      response.financial = await this.summaries.getFinancialSummary(projectId);
    }
    if (query.include_imports) {
      response.imports = await this.summaries.getImportsSummary(projectId);
    }
    if (query.include_exports) {
      response.exports = await this.summaries.getExportsSummary(projectId);
    }
    if (query.include_recent_activity) {
      response.recent_activity =
        await this.summaries.getRecentActivitySummary(projectId);
    }

    return response;
  }

  private toProjectDto(project: {
    id: number;
    name: string;
    status: string;
    organizationId: number;
    startDate: Date | null;
    endDate: Date | null;
    createdAt: Date;
  }): ProjectSummaryProjectDto {
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      organization_id: project.organizationId,
      start_date: project.startDate
        ? project.startDate.toISOString().slice(0, 10)
        : null,
      end_date: project.endDate
        ? project.endDate.toISOString().slice(0, 10)
        : null,
      created_at: project.createdAt.toISOString(),
    };
  }
}
