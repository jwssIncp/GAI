import { z } from 'zod';

const money = z
  .string()
  .trim()
  .min(1, 'Informe o valor')
  .transform((value) => value.replace(',', '.'))
  .pipe(z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, 'Use ate 13 digitos e 2 casas decimais'));

const optionalMoney = z
  .string()
  .trim()
  .transform((value) => (value ? value.replace(',', '.') : undefined))
  .pipe(z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, 'Use ate 13 digitos e 2 casas decimais').optional());

const optionalText = z.string().trim().transform((value) => (value ? value : undefined)).optional();
const optionalDate = z.string().trim().transform((value) => (value ? value : undefined)).optional();

export const paymentStatuses = ['pending', 'approved', 'paid', 'cancelled'] as const;
export const expenseStatuses = ['pending', 'approved', 'rejected', 'paid', 'cancelled'] as const;

export const paymentStatusLabels: Record<(typeof paymentStatuses)[number], string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
  cancelled: 'Cancelado',
};

export const expenseStatusLabels: Record<(typeof expenseStatuses)[number], string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  paid: 'Paga',
  cancelled: 'Cancelada',
};

export const paymentFormSchema = z.object({
  field_agent_id: z.string().min(1, 'Selecione o inventariante').transform(Number),
  state: optionalText,
  start_date: z.string().min(1, 'Informe o inicio'),
  end_date: z.string().min(1, 'Informe o fim'),
  payment_date: optionalDate,
  daily_rate: money,
  additional_amount: optionalMoney,
  discount_amount: optionalMoney,
  notes: optionalText,
}).refine((value) => value.end_date >= value.start_date, {
  path: ['end_date'],
  message: 'A data final deve ser maior ou igual a inicial',
});

export const expenseFormSchema = z.object({
  field_agent_id: z.string().optional().transform((value) => (value ? Number(value) : undefined)),
  description: z.string().trim().min(3, 'Descreva a despesa'),
  reason: optionalText,
  expense_date: z.string().min(1, 'Informe a data'),
  amount: money,
});

export const paidDateSchema = z.object({
  payment_date: optionalDate,
});

export const rejectExpenseSchema = z.object({
  reason: z.string().trim().min(3, 'Informe o motivo da rejeicao'),
});

export type PaymentFormValues = z.input<typeof paymentFormSchema>;
export type ExpenseFormValues = z.input<typeof expenseFormSchema>;
export type PaidDateValues = z.input<typeof paidDateSchema>;
export type RejectExpenseValues = z.input<typeof rejectExpenseSchema>;
