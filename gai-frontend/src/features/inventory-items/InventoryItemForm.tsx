import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { DateInput, MoneyInput } from '@/components/base/Inputs';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inventoryItemFormSchema, inventoryItemStatuses, type InventoryItemFormValues } from './inventoryItemSchemas';
import type { InventoryItem, InventoryItemInput } from '@/types/api';

export function InventoryItemForm({ initial, busy, onSubmit }: { initial?: InventoryItem; busy: boolean; onSubmit: (payload: InventoryItemInput) => void }) {
  const form = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemFormSchema),
    defaultValues: {
      external_item_id: initial?.external_item_id ?? '',
      sequence: initial?.sequence ?? '',
      old_plate: initial?.old_plate ?? '',
      new_plate: initial?.new_plate ?? '',
      unit_text: initial?.unit_text ?? '',
      address_text: initial?.address_text ?? '',
      location_text: initial?.location_text ?? '',
      description: initial?.description ?? '',
      brand: initial?.brand ?? '',
      model: initial?.model ?? '',
      serial_number: initial?.serial_number ?? '',
      capacity: initial?.capacity ?? '',
      year: initial?.year ? String(initial.year) : '',
      notes: initial?.notes ?? '',
      source: initial?.source ?? '',
      used_value: initial?.used_value ?? '',
      new_value: initial?.new_value ?? '',
      status: initial?.status ?? 'pending',
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(clean(values as unknown as InventoryItemInput)))}>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="ID externo"><Input {...form.register('external_item_id')} /></FormField>
        <FormField label="Sequencia"><Input {...form.register('sequence')} /></FormField>
        <FormField label="Placa antiga"><Input {...form.register('old_plate')} /></FormField>
        <FormField label="Placa nova"><Input {...form.register('new_plate')} /></FormField>
      </div>
      <FormField label="Descricao" error={form.formState.errors.description?.message}>
        <Input {...form.register('description')} />
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Marca"><Input {...form.register('brand')} /></FormField>
        <FormField label="Modelo"><Input {...form.register('model')} /></FormField>
        <FormField label="Numero de serie"><Input {...form.register('serial_number')} /></FormField>
        <FormField label="Capacidade"><Input {...form.register('capacity')} /></FormField>
        <FormField label="Ano" error={form.formState.errors.year?.message}><DateInput type="number" min={1900} max={2100} {...form.register('year')} /></FormField>
        <FormField label="Origem"><Input {...form.register('source')} /></FormField>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Unidade"><Input {...form.register('unit_text')} /></FormField>
        <FormField label="Localizacao"><Input {...form.register('location_text')} /></FormField>
      </div>
      <FormField label="Endereco"><Input {...form.register('address_text')} /></FormField>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="Valor usado" error={form.formState.errors.used_value?.message}><MoneyInput {...form.register('used_value')} /></FormField>
        <FormField label="Valor novo" error={form.formState.errors.new_value?.message}><MoneyInput {...form.register('new_value')} /></FormField>
        <FormField label="Status">
          <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('status')}>
            {inventoryItemStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Observacoes"><Input {...form.register('notes')} /></FormField>
      <Button loading={busy}>{initial ? 'Atualizar item' : 'Salvar item'}</Button>
    </form>
  );
}

function clean(payload: InventoryItemInput): InventoryItemInput {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as InventoryItemInput;
}
