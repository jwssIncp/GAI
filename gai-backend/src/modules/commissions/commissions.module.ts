import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';

export {
  CommissionAuditLogEntity,
  CommissionEntity,
  CommissionPartnerEntity,
} from './commission.entity';

@Module({
  imports: [AuthModule],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  // A etapa 7 (fluxo de caixa e DRE) consome CommissionsService.events().
  exports: [CommissionsService],
})
export class CommissionsModule {}
