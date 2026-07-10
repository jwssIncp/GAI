import { z } from 'zod';

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

export const fieldAgentFormSchema = z.object({
  organization_id: z
    .string()
    .trim()
    .min(1, 'Informe a organization')
    .transform((value) => Number(value))
    .pipe(z.number().int().positive('Organization invalida')),
  user_id: optionalNumber,
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255, 'Nome muito longo'),
  email: optionalEmail,
  phone: optionalText,
  document: optionalText,
});

export const fieldAgentEditSchema = fieldAgentFormSchema.omit({ organization_id: true });

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

export type FieldAgentFormValues = z.input<typeof fieldAgentFormSchema>;
export type FieldAgentEditValues = z.input<typeof fieldAgentEditSchema>;
export type ProjectFieldAgentFormValues = z.input<typeof projectFieldAgentFormSchema>;
