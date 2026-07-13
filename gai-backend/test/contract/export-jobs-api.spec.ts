import { readFileSync } from 'fs';
import { join } from 'path';

describe('export-jobs-api contract', () => {
  const content = readFileSync(
    join(process.cwd(), 'specs/015-export-jobs/contracts/export-jobs-api.yaml'),
    'utf8',
  );

  it('defines the complete export job lifecycle endpoints', () => {
    for (const path of [
      '/projects/{projectId}/export-jobs:',
      '/projects/{projectId}/export-jobs/{jobId}:',
      '/projects/{projectId}/export-jobs/{jobId}/download-url:',
      '/projects/{projectId}/export-jobs/{jobId}/download:',
      '/projects/{projectId}/export-jobs/{jobId}/cancel:',
      '/projects/{projectId}/export-jobs/{jobId}/retry:',
    ]) {
      expect(content).toContain(path);
    }
  });

  it('limits types to supported XLSX exports and defines all statuses', () => {
    for (const item of [
      'inventory_items_xlsx',
      'inventory_accounting_items_xlsx',
      'pending_issues_xlsx',
      'payments_xlsx',
      'expenses_xlsx',
      'project_backup_xlsx',
      'pending, processing, finished, failed, cancelled, expired',
    ]) {
      expect(content).toContain(item);
    }
    expect(content).not.toContain('_zip');
    expect(content).not.toContain('_csv');
  });

  it('documents RBAC and keeps persistence internals out of public DTOs', () => {
    for (const permission of [
      'export-jobs:create',
      'export-jobs:read',
      'export-jobs:download',
      'export-jobs:cancel',
      'export-jobs:retry',
    ]) {
      expect(content).toContain(permission);
    }
    expect(content).not.toContain('file_content:');
    expect(content).not.toContain('bucket:');
    expect(content).not.toContain('storage_path:');
  });
});
