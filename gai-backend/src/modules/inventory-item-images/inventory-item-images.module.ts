import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguredStorageSignerService } from '../../common/storage/configured-storage-signer.service';
import { STORAGE_SIGNER } from '../../common/storage/storage-signer.port';
import { AuthModule } from '../auth/auth.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { ProjectsModule } from '../projects/projects.module';
import { InventoryItemImageScopeService } from './application/services/inventory-item-image-scope.service';
import { ConfirmInventoryItemImageUploadUseCase } from './application/use-cases/confirm-inventory-item-image-upload.use-case';
import { CreateInventoryItemImageDownloadUrlUseCase } from './application/use-cases/create-inventory-item-image-download-url.use-case';
import { CreateInventoryItemImageUploadUrlUseCase } from './application/use-cases/create-inventory-item-image-upload-url.use-case';
import { GetInventoryItemImageUseCase } from './application/use-cases/get-inventory-item-image.use-case';
import { ListInventoryItemImagesUseCase } from './application/use-cases/list-inventory-item-images.use-case';
import { RemoveInventoryItemImageUseCase } from './application/use-cases/remove-inventory-item-image.use-case';
import { INVENTORY_ITEM_IMAGE_REPOSITORY } from './domain/ports/inventory-item-image.repository.port';
import { InventoryItemImageAuditLogEntity } from './infrastructure/persistence/inventory-item-image-audit-log.entity';
import { InventoryItemImageEntity } from './infrastructure/persistence/inventory-item-image.entity';
import { TypeOrmInventoryItemImageRepository } from './infrastructure/persistence/typeorm-inventory-item-image.repository';
import { InventoryItemImagesController } from './presentation/inventory-item-images.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItemImageEntity,
      InventoryItemImageAuditLogEntity,
    ]),
    AuthModule,
    ProjectsModule,
    InventoryItemsModule,
  ],
  controllers: [InventoryItemImagesController],
  providers: [
    InventoryItemImageScopeService,
    CreateInventoryItemImageUploadUrlUseCase,
    ConfirmInventoryItemImageUploadUseCase,
    ListInventoryItemImagesUseCase,
    GetInventoryItemImageUseCase,
    CreateInventoryItemImageDownloadUrlUseCase,
    RemoveInventoryItemImageUseCase,
    {
      provide: INVENTORY_ITEM_IMAGE_REPOSITORY,
      useClass: TypeOrmInventoryItemImageRepository,
    },
    {
      provide: STORAGE_SIGNER,
      useClass: ConfiguredStorageSignerService,
    },
  ],
  exports: [INVENTORY_ITEM_IMAGE_REPOSITORY, TypeOrmModule],
})
export class InventoryItemImagesModule {}
