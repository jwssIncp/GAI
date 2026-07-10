import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Organization } from '../../domain/entities/organization';
import { OrganizationAuditOperation } from '../../domain/enums/organization-audit-operation.enum';
import { OrganizationStatus } from '../../domain/enums/organization-status.enum';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../domain/ports/organization.repository.port';
import { Cnpj } from '../../domain/value-objects/cnpj';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { OrganizationResponseDto } from '../dto/organization-response.dto';

@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly repository: OrganizationRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateOrganizationUseCase.name);
  }

  async execute(
    dto: CreateOrganizationDto,
    performedBy: number | null,
  ): Promise<OrganizationResponseDto> {
    const cnpj = Cnpj.create(dto.cnpj);
    const existing = await this.repository.findByCnpj(cnpj.getValue());
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Organization with this CNPJ already exists',
      });
    }

    const now = new Date();
    const organization = new Organization({
      id: 0,
      legalName: dto.legal_name.trim(),
      tradeName: dto.trade_name?.trim() ?? null,
      cnpj,
      contactEmail: dto.contact_email ?? null,
      contactPhone: dto.contact_phone ?? null,
      status: dto.status ?? OrganizationStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.repository.saveWithAudit(organization, {
      organizationId: 0,
      operation: OrganizationAuditOperation.CREATE,
      performedBy,
      changes: {
        legal_name: { before: null, after: organization.legalName },
        cnpj: { before: null, after: cnpj.getValue() },
        status: { before: null, after: organization.status },
      },
    });

    this.logger.info({
      operation: 'CREATE_ORGANIZATION',
      organizationId: saved.id,
      result: 'SUCCESS',
    });

    return OrganizationResponseDto.fromDomain(saved);
  }
}
