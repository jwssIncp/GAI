import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { FieldAgentScopeService } from './application/services/field-agent-scope.service';
import { AssignProjectFieldAgentUseCase } from './application/use-cases/assign-project-field-agent.use-case';
import { CreateFieldAgentUseCase } from './application/use-cases/create-field-agent.use-case';
import { DeleteFieldAgentUseCase } from './application/use-cases/delete-field-agent.use-case';
import { GetFieldAgentUseCase } from './application/use-cases/get-field-agent.use-case';
import { ListFieldAgentsUseCase } from './application/use-cases/list-field-agents.use-case';
import { ListProjectFieldAgentsUseCase } from './application/use-cases/list-project-field-agents.use-case';
import { RemoveProjectFieldAgentUseCase } from './application/use-cases/remove-project-field-agent.use-case';
import { UpdateFieldAgentStatusUseCase } from './application/use-cases/update-field-agent-status.use-case';
import { UpdateFieldAgentUseCase } from './application/use-cases/update-field-agent.use-case';
import { UpdateProjectFieldAgentUseCase } from './application/use-cases/update-project-field-agent.use-case';
import { FIELD_AGENT_REPOSITORY } from './domain/ports/field-agent.repository.port';
import { FieldAgentAuditLogEntity } from './infrastructure/persistence/field-agent-audit-log.entity';
import { FieldAgentEntity } from './infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from './infrastructure/persistence/project-field-agent.entity';
import { TypeOrmFieldAgentRepository } from './infrastructure/persistence/typeorm-field-agent.repository';
import { FieldAgentsController } from './presentation/field-agents.controller';
import { ProjectFieldAgentsController } from './presentation/project-field-agents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FieldAgentEntity,
      ProjectFieldAgentEntity,
      FieldAgentAuditLogEntity,
      UserEntity,
    ]),
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
  ],
  controllers: [FieldAgentsController, ProjectFieldAgentsController],
  providers: [
    FieldAgentScopeService,
    CreateFieldAgentUseCase,
    DeleteFieldAgentUseCase,
    ListFieldAgentsUseCase,
    GetFieldAgentUseCase,
    UpdateFieldAgentUseCase,
    UpdateFieldAgentStatusUseCase,
    AssignProjectFieldAgentUseCase,
    ListProjectFieldAgentsUseCase,
    UpdateProjectFieldAgentUseCase,
    RemoveProjectFieldAgentUseCase,
    {
      provide: FIELD_AGENT_REPOSITORY,
      useClass: TypeOrmFieldAgentRepository,
    },
  ],
  exports: [FIELD_AGENT_REPOSITORY, TypeOrmModule],
})
export class FieldAgentsModule {}
