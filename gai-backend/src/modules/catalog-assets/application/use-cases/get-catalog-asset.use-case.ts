import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CATALOG_ASSET_REPOSITORY,
  type CatalogAssetRepository,
} from '../../domain/ports/catalog-asset.repository.port';
import { CatalogAssetResponseDto } from '../dto/catalog-asset-response.dto';
import {
  CatalogAssetActorContext,
  CatalogAssetScopeService,
} from '../services/catalog-asset-scope.service';

@Injectable()
export class GetCatalogAssetUseCase {
  constructor(
    @Inject(CATALOG_ASSET_REPOSITORY)
    private readonly repository: CatalogAssetRepository,
    private readonly scope: CatalogAssetScopeService,
  ) {}

  async execute(
    id: number,
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
    return CatalogAssetResponseDto.fromDomain(catalogAsset);
  }
}
