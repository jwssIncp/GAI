import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { fieldAgentEditSchema, fieldAgentFormSchema, type FieldAgentEditValues, type FieldAgentFormValues } from './fieldAgentSchemas';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CreateFieldAgentRequest, FieldAgent, UpdateFieldAgentRequest } from '@/types/api';
import { ApiError } from '@/api/http';
import { maskDocument, maskPhone } from './brazilianContact';

type Props =
  | { mode: 'create'; busy: boolean; onSubmit: (payload: CreateFieldAgentRequest) => Promise<void>; initial?: never }
  | { mode: 'edit'; busy: boolean; onSubmit: (payload: UpdateFieldAgentRequest) => Promise<void>; initial: FieldAgent };

export function FieldAgentForm(props: Props) {
  const defaults =
    props.mode === 'edit'
      ? {
          user_id: props.initial.user_id ? String(props.initial.user_id) : '',
          name: props.initial.name,
          email: props.initial.email ?? '',
          phone: props.initial.phone ?? '',
          document: props.initial.document ?? '',
        }
      : { user_id: '', name: '', email: '', phone: '', document: '' };
  const form = useForm<FieldAgentFormValues | FieldAgentEditValues>({
    resolver: zodResolver(props.mode === 'create' ? fieldAgentFormSchema : fieldAgentEditSchema),
    defaultValues: defaults,
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors();
        try {
          await props.onSubmit(removeUndefined(values as unknown as CreateFieldAgentRequest | UpdateFieldAgentRequest) as never);
        } catch (error) {
          const apiError = error as ApiError;
          const detail = apiError.details?.find(({ field }) => field === 'email' || field === 'document');
          if (detail) form.setError(detail.field as 'email' | 'document', { message: detail.message });
          else form.setError('root', { message: apiError.message || 'Não foi possível salvar o inventariante' });
        }
      })}
    >
      <FormField label="Nome" error={form.formState.errors.name?.message as string | undefined}>
        <Input {...form.register('name')} />
      </FormField>
      <FormField label="Email" error={form.formState.errors.email?.message as string | undefined}>
        <Input type="email" {...form.register('email')} />
      </FormField>
      <FormField label="Telefone" error={form.formState.errors.phone?.message as string | undefined}>
        <Input inputMode="tel" autoComplete="tel" {...form.register('phone')} onChange={(event) => form.setValue('phone', maskPhone(event.target.value), { shouldValidate: true })} />
      </FormField>
      <FormField label="CPF/CNPJ" error={form.formState.errors.document?.message as string | undefined}>
        <Input inputMode="numeric" {...form.register('document')} onChange={(event) => form.setValue('document', maskDocument(event.target.value), { shouldValidate: true })} />
      </FormField>
      <FormField label="User ID vinculado" error={form.formState.errors.user_id?.message as string | undefined}>
        <Input type="number" min={1} {...form.register('user_id')} />
      </FormField>
      {form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
      <Button type="submit" disabled={props.busy || form.formState.isSubmitting}>{props.busy || form.formState.isSubmitting ? 'Salvando...' : props.mode === 'create' ? 'Salvar inventariante' : 'Atualizar inventariante'}</Button>
    </form>
  );
}

function removeUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>;
}
