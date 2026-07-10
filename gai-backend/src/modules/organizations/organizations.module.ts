import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ActivateOrganizationUseCase } from './application/use-cases/activate-organization.use-case';
import { CreateOrganizationUseCase } from './application/use-cases/create-organization.use-case';
import { DeactivateOrganizationUseCase } from './application/use-cases/deactivate-organization.use-case';
import { GetOrganizationUseCase } from './application/use-cases/get-organization.use-case';
import { ListOrganizationsUseCase } from './application/use-cases/list-organizations.use-case';
import { UpdateOrganizationUseCase } from './application/use-cases/update-organization.use-case';
import { ORGANIZATION_REPOSITORY } from './domain/ports/organization.repository.port';
import { OrganizationAuditLogEntity } from './infrastructure/persistence/organization-audit-log.entity';
import { OrganizationEntity } from './infrastructure/persistence/organization.entity';
import { TypeOrmOrganizationRepository } from './infrastructure/persistence/typeorm-organization.repository';
import { OrganizationsController } from './presentation/organizations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationEntity, OrganizationAuditLogEntity]),
    AuthModule,
  ],
  controllers: [OrganizationsController],
  providers: [
    CreateOrganizationUseCase,
    ListOrganizationsUseCase,
    GetOrganizationUseCase,
    UpdateOrganizationUseCase,
    DeactivateOrganizationUseCase,
    ActivateOrganizationUseCase,
    {
      provide: ORGANIZATION_REPOSITORY,
      useClass: TypeOrmOrganizationRepository,
    },
  ],
  exports: [ORGANIZATION_REPOSITORY, TypeOrmModule],
})
export class OrganizationsModule {}
