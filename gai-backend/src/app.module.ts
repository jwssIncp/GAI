import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import appConfig from './common/config/app.config';
import authConfig from './common/config/auth.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { SENSITIVE_LOG_REDACTION } from './common/logging/sensitive-log-redaction';
import { AuthModule } from './modules/auth/auth.module';
import { AuthAuditLogEntity } from './modules/auth/infrastructure/persistence/auth-audit-log.entity';
import { PasswordResetTokenEntity } from './modules/auth/infrastructure/persistence/password-reset-token.entity';
import { SessionEntity } from './modules/auth/infrastructure/persistence/session.entity';
import { UserEntity } from './modules/auth/infrastructure/persistence/user.entity';
import { CatalogAssetsModule } from './modules/catalog-assets/catalog-assets.module';
import { CatalogAssetAuditLogEntity } from './modules/catalog-assets/infrastructure/persistence/catalog-asset-audit-log.entity';
import { CatalogAssetEntity } from './modules/catalog-assets/infrastructure/persistence/catalog-asset.entity';
import { CompaniesModule } from './modules/companies/companies.module';
import { CompanyAuditLogEntity } from './modules/companies/infrastructure/persistence/company-audit-log.entity';
import { CompanyUnitAuditLogEntity } from './modules/companies/infrastructure/persistence/company-unit-audit-log.entity';
import { CompanyUnitEntity } from './modules/companies/infrastructure/persistence/company-unit.entity';
import { CompanyEntity } from './modules/companies/infrastructure/persistence/company.entity';
import { ProjectUnitAuditLogEntity } from './modules/companies/infrastructure/persistence/project-unit-audit-log.entity';
import { ProjectUnitEntity } from './modules/companies/infrastructure/persistence/project-unit.entity';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { OrganizationAuditLogEntity } from './modules/organizations/infrastructure/persistence/organization-audit-log.entity';
import { OrganizationEntity } from './modules/organizations/infrastructure/persistence/organization.entity';
import { FieldAgentsModule } from './modules/field-agents/field-agents.module';
import { FieldAgentAuditLogEntity } from './modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity';
import { FieldAgentEntity } from './modules/field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from './modules/field-agents/infrastructure/persistence/project-field-agent.entity';
import { InventoryItemsModule } from './modules/inventory-items/inventory-items.module';
import {
  INVENTORY_OPERATION_ENTITIES,
  InventoryOperationsModule,
} from './modules/inventory-operations/inventory-operations.module';
import { InventoryItemAuditLogEntity } from './modules/inventory-items/infrastructure/persistence/inventory-item-audit-log.entity';
import { InventoryItemEntity } from './modules/inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryItemImagesModule } from './modules/inventory-item-images/inventory-item-images.module';
import { InventoryItemImageAuditLogEntity } from './modules/inventory-item-images/infrastructure/persistence/inventory-item-image-audit-log.entity';
import { InventoryItemImageEntity } from './modules/inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import { InventoryAccountingItemsModule } from './modules/inventory-accounting-items/inventory-accounting-items.module';
import { AccountingImportBatchEntity } from './modules/inventory-accounting-items/infrastructure/persistence/accounting-import-batch.entity';
import { InventoryAccountingItemAuditLogEntity } from './modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item-audit-log.entity';
import { InventoryAccountingItemEntity } from './modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryPendingIssuesModule } from './modules/inventory-pending-issues/inventory-pending-issues.module';
import { InventoryPendingIssueAuditLogEntity } from './modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue-audit-log.entity';
import { InventoryPendingIssueEntity } from './modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { PaymentsExpensesModule } from './modules/payments-expenses/payments-expenses.module';
import { ExpenseAttachmentEntity } from './modules/payments-expenses/infrastructure/persistence/expense-attachment.entity';
import { ExpenseEntity } from './modules/payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from './modules/payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { PaymentExpenseAuditLogEntity } from './modules/payments-expenses/infrastructure/persistence/payment-expense-audit-log.entity';
import { ImportSessionsModule } from './modules/import-sessions/import-sessions.module';
import { ImportFileEntity } from './modules/import-sessions/infrastructure/persistence/import-file.entity';
import { ImportPayloadEntity } from './modules/import-sessions/infrastructure/persistence/import-payload.entity';
import { ImportPayloadErrorEntity } from './modules/import-sessions/infrastructure/persistence/import-payload-error.entity';
import { ImportSessionAuditLogEntity } from './modules/import-sessions/infrastructure/persistence/import-session-audit-log.entity';
import { ImportSessionEntity } from './modules/import-sessions/infrastructure/persistence/import-session.entity';
import { ExportJobsModule } from './modules/export-jobs/export-jobs.module';
import {
  EXPENSE_ACCOUNTABILITY_ENTITIES,
  ExpenseAccountabilitiesModule,
} from './modules/expense-accountabilities/expense-accountabilities.module';
import { ExportJobAuditLogEntity } from './modules/export-jobs/infrastructure/persistence/export-job-audit-log.entity';
import { ExportJobEntity } from './modules/export-jobs/infrastructure/persistence/export-job.entity';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProjectDashboardModule } from './modules/project-dashboard/project-dashboard.module';
import { ProjectAuditLogEntity } from './modules/projects/infrastructure/persistence/project-audit-log.entity';
import { ProjectEntity } from './modules/projects/infrastructure/persistence/project.entity';
import { RoleAuditLogEntity } from './modules/users/infrastructure/persistence/role-audit-log.entity';
import { RolePermissionEntity } from './modules/users/infrastructure/persistence/role-permission.entity';
import { RoleEntity } from './modules/users/infrastructure/persistence/role.entity';
import { PermissionEntity } from './modules/users/infrastructure/persistence/permission.entity';
import { UserAuditLogEntity } from './modules/users/infrastructure/persistence/user-audit-log.entity';
import { UserRoleAssignmentEntity } from './modules/users/infrastructure/persistence/user-role-assignment.entity';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        redact: SENSITIVE_LOG_REDACTION,
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: true,
        customProps: () => ({ service: 'gai-backend' }),
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '3306', 10),
        username: process.env.DB_USERNAME ?? 'gai',
        password: process.env.DB_PASSWORD ?? 'gai',
        database: process.env.DB_DATABASE ?? 'gai',
        charset: 'utf8mb4',
        extra: {
          bigNumberStrings: false,
        },
        entities: [
          OrganizationEntity,
          OrganizationAuditLogEntity,
          UserEntity,
          SessionEntity,
          PasswordResetTokenEntity,
          AuthAuditLogEntity,
          ProjectEntity,
          ProjectAuditLogEntity,
          FieldAgentEntity,
          ProjectFieldAgentEntity,
          FieldAgentAuditLogEntity,
          InventoryItemEntity,
          InventoryItemAuditLogEntity,
          ...INVENTORY_OPERATION_ENTITIES,
          InventoryItemImageEntity,
          InventoryItemImageAuditLogEntity,
          InventoryAccountingItemEntity,
          InventoryAccountingItemAuditLogEntity,
          AccountingImportBatchEntity,
          InventoryPendingIssueEntity,
          InventoryPendingIssueAuditLogEntity,
          FieldAgentPaymentEntity,
          ExpenseEntity,
          ExpenseAttachmentEntity,
          PaymentExpenseAuditLogEntity,
          ImportSessionEntity,
          ImportPayloadEntity,
          ImportPayloadErrorEntity,
          ImportFileEntity,
          ImportSessionAuditLogEntity,
          ExportJobEntity,
          ExportJobAuditLogEntity,
          ...EXPENSE_ACCOUNTABILITY_ENTITIES,
          CatalogAssetEntity,
          CatalogAssetAuditLogEntity,
          CompanyEntity,
          CompanyUnitEntity,
          CompanyAuditLogEntity,
          CompanyUnitAuditLogEntity,
          ProjectUnitEntity,
          ProjectUnitAuditLogEntity,
          PermissionEntity,
          RoleEntity,
          RolePermissionEntity,
          UserAuditLogEntity,
          RoleAuditLogEntity,
          UserRoleAssignmentEntity,
        ],
        synchronize: process.env.NODE_ENV === 'test',
        logging: process.env.DB_LOGGING === 'true',
      }),
    }),
    AuthModule,
    OrganizationsModule,
    UsersModule,
    ProjectsModule,
    ProjectDashboardModule,
    FieldAgentsModule,
    InventoryItemsModule,
    InventoryOperationsModule,
    InventoryItemImagesModule,
    InventoryAccountingItemsModule,
    InventoryPendingIssuesModule,
    PaymentsExpensesModule,
    ImportSessionsModule,
    ExportJobsModule,
    ExpenseAccountabilitiesModule,
    CatalogAssetsModule,
    CompaniesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
