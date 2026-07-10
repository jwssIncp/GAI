import { z } from 'zod';

export const importSessionTypes = ['mobile_sync', 'inventory_items_import', 'accounting_items_import', 'images_import', 'raw_backup_import', 'incremental_sync'] as const;
export const importSessionSources = ['mobile_app', 'web_admin', 'api_client', 'system', 'migration'] as const;
export const importSessionStatuses = ['open', 'receiving', 'processing', 'finished', 'failed', 'cancelled', 'expired'] as const;
export const importPayloadStatuses = ['received', 'processing', 'processed', 'failed', 'duplicated', 'ignored'] as const;
export const importFileTypes = ['raw_payload', 'raw_backup', 'image', 'other'] as const;

export const importSessionTypeLabels: Record<(typeof importSessionTypes)[number], string> = {
  mobile_sync: 'Sincronizacao mobile',
  inventory_items_import: 'Importacao de itens',
  accounting_items_import: 'Importacao contabil',
  images_import: 'Importacao de imagens',
  raw_backup_import: 'Backup bruto',
  incremental_sync: 'Sincronizacao incremental',
};

export const importSessionSourceLabels: Record<(typeof importSessionSources)[number], string> = {
  mobile_app: 'Aplicativo mobile',
  web_admin: 'Web admin',
  api_client: 'Cliente API',
  system: 'Sistema',
  migration: 'Migracao',
};

export const importSessionStatusLabels: Record<(typeof importSessionStatuses)[number], string> = {
  open: 'Aberta',
  receiving: 'Recebendo',
  processing: 'Processando',
  finished: 'Finalizada',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

export const importFileTypeLabels: Record<(typeof importFileTypes)[number], string> = {
  raw_payload: 'Payload bruto',
  raw_backup: 'Backup bruto',
  image: 'Imagem',
  other: 'Outro',
};

export const importSessionFormSchema = z.object({
  type: z.string().min(1, 'Selecione o tipo').pipe(z.enum(importSessionTypes)),
  source: z.string().min(1, 'Selecione a origem').pipe(z.enum(importSessionSources)),
  expected_payloads: z.string().trim().transform((value) => (value ? Number(value) : undefined)).pipe(z.number().int().min(1).max(100000).optional()),
});

export const importPayloadFormSchema = z.object({
  payload_number: z.string().min(1, 'Informe o numero').transform(Number).pipe(z.number().int().min(1)),
  idempotency_key: z.string().trim().min(1, 'Informe a chave idempotente').max(128),
  checksum: z.string().trim().transform((value) => (value ? value : undefined)).optional(),
  payload_json: z.string().trim().min(2, 'Informe o JSON').refine((value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed.items);
    } catch {
      return false;
    }
  }, 'JSON deve ser valido e conter items[]'),
});

export type ImportSessionFormValues = z.input<typeof importSessionFormSchema>;
export type ImportPayloadFormValues = z.input<typeof importPayloadFormSchema>;
