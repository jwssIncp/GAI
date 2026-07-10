import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../../auth/domain/ports/session.repository.port';
import { OrganizationAuditOperation } from '../../domain/enums/organization-audit-operation.enum';
import { OrganizationStatus } from '../../domain/enums/organization-status.enum';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../domain/ports/organization.repository.port';
import { OrganizationResponseDto } from '../dto/organization-response.dto';

@Injectable()
export class ActivateOrganizationUseCase {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly repository: OrganizationRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ActivateOrganizationUseCase.name);
  }

  async execute(
    id: number,
    performedBy: number | null,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.repository.findById(id);
    if (!organization) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Organization not found',
      });
    }

    if (organization.status === OrganizationStatus.ACTIVE) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Organization is already active',
      });
    }

    const sessionsRevoked = await this.sessions.revokeAllForOrganization(
      organization.id,
      new Date(),
    );
    const previousStatus = organization.status;
    organization.activate();

    const saved = await this.repository.saveWithAudit(organization, {
      organizationId: organization.id,
      operation: OrganizationAuditOperation.ACTIVATE,
      performedBy,
      changes: {
        status: { before: previousStatus, after: OrganizationStatus.ACTIVE },
      },
    });

    this.logger.info({
      operation: 'ACTIVATE_ORGANIZATION',
      organizationId: saved.id,
      sessionsRevoked,
      result: 'SUCCESS',
    });

    return OrganizationResponseDto.fromDomain(saved);
  }
}
