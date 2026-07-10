import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { fieldAgentEditSchema, fieldAgentFormSchema, type FieldAgentEditValues, type FieldAgentFormValues } from './fieldAgentSchemas';
import { FormField } from '@/components/base/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CreateFieldAgentRequest, FieldAgent, UpdateFieldAgentRequest } from '@/types/api';

type Props =
  | { mode: 'create'; busy: boolean; onSubmit: (payload: CreateFieldAgentRequest) => void; initial?: never }
  | { mode: 'edit'; busy: boolean; onSubmit: (payload: UpdateFieldAgentRequest) => void; initial: FieldAgent };

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
      : { organization_id: '', user_id: '', name: '', email: '', phone: '', document: '' };
  const form = useForm<FieldAgentFormValues | FieldAgentEditValues>({
    resolver: zodResolver(props.mode === 'create' ? fieldAgentFormSchema : fieldAgentEditSchema),
    defaultValues: defaults,
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        props.onSubmit(removeUndefined(values as unknown as CreateFieldAgentRequest | UpdateFieldAgentRequest) as never);
      })}
    >
      {props.mode === 'create' ? (
        <FormField label="Organization ID" error={(form.formState.errors as any).organization_id?.message}>
          <Input type="number" min={1} {...form.register('organization_id' as const)} />
        </FormField>
      ) : null}
      <FormField label="Nome" error={form.formState.errors.name?.message as string | undefined}>
        <Input {...form.register('name')} />
      </FormField>
      <FormField label="Email" error={form.formState.errors.email?.message as string | undefined}>
        <Input type="email" {...form.register('email')} />
      </FormField>
      <FormField label="Telefone" error={form.formState.errors.phone?.message as string | undefined}>
        <Input {...form.register('phone')} />
      </FormField>
      <FormField label="Documento" error={form.formState.errors.document?.message as string | undefined}>
        <Input {...form.register('document')} />
      </FormField>
      <FormField label="User ID vinculado" error={form.formState.errors.user_id?.message as string | undefined}>
        <Input type="number" min={1} {...form.register('user_id')} />
      </FormField>
      <Button disabled={props.busy}>{props.mode === 'create' ? 'Salvar inventariante' : 'Atualizar inventariante'}</Button>
    </form>
  );
}

function removeUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>;
}
