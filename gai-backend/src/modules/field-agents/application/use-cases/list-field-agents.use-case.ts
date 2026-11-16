import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../domain/ports/field-agent.repository.port';
import {
  FieldAgentListResponseDto,
  FieldAgentResponseDto,
} from '../dto/field-agent-response.dto';
import { ListFieldAgentsQueryDto } from '../dto/list-field-agents-query.dto';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from '../services/field-agent-scope.service';
import {
  fieldAgentAccess,
  loadFieldAgentAccess,
} from '../services/field-agent-access';

@Injectable()
export class ListFieldAgentsUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    private readonly scope: FieldAgentScopeService,
    private readonly db: DataSource,
  ) {}

  async execute(
    query: ListFieldAgentsQueryDto,
    actor: FieldAgentActorContext,
  ): Promise<FieldAgentListResponseDto> {
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
      status: query.status,
      state: query.state,
      search: query.search,
      deleted: query.deletion === 'deleted',
      excludeProjectId: query.exclude_project_id,
    });

    const access = await loadFieldAgentAccess(
      this.db.manager,
      items.map((item) => item.userId),
    );
    return {
      items: items.map((item) => ({
        ...FieldAgentResponseDto.fromDomain(item),
        access:
          (item.userId && access.get(Number(item.userId))) ||
          fieldAgentAccess(null),
      })),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
