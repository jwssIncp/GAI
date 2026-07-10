import { useForm } from 'react-hook-form';
import { usersApi } from '@/api/endpoints';
import { FormField } from '@/components/base/FormField';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResourceListPage } from '@/features/shared/ResourceListPage';
import type { CreateUserRequest, User } from '@/types/api';

export function UsersPage() {
  return (
    <ResourceListPage<User, CreateUserRequest>
      title="Usuários"
      entityLabel="usuário"
      description="Pessoas, credenciais e perfis de acesso vinculados ao workspace."
      queryKey="users"
      createPermissions={['users:write']}
      list={usersApi.list}
      create={usersApi.create}
      getKey={(item) => item.id}
      columns={[
        { header: 'Usuario', cell: (item) => <div className="font-medium">{item.login}<div className="text-xs text-muted-foreground">{item.email}</div></div> },
        { header: 'Organização', cell: (item) => item.organization_id ?? 'Plataforma' },
        { header: 'Perfis', cell: (item) => item.role_assignments.map((r) => r.role_key ?? r.role_name).join(', ') || '-' },
        { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
      ]}
      form={(submit, busy) => <UserForm onSubmit={submit} busy={busy} />}
    />
  );
}

function UserForm({ onSubmit, busy }: { onSubmit: (payload: CreateUserRequest) => void; busy: boolean }) {
  const form = useForm<CreateUserRequest>();
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => onSubmit({ ...values, organization_id: values.organization_id ? Number(values.organization_id) : undefined }))}>
      <FormField label="Login"><Input {...form.register('login', { required: true })} /></FormField>
      <FormField label="Email"><Input type="email" {...form.register('email', { required: true })} /></FormField>
      <FormField label="Senha inicial"><Input type="password" {...form.register('password', { required: true })} /></FormField>
      <FormField label="Organization ID"><Input type="number" {...form.register('organization_id')} /></FormField>
      <Button loading={busy}>Salvar usuário</Button>
    </form>
  );
}
