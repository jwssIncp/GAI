export const exportJobTypes = [
  'inventory_items_xlsx',
  'inventory_accounting_items_xlsx',
  'pending_issues_xlsx',
  'payments_xlsx',
  'expenses_xlsx',
  'project_images_zip',
  'project_backup_xlsx',
  'project_backup_zip',
] as const;

export const exportJobStatuses = ['pending', 'processing', 'finished', 'failed', 'cancelled', 'expired'] as const;

export const exportJobTypeLabels: Record<(typeof exportJobTypes)[number], string> = {
  inventory_items_xlsx: 'Itens inventariados XLSX',
  inventory_accounting_items_xlsx: 'Base contabil XLSX',
  pending_issues_xlsx: 'Pendencias XLSX',
  payments_xlsx: 'Pagamentos XLSX',
  expenses_xlsx: 'Despesas XLSX',
  project_images_zip: 'Imagens do projeto ZIP',
  project_backup_xlsx: 'Backup consolidado XLSX',
  project_backup_zip: 'Backup consolidado ZIP',
};

export const exportJobStatusLabels: Record<(typeof exportJobStatuses)[number], string> = {
  pending: 'Pendente',
  processing: 'Processando',
  finished: 'Finalizada',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};
