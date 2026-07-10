import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/api/endpoints';
import { FormField } from '@/components/base/FormField';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResourceListPage } from '@/features/shared/ResourceListPage';
import { formatDate } from '@/utils/format';
import type { CreateProjectRequest, Project } from '@/types/api';

export function ProjectsPage() {
  return (
    <ResourceListPage<Project, CreateProjectRequest>
      title="Projetos"
      entityLabel="projeto"
      description="Projetos de inventário patrimonial organizados por empresa e operação."
      queryKey="projects"
      createPermissions={['projects:create']}
      list={projectsApi.list}
      create={projectsApi.create}
      getKey={(item) => item.id}
      columns={[
        { header: 'Projeto', cell: (item) => <Link className="font-semibold text-primary transition hover:text-primary/80" to={`/app/projects/${item.id}/summary`}>{item.name}</Link> },
        { header: 'Organização', cell: (item) => item.organization_id },
        { header: 'Empresa', cell: (item) => item.company_id ?? '-' },
        { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
        { header: 'Periodo', cell: (item) => `${formatDate(item.start_date)} - ${formatDate(item.end_date)}` },
      ]}
      form={(submit, busy) => <ProjectForm onSubmit={submit} busy={busy} />}
    />
  );
}

function ProjectForm({ onSubmit, busy }: { onSubmit: (payload: CreateProjectRequest) => void; busy: boolean }) {
  const form = useForm<CreateProjectRequest>();
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit({ ...values, organization_id: Number(values.organization_id), company_id: Number(values.company_id) }))}>
      <FormField label="Organization ID"><Input type="number" {...form.register('organization_id', { required: true })} /></FormField>
      <FormField label="Company ID"><Input type="number" {...form.register('company_id', { required: true })} /></FormField>
      <FormField label="Nome"><Input {...form.register('name', { required: true })} /></FormField>
      <FormField label="Descricao"><Input {...form.register('description')} /></FormField>
      <FormField label="Inicio"><Input type="date" {...form.register('start_date')} /></FormField>
      <FormField label="Fim"><Input type="date" {...form.register('end_date')} /></FormField>
      <Button loading={busy}>Salvar projeto</Button>
    </form>
  );
}
