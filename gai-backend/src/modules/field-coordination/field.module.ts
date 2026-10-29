import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { FIELD_ENTITIES } from './field.entity';
import { FieldService } from './field.service';
import { FieldController, FieldTemplatesController } from './field.controller';
@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    TypeOrmModule.forFeature(FIELD_ENTITIES),
  ],
  controllers: [FieldController, FieldTemplatesController],
  providers: [FieldService],
})
export class FieldCoordinationModule {}
