import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { DateInput, MoneyInput } from '@/components/base/Inputs';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { paymentFormSchema, type PaymentFormValues } from './financeSchemas';
import type { FieldAgent, FieldAgentPayment, PaymentInput } from '@/types/api';

function toValues(initial?: FieldAgentPayment): PaymentFormValues {
  return {
    field_agent_id: initial?.field_agent_id ? String(initial.field_agent_id) : '',
    state: initial?.state ?? '',
    start_date: initial?.start_date ?? '',
    end_date: initial?.end_date ?? '',
    payment_date: initial?.payment_date ?? '',
    daily_rate: initial?.daily_rate ?? '',
    additional_amount: initial?.additional_amount ?? '',
    discount_amount: initial?.discount_amount ?? '',
    notes: initial?.notes ?? '',
  };
}

export function PaymentForm({ initial, fieldAgents, busy, onSubmit }: { initial?: FieldAgentPayment; fieldAgents: FieldAgent[]; busy?: boolean; onSubmit: (payload: PaymentInput) => void }) {
  const form = useForm<PaymentFormValues>({ resolver: zodResolver(paymentFormSchema), values: toValues(initial) });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(paymentFormSchema.parse(values)))}>
      <FormField label="Inventariante" error={form.formState.errors.field_agent_id?.message}>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('field_agent_id')}>
          <option value="">Selecione</option>
          {fieldAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </select>
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Inicio" error={form.formState.errors.start_date?.message}><DateInput {...form.register('start_date')} /></FormField>
        <FormField label="Fim" error={form.formState.errors.end_date?.message}><DateInput {...form.register('end_date')} /></FormField>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Valor diario" error={form.formState.errors.daily_rate?.message}><MoneyInput {...form.register('daily_rate')} /></FormField>
        <FormField label="UF/Estado"><Input placeholder="SP" {...form.register('state')} /></FormField>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Adicional" error={form.formState.errors.additional_amount?.message}><MoneyInput {...form.register('additional_amount')} /></FormField>
        <FormField label="Desconto" error={form.formState.errors.discount_amount?.message}><MoneyInput {...form.register('discount_amount')} /></FormField>
      </div>
      <FormField label="Data de pagamento"><DateInput {...form.register('payment_date')} /></FormField>
      <FormField label="Observacoes">
        <textarea className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('notes')} />
      </FormField>
      <Button loading={busy}>{initial ? 'Salvar pagamento' : 'Criar pagamento'}</Button>
    </form>
  );
}
