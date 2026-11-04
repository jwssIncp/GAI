import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { PREPARATION_ENTITIES } from './preparation.entity';
import { PreparationRepository } from './preparation.repository';
import { PreparationService } from './preparation.service';
import {
  PreparationTemplatesController,
  ProjectPreparationController,
} from './preparation.controller';
@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    TypeOrmModule.forFeature(PREPARATION_ENTITIES),
  ],
  controllers: [PreparationTemplatesController, ProjectPreparationController],
  providers: [PreparationRepository, PreparationService],
})
export class ProjectPreparationModule {}
