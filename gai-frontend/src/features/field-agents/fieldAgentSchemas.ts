import { z } from 'zod';
import { isValidDocument, isValidPhone, normalizeDocument, normalizePhone } from './brazilianContact';

const optionalText = z.string().trim().transform((value) => (value ? value : undefined)).optional();
const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value ? value : undefined))
  .pipe(z.string().email('Informe um email valido').optional());
const optionalNumber = z
  .string()
  .trim()
  .transform((value) => (value ? Number(value) : undefined))
  .pipe(z.number().int().positive().optional());

const optionalDocument = z.string().trim()
  .refine((value) => !value || isValidDocument(value), 'CPF ou CNPJ inválido')
  .transform((value) => value ? normalizeDocument(value) : undefined);
const optionalPhone = z.string().trim()
  .refine((value) => !value || isValidPhone(value), 'Telefone brasileiro inválido')
  .transform((value) => value ? normalizePhone(value) : undefined);

export const fieldAgentFormSchema = z.object({
  user_id: optionalNumber,
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255, 'Nome muito longo'),
  email: optionalEmail,
  phone: optionalPhone,
  document: optionalDocument,
});

export const fieldAgentEditSchema = fieldAgentFormSchema;

export const projectFieldAgentFormSchema = z.object({
  field_agent_id: z
    .string()
    .trim()
    .min(1, 'Informe o inventariante')
    .transform((value) => Number(value))
    .pipe(z.number().int().positive('Inventariante invalido')),
  role: optionalText,
  start_date: optionalText,
  end_date: optionalText,
  notes: optionalText,
});

export const projectFieldAgentEditSchema = projectFieldAgentFormSchema.omit({ field_agent_id: true }).extend({
  status: z.enum(['active', 'inactive', 'finished']),
});

export type FieldAgentFormValues = z.input<typeof fieldAgentFormSchema>;
export type FieldAgentEditValues = z.input<typeof fieldAgentEditSchema>;
export type ProjectFieldAgentFormValues = z.input<typeof projectFieldAgentFormSchema>;
export type ProjectFieldAgentEditValues = z.input<typeof projectFieldAgentEditSchema>;
