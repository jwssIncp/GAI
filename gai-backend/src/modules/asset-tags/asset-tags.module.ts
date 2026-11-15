import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceSettingsModule } from '../finance-settings/finance-settings.module';
import { AssetTagsController } from './asset-tags.controller';
import { AssetTagsService } from './asset-tags.service';

export {
  AssetTagOrderAuditLogEntity,
  AssetTagOrderEntity,
} from './asset-tag-order.entity';

@Module({
  imports: [AuthModule, FinanceSettingsModule],
  controllers: [AssetTagsController],
  providers: [AssetTagsService],
  // A etapa 7 (fluxo de caixa e DRE) consome AssetTagsService.events().
  exports: [AssetTagsService],
})
export class AssetTagsModule {}
