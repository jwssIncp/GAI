import { AppController } from '../../src/app.controller';
import { DOCUMENT_ENTITIES } from '../../src/modules/documents/document.entity';
import { MYSQL_UTC_OPTIONS } from '../../src/common/persistence/mysql-utc-options';
import { DocumentsModule } from '../../src/modules/documents/documents.module';
import { TECHNICAL_REPORT_ENTITIES } from '../../src/modules/technical-reports/report.entity';
import { TechnicalReportsModule } from '../../src/modules/technical-reports/technical-reports.module';
import { DRE_ENTITIES } from '../../src/modules/managerial-dre/dre.entity';
import { ManagerialDreModule } from '../../src/modules/managerial-dre/managerial-dre.module';
import { RECEIVABLE_ENTITIES } from '../../src/modules/receivables/receivable.entity';
import { ReceivablesModule } from '../../src/modules/receivables/receivables.module';
import { BUDGET_ENTITIES } from '../../src/modules/budgets/budget.entity';
import { BudgetsModule } from '../../src/modules/budgets/budgets.module';
import { CONTRACT_ENTITIES } from '../../src/modules/contracts/contract.entity';
import { ContractsModule } from '../../src/modules/contracts/contracts.module';
import { ASSISTED_ENTITIES } from '../../src/modules/assisted-reconciliation/assisted.entity';
import { AssistedReconciliationModule } from '../../src/modules/assisted-reconciliation/assisted.module';
import { FIELD_ENTITIES } from '../../src/modules/field-coordination/field.entity';
import { FieldCoordinationModule } from '../../src/modules/field-coordination/field.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { Repository } from 'typeorm';
import {
  STORAGE_SIGNER,
  StorageSigner,
} from '../../src/common/storage/storage-signer.port';
import { FakeStorage } from './storage.fake';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import appConfig from '../../src/common/config/app.config';
import authConfig from '../../src/common/config/auth.config';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { SENSITIVE_LOG_REDACTION } from '../../src/common/logging/sensitive-log-redaction';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { UserStatus } from '../../src/modules/auth/domain/enums/user.enums';
import { AuthAuditLogEntity } from '../../src/modules/auth/infrastructure/persistence/auth-audit-log.entity';
import { PasswordResetTokenEntity } from '../../src/modules/auth/infrastructure/persistence/password-reset-token.entity';
import { SessionEntity } from '../../src/modules/auth/infrastructure/persistence/session.entity';
import { UserEntity } from '../../src/modules/auth/infrastructure/persistence/user.entity';
import { Argon2PasswordHasher } from '../../src/modules/auth/infrastructure/security/argon2-password-hasher';
import { CatalogAssetsModule } from '../../src/modules/catalog-assets/catalog-assets.module';
import { CatalogAssetAuditLogEntity } from '../../src/modules/catalog-assets/infrastructure/persistence/catalog-asset-audit-log.entity';
import { CatalogAssetEntity } from '../../src/modules/catalog-assets/infrastructure/persistence/catalog-asset.entity';
import { CompaniesModule } from '../../src/modules/companies/companies.module';
import { CompanyAuditLogEntity } from '../../src/modules/companies/infrastructure/persistence/company-audit-log.entity';
import { CompanyUnitAuditLogEntity } from '../../src/modules/companies/infrastructure/persistence/company-unit-audit-log.entity';
import { CompanyUnitEntity } from '../../src/modules/companies/infrastructure/persistence/company-unit.entity';
import { CompanyEntity } from '../../src/modules/companies/infrastructure/persistence/company.entity';
import { CompanyStatus } from '../../src/modules/companies/domain/enums/company-status.enum';
import { ProjectUnitAuditLogEntity } from '../../src/modules/companies/infrastructure/persistence/project-unit-audit-log.entity';
import { ProjectUnitEntity } from '../../src/modules/companies/infrastructure/persistence/project-unit.entity';
import {
  EXPENSE_ACCOUNTABILITY_ENTITIES,
  ExpenseAccountabilitiesModule,
} from '../../src/modules/expense-accountabilities/expense-accountabilities.module';
import { FieldAgentsModule } from '../../src/modules/field-agents/field-agents.module';
import { FieldAgentAuditLogEntity } from '../../src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity';
import { FieldAgentEntity } from '../../src/modules/field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from '../../src/modules/field-agents/infrastructure/persistence/project-field-agent.entity';
import { InventoryItemsModule } from '../../src/modules/inventory-items/inventory-items.module';
import {
  INVENTORY_OPERATION_ENTITIES,
  InventoryOperationsModule,
} from '../../src/modules/inventory-operations/inventory-operations.module';
import { InventoryItemAuditLogEntity } from '../../src/modules/inventory-items/infrastructure/persistence/inventory-item-audit-log.entity';
import { InventoryItemEntity } from '../../src/modules/inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryItemImagesModule } from '../../src/modules/inventory-item-images/inventory-item-images.module';
import { InventoryItemImageAuditLogEntity } from '../../src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image-audit-log.entity';
import { InventoryItemImageEntity } from '../../src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import { InventoryAccountingItemsModule } from '../../src/modules/inventory-accounting-items/inventory-accounting-items.module';
import { AccountingImportBatchEntity } from '../../src/modules/inventory-accounting-items/infrastructure/persistence/accounting-import-batch.entity';
import { InventoryAccountingItemAuditLogEntity } from '../../src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item-audit-log.entity';
import { InventoryAccountingItemEntity } from '../../src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryPendingIssuesModule } from '../../src/modules/inventory-pending-issues/inventory-pending-issues.module';
import { InventoryPendingIssueAuditLogEntity } from '../../src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue-audit-log.entity';
import { InventoryPendingIssueEntity } from '../../src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { PaymentsExpensesModule } from '../../src/modules/payments-expenses/payments-expenses.module';
import { ExpenseAttachmentEntity } from '../../src/modules/payments-expenses/infrastructure/persistence/expense-attachment.entity';
import { ExpenseEntity } from '../../src/modules/payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../../src/modules/payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { PaymentExpenseAuditLogEntity } from '../../src/modules/payments-expenses/infrastructure/persistence/payment-expense-audit-log.entity';
import { ImportSessionsModule } from '../../src/modules/import-sessions/import-sessions.module';
import { ImportFileEntity } from '../../src/modules/import-sessions/infrastructure/persistence/import-file.entity';
import { ImportPayloadEntity } from '../../src/modules/import-sessions/infrastructure/persistence/import-payload.entity';
import { ImportPayloadErrorEntity } from '../../src/modules/import-sessions/infrastructure/persistence/import-payload-error.entity';
import { ImportSessionAuditLogEntity } from '../../src/modules/import-sessions/infrastructure/persistence/import-session-audit-log.entity';
import { ImportSessionEntity } from '../../src/modules/import-sessions/infrastructure/persistence/import-session.entity';
import { ExportJobsModule } from '../../src/modules/export-jobs/export-jobs.module';
import { ExportJobAuditLogEntity } from '../../src/modules/export-jobs/infrastructure/persistence/export-job-audit-log.entity';
import { ExportJobEntity } from '../../src/modules/export-jobs/infrastructure/persistence/export-job.entity';
import { OrganizationStatus } from '../../src/modules/organizations/domain/enums/organization-status.enum';
import { OrganizationsModule } from '../../src/modules/organizations/organizations.module';
import { OrganizationAuditLogEntity } from '../../src/modules/organizations/infrastructure/persistence/organization-audit-log.entity';
import { OrganizationEntity } from '../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { ProjectsModule } from '../../src/modules/projects/projects.module';
import { ProjectDashboardModule } from '../../src/modules/project-dashboard/project-dashboard.module';
import { ProjectAuditLogEntity } from '../../src/modules/projects/infrastructure/persistence/project-audit-log.entity';
import { ProjectEntity } from '../../src/modules/projects/infrastructure/persistence/project.entity';
import { RoleType } from '../../src/modules/users/domain/enums/role-type.enum';
import { RoleAuditLogEntity } from '../../src/modules/users/infrastructure/persistence/role-audit-log.entity';
import { RolePermissionEntity } from '../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { RoleEntity } from '../../src/modules/users/infrastructure/persistence/role.entity';
import { PermissionEntity } from '../../src/modules/users/infrastructure/persistence/permission.entity';
import { UserAuditLogEntity } from '../../src/modules/users/infrastructure/persistence/user-audit-log.entity';
import { UserRoleAssignmentEntity } from '../../src/modules/users/infrastructure/persistence/user-role-assignment.entity';
import { UsersModule } from '../../src/modules/users/users.module';
import { PERMISSION_SEEDS } from '../../src/scripts/seed/permissions.seed';
import { ProjectPreparationModule } from '../../src/modules/project-preparation/project-preparation.module';
import { PREPARATION_ENTITIES } from '../../src/modules/project-preparation/preparation.entity';

export async function createTestApp(
  storage?: StorageSigner,
  options: {
    reuseDisposableDatabase?: boolean;
    includeHealthController?: boolean;
    browserDisposableDatabase?: boolean;
  } = {},
): Promise<INestApplication> {
  if (
    options.browserDisposableDatabase &&
    (process.env.GAI_TEST_MYSQL_DISPOSABLE !== '1' ||
      process.env.GAI_TEST_MYSQL_WAVE2 !== '1')
  )
    throw new Error(
      'Browser schema is only available on disposable Wave 2 MySQL',
    );
  if (
    options.reuseDisposableDatabase &&
    process.env.GAI_TEST_MYSQL_DISPOSABLE !== '1'
  )
    throw new Error('Database reuse is only available for disposable MySQL');
  // Opt-in only. Fixed loopback target and synthetic credentials deliberately
  // ignore DB_* and .env so destructive schema setup cannot reach the app DB.
  const databaseOptions: TypeOrmModuleOptions =
    process.env.GAI_TEST_MYSQL_DISPOSABLE === '1'
      ? {
          type: 'mysql',
          ...MYSQL_UTC_OPTIONS,
          host: '127.0.0.1',
          port:
            process.env.GAI_TEST_MYSQL_WAVE2 === '1'
              ? 33347
              : process.env.GAI_TEST_MYSQL_WAVE1 === '1'
                ? 33337
                : process.env.GAI_TEST_MYSQL_WAVE0 === '1'
                  ? 33327
                  : 33317,
          username: 'root',
          password: 'gai-validation-only',
          database: options.browserDisposableDatabase
            ? 'gai_navigation_disposable'
            : 'gai_validation_disposable',
          charset: 'utf8mb4',
          extra: { bigNumberStrings: false },
          dropSchema: !options.reuseDisposableDatabase,
          synchronize: false,
          migrationsRun: !options.reuseDisposableDatabase,
          migrations: [join(__dirname, '../../src/migrations/*.ts')],
          retryAttempts: 1,
        }
      : {
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          synchronize: true,
        };
  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: options.includeHealthController ? [AppController] : [],
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [appConfig, authConfig],
      }),
      LoggerModule.forRoot({
        pinoHttp: {
          autoLogging: false,
          redact: SENSITIVE_LOG_REDACTION,
        },
      }),
      TypeOrmModule.forRoot({
        ...databaseOptions,
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
          ...EXPENSE_ACCOUNTABILITY_ENTITIES,
          ...PREPARATION_ENTITIES,
          ...FIELD_ENTITIES,
          ...ASSISTED_ENTITIES,
          ...CONTRACT_ENTITIES,
          ...BUDGET_ENTITIES,
          ...RECEIVABLE_ENTITIES,
          ...DRE_ENTITIES,
          ...TECHNICAL_REPORT_ENTITIES,
          ...DOCUMENT_ENTITIES,
          ImportSessionEntity,
          ImportPayloadEntity,
          ImportPayloadErrorEntity,
          ImportFileEntity,
          ImportSessionAuditLogEntity,
          ExportJobEntity,
          ExportJobAuditLogEntity,
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
      ExpenseAccountabilitiesModule,
      ProjectPreparationModule,
      FieldCoordinationModule,
      ContractsModule,
      BudgetsModule,
      ReceivablesModule,
      ManagerialDreModule,
      TechnicalReportsModule,
      DocumentsModule,
      AssistedReconciliationModule,
      ImportSessionsModule,
      ExportJobsModule,
      CatalogAssetsModule,
      CompaniesModule,
    ],
  })
    .overrideProvider(STORAGE_SIGNER)
    .useValue(storage ?? new FakeStorage())
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

export async function loginAsAdmin(app: INestApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({
      identifier: 'platform.admin',
      password: 'Admin@123456',
    })
    .expect(200);

  return response.body.access_token as string;
}

export async function loginAsOrgAdmin(app: INestApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({
      identifier: 'org.admin',
      password: 'Admin@123456',
    })
    .expect(200);

  return response.body.access_token as string;
}

export async function loginAsOrgUser(app: INestApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({
      identifier: 'test.user',
      password: 'Test@123456',
    })
    .expect(200);

  return response.body.access_token as string;
}

export async function seedTestData(app: INestApplication): Promise<void> {
  const orgRepo = app.get<Repository<OrganizationEntity>>(
    getRepositoryToken(OrganizationEntity),
  );
  const companyRepo = app.get<Repository<CompanyEntity>>(
    getRepositoryToken(CompanyEntity),
  );
  const userRepo = app.get<Repository<UserEntity>>(
    getRepositoryToken(UserEntity),
  );
  const permissionRepo = app.get<Repository<PermissionEntity>>(
    getRepositoryToken(PermissionEntity),
  );
  const roleRepo = app.get<Repository<RoleEntity>>(
    getRepositoryToken(RoleEntity),
  );
  const rolePermRepo = app.get<Repository<RolePermissionEntity>>(
    getRepositoryToken(RolePermissionEntity),
  );
  const assignmentRepo = app.get<Repository<UserRoleAssignmentEntity>>(
    getRepositoryToken(UserRoleAssignmentEntity),
  );
  const hasher = new Argon2PasswordHasher();
  const now = new Date();

  const organization = await orgRepo.save(
    orgRepo.create({
      legalName: 'GAI Test Organization',
      tradeName: 'GAI Test',
      cnpj: '11222333000181',
      contactEmail: 'org@gai.local',
      contactPhone: '11999999999',
      status: OrganizationStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    }),
  );

  await companyRepo.save(
    companyRepo.create({
      organizationId: organization.id,
      name: 'Empresa Teste',
      corporateName: 'Empresa Teste LTDA',
      document: '11222333000181',
      status: CompanyStatus.ACTIVE,
      country: 'BR',
      metadata: null,
      createdById: null,
      updatedById: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }),
  );

  // Migrations may already register catalog entries before fixture setup.
  await permissionRepo.upsert(PERMISSION_SEEDS, ['key']);

  const permissions = await permissionRepo.find();
  const usersReadPerm = permissions.find((p) => p.key === 'users:read')!;
  const projectPermissions = permissions.filter((p) =>
    p.key.startsWith('projects:'),
  );
  const fieldAgentPermissions = permissions.filter(
    (p) =>
      p.key.startsWith('field-agents:') ||
      p.key.startsWith('project-field-agents:'),
  );
  const inventoryItemPermissions = permissions.filter((p) =>
    p.key.startsWith('inventory-items:'),
  );
  const inventoryItemImagePermissions = permissions.filter((p) =>
    p.key.startsWith('inventory-item-images:'),
  );
  const inventoryAccountingItemPermissions = permissions.filter((p) =>
    p.key.startsWith('inventory-accounting-items:'),
  );
  const inventoryPendingIssuePermissions = permissions.filter((p) =>
    p.key.startsWith('inventory-pending-issues:'),
  );
  const paymentsExpensesPermissions = permissions.filter(
    (p) => p.key.startsWith('payments:') || p.key.startsWith('expenses:'),
  );
  const importSessionPermissions = permissions.filter(
    (p) =>
      p.key.startsWith('import-sessions:') ||
      p.key.startsWith('import-payloads:') ||
      p.key.startsWith('import-errors:') ||
      p.key.startsWith('import-files:'),
  );
  const catalogAssetPermissions = permissions.filter((p) =>
    p.key.startsWith('catalog-assets:'),
  );
  const companyPermissions = permissions.filter(
    (p) =>
      p.key.startsWith('companies:') ||
      p.key.startsWith('company-units:') ||
      p.key.startsWith('project-units:'),
  );
  const exportJobPermissions = permissions.filter((p) =>
    p.key.startsWith('export-jobs:'),
  );

  const platformAdminRole =
    (await roleRepo.findOneBy({ key: 'PLATFORM_ADMIN' })) ??
    (await roleRepo.save(
      roleRepo.create({
        key: 'PLATFORM_ADMIN',
        type: RoleType.SYSTEM,
        organizationId: null,
        name: 'Platform Administrator',
        description: 'Platform Administrator',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    ));

  const orgAdminRole =
    (await roleRepo.findOneBy({ key: 'ORG_ADMIN' })) ??
    (await roleRepo.save(
      roleRepo.create({
        key: 'ORG_ADMIN',
        type: RoleType.SYSTEM,
        organizationId: null,
        name: 'Organization Administrator',
        description: 'Organization Administrator',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    ));

  const operatorRole = await roleRepo.save(
    roleRepo.create({
      key: null,
      type: RoleType.ORGANIZATION,
      organizationId: organization.id,
      name: 'Operador',
      description: 'Basic operator role',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }),
  );

  await rolePermRepo.save([
    rolePermRepo.create({
      roleId: operatorRole.id,
      permissionId: usersReadPerm.id,
    }),
    ...projectPermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
    ...fieldAgentPermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
    ...inventoryItemPermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
    ...inventoryItemImagePermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
    ...inventoryAccountingItemPermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
    ...inventoryPendingIssuePermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
    ...paymentsExpensesPermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
    ...importSessionPermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
    ...catalogAssetPermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
    ...companyPermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
    ...exportJobPermissions.map((permission) =>
      rolePermRepo.create({
        roleId: operatorRole.id,
        permissionId: permission.id,
      }),
    ),
  ]);

  const admin = await userRepo.save(
    userRepo.create({
      organizationId: null,
      login: 'platform.admin',
      email: 'admin@gai.local',
      passwordHash: await hasher.hash('Admin@123456'),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );

  const orgAdmin = await userRepo.save(
    userRepo.create({
      organizationId: organization.id,
      login: 'org.admin',
      email: 'orgadmin@gai.local',
      passwordHash: await hasher.hash('Admin@123456'),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );

  const testUser = await userRepo.save(
    userRepo.create({
      organizationId: organization.id,
      login: 'test.user',
      email: 'test@gai.local',
      passwordHash: await hasher.hash('Test@123456'),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );

  await assignmentRepo.save([
    assignmentRepo.create({
      userId: admin.id,
      roleId: platformAdminRole.id,
      isActive: true,
      assignedBy: null,
      assignedAt: now,
      revokedAt: null,
    }),
    assignmentRepo.create({
      userId: orgAdmin.id,
      roleId: orgAdminRole.id,
      isActive: true,
      assignedBy: null,
      assignedAt: now,
      revokedAt: null,
    }),
    assignmentRepo.create({
      userId: testUser.id,
      roleId: operatorRole.id,
      isActive: true,
      assignedBy: null,
      assignedAt: now,
      revokedAt: null,
    }),
  ]);
}
