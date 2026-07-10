import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogAsset, JsonRecord } from '../../domain/entities/catalog-asset';
import { CatalogAssetStatus } from '../../domain/enums/catalog-asset-status.enum';

export class CatalogAssetResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  description_normalized!: string;

  @ApiPropertyOptional({ nullable: true })
  category!: string | null;

  @ApiProperty({ enum: CatalogAssetStatus })
  status!: CatalogAssetStatus;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: JsonRecord | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  created_by_id!: number | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  updated_by_id!: number | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deleted_at!: string | null;

  static fromDomain(catalogAsset: CatalogAsset): CatalogAssetResponseDto {
    return {
      id: catalogAsset.id,
      organization_id: catalogAsset.organizationId,
      description: catalogAsset.description,
      description_normalized: catalogAsset.descriptionNormalized,
      category: catalogAsset.category,
      status: catalogAsset.status,
      metadata: catalogAsset.metadata,
      created_by_id: catalogAsset.createdById,
      updated_by_id: catalogAsset.updatedById,
      created_at: catalogAsset.createdAt.toISOString(),
      updated_at: catalogAsset.updatedAt.toISOString(),
      deleted_at: catalogAsset.deletedAt?.toISOString() ?? null,
    };
  }
}

export class CatalogAssetListResponseDto {
  @ApiProperty({ type: [CatalogAssetResponseDto] })
  items!: CatalogAssetResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  page_size!: number;

  @ApiProperty({ minimum: 0 })
  total_items!: number;

  @ApiProperty({ minimum: 0 })
  total_pages!: number;
}
