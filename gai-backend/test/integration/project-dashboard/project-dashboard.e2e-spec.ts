import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { ProjectFieldAgentStatus } from '../../../src/modules/field-agents/domain/enums/project-field-agent-status.enum';
import { ProjectFieldAgentEntity } from '../../../src/modules/field-agents/infrastructure/persistence/project-field-agent.entity';
import { ImportSessionStatus } from '../../../src/modules/import-sessions/domain/enums/import-session-status.enum';
import { ImportSessionSource } from '../../../src/modules/import-sessions/domain/enums/import-session-source.enum';
import { ImportSessionType } from '../../../src/modules/import-sessions/domain/enums/import-session-type.enum';
import { ImportSessionEntity } from '../../../src/modules/import-sessions/infrastructure/persistence/import-session.entity';
import { InventoryAccountingItemStatus } from '../../../src/modules/inventory-accounting-items/domain/enums/inventory-accounting-item-status.enum';
import { InventoryAccountingItemEntity } from '../../../src/modules/inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryItemImageStatus } from '../../../src/modules/inventory-item-images/domain/enums/inventory-item-image-status.enum';
import { InventoryItemImageEntity } from '../../../src/modules/inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import { InventoryItemStatus } from '../../../src/modules/inventory-items/domain/enums/inventory-item-status.enum';
import { InventoryItemEntity } from '../../../src/modules/inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryPendingIssueSeverity } from '../../../src/modules/inventory-pending-issues/domain/enums/inventory-pending-issue-severity.enum';
import { InventoryPendingIssueStatus } from '../../../src/modules/inventory-pending-issues/domain/enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueType } from '../../../src/modules/inventory-pending-issues/domain/enums/inventory-pending-issue-type.enum';
import { InventoryPendingIssueEntity } from '../../../src/modules/inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { ExpenseStatus } from '../../../src/modules/payments-expenses/domain/enums/expense-status.enum';
import { PaymentStatus } from '../../../src/modules/payments-expenses/domain/enums/payment-status.enum';
import { ExpenseEntity } from '../../../src/modules/payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../../../src/modules/payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { ProjectStatus } from '../../../src/modules/projects/domain/enums/project-status.enum';
import { ProjectEntity } from '../../../src/modules/projects/infrastructure/persistence/project.entity';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

interface ProjectDashboardResponseBody {
  project: { id: number };
  inventory: {
    total_items: number;
    evaluated_items: number;
    progress_percentage: number;
    removed_items: number;
  };
  images: { uploaded_images: number };
  accounting: { matched_accounting_items: number };
  pending_issues: {
    open_pending_issues: number;
    ignored_pending_issues: number;
  };
  field_agents: { active_field_agents: number };
  financial: {
    total_payment_amount: string;
    total_expense_amount: string;
    financial_total_amount: string;
  };
  imports: { finished_import_sessions: number };
  exports: { total_export_jobs: number };
  recent_activity: { last_inventory_item_created_at: string | null };
}

describe('Project Dashboard (e2e)', () => {
  let app: INestApplication;
  let orgAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    orgAdminToken = await loginAsOrgAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns aggregated project summary with optional blocks', async () => {
    const projectId = await seedDashboardProject(app);

    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${projectId}/summary?include_financial=true&include_imports=true&include_exports=true&include_recent_activity=true`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ProjectDashboardResponseBody;
        expect(body.project.id).toBe(projectId);
        expect(body.inventory.total_items).toBe(4);
        expect(body.inventory.evaluated_items).toBe(2);
        expect(body.inventory.progress_percentage).toBe(50);
        expect(body.inventory.removed_items).toBe(1);
        expect(body.images.uploaded_images).toBe(1);
        expect(body.accounting.matched_accounting_items).toBe(1);
        expect(body.pending_issues.open_pending_issues).toBe(1);
        expect(body.pending_issues.ignored_pending_issues).toBe(1);
        expect(body.field_agents.active_field_agents).toBe(1);
        expect(body.financial.total_payment_amount).toBe('100.00');
        expect(body.financial.total_expense_amount).toBe('25.00');
        expect(body.financial.financial_total_amount).toBe('125.00');
        expect(body.imports.finished_import_sessions).toBe(1);
        expect(body.exports.total_export_jobs).toBe(0);
        expect(body.recent_activity.last_inventory_item_created_at).toEqual(
          expect.any(String),
        );
      });

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/dashboard`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);
  });

  it('denies access to a project from another organization', async () => {
    const projectRepo = app.get<Repository<ProjectEntity>>(
      getRepositoryToken(ProjectEntity),
    );
    const orgRepo = app.get<Repository<OrganizationEntity>>(
      getRepositoryToken(OrganizationEntity),
    );
    const otherOrg = await orgRepo.save(
      orgRepo.create({
        legalName: 'Other Org',
        tradeName: 'Other',
        cnpj: '99888777000166',
        contactEmail: 'other@gai.local',
        contactPhone: '11888888888',
        status: OrganizationStatus.ACTIVE,
      }),
    );
    const project = await projectRepo.save(
      projectRepo.create({
        organizationId: otherOrg.id,
        name: 'Other Project',
        status: ProjectStatus.ACTIVE,
      }),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/summary`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(403);
  });
});

async function seedDashboardProject(app: INestApplication): Promise<number> {
  const projectRepo = app.get<Repository<ProjectEntity>>(
    getRepositoryToken(ProjectEntity),
  );
  const itemRepo = app.get<Repository<InventoryItemEntity>>(
    getRepositoryToken(InventoryItemEntity),
  );
  const imageRepo = app.get<Repository<InventoryItemImageEntity>>(
    getRepositoryToken(InventoryItemImageEntity),
  );
  const accountingRepo = app.get<Repository<InventoryAccountingItemEntity>>(
    getRepositoryToken(InventoryAccountingItemEntity),
  );
  const issueRepo = app.get<Repository<InventoryPendingIssueEntity>>(
    getRepositoryToken(InventoryPendingIssueEntity),
  );
  const assignmentRepo = app.get<Repository<ProjectFieldAgentEntity>>(
    getRepositoryToken(ProjectFieldAgentEntity),
  );
  const paymentRepo = app.get<Repository<FieldAgentPaymentEntity>>(
    getRepositoryToken(FieldAgentPaymentEntity),
  );
  const expenseRepo = app.get<Repository<ExpenseEntity>>(
    getRepositoryToken(ExpenseEntity),
  );
  const importRepo = app.get<Repository<ImportSessionEntity>>(
    getRepositoryToken(ImportSessionEntity),
  );

  const project = await projectRepo.save(
    projectRepo.create({
      organizationId: 1,
      name: 'Dashboard Project',
      status: ProjectStatus.ACTIVE,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T00:00:00.000Z'),
    }),
  );

  const items = await itemRepo.save([
    itemRepo.create({
      organizationId: 1,
      projectId: project.id,
      description: 'Evaluated A',
      status: InventoryItemStatus.EVALUATED,
    }),
    itemRepo.create({
      organizationId: 1,
      projectId: project.id,
      description: 'Evaluated B',
      status: InventoryItemStatus.EVALUATED,
    }),
    itemRepo.create({
      organizationId: 1,
      projectId: project.id,
      description: 'Pending',
      status: InventoryItemStatus.PENDING,
    }),
    itemRepo.create({
      organizationId: 1,
      projectId: project.id,
      description: 'Divergent',
      status: InventoryItemStatus.DIVERGENT,
    }),
    itemRepo.create({
      organizationId: 1,
      projectId: project.id,
      description: 'Removed',
      status: InventoryItemStatus.REMOVED,
    }),
  ]);

  await imageRepo.save([
    imageRepo.create({
      organizationId: 1,
      inventoryItemId: items[0].id,
      storageProvider: 's3',
      bucket: 'private',
      path: 'internal/path.jpg',
      originalName: 'foto.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      status: InventoryItemImageStatus.UPLOADED,
    }),
    imageRepo.create({
      organizationId: 1,
      inventoryItemId: items[1].id,
      storageProvider: 's3',
      bucket: 'private',
      path: 'internal/path2.jpg',
      originalName: 'foto2.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      status: InventoryItemImageStatus.PENDING_UPLOAD,
    }),
  ]);

  await accountingRepo.save([
    accountingRepo.create({
      organizationId: 1,
      projectId: project.id,
      plate: 'ABC1',
      status: InventoryAccountingItemStatus.MATCHED,
    }),
    accountingRepo.create({
      organizationId: 1,
      projectId: project.id,
      plate: 'ABC2',
      status: InventoryAccountingItemStatus.DIVERGENT,
    }),
  ]);

  await issueRepo.save([
    issueRepo.create({
      organizationId: 1,
      projectId: project.id,
      type: InventoryPendingIssueType.PLATE_DIVERGENCE,
      status: InventoryPendingIssueStatus.OPEN,
      severity: InventoryPendingIssueSeverity.CRITICAL,
      title: 'Plate mismatch',
    }),
    issueRepo.create({
      organizationId: 1,
      projectId: project.id,
      type: InventoryPendingIssueType.ACCOUNTING_ITEM_NOT_FOUND,
      status: InventoryPendingIssueStatus.IGNORED,
      severity: InventoryPendingIssueSeverity.LOW,
      title: 'Ignored',
    }),
  ]);

  await assignmentRepo.save(
    assignmentRepo.create({
      organizationId: 1,
      projectId: project.id,
      fieldAgentId: 1,
      status: ProjectFieldAgentStatus.ACTIVE,
    }),
  );

  await paymentRepo.save([
    paymentRepo.create({
      organizationId: 1,
      projectId: project.id,
      fieldAgentId: 1,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-01T00:00:00.000Z'),
      days: 1,
      dailyRate: '100.00',
      dailyTotal: '100.00',
      additionalAmount: '0.00',
      discountAmount: '0.00',
      finalAmount: '100.00',
      status: PaymentStatus.PAID,
    }),
    paymentRepo.create({
      organizationId: 1,
      projectId: project.id,
      fieldAgentId: 1,
      startDate: new Date('2026-01-02T00:00:00.000Z'),
      endDate: new Date('2026-01-02T00:00:00.000Z'),
      days: 1,
      dailyRate: '50.00',
      dailyTotal: '50.00',
      additionalAmount: '0.00',
      discountAmount: '0.00',
      finalAmount: '50.00',
      status: PaymentStatus.CANCELLED,
    }),
  ]);

  await expenseRepo.save([
    expenseRepo.create({
      organizationId: 1,
      projectId: project.id,
      description: 'Taxi',
      expenseDate: new Date('2026-01-03T00:00:00.000Z'),
      amount: '25.00',
      status: ExpenseStatus.PAID,
    }),
    expenseRepo.create({
      organizationId: 1,
      projectId: project.id,
      description: 'Rejected',
      expenseDate: new Date('2026-01-04T00:00:00.000Z'),
      amount: '99.00',
      status: ExpenseStatus.REJECTED,
    }),
  ]);

  await importRepo.save(
    importRepo.create({
      organizationId: 1,
      projectId: project.id,
      type: ImportSessionType.INVENTORY_ITEMS_IMPORT,
      source: ImportSessionSource.WEB_ADMIN,
      status: ImportSessionStatus.FINISHED,
      sessionUuid: `summary-${project.id}`,
      finishedAt: new Date('2026-01-05T00:00:00.000Z'),
    }),
  );

  return project.id;
}
