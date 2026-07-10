import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../domain/ports/field-agent.repository.port';
import {
  ProjectFieldAgentListResponseDto,
  ProjectFieldAgentResponseDto,
} from '../dto/field-agent-response.dto';
import { ListProjectFieldAgentsQueryDto } from '../dto/project-field-agent.dto';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from '../services/field-agent-scope.service';

@Injectable()
export class ListProjectFieldAgentsUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly scope: FieldAgentScopeService,
  ) {}

  async execute(
    projectId: number,
    query: ListProjectFieldAgentsQueryDto,
    actor: FieldAgentActorContext,
  ): Promise<ProjectFieldAgentListResponseDto> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, project.organizationId);

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repository.listAssignments({
      page,
      pageSize,
      projectId,
      status: query.status,
    });

    return {
      items: items.map((item) => ProjectFieldAgentResponseDto.fromDomain(item)),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
