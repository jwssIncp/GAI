import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import { CompanyScopeService } from './application/services/company-scope.service';
import { CompaniesService } from './application/services/companies.service';
import { CompanyAuditLogEntity } from './infrastructure/persistence/company-audit-log.entity';
import { CompanyUnitAuditLogEntity } from './infrastructure/persistence/company-unit-audit-log.entity';
import { CompanyUnitEntity } from './infrastructure/persistence/company-unit.entity';
import { CompanyEntity } from './infrastructure/persistence/company.entity';
import { ProjectUnitAuditLogEntity } from './infrastructure/persistence/project-unit-audit-log.entity';
import { ProjectUnitEntity } from './infrastructure/persistence/project-unit.entity';
import { TypeOrmCompaniesRepository } from './infrastructure/persistence/typeorm-companies.repository';
import { CompaniesController } from './presentation/companies.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      CompanyUnitEntity,
      CompanyAuditLogEntity,
      CompanyUnitAuditLogEntity,
      ProjectUnitEntity,
      ProjectUnitAuditLogEntity,
      ProjectEntity,
    ]),
    AuthModule,
    OrganizationsModule,
  ],
  controllers: [CompaniesController],
  providers: [
    CompanyScopeService,
    CompaniesService,
    TypeOrmCompaniesRepository,
  ],
  exports: [CompaniesService, TypeOrmModule],
})
export class CompaniesModule {}
