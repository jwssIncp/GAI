import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ApiError } from '@/api/http';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { maskPhone } from '@/features/field-agents/brazilianContact';
import {
  maskDocument,
  organizationEditSchema,
  organizationFormSchema,
  type OrganizationEditValues,
  type OrganizationFormValues,
} from './organizationSchemas';
import type { CreateOrganizationRequest, Organization, UpdateOrganizationRequest } from '@/types/api';

type Props =
  | { mode: 'create'; busy: boolean; onSubmit: (payload: CreateOrganizationRequest) => Promise<void>; initial?: never }
  | { mode: 'edit'; busy: boolean; onSubmit: (payload: UpdateOrganizationRequest) => Promise<void>; initial: Organization };

export function OrganizationForm(props: Props) {
  const defaults =
    props.mode === 'edit'
      ? {
          legal_name: props.initial.legal_name,
          trade_name: props.initial.trade_name ?? '',
          contact_email: props.initial.contact_email ?? '',
          contact_phone: props.initial.contact_phone ?? '',
        }
      : { legal_name: '', trade_name: '', cnpj: '', contact_email: '', contact_phone: '' };

  const form = useForm<OrganizationFormValues | OrganizationEditValues>({
    resolver: zodResolver(props.mode === 'create' ? organizationFormSchema : organizationEditSchema),
    defaultValues: defaults,
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors();
        try {
          await props.onSubmit(removeUndefined(values as unknown as CreateOrganizationRequest | UpdateOrganizationRequest) as never);
        } catch (error) {
          const apiError = error as ApiError;
          const detail = apiError.details?.find(({ field }) => field === 'cnpj' || field === 'contact_email' || field === 'legal_name');
          if (detail) form.setError(detail.field as 'cnpj' | 'contact_email' | 'legal_name', { message: detail.message });
          else form.setError('root', { message: apiError.message || 'Não foi possível salvar a organização' });
        }
      })}
    >
      <FormField label="Razão social" error={form.formState.errors.legal_name?.message as string | undefined}>
        <Input {...form.register('legal_name')} />
      </FormField>
      <FormField label="Nome fantasia" optional error={form.formState.errors.trade_name?.message as string | undefined}>
        <Input {...form.register('trade_name')} />
      </FormField>
      {props.mode === 'create' ? (
        <FormField
          label="CNPJ"
          help="Informe o CNPJ com 14 dígitos. A máscara é aplicada automaticamente; o valor enviado à API fica sem formatação."
          error={(form.formState.errors as { cnpj?: { message?: string } }).cnpj?.message}
        >
          <Input
            inputMode="numeric"
            {...form.register('cnpj')}
            onChange={(event) => form.setValue('cnpj', maskDocument(event.target.value), { shouldValidate: true })}
          />
        </FormField>
      ) : (
        <FormField label="CNPJ" hint="O CNPJ não pode ser alterado após o cadastro.">
          <Input value={maskDocument(props.initial.cnpj)} disabled readOnly />
        </FormField>
      )}
      <FormField label="Email de contato" optional error={form.formState.errors.contact_email?.message as string | undefined}>
        <Input type="email" {...form.register('contact_email')} />
      </FormField>
      <FormField label="Telefone" optional error={form.formState.errors.contact_phone?.message as string | undefined}>
        <Input
          inputMode="tel"
          autoComplete="tel"
          {...form.register('contact_phone')}
          onChange={(event) => form.setValue('contact_phone', maskPhone(event.target.value), { shouldValidate: true })}
        />
      </FormField>
      {form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
      <Button type="submit" disabled={props.busy || form.formState.isSubmitting}>
        {props.busy || form.formState.isSubmitting ? 'Salvando...' : props.mode === 'create' ? 'Salvar organização' : 'Atualizar organização'}
      </Button>
    </form>
  );
}

function removeUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>;
}
