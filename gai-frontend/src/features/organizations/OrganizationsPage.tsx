import { useForm } from 'react-hook-form';
import { organizationsApi } from '@/api/endpoints';
import { FormField } from '@/components/base/FormField';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResourceListPage } from '@/features/shared/ResourceListPage';
import { formatDate } from '@/utils/format';
import type { CreateOrganizationRequest, Organization } from '@/types/api';

export function OrganizationsPage() {
  return (
    <ResourceListPage<Organization, CreateOrganizationRequest>
      title="Organizações"
      entityLabel="organização"
      description="Estruturas organizacionais que centralizam usuários, empresas e operações."
      queryKey="organizations"
      createPermissions={['organizations:create']}
      list={organizationsApi.list}
      create={organizationsApi.create}
      getKey={(item) => item.id}
      columns={[
        { header: 'Razao social', cell: (item) => <div className="font-medium">{item.legal_name}<div className="text-xs text-muted-foreground">{item.trade_name ?? item.cnpj}</div></div> },
        { header: 'Contato', cell: (item) => item.contact_email ?? '-' },
        { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
        { header: 'Criada em', cell: (item) => formatDate(item.created_at) },
      ]}
      form={(submit, busy) => <OrganizationForm onSubmit={submit} busy={busy} />}
    />
  );
}

function OrganizationForm({ onSubmit, busy }: { onSubmit: (payload: CreateOrganizationRequest) => void; busy: boolean }) {
  const form = useForm<CreateOrganizationRequest>();
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormField label="Razao social"><Input {...form.register('legal_name', { required: true })} /></FormField>
      <FormField label="Nome fantasia"><Input {...form.register('trade_name')} /></FormField>
      <FormField label="CNPJ sem mascara"><Input maxLength={14} {...form.register('cnpj', { required: true })} /></FormField>
      <FormField label="Email de contato"><Input type="email" {...form.register('contact_email')} /></FormField>
      <FormField label="Telefone"><Input {...form.register('contact_phone')} /></FormField>
      <Button loading={busy}>Salvar organização</Button>
    </form>
  );
}
