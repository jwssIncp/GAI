import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { OrganizationAuditOperation } from '../../domain/enums/organization-audit-operation.enum';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../domain/ports/organization.repository.port';
import { OrganizationResponseDto } from '../dto/organization-response.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';

@Injectable()
export class UpdateOrganizationUseCase {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly repository: OrganizationRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateOrganizationUseCase.name);
  }

  async execute(
    id: number,
    dto: UpdateOrganizationDto,
    performedBy: number | null,
  ): Promise<OrganizationResponseDto> {
    if ('cnpj' in (dto as Record<string, unknown>)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'CNPJ cannot be changed after creation',
      });
    }

    const organization = await this.repository.findById(id);
    if (!organization) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Organization not found',
      });
    }

    const changes = organization.updateFields({
      legalName: dto.legal_name?.trim(),
      tradeName:
        dto.trade_name !== undefined
          ? (dto.trade_name?.trim() ?? null)
          : undefined,
      contactEmail: dto.contact_email,
      contactPhone: dto.contact_phone,
    });

    if (Object.keys(changes).length === 0) {
      return OrganizationResponseDto.fromDomain(organization);
    }

    const saved = await this.repository.saveWithAudit(organization, {
      organizationId: organization.id,
      operation: OrganizationAuditOperation.UPDATE,
      performedBy,
      changes,
    });

    this.logger.info({
      operation: 'UPDATE_ORGANIZATION',
      organizationId: saved.id,
      result: 'SUCCESS',
    });

    return OrganizationResponseDto.fromDomain(saved);
  }
}
