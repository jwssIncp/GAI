import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { FieldAgentAuditOperation } from '../../domain/enums/field-agent-audit-operation.enum';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../domain/ports/field-agent.repository.port';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from '../services/field-agent-scope.service';

@Injectable()
export class DeleteFieldAgentUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    private readonly scope: FieldAgentScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DeleteFieldAgentUseCase.name);
  }

  async execute(id: number, actor: FieldAgentActorContext): Promise<void> {
    const fieldAgent = await this.repository.findById(id);
    if (!fieldAgent) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Field agent not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, fieldAgent.organizationId);
    let changes;
    try {
      changes = fieldAgent.softDelete(new Date());
    } catch (error) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          error instanceof Error
            ? error.message
            : 'Field agent cannot be deleted',
      });
    }
    await this.repository.saveFieldAgentWithAudit(fieldAgent, {
      organizationId: fieldAgent.organizationId,
      fieldAgentId: fieldAgent.id,
      operation: FieldAgentAuditOperation.DELETE,
      performedBy: actor.id,
      changes,
    });
    this.logger.info({
      operation: 'DELETE_FIELD_AGENT',
      fieldAgentId: fieldAgent.id,
      organizationId: fieldAgent.organizationId,
      result: 'SUCCESS',
    });
  }
}
