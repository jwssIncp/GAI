import { useForm } from 'react-hook-form';
import { companiesApi } from '@/api/endpoints';
import { FormField } from '@/components/base/FormField';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResourceListPage } from '@/features/shared/ResourceListPage';
import type { Company, CreateCompanyRequest } from '@/types/api';

export function CompaniesPage() {
  return (
    <ResourceListPage<Company, CreateCompanyRequest>
      title="Empresas"
      entityLabel="empresa"
      description="Empresas operacionais vinculadas às estruturas da organização."
      queryKey="companies"
      createPermissions={['companies:create']}
      list={companiesApi.list}
      create={companiesApi.create}
      getKey={(item) => item.id}
      columns={[
        { header: 'Empresa', cell: (item) => <div className="font-medium">{item.name}<div className="text-xs text-muted-foreground">{item.corporate_name ?? item.document ?? '-'}</div></div> },
        { header: 'Organização', cell: (item) => item.organization_id },
        { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
        { header: 'Documento', cell: (item) => item.document ?? '-' },
      ]}
      form={(submit, busy) => <CompanyForm onSubmit={submit} busy={busy} />}
    />
  );
}

function CompanyForm({ onSubmit, busy }: { onSubmit: (payload: CreateCompanyRequest) => void; busy: boolean }) {
  const form = useForm<CreateCompanyRequest>();
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit({ ...values, organization_id: Number(values.organization_id) }))}>
      <FormField label="Organization ID"><Input type="number" {...form.register('organization_id', { required: true })} /></FormField>
      <FormField label="Nome"><Input {...form.register('name', { required: true })} /></FormField>
      <FormField label="Razao social"><Input {...form.register('corporate_name')} /></FormField>
      <FormField label="Documento"><Input {...form.register('document')} /></FormField>
      <Button loading={busy}>Salvar empresa</Button>
    </form>
  );
}
