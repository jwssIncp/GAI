import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CatalogAssetAuditOperation } from '../../domain/enums/catalog-asset-audit-operation.enum';
import {
  CATALOG_ASSET_REPOSITORY,
  type CatalogAssetRepository,
} from '../../domain/ports/catalog-asset.repository.port';
import { UpdateCatalogAssetDto } from '../dto/catalog-asset-inputs';
import { CatalogAssetResponseDto } from '../dto/catalog-asset-response.dto';
import {
  CatalogAssetActorContext,
  CatalogAssetScopeService,
} from '../services/catalog-asset-scope.service';

@Injectable()
export class UpdateCatalogAssetUseCase {
  constructor(
    @Inject(CATALOG_ASSET_REPOSITORY)
    private readonly repository: CatalogAssetRepository,
    private readonly scope: CatalogAssetScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateCatalogAssetUseCase.name);
  }

  async execute(
    id: number,
    dto: UpdateCatalogAssetDto,
    actor: CatalogAssetActorContext,
  ): Promise<CatalogAssetResponseDto> {
    const catalogAsset = await this.repository.findById(id);
    if (!catalogAsset) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Catalog asset not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, catalogAsset.organizationId);

    const description =
      dto.description !== undefined
        ? this.scope.cleanText(dto.description)
        : undefined;
    if (description === null) {
      throw this.validation(new Error('description is required'));
    }
    const descriptionNormalized =
      description !== undefined
        ? this.scope.normalizeDescription(description)
        : undefined;

    if (
      descriptionNormalized !== undefined &&
      descriptionNormalized !== catalogAsset.descriptionNormalized
    ) {
      await this.assertUniqueDescription(
        catalogAsset.organizationId,
        descriptionNormalized,
        catalogAsset.id,
      );
    }

    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes = catalogAsset.updateFields({
        description,
        descriptionNormalized,
        category:
          dto.category !== undefined
            ? (this.scope.cleanText(dto.category) ?? null)
            : undefined,
        metadata: dto.metadata,
        updatedById: actor.id,
      });
    } catch (error) {
      throw this.validation(error);
    }

    if (Object.keys(changes).length === 0) {
      return CatalogAssetResponseDto.fromDomain(catalogAsset);
    }

    const saved = await this.repository.saveWithAudit(catalogAsset, {
      organizationId: catalogAsset.organizationId,
      catalogAssetId: catalogAsset.id,
      operation: CatalogAssetAuditOperation.UPDATE,
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: 'UPDATE_CATALOG_ASSET',
      catalogAssetId: saved.id,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return CatalogAssetResponseDto.fromDomain(saved);
  }

  private async assertUniqueDescription(
    organizationId: number,
    descriptionNormalized: string,
    excludeId: number,
  ): Promise<void> {
    const existing = await this.repository.findByNormalizedDescription(
      organizationId,
      descriptionNormalized,
      excludeId,
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
