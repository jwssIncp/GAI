import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { EntityCombobox } from '@/components/base/EntityCombobox';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pendingIssueFormSchema, pendingIssueSeverityLabels, pendingIssueSeverities, pendingIssueStatusLabels, pendingIssueStatuses, pendingIssueTypeLabels, pendingIssueTypes, type PendingIssueFormValues } from './pendingIssueSchemas';
import { accountingItemSource, inventoryItemSource } from './pendingIssueSources';
import type { CreateInventoryPendingIssueRequest, InventoryPendingIssue, InventoryPendingIssueInput } from '@/types/api';

export function PendingIssueForm({ projectId, initial, busy, onSubmit }: { projectId: number; initial?: InventoryPendingIssue; busy: boolean; onSubmit: (payload: CreateInventoryPendingIssueRequest | InventoryPendingIssueInput) => void }) {
  const projectContext = useMemo(() => ({ project_id: projectId }), [projectId]);
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
      <FormField label="Título" error={form.formState.errors.title?.message}><Input {...form.register('title')} /></FormField>
      <FormField label="Descrição"><Input {...form.register('description')} /></FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <Controller control={form.control} name="inventory_item_id" render={({ field }) => (
          <FormField label="Item inventariado" optional hint="Busque pela descrição, placa, marca, modelo ou série." error={form.formState.errors.inventory_item_id?.message}>
            <EntityCombobox source={inventoryItemSource} context={projectContext} value={field.value ? Number(field.value) : null} onChange={(id) => field.onChange(id ? String(id) : '')} />
          </FormField>
        )} />
        <Controller control={form.control} name="accounting_item_id" render={({ field }) => (
          <FormField label="Item contábil" optional hint="Busque pela descrição, placa, cód. base, investor ou localização." error={form.formState.errors.accounting_item_id?.message}>
            <EntityCombobox source={accountingItemSource} context={projectContext} value={field.value ? Number(field.value) : null} onChange={(id) => field.onChange(id ? String(id) : '')} />
          </FormField>
        )} />
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
      <Button loading={busy}>{initial ? 'Atualizar pendência' : 'Salvar pendência'}</Button>
    </form>
  );
}

function clean(payload: InventoryPendingIssueInput): InventoryPendingIssueInput {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as InventoryPendingIssueInput;
}
