import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../domain/ports/field-agent.repository.port';
import { FieldAgentResponseDto } from '../dto/field-agent-response.dto';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from '../services/field-agent-scope.service';

@Injectable()
export class GetFieldAgentUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    private readonly scope: FieldAgentScopeService,
  ) {}

  async execute(
    id: number,
    actor: FieldAgentActorContext,
  ): Promise<FieldAgentResponseDto> {
    const fieldAgent = await this.repository.findById(id);
    if (!fieldAgent) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Field agent not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, fieldAgent.organizationId);
    return FieldAgentResponseDto.fromDomain(fieldAgent);
  }
}
