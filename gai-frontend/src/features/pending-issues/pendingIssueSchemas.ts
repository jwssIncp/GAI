import { z } from 'zod';
import type { InventoryPendingIssueSeverity, InventoryPendingIssueStatus, InventoryPendingIssueType } from '@/types/api';

export const pendingIssueTypes = ['missing_plate', 'accounting_item_not_found', 'physical_item_without_accounting_match', 'plate_divergence', 'description_divergence', 'location_divergence', 'duplicated_item', 'manual_issue', 'other'] as const;
export const pendingIssueStatuses = ['open', 'in_review', 'resolved', 'ignored', 'cancelled'] as const;
export const pendingIssueSeverities = ['low', 'medium', 'high', 'critical'] as const;

export const pendingIssueTypeLabels: Record<InventoryPendingIssueType, string> = {
  missing_plate: 'Furo de placa',
  accounting_item_not_found: 'Item contabil nao encontrado',
  physical_item_without_accounting_match: 'Item fisico sem base contabil',
  plate_divergence: 'Divergencia de placa',
  description_divergence: 'Divergencia de descricao',
  location_divergence: 'Divergencia de localizacao',
  duplicated_item: 'Item duplicado',
  manual_issue: 'Pendencia manual',
  other: 'Outra pendencia',
};

export const pendingIssueStatusLabels: Record<InventoryPendingIssueStatus, string> = {
  open: 'Aberta',
  in_review: 'Em analise',
  resolved: 'Resolvida',
  ignored: 'Ignorada',
  cancelled: 'Cancelada',
};

export const pendingIssueSeverityLabels: Record<InventoryPendingIssueSeverity, string> = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
};

const optionalText = z.string().trim().transform((value) => (value ? value : undefined)).optional();
const optionalId = z
  .string()
  .trim()
  .transform((value) => (value ? Number(value) : undefined))
  .pipe(z.number().int().min(1, 'Informe um ID valido').optional());
const optionalJson = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return undefined;
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um JSON valido' });
      return z.NEVER;
    }
  })
  .optional();

export const pendingIssueFormSchema = z.object({
  type: z.enum(pendingIssueTypes, { required_error: 'Informe o tipo da pendencia' }),
  severity: z.enum(pendingIssueSeverities, { required_error: 'Informe a severidade' }),
  status: z.enum(pendingIssueStatuses).optional(),
  title: z.string().trim().min(1, 'Informe o titulo').max(255, 'Titulo deve ter ate 255 caracteres'),
  description: optionalText,
  inventory_item_id: optionalId,
  accounting_item_id: optionalId,
  old_value: optionalJson,
  new_value: optionalJson,
  metadata: optionalJson,
});

export const resolutionSchema = z.object({
  resolution_notes: z.string().trim().min(1, 'Informe as observacoes da resolucao'),
});

export const ignoreSchema = z.object({
  resolution_notes: z.string().trim().optional(),
});

export type PendingIssueFormValues = z.input<typeof pendingIssueFormSchema>;
export type ResolutionFormValues = z.input<typeof resolutionSchema>;
export type IgnoreFormValues = z.input<typeof ignoreSchema>;
