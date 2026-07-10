import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { DateInput, MoneyInput } from '@/components/base/Inputs';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { accountingItemFormSchema, accountingItemStatuses, type AccountingItemFormValues } from './accountingItemSchemas';
import type { InventoryAccountingItem, InventoryAccountingItemInput } from '@/types/api';

export function AccountingItemForm({ initial, busy, onSubmit }: { initial: InventoryAccountingItem; busy: boolean; onSubmit: (payload: InventoryAccountingItemInput) => void }) {
  const form = useForm<AccountingItemFormValues>({
    resolver: zodResolver(accountingItemFormSchema),
    defaultValues: {
      plate: initial.plate ?? '',
      description: initial.description ?? '',
      accounting_account_description: initial.accounting_account_description ?? '',
      location: initial.location ?? '',
      acquisition_date: initial.acquisition_date ?? '',
      acquisition_value: initial.acquisition_value ?? '',
      base_code: initial.base_code ?? '',
      status: initial.status ?? 'pending',
      investor_code: initial.investor_code ?? '',
      note_1: initial.note_1 ?? '',
      note_2: initial.note_2 ?? '',
      new_inventory_plate: initial.new_inventory_plate ?? '',
      inventory_description: initial.inventory_description ?? '',
      inventory_location: initial.inventory_location ?? '',
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit(clean(values as unknown as InventoryAccountingItemInput)))}>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Placa"><Input {...form.register('plate')} /></FormField>
        <FormField label="Codigo base"><Input {...form.register('base_code')} /></FormField>
        <FormField label="Codigo investor"><Input {...form.register('investor_code')} /></FormField>
        <FormField label="Localizacao"><Input {...form.register('location')} /></FormField>
      </div>
      <FormField label="Descricao"><Input {...form.register('description')} /></FormField>
      <FormField label="Conta contabil"><Input {...form.register('accounting_account_description')} /></FormField>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="Data de aquisicao"><DateInput {...form.register('acquisition_date')} /></FormField>
        <FormField label="Valor de aquisicao" error={form.formState.errors.acquisition_value?.message}><MoneyInput {...form.register('acquisition_value')} /></FormField>
        <FormField label="Status">
          <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register('status')}>
            {accountingItemStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </FormField>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Obs. 1"><Input {...form.register('note_1')} /></FormField>
        <FormField label="Obs. 2"><Input {...form.register('note_2')} /></FormField>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Placa nova inventario"><Input {...form.register('new_inventory_plate')} /></FormField>
        <FormField label="Localizacao inventario"><Input {...form.register('inventory_location')} /></FormField>
      </div>
      <FormField label="Descricao inventario"><Input {...form.register('inventory_description')} /></FormField>
      <Button loading={busy}>Atualizar item contabil</Button>
    </form>
  );
}

function clean(payload: InventoryAccountingItemInput): InventoryAccountingItemInput {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as InventoryAccountingItemInput;
}
