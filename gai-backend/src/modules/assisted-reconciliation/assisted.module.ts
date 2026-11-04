import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { InventoryOperationsModule } from '../inventory-operations/inventory-operations.module';
import { ASSISTED_ENTITIES } from './assisted.entity';
import { AssistedController } from './assisted.controller';
import { AssistedService } from './assisted.service';
@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    InventoryOperationsModule,
    TypeOrmModule.forFeature(ASSISTED_ENTITIES),
  ],
  providers: [AssistedService],
  controllers: [AssistedController],
})
export class AssistedReconciliationModule {}
