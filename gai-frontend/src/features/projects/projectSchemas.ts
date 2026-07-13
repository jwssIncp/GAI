import { z } from 'zod';

const optionalText = z.string().trim().max(5000, 'Descricao deve ter no maximo 5000 caracteres');
const optionalDate = z.string().trim().refine(
  (value) => value === '' || z.string().date().safeParse(value).success,
  'Use uma data valida',
);

const projectFields = {
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255, 'Nome deve ter no maximo 255 caracteres'),
  description: optionalText,
  start_date: optionalDate,
  end_date: optionalDate,
};

function validateDates(value: { start_date?: string; end_date?: string }, context: z.RefinementCtx) {
  if (value.start_date && value.end_date && value.end_date < value.start_date) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['end_date'], message: 'A data final deve ser maior ou igual a inicial' });
  }
}

const projectFormFields = z.object({
  organization_id: z.string().trim(),
  company_id: z.string().trim(),
  ...projectFields,
});

export const projectCreateFormSchema = projectFormFields.superRefine((value, context) => {
  if (!isPositiveInteger(value.organization_id)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['organization_id'], message: 'Selecione a organizacao' });
  }
  if (!isPositiveInteger(value.company_id)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['company_id'], message: 'Selecione a empresa' });
  }
  validateDates(value, context);
});

export const projectEditFormSchema = projectFormFields.superRefine(validateDates);

export type ProjectFormValues = z.infer<typeof projectEditFormSchema>;

export const projectStatuses = ['draft', 'active', 'paused', 'inactive', 'finished', 'cancelled', 'archived'] as const;

function isPositiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}
