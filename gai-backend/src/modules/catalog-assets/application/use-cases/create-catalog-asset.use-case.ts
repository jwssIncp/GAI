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
import { CatalogAsset } from '../../domain/entities/catalog-asset';
import { CatalogAssetAuditOperation } from '../../domain/enums/catalog-asset-audit-operation.enum';
import { CatalogAssetStatus } from '../../domain/enums/catalog-asset-status.enum';
import {
  CATALOG_ASSET_REPOSITORY,
  type CatalogAssetRepository,
} from '../../domain/ports/catalog-asset.repository.port';
import { CreateCatalogAssetDto } from '../dto/catalog-asset-inputs';
import { CatalogAssetResponseDto } from '../dto/catalog-asset-response.dto';
import {
  CatalogAssetActorContext,
  CatalogAssetScopeService,
} from '../services/catalog-asset-scope.service';

@Injectable()
export class CreateCatalogAssetUseCase {
  constructor(
    @Inject(CATALOG_ASSET_REPOSITORY)
    private readonly repository: CatalogAssetRepository,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizations: OrganizationRepository,
    private readonly scope: CatalogAssetScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateCatalogAssetUseCase.name);
  }

  async execute(
    dto: CreateCatalogAssetDto,
    actor: CatalogAssetActorContext,
  ): Promise<CatalogAssetResponseDto> {
    const organizationId = this.scope.resolveOrganizationForCreate(
      actor,
      dto.organization_id,
    );
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
        message: 'Catalog asset cannot be created for inactive organization',
      });
    }

    const description = this.scope.cleanText(dto.description);
    if (!description) {
      throw this.validation(new Error('description is required'));
    }
    const descriptionNormalized = this.scope.normalizeDescription(description);
    await this.assertUniqueDescription(organizationId, descriptionNormalized);

    const now = new Date();
    let catalogAsset: CatalogAsset;
    try {
      catalogAsset = new CatalogAsset({
        id: 0,
        organizationId,
        description,
        descriptionNormalized,
        category: this.scope.cleanText(dto.category) ?? null,
        status: CatalogAssetStatus.ACTIVE,
        metadata: dto.metadata ?? null,
        createdById: actor.id,
        updatedById: actor.id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    } catch (error) {
      throw this.validation(error);
    }

    const saved = await this.repository.saveWithAudit(catalogAsset, {
      catalogAssetId: 0,
      organizationId,
      operation: CatalogAssetAuditOperation.CREATE,
      performedBy: actor.id,
      changes: {
        organization_id: { before: null, after: organizationId },
        description: { before: null, after: catalogAsset.description },
        description_normalized: {
          before: null,
          after: catalogAsset.descriptionNormalized,
        },
        status: { before: null, after: catalogAsset.status },
      },
    });

    this.logger.info({
      operation: 'CREATE_CATALOG_ASSET',
      catalogAssetId: saved.id,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return CatalogAssetResponseDto.fromDomain(saved);
  }

  private async assertUniqueDescription(
    organizationId: number,
    descriptionNormalized: string,
  ): Promise<void> {
    const existing = await this.repository.findByNormalizedDescription(
      organizationId,
      descriptionNormalized,
    );
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Catalog asset description already exists in organization',
      });
    }
  }

  private validation(error: unknown): BadRequestException {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Invalid catalog asset',
    });
  }
}
