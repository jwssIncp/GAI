import {
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
import { CatalogAssetResponseDto } from '../dto/catalog-asset-response.dto';
import {
  CatalogAssetActorContext,
  CatalogAssetScopeService,
} from '../services/catalog-asset-scope.service';

export type CatalogAssetStatusAction = 'deactivate' | 'reactivate';

@Injectable()
export class UpdateCatalogAssetStatusUseCase {
  constructor(
    @Inject(CATALOG_ASSET_REPOSITORY)
    private readonly repository: CatalogAssetRepository,
    private readonly scope: CatalogAssetScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateCatalogAssetStatusUseCase.name);
  }

  async execute(
    id: number,
    action: CatalogAssetStatusAction,
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

    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes =
        action === 'deactivate'
          ? catalogAsset.deactivate(actor.id)
          : catalogAsset.reactivate(actor.id);
    } catch (error) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          error instanceof Error
            ? error.message
            : 'Catalog asset status blocks this operation',
      });
    }

    const saved = await this.repository.saveWithAudit(catalogAsset, {
      organizationId: catalogAsset.organizationId,
      catalogAssetId: catalogAsset.id,
      operation:
        action === 'deactivate'
          ? CatalogAssetAuditOperation.DEACTIVATE
          : CatalogAssetAuditOperation.REACTIVATE,
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: `CATALOG_ASSET_${action.toUpperCase()}`,
      catalogAssetId: saved.id,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return CatalogAssetResponseDto.fromDomain(saved);
  }
}
