import { z } from 'zod';
import { isValidDocument, isValidPhone, maskDocument, normalizeDocument, normalizePhone } from '@/features/field-agents/brazilianContact';

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value ? value : undefined))
  .optional();

const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value ? value : undefined))
  .pipe(z.string().email('Informe um email valido').optional());

const optionalPhone = z
  .string()
  .trim()
  .refine((value) => !value || isValidPhone(value), 'Telefone brasileiro inválido')
  .transform((value) => (value ? normalizePhone(value) : undefined));

const cnpjSchema = z
  .string()
  .trim()
  .min(1, 'Informe o CNPJ')
  .refine((value) => normalizeDocument(value).length === 14 && isValidDocument(value), 'CNPJ inválido')
  .transform((value) => normalizeDocument(value));

export const organizationFormSchema = z.object({
  legal_name: z.string().trim().min(2, 'Razão social deve ter pelo menos 2 caracteres').max(255, 'Razão social muito longa'),
  trade_name: optionalText,
  cnpj: cnpjSchema,
  contact_email: optionalEmail,
  contact_phone: optionalPhone,
});

export const organizationEditSchema = organizationFormSchema.omit({ cnpj: true });

export type OrganizationFormValues = z.input<typeof organizationFormSchema>;
export type OrganizationEditValues = z.input<typeof organizationEditSchema>;

export { maskDocument };
