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
import { FieldAgentResponseDto } from '../dto/field-agent-response.dto';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from '../services/field-agent-scope.service';

export type FieldAgentStatusAction =
  | 'deactivate'
  | 'reactivate'
  | 'block'
  | 'unblock';

@Injectable()
export class UpdateFieldAgentStatusUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    private readonly scope: FieldAgentScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateFieldAgentStatusUseCase.name);
  }

  async execute(
    id: number,
    action: FieldAgentStatusAction,
    actor: FieldAgentActorContext,
  ): Promise<FieldAgentResponseDto> {
    const fieldAgent = await this.repository.findById(id);
    if (!fieldAgent) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventariante não encontrado.',
      });
    }
    this.scope.assertCanAccessOrganization(actor, fieldAgent.organizationId);

    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      const transitions = {
        deactivate: () => fieldAgent.deactivate(),
        reactivate: () => fieldAgent.reactivate(),
        block: () => fieldAgent.block(),
        unblock: () => fieldAgent.unblock(),
      };
      changes = transitions[action]();
    } catch (error) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          error instanceof Error
            ? error.message
            : 'A situação do inventariante não permite esta operação.',
      });
    }

    const saved = await this.repository.saveFieldAgentWithAudit(fieldAgent, {
      organizationId: fieldAgent.organizationId,
      fieldAgentId: fieldAgent.id,
      operation: {
        deactivate: FieldAgentAuditOperation.DEACTIVATE,
        reactivate: FieldAgentAuditOperation.REACTIVATE,
        block: FieldAgentAuditOperation.BLOCK,
        unblock: FieldAgentAuditOperation.UNBLOCK,
      }[action],
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: `FIELD_AGENT_${action.toUpperCase()}`,
      fieldAgentId: saved.id,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return FieldAgentResponseDto.fromDomain(saved);
  }
}
