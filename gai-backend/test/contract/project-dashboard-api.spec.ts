import { readFileSync } from 'fs';
import { join } from 'path';

describe('project-dashboard-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/013-project-dashboard/contracts/project-dashboard-api.yaml',
    ),
    'utf8',
  );

  it('defines summary and dashboard endpoints', () => {
    expect(content).toContain('/projects/{projectId}/summary:');
    expect(content).toContain('/projects/{projectId}/dashboard:');
    expect(content).toContain('projects:read');
  });

  it('documents optional include query params and response blocks', () => {
    for (const item of [
      'include_financial',
      'include_imports',
      'include_exports',
      'include_recent_activity',
      'ProjectFinancialSummary',
      'ProjectImportsSummary',
      'ProjectExportsSummary',
      'ProjectRecentActivitySummary',
    ]) {
      expect(content).toContain(item);
    }
  });

  it('uses snake_case dashboard fields', () => {
    for (const field of [
      'progress_percentage',
      'total_payment_amount',
      'financial_total_amount',
      'open_pending_issues',
      'last_inventory_item_created_at',
    ]) {
      expect(content).toContain(field);
    }
  });
});
