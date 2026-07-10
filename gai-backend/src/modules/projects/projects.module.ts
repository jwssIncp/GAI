import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CompaniesModule } from '../companies/companies.module';
import { CreateProjectUseCase } from './application/use-cases/create-project.use-case';
import { GetProjectUseCase } from './application/use-cases/get-project.use-case';
import { ListProjectsUseCase } from './application/use-cases/list-projects.use-case';
import { UpdateProjectStatusUseCase } from './application/use-cases/update-project-status.use-case';
import { UpdateProjectUseCase } from './application/use-cases/update-project.use-case';
import { ProjectScopeService } from './application/services/project-scope.service';
import { PROJECT_REPOSITORY } from './domain/ports/project.repository.port';
import { ProjectAuditLogEntity } from './infrastructure/persistence/project-audit-log.entity';
import { ProjectEntity } from './infrastructure/persistence/project.entity';
import { TypeOrmProjectRepository } from './infrastructure/persistence/typeorm-project.repository';
import { ProjectsController } from './presentation/projects.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectEntity, ProjectAuditLogEntity]),
    AuthModule,
    OrganizationsModule,
    CompaniesModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectScopeService,
    CreateProjectUseCase,
    ListProjectsUseCase,
    GetProjectUseCase,
    UpdateProjectUseCase,
    UpdateProjectStatusUseCase,
    {
      provide: PROJECT_REPOSITORY,
      useClass: TypeOrmProjectRepository,
    },
  ],
  exports: [PROJECT_REPOSITORY, ProjectScopeService, TypeOrmModule],
})
export class ProjectsModule {}
