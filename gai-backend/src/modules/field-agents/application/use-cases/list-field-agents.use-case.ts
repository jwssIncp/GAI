import { Inject, Injectable } from '@nestjs/common';
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

@Injectable()
export class ListFieldAgentsUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    private readonly scope: FieldAgentScopeService,
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
      search: query.search,
    });

    return {
      items: items.map((item) => FieldAgentResponseDto.fromDomain(item)),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
