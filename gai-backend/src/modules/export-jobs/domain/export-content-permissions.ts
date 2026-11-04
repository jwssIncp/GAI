import { ExportJobType } from './enums/export-job-type.enum';

export const EXPORT_CONTENT_PERMISSIONS: Record<ExportJobType, string[]> = {
  [ExportJobType.DRE_XLSX]: ['dre:read', 'dre:export'],
  [ExportJobType.FINANCE_XLSX]: [
    'finance:export',
    'receivables:read',
    'cash-flow:read',
    'payments:read',
    'expenses:read',
    'expense-installments:read',
  ],
  [ExportJobType.VALUATION_BATCHES_XLSX]: [
    'asset-valuations:read',
    'inventory-items:read',
  ],
  [ExportJobType.INVENTORY_ITEMS_XLSX]: ['inventory-items:read'],
  [ExportJobType.INVENTORY_ACCOUNTING_ITEMS_XLSX]: [
    'inventory-accounting-items:read',
  ],
  [ExportJobType.PENDING_ISSUES_XLSX]: ['inventory-pending-issues:read'],
  [ExportJobType.PAYMENTS_XLSX]: ['payments:read'],
  [ExportJobType.EXPENSES_XLSX]: ['expenses:read'],
  [ExportJobType.PROJECT_BACKUP_XLSX]: [
    'projects:read',
    'inventory-items:read',
    'inventory-accounting-items:read',
    'inventory-pending-issues:read',
    'payments:read',
    'expenses:read',
  ],
};
