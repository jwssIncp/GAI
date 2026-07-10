import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_ASSET_REPOSITORY,
  type CatalogAssetRepository,
} from '../../domain/ports/catalog-asset.repository.port';
import {
  CatalogAssetListResponseDto,
  CatalogAssetResponseDto,
} from '../dto/catalog-asset-response.dto';
import { ListCatalogAssetsQueryDto } from '../dto/list-catalog-assets-query.dto';
import {
  CatalogAssetActorContext,
  CatalogAssetScopeService,
} from '../services/catalog-asset-scope.service';

@Injectable()
export class ListCatalogAssetsUseCase {
  constructor(
    @Inject(CATALOG_ASSET_REPOSITORY)
    private readonly repository: CatalogAssetRepository,
    private readonly scope: CatalogAssetScopeService,
  ) {}

  async execute(
    query: ListCatalogAssetsQueryDto,
    actor: CatalogAssetActorContext,
  ): Promise<CatalogAssetListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const organizationId = this.scope.resolveOrganizationFilter(
      actor,
      query.organization_id,
    );
    const { items, total } = await this.repository.list({
      page,
      pageSize,
      organizationId,
      status: query.status,
      category: this.scope.cleanText(query.category) ?? undefined,
      search: this.scope.cleanText(query.search) ?? undefined,
    });

    return {
      items: items.map((item) => CatalogAssetResponseDto.fromDomain(item)),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
