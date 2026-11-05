import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { FieldAgentSelect } from '@/features/field-agents/FieldAgentSelect';
import { DateInput, MoneyInput } from '@/components/base/Inputs';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { expenseFormSchema, type ExpenseFormValues } from './financeSchemas';
import type { Expense, ExpenseInput, FieldAgent } from '@/types/api';

function toValues(initial?: Expense): ExpenseFormValues {
  return {
    field_agent_id: initial?.field_agent_id ? String(initial.field_agent_id) : '',
    description: initial?.description ?? '',
    reason: initial?.reason ?? '',
    expense_date: initial?.expense_date ?? '',
    amount: initial?.amount ?? '',
  };
}

export function ExpenseForm({ initial, fieldAgents, busy, onSubmit }: { initial?: Expense; fieldAgents: FieldAgent[]; busy?: boolean; onSubmit: (payload: ExpenseInput) => void }) {
  const form = useForm<ExpenseFormValues>({ resolver: zodResolver(expenseFormSchema), values: toValues(initial) });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(expenseFormSchema.parse(values)))}>
      <FormField label="Descricao" error={form.formState.errors.description?.message}>
        <Input placeholder="Alimentacao, deslocamento, hospedagem..." {...form.register('description')} />
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Data" error={form.formState.errors.expense_date?.message}><DateInput {...form.register('expense_date')} /></FormField>
        <FormField label="Valor" error={form.formState.errors.amount?.message}><MoneyInput {...form.register('amount')} /></FormField>
      </div>
      <FormField label="Inventariante">
        <Controller control={form.control} name="field_agent_id" render={({ field }) => <FieldAgentSelect value={field.value ?? ''} onChange={field.onChange} selectedLabel={fieldAgents.find(agent => String(agent.id) === field.value)?.name} />} />
      </FormField>
      <FormField label="Motivo">
        <textarea className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('reason')} />
      </FormField>
      <Button loading={busy}>{initial ? 'Salvar despesa' : 'Criar despesa'}</Button>
    </form>
  );
}
