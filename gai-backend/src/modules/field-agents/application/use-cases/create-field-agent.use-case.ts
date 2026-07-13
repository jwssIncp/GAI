import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../../organizations/domain/ports/organization.repository.port';
import { FieldAgent } from '../../domain/entities/field-agent';
import { FieldAgentAuditOperation } from '../../domain/enums/field-agent-audit-operation.enum';
import { FieldAgentStatus } from '../../domain/enums/field-agent-status.enum';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../domain/ports/field-agent.repository.port';
import { CreateFieldAgentDto } from '../dto/create-field-agent.dto';
import { FieldAgentResponseDto } from '../dto/field-agent-response.dto';
import {
  duplicateFieldFromDatabase,
  fieldAgentConflict,
} from '../errors/field-agent-conflict';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from '../services/field-agent-scope.service';

@Injectable()
export class CreateFieldAgentUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizations: OrganizationRepository,
    private readonly scope: FieldAgentScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateFieldAgentUseCase.name);
  }

  async execute(
    dto: CreateFieldAgentDto,
    actor: FieldAgentActorContext,
  ): Promise<FieldAgentResponseDto> {
    const organizationId = this.scope.resolveOrganizationForCreate(actor);
    const organization = await this.organizations.findById(organizationId);
    if (!organization) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Organization not found',
      });
    }
    if (!organization.isActive()) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Field agent cannot be created for inactive organization',
      });
    }
    await this.assertUserScope(dto.user_id, organizationId);

    const now = new Date();
    let fieldAgent: FieldAgent;
    try {
      fieldAgent = new FieldAgent({
        id: 0,
        organizationId,
        userId: dto.user_id ?? null,
        name: dto.name.trim(),
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        document: dto.document ?? null,
        status: FieldAgentStatus.ACTIVE,
        metadata: dto.metadata ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    } catch (error) {
      throw this.validation(error);
    }

    const conflict = await this.repository.findConflict(organizationId, {
      email: fieldAgent.email,
      document: fieldAgent.document,
    });
    if (conflict) throw fieldAgentConflict(conflict);

    let saved: FieldAgent;
    try {
      saved = await this.repository.saveFieldAgentWithAudit(fieldAgent, {
        organizationId,
        fieldAgentId: 0,
        operation: FieldAgentAuditOperation.CREATE,
        performedBy: actor.id,
        changes: {
          organization_id: { before: null, after: organizationId },
          name: { before: null, after: fieldAgent.name },
          status: { before: null, after: fieldAgent.status },
        },
      });
    } catch (error) {
      const duplicateField = duplicateFieldFromDatabase(error);
      if (duplicateField) throw fieldAgentConflict(duplicateField);
      throw error;
    }

    this.logger.info({
      operation: 'CREATE_FIELD_AGENT',
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
    if (!userId) {
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

  private validation(error: unknown): BadRequestException {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Invalid field agent',
    });
  }
}
