import { NotFoundException } from '@nestjs/common';
import { ProjectSummaryService } from '../../../../src/modules/project-dashboard/application/services/project-summary.service';
import { ProjectStatus } from '../../../../src/modules/projects/domain/enums/project-status.enum';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';

const project = {
  id: 1,
  organizationId: 1,
  name: 'Inventario 2026',
  status: ProjectStatus.ACTIVE,
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-01-31T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
};

function makeService(projectResult: typeof project | null = project) {
  const projects = {
    findById: jest.fn().mockResolvedValue(projectResult),
  };
  const summaries = {
    getInventorySummary: jest.fn().mockResolvedValue({
      total_items: 10,
      evaluated_items: 5,
      pending_items: 5,
      divergent_items: 0,
      not_found_items: 0,
      duplicated_items: 0,
      removed_items: 0,
      inactive_items: 0,
      progress_percentage: 50,
    }),
    getImagesSummary: jest.fn().mockResolvedValue({
      total_images: 0,
      uploaded_images: 0,
      pending_upload_images: 0,
      removed_images: 0,
    }),
    getAccountingSummary: jest.fn().mockResolvedValue({
      total_accounting_items: 0,
      matched_accounting_items: 0,
      divergent_accounting_items: 0,
      not_found_accounting_items: 0,
      ignored_accounting_items: 0,
    }),
    getPendingIssuesSummary: jest.fn().mockResolvedValue({
      total_pending_issues: 0,
      open_pending_issues: 0,
      in_review_pending_issues: 0,
      resolved_pending_issues: 0,
      ignored_pending_issues: 0,
      cancelled_pending_issues: 0,
      critical_pending_issues: 0,
      high_pending_issues: 0,
      medium_pending_issues: 0,
      low_pending_issues: 0,
    }),
    getFieldAgentsSummary: jest.fn().mockResolvedValue({
      total_field_agents: 0,
      active_field_agents: 0,
      inactive_field_agents: 0,
      finished_field_agents: 0,
    }),
    getFinancialSummary: jest.fn().mockResolvedValue({
      total_payments: 1,
      pending_payments: 0,
      approved_payments: 0,
      paid_payments: 1,
      cancelled_payments: 0,
      total_payment_amount: '100.00',
      total_expenses: 1,
      pending_expenses: 0,
      approved_expenses: 0,
      paid_expenses: 1,
      rejected_expenses: 0,
      cancelled_expenses: 0,
      total_expense_amount: '25.00',
      financial_total_amount: '125.00',
    }),
    getImportsSummary: jest.fn().mockResolvedValue({
      total_import_sessions: 0,
      open_import_sessions: 0,
      processing_import_sessions: 0,
      finished_import_sessions: 0,
      failed_import_sessions: 0,
      cancelled_import_sessions: 0,
      expired_import_sessions: 0,
    }),
    getExportsSummary: jest.fn().mockResolvedValue({
      total_export_jobs: 0,
      pending_export_jobs: 0,
      processing_export_jobs: 0,
      finished_export_jobs: 0,
      failed_export_jobs: 0,
      cancelled_export_jobs: 0,
      expired_export_jobs: 0,
    }),
    getRecentActivitySummary: jest.fn().mockResolvedValue({
      last_inventory_item_created_at: null,
      last_inventory_item_updated_at: null,
      last_import_finished_at: null,
      last_export_finished_at: null,
      last_pending_issue_created_at: null,
      last_payment_updated_at: null,
    }),
  };
  const scope = {
    assertCanAccessProject: jest.fn(),
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
  const service = new ProjectSummaryService(
    projects as never,
    summaries,
    scope as never,
    logger as never,
  );
  return { service, projects, summaries, scope };
}

const actor = {
  id: 1,
  systemRoles: [UserRole.ORG_ADMIN],
  organizationId: 1,
};

describe('ProjectSummaryService', () => {
  it('returns basic summary without optional blocks by default', async () => {
    const { service, summaries, scope } = makeService();

    const result = await service.getSummary(1, {}, actor);

    expect(result.project.organization_id).toBe(1);
    expect(result.financial).toBeUndefined();
    expect(result.imports).toBeUndefined();
    expect(result.exports).toBeUndefined();
    expect(result.recent_activity).toBeUndefined();
    expect(summaries.getFinancialSummary).not.toHaveBeenCalled();
    expect(scope.assertCanAccessProject).toHaveBeenCalledWith(actor, 1);
  });

  it('includes optional blocks when requested', async () => {
    const { service, summaries } = makeService();

    const result = await service.getSummary(
      1,
      {
        include_financial: true,
        include_imports: true,
        include_exports: true,
        include_recent_activity: true,
      },
      actor,
    );

    expect(result.financial?.financial_total_amount).toBe('125.00');
    expect(result.imports?.total_import_sessions).toBe(0);
    expect(result.exports?.total_export_jobs).toBe(0);
    expect(result.recent_activity).toBeDefined();
    expect(summaries.getFinancialSummary).toHaveBeenCalledWith(1);
  });

  it('returns not found when project does not exist', async () => {
    const { service } = makeService(null);

    await expect(service.getSummary(999, {}, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
