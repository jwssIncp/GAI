import { z } from 'zod';

export const exportJobTypes = [
  'inventory_items_xlsx',
  'inventory_accounting_items_xlsx',
  'pending_issues_xlsx',
  'payments_xlsx',
  'expenses_xlsx',
  'project_backup_xlsx',
] as const;

export const exportJobStatuses = ['pending', 'processing', 'finished', 'failed', 'cancelled', 'expired'] as const;

export const exportJobTypeLabels: Record<(typeof exportJobTypes)[number], string> = {
  inventory_items_xlsx: 'Itens inventariados XLSX',
  inventory_accounting_items_xlsx: 'Base contabil XLSX',
  pending_issues_xlsx: 'Pendencias XLSX',
  payments_xlsx: 'Pagamentos XLSX',
  expenses_xlsx: 'Despesas XLSX',
  project_backup_xlsx: 'Relatorio consolidado do projeto XLSX',
};

export const exportJobStatusLabels: Record<(typeof exportJobStatuses)[number], string> = {
  pending: 'Pendente',
  processing: 'Processando',
  finished: 'Finalizada',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

export const exportJobFormSchema = z.object({ type: z.enum(exportJobTypes, { required_error: 'Selecione o tipo de exportacao' }) });
export type ExportJobFormValues = z.infer<typeof exportJobFormSchema>;
