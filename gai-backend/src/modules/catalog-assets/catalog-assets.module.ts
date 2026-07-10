import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CatalogAssetScopeService } from './application/services/catalog-asset-scope.service';
import { CreateCatalogAssetUseCase } from './application/use-cases/create-catalog-asset.use-case';
import { GetCatalogAssetUseCase } from './application/use-cases/get-catalog-asset.use-case';
import { ListCatalogAssetsUseCase } from './application/use-cases/list-catalog-assets.use-case';
import { UpdateCatalogAssetStatusUseCase } from './application/use-cases/update-catalog-asset-status.use-case';
import { UpdateCatalogAssetUseCase } from './application/use-cases/update-catalog-asset.use-case';
import { CATALOG_ASSET_REPOSITORY } from './domain/ports/catalog-asset.repository.port';
import { CatalogAssetAuditLogEntity } from './infrastructure/persistence/catalog-asset-audit-log.entity';
import { CatalogAssetEntity } from './infrastructure/persistence/catalog-asset.entity';
import { TypeOrmCatalogAssetRepository } from './infrastructure/persistence/typeorm-catalog-asset.repository';
import { CatalogAssetsController } from './presentation/catalog-assets.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatalogAssetEntity, CatalogAssetAuditLogEntity]),
    AuthModule,
    OrganizationsModule,
  ],
  controllers: [CatalogAssetsController],
  providers: [
    CatalogAssetScopeService,
    CreateCatalogAssetUseCase,
    ListCatalogAssetsUseCase,
    GetCatalogAssetUseCase,
    UpdateCatalogAssetUseCase,
    UpdateCatalogAssetStatusUseCase,
    {
      provide: CATALOG_ASSET_REPOSITORY,
      useClass: TypeOrmCatalogAssetRepository,
    },
  ],
  exports: [CATALOG_ASSET_REPOSITORY, TypeOrmModule],
})
export class CatalogAssetsModule {}
