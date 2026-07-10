import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/ports/project.repository.port';
import { ListProjectsQueryDto } from '../dto/list-projects-query.dto';
import {
  ProjectListResponseDto,
  ProjectResponseDto,
} from '../dto/project-response.dto';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../services/project-scope.service';

@Injectable()
export class ListProjectsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly repository: ProjectRepository,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(
    query: ListProjectsQueryDto,
    actor: ProjectActorContext,
  ): Promise<ProjectListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const organizationId = this.scope.resolveOrganizationFilter(
      actor,
      query.organization_id,
    );

    const { items, total } = await this.repository.list({
      page,
      pageSize,
      organizationId,
      companyId: query.company_id,
      status: query.status,
      search: query.search,
    });

    return {
      items: items.map((project) => ProjectResponseDto.fromDomain(project)),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
