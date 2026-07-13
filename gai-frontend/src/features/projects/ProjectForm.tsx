import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { companiesApi, organizationsApi } from '@/api/endpoints';
import { ApiError } from '@/api/http';
import { FormField } from '@/components/base/FormField';
import { DateInput } from '@/components/base/Inputs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/AuthContext';
import { usePermissions } from '@/features/auth/usePermissions';
import type { CreateProjectRequest, Project, UpdateProjectRequest } from '@/types/api';
import { CompanySelect, OrganizationSelect } from './ProjectSelectors';
import { projectCreateFormSchema, projectEditFormSchema, type ProjectFormValues } from './projectSchemas';

type ProjectFormProps = {
  mode: 'create' | 'edit';
  initial?: Project;
  busy?: boolean;
  onSubmit: (payload: CreateProjectRequest | UpdateProjectRequest) => Promise<void>;
};

export function ProjectForm({ mode, initial, busy = false, onSubmit }: ProjectFormProps) {
  const { user } = useAuth();
  const { isPlatformAdmin, hasPermission } = usePermissions();
  const schema = mode === 'create' ? projectCreateFormSchema : projectEditFormSchema;
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organization_id: initial?.organization_id ? String(initial.organization_id) : user?.organization_id ? String(user.organization_id) : '',
      company_id: initial?.company_id ? String(initial.company_id) : '',
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      start_date: initial?.start_date ?? '',
      end_date: initial?.end_date ?? '',
    },
  });
  const organizationValue = form.watch('organization_id');
  const organizationId = toId(organizationValue);
  const canSelectCompany = mode === 'edit' || hasPermission('companies:read');

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors();
        try {
          const organizationId = toId(values.organization_id);
          const companyId = toId(values.company_id);
          const payload: CreateProjectRequest | UpdateProjectRequest = mode === 'create'
            ? {
                organization_id: organizationId!,
                company_id: companyId!,
                name: values.name,
                ...(values.description ? { description: values.description } : {}),
                ...(values.start_date ? { start_date: values.start_date } : {}),
                ...(values.end_date ? { end_date: values.end_date } : {}),
              }
            : {
                name: values.name,
                description: values.description || null,
                start_date: values.start_date || null,
                end_date: values.end_date || null,
              };
          await onSubmit(payload);
        } catch (error) {
          if (error instanceof ApiError) {
            for (const detail of error.details ?? []) {
              if (isProjectField(detail.field)) form.setError(detail.field, { message: detail.message });
            }
            form.setError('root', { message: error.message });
            return;
          }
          throw error;
        }
      })}
    >
      {mode === 'create' ? (
        <>
          {isPlatformAdmin ? (
            <FormField label="Organizacao" error={form.formState.errors.organization_id?.message}>
              <Controller
                control={form.control}
                name="organization_id"
                render={({ field }) => (
                  <OrganizationSelect
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      form.setValue('company_id', '', { shouldValidate: false });
                    }}
                    required
                  />
                )}
              />
            </FormField>
          ) : (
            <FormField label="Organizacao" hint="O projeto sera criado na organizacao do usuario autenticado.">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">Sua organizacao</div>
            </FormField>
          )}
          {hasPermission('companies:read') ? (
            <FormField label="Empresa" error={form.formState.errors.company_id?.message}>
              <Controller
                control={form.control}
                name="company_id"
                render={({ field }) => <CompanySelect organizationId={organizationId} value={field.value} onChange={field.onChange} required />}
              />
            </FormField>
          ) : (
            <p role="alert" className="rounded-xl border border-warning/25 bg-warning-subtle/40 p-3 text-sm text-muted-foreground">Voce pode criar projetos, mas nao possui `companies:read` para selecionar uma empresa. Solicite esse acesso ao administrador.</p>
          )}
        </>
      ) : initial ? (
        <ProjectReadonlyContext project={initial} canReadCompany={hasPermission('companies:read')} canReadOrganization={hasPermission('organizations:read')} />
      ) : null}

      <FormField label="Nome" error={form.formState.errors.name?.message}>
        <Input maxLength={255} {...form.register('name')} />
      </FormField>
      <FormField label="Descricao" optional error={form.formState.errors.description?.message}>
        <textarea className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" maxLength={5000} {...form.register('description')} />
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Inicio" optional error={form.formState.errors.start_date?.message}><DateInput {...form.register('start_date')} /></FormField>
        <FormField label="Fim" optional error={form.formState.errors.end_date?.message}><DateInput {...form.register('end_date')} /></FormField>
      </div>
      {form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
      <Button type="submit" loading={busy || form.formState.isSubmitting} disabled={busy || form.formState.isSubmitting || !canSelectCompany}>
        {mode === 'create' ? 'Salvar projeto' : 'Atualizar projeto'}
      </Button>
    </form>
  );
}

function ProjectReadonlyContext({ project, canReadCompany, canReadOrganization }: { project: Project; canReadCompany: boolean; canReadOrganization: boolean }) {
  const company = useQuery({
    queryKey: ['companies', 'project-context', project.company_id],
    queryFn: () => companiesApi.get(project.company_id!),
    enabled: canReadCompany && Boolean(project.company_id),
  });
  const organization = useQuery({
    queryKey: ['organizations', 'project-context', project.organization_id],
    queryFn: () => organizationsApi.get(project.organization_id),
    enabled: canReadOrganization,
  });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label="Organizacao" hint="A organizacao nao pode ser alterada.">
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{organization.data?.trade_name || organization.data?.legal_name || 'Organizacao do projeto'}</div>
      </FormField>
      <FormField label="Empresa" hint="A empresa nao pode ser alterada apos a criacao.">
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{company.data?.name || 'Empresa vinculada ao projeto'}</div>
      </FormField>
    </div>
  );
}

function isProjectField(value: string): value is keyof ProjectFormValues {
  return ['organization_id', 'company_id', 'name', 'description', 'start_date', 'end_date'].includes(value);
}

function toId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}
