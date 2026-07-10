import {
  BadRequestException,
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
import { UpdateFieldAgentDto } from '../dto/update-field-agent.dto';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from '../services/field-agent-scope.service';

@Injectable()
export class UpdateFieldAgentUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    private readonly scope: FieldAgentScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateFieldAgentUseCase.name);
  }

  async execute(
    id: number,
    dto: UpdateFieldAgentDto,
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
    await this.assertUserScope(dto.user_id, fieldAgent.organizationId);

    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes = fieldAgent.updateFields({
        userId: dto.user_id,
        name: dto.name?.trim(),
        email:
          dto.email !== undefined
            ? (dto.email?.trim().toLowerCase() ?? null)
            : undefined,
        phone:
          dto.phone !== undefined ? (dto.phone?.trim() ?? null) : undefined,
        document:
          dto.document !== undefined
            ? (dto.document?.trim() ?? null)
            : undefined,
        metadata: dto.metadata,
      });
    } catch (error) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Invalid field agent',
      });
    }

    if (Object.keys(changes).length === 0) {
      return FieldAgentResponseDto.fromDomain(fieldAgent);
    }

    const saved = await this.repository.saveFieldAgentWithAudit(fieldAgent, {
      organizationId: fieldAgent.organizationId,
      fieldAgentId: fieldAgent.id,
      operation: FieldAgentAuditOperation.UPDATE,
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: 'UPDATE_FIELD_AGENT',
      fieldAgentId: saved.id,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return FieldAgentResponseDto.fromDomain(saved);
  }

  private async assertUserScope(
    userId: number | null | undefined,
    organizationId: number,
  ): Promise<void> {
    if (userId === undefined || userId === null) {
      return;
    }
    const userOrganizationId =
      await this.repository.findUserOrganizationId(userId);
    if (userOrganizationId === undefined) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }
    if (userOrganizationId !== organizationId) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'User must belong to the same organization',
      });
    }
  }
}
