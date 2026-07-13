import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { ProjectUnitAuditLogEntity } from '../../src/modules/companies/infrastructure/persistence/project-unit-audit-log.entity';
import { ProjectUnitEntity } from '../../src/modules/companies/infrastructure/persistence/project-unit.entity';
import { FieldAgentsModule } from '../../src/modules/field-agents/field-agents.module';
import { FieldAgentAuditLogEntity } from '../../src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity';
import { FieldAgentEntity } from '../../src/modules/field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from '../../src/modules/field-agents/infrastructure/persistence/project-field-agent.entity';
import { InventoryItemsModule } from '../../src/modules/inventory-items/inventory-items.module';
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

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
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
        type: 'sqlite',
        database: ':memory:',
        dropSchema: true,
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
        synchronize: true,
      }),
      AuthModule,
      OrganizationsModule,
      UsersModule,
      ProjectsModule,
      ProjectDashboardModule,
      FieldAgentsModule,
      InventoryItemsModule,
      InventoryItemImagesModule,
      InventoryAccountingItemsModule,
      InventoryPendingIssuesModule,
      PaymentsExpensesModule,
      ImportSessionsModule,
      ExportJobsModule,
      CatalogAssetsModule,
      CompaniesModule,
    ],
  }).compile();

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
  const orgRepo = app.get(getRepositoryToken(OrganizationEntity));
  const companyRepo = app.get(getRepositoryToken(CompanyEntity));
  const userRepo = app.get(getRepositoryToken(UserEntity));
  const permissionRepo = app.get(getRepositoryToken(PermissionEntity));
  const roleRepo = app.get(getRepositoryToken(RoleEntity));
  const rolePermRepo = app.get(getRepositoryToken(RolePermissionEntity));
  const assignmentRepo = app.get(getRepositoryToken(UserRoleAssignmentEntity));
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
      status: 'active',
      country: 'BR',
      metadata: null,
      createdById: null,
      updatedById: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }),
  );

  for (const seed of PERMISSION_SEEDS) {
    await permissionRepo.save(permissionRepo.create(seed));
  }

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

  const platformAdminRole = await roleRepo.save(
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
  );

  const orgAdminRole = await roleRepo.save(
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
  );

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
