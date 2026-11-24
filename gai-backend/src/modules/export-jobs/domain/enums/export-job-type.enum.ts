export enum ExportJobType {
  DRE_XLSX = 'dre_xlsx',
  FINANCE_XLSX = 'finance_xlsx',
  VALUATION_BATCHES_XLSX = 'valuation_batches_xlsx',
  INVENTORY_ITEMS_XLSX = 'inventory_items_xlsx',
  /** Itens com a avaliação mais recente (fonte, data, valor novo, valor usado). */
  INVENTORY_ITEMS_VALUATION_XLSX = 'inventory_items_valuation_xlsx',
  /** Conciliação da última execução: uma aba por situação e Resumo. */
  RECONCILIATION_XLSX = 'reconciliation_xlsx',
  INVENTORY_ACCOUNTING_ITEMS_XLSX = 'inventory_accounting_items_xlsx',
  PENDING_ISSUES_XLSX = 'pending_issues_xlsx',
  PAYMENTS_XLSX = 'payments_xlsx',
  EXPENSES_XLSX = 'expenses_xlsx',
  PROJECT_BACKUP_XLSX = 'project_backup_xlsx',
}
