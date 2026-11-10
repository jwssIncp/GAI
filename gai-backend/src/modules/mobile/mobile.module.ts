import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MobileRefreshTokenEntity } from '../auth/infrastructure/persistence/mobile-refresh-token.entity';
import { ImportSessionsModule } from '../import-sessions/import-sessions.module';
import { InventoryItemImagesModule } from '../inventory-item-images/inventory-item-images.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { PaymentsExpensesModule } from '../payments-expenses/payments-expenses.module';
import { MobileAuthController, MobileMeController } from './mobile.controller';
import { MobileAccessService } from './mobile-access.service';
import { MobileExpensesService } from './mobile-expenses.service';
import { MobileIdempotencyKeyEntity } from './mobile-idempotency-key.entity';
import { MobileIdentityService } from './mobile-identity.service';
import { MobileImagesService } from './mobile-images.service';
import { MobileImportService } from './mobile-import.service';
import { MobileItemsController } from './mobile-items.controller';
import { MobileItemsService } from './mobile-items.service';
import {
  MobileExpensesController,
  MobileImportController,
  MobilePlatesController,
} from './mobile-operations.controller';
import { MobilePlatesService } from './mobile-plates.service';
import { MobileSessionService } from './mobile-session.service';

/** Mobile API (/api/v1/mobile). Thin layer over shared auth/field/item/import/expense services. */
@Module({
  imports: [
    AuthModule,
    InventoryItemsModule,
    InventoryItemImagesModule,
    ImportSessionsModule,
    PaymentsExpensesModule,
    TypeOrmModule.forFeature([
      MobileRefreshTokenEntity,
      MobileIdempotencyKeyEntity,
    ]),
  ],
  controllers: [
    MobileAuthController,
    MobileMeController,
    MobileItemsController,
    MobilePlatesController,
    MobileExpensesController,
    MobileImportController,
  ],
  providers: [
    MobileSessionService,
    MobileIdentityService,
    MobileAccessService,
    MobileItemsService,
    MobileImagesService,
    MobilePlatesService,
    MobileExpensesService,
    MobileImportService,
  ],
})
export class MobileModule {}
