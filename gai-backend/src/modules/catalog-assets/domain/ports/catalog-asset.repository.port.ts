import { CatalogAsset } from '../entities/catalog-asset';
import { CatalogAssetAuditOperation } from '../enums/catalog-asset-audit-operation.enum';
import { CatalogAssetStatus } from '../enums/catalog-asset-status.enum';

export interface ListCatalogAssetsParams {
  page: number;
  pageSize: number;
  organizationId?: number;
  status?: CatalogAssetStatus;
  category?: string;
  search?: string;
}

export interface CatalogAssetAuditEntry {
  catalogAssetId: number | null;
  organizationId: number;
  operation: CatalogAssetAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export const CATALOG_ASSET_REPOSITORY = Symbol('CATALOG_ASSET_REPOSITORY');

export interface CatalogAssetRepository {
  findById(id: number): Promise<CatalogAsset | null>;
  findByNormalizedDescription(
    organizationId: number,
    descriptionNormalized: string,
    excludeId?: number,
  ): Promise<CatalogAsset | null>;
  list(
    params: ListCatalogAssetsParams,
  ): Promise<{ items: CatalogAsset[]; total: number }>;
  saveWithAudit(
    catalogAsset: CatalogAsset,
    audit: CatalogAssetAuditEntry,
  ): Promise<CatalogAsset>;
}
