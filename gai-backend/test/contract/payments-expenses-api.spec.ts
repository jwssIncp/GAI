import { readFileSync } from 'fs';
import { join } from 'path';

describe('payments-expenses-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/011-payments-expenses/contracts/payments-expenses-api.yaml',
    ),
    'utf8',
  );

  it('defines payment, expense and attachment endpoints', () => {
    for (const path of [
      '/projects/{projectId}/payments:',
      '/projects/{projectId}/payments/summary:',
      '/projects/{projectId}/payments/{id}:',
      '/projects/{projectId}/payments/{id}/approve:',
      '/projects/{projectId}/payments/{id}/mark-as-paid:',
      '/projects/{projectId}/expenses:',
      '/projects/{projectId}/expenses/{id}:',
      '/projects/{projectId}/expenses/{id}/reject:',
      '/projects/{projectId}/expenses/{expenseId}/attachments/upload-url:',
      '/projects/{projectId}/expenses/{expenseId}/attachments/{attachmentId}/download-url:',
    ])
      expect(content).toContain(path);
  });

  it('documents statuses, fields and permissions', () => {
    for (const item of [
      'pending',
      'approved',
      'paid',
      'cancelled',
      'rejected',
      'daily_rate',
      'daily_total',
      'final_amount',
      'field_agent_id',
      'expenses:upload-attachment',
      'expenses:download-attachment',
      'payments:mark-as-paid',
      'payments:export',
    ])
      expect(content).toContain(item);
  });
});
