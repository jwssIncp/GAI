import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pendingIssueFormSchema, pendingIssueSeverityLabels, pendingIssueSeverities, pendingIssueStatusLabels, pendingIssueStatuses, pendingIssueTypeLabels, pendingIssueTypes, type PendingIssueFormValues } from './pendingIssueSchemas';
import type { CreateInventoryPendingIssueRequest, InventoryPendingIssue, InventoryPendingIssueInput } from '@/types/api';

export function PendingIssueForm({ initial, busy, onSubmit }: { initial?: InventoryPendingIssue; busy: boolean; onSubmit: (payload: CreateInventoryPendingIssueRequest | InventoryPendingIssueInput) => void }) {
  const form = useForm<PendingIssueFormValues>({
    resolver: zodResolver(pendingIssueFormSchema),
    defaultValues: {
      type: initial?.type ?? 'manual_issue',
      severity: initial?.severity ?? 'medium',
      status: initial?.status,
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      inventory_item_id: initial?.inventory_item_id ? String(initial.inventory_item_id) : '',
      accounting_item_id: initial?.accounting_item_id ? String(initial.accounting_item_id) : '',
      old_value: initial?.old_value ? JSON.stringify(initial.old_value, null, 2) : '',
      new_value: initial?.new_value ? JSON.stringify(initial.new_value, null, 2) : '',
      metadata: initial?.metadata ? JSON.stringify(initial.metadata, null, 2) : '',
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(clean(values as unknown as InventoryPendingIssueInput)))}>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Tipo" error={form.formState.errors.type?.message}>
          <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('type')}>
            {pendingIssueTypes.map((type) => <option key={type} value={type}>{pendingIssueTypeLabels[type]}</option>)}
          </select>
        </FormField>
        <FormField label="Severidade" error={form.formState.errors.severity?.message}>
          <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('severity')}>
            {pendingIssueSeverities.map((severity) => <option key={severity} value={severity}>{pendingIssueSeverityLabels[severity]}</option>)}
          </select>
        </FormField>
      </div>
      {initial ? (
        <FormField label="Status">
          <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('status')}>
            {pendingIssueStatuses.map((status) => <option key={status} value={status}>{pendingIssueStatusLabels[status]}</option>)}
          </select>
        </FormField>
      ) : null}
      <FormField label="Titulo" error={form.formState.errors.title?.message}><Input {...form.register('title')} /></FormField>
      <FormField label="Descricao"><Input {...form.register('description')} /></FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Item inventariado ID" error={form.formState.errors.inventory_item_id?.message}><Input inputMode="numeric" {...form.register('inventory_item_id')} /></FormField>
        <FormField label="Item contabil ID" error={form.formState.errors.accounting_item_id?.message}><Input inputMode="numeric" {...form.register('accounting_item_id')} /></FormField>
      </div>
      <FormField label="Valor antigo JSON" error={form.formState.errors.old_value?.message}>
        <textarea className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('old_value')} />
      </FormField>
      <FormField label="Valor novo JSON" error={form.formState.errors.new_value?.message}>
        <textarea className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('new_value')} />
      </FormField>
      <FormField label="Metadata JSON" error={form.formState.errors.metadata?.message}>
        <textarea className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('metadata')} />
      </FormField>
      <Button loading={busy}>{initial ? 'Atualizar pendencia' : 'Salvar pendencia'}</Button>
    </form>
  );
}

function clean(payload: InventoryPendingIssueInput): InventoryPendingIssueInput {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as InventoryPendingIssueInput;
}
