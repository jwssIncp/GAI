import { z } from 'zod';

const optionalText = z.string().trim().transform((value) => (value ? value : undefined)).optional();
const optionalMoney = z
  .string()
  .trim()
  .transform((value) => (value ? value.replace(',', '.') : undefined))
  .pipe(z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, 'Valor deve seguir o formato 9999999999999.99').optional());

export const accountingItemStatuses = ['pending', 'matched', 'divergent', 'not_found', 'ignored', 'inactive'] as const;
export const accountingImportStatuses = ['pending', 'processing', 'finished', 'failed', 'cancelled'] as const;

export const accountingItemFormSchema = z.object({
  plate: optionalText,
  description: optionalText,
  accounting_account_description: optionalText,
  location: optionalText,
  acquisition_date: optionalText,
  acquisition_value: optionalMoney,
  base_code: optionalText,
  status: z.enum(accountingItemStatuses).optional(),
  investor_code: optionalText,
  note_1: optionalText,
  note_2: optionalText,
  new_inventory_plate: optionalText,
  inventory_description: optionalText,
  inventory_location: optionalText,
});

export type AccountingItemFormValues = z.input<typeof accountingItemFormSchema>;

export function validateAccountingImportFile(file: File) {
  const nameOk = file.name.toLowerCase().endsWith('.xlsx');
  const typeOk = !file.type || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (!nameOk || !typeOk) return 'Envie um arquivo .xlsx valido.';
  if (file.size < 1) return 'Arquivo vazio nao pode ser importado.';
  if (file.size > 20 * 1024 * 1024) return 'Arquivo deve ter no maximo 20 MB.';
  return null;
}
