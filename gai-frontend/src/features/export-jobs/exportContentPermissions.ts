import type { ExportJobType } from '@/types/api';

const reads: Record<ExportJobType, string[]> = {
  valuation_batches_xlsx: ['asset-valuations:read','inventory-items:read'],
  inventory_items_xlsx: ['inventory-items:read'],
  inventory_accounting_items_xlsx: ['inventory-accounting-items:read'],
  pending_issues_xlsx: ['inventory-pending-issues:read'],
  payments_xlsx: ['payments:read'],
  expenses_xlsx: ['expenses:read'],
  project_backup_xlsx: ['projects:read', 'inventory-items:read', 'inventory-accounting-items:read', 'inventory-pending-issues:read', 'payments:read', 'expenses:read'],
};

export function canExportContent(type: ExportJobType, hasPermission: (key: string) => boolean) {
  return reads[type]?.every(hasPermission) ?? false;
}
