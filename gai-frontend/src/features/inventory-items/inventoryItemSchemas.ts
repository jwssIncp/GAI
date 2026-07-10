import { z } from 'zod';

const optionalText = z.string().trim().transform((value) => (value ? value : undefined)).optional();
const optionalMoney = z
  .string()
  .trim()
  .transform((value) => (value ? value.replace(',', '.') : undefined))
  .pipe(z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, 'Valor deve ter ate 2 casas decimais').optional());
const optionalYear = z
  .string()
  .trim()
  .transform((value) => (value ? Number(value) : undefined))
  .pipe(z.number().int().min(1900, 'Ano minimo 1900').max(2100, 'Ano maximo 2100').optional());

export const inventoryItemFormSchema = z.object({
  external_item_id: optionalText,
  sequence: optionalText,
  old_plate: optionalText,
  new_plate: optionalText,
  unit_text: optionalText,
  address_text: optionalText,
  location_text: optionalText,
  description: z.string().trim().min(1, 'Informe a descricao do item').optional(),
  brand: optionalText,
  model: optionalText,
  serial_number: optionalText,
  capacity: optionalText,
  year: optionalYear,
  notes: optionalText,
  source: optionalText,
  used_value: optionalMoney,
  new_value: optionalMoney,
  status: z.enum(['pending', 'evaluated', 'divergent', 'not_found', 'duplicated', 'removed', 'inactive']).optional(),
});

export type InventoryItemFormValues = z.input<typeof inventoryItemFormSchema>;
export const inventoryItemStatuses = ['pending', 'evaluated', 'divergent', 'not_found', 'duplicated', 'removed', 'inactive'] as const;
