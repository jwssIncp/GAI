import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rbacApi } from '@/api/endpoints';
import { FormField } from '@/components/base/FormField';
import { ErrorState, LoadingState } from '@/components/base/States';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalForm } from '@/components/ui/dialog';
import { useAuth } from '@/features/auth/AuthContext';
import type { OrgRole, Permission } from '@/types/api';
import { actionName, permissionArea, resourceName } from './accessProfiles';

export function CustomRoleDialog({ organizationId, roleId, onClose }: { organizationId: number; roleId?: number; onClose: () => void }) {
  const permissions = useQuery({ queryKey: ['organizational-permissions'], queryFn: rbacApi.permissions });
  const role = useQuery({ queryKey: ['custom-role', organizationId, roleId], queryFn: () => rbacApi.getRole(organizationId, roleId!), enabled: Boolean(roleId) });
  return <ModalForm open onOpenChange={(open) => { if (!open) onClose(); }} title={roleId ? 'Editar perfil personalizado' : 'Criar perfil personalizado'}>
    {permissions.isLoading || (roleId && role.isLoading) ? <LoadingState /> : permissions.isError || role.isError ? <ErrorState message={(permissions.error ?? role.error)?.message} onRetry={() => { void permissions.refetch(); if (roleId) void role.refetch(); }} />
      : <RoleEditor organizationId={organizationId} role={role.data} permissions={(permissions.data ?? []).filter((permission) => permission.scope === 'ORGANIZATION')} onClose={onClose} />}
  </ModalForm>;
}

function RoleEditor({ organizationId, role, permissions, onClose }: { organizationId: number; role?: OrgRole; permissions: Permission[]; onClose: () => void }) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState(role?.permissions.map((permission) => permission.id) ?? []);
  const [search, setSearch] = useState('');
  const auth = useAuth();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), description: description.trim(), permission_ids: selected };
      return role ? rbacApi.updateRole(organizationId, role.id, payload) : rbacApi.createRole(organizationId, payload);
    },
    onSuccess: async () => {
      await Promise.all(['access-profiles', 'custom-role', 'users', 'profile-users'].map((key) => client.invalidateQueries({ queryKey: [key] })));
      await auth.restore(); onClose();
    },
  });
  const groups = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const text = `${resourceName(permission.resource)} ${actionName(permission.action)} ${permission.description}`.toLocaleLowerCase('pt-BR');
    if (!text.includes(search.toLocaleLowerCase('pt-BR'))) continue;
    const area = permissionArea(permission.resource);
    groups.set(area, [...(groups.get(area) ?? []), permission]);
  }
  return <form className="grid min-w-0 gap-5" onSubmit={(event) => { event.preventDefault(); if (selected.length && name.trim()) mutation.mutate(); }}>
    <FormField label="Nome do perfil"><Input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></FormField>
    <FormField label="Descrição" optional><Input maxLength={255} value={description} onChange={(event) => setDescription(event.target.value)} /></FormField>
    <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">Selecione os acessos por área. As funções de usuários e perfis também exigem um perfil administrativo de sistema; selecioná-las não transforma este perfil em administrador.</p>
    <FormField label="Pesquisar funcionalidades"><Input value={search} onChange={(event) => setSearch(event.target.value)} /></FormField>
    <p className="text-sm font-semibold" aria-live="polite">{selected.length} acesso(s) selecionado(s)</p>
    <div className="grid gap-3">
      {[...groups].map(([area, entries]) => <details key={area} className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring">{area} <span className="text-muted-foreground">({entries.filter((permission) => selected.includes(permission.id)).length}/{entries.length})</span></summary>
        <div className="mt-4 grid gap-2">{entries.map((permission) => <label key={permission.id} className="flex min-w-0 items-start gap-3 rounded-lg p-2 text-sm hover:bg-muted/60">
          <input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={selected.includes(permission.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id))} />
          <span className="min-w-0"><span className="block font-medium">{resourceName(permission.resource)} · {actionName(permission.action)}</span>{permission.description && <span className="block break-words text-xs leading-5 text-muted-foreground">{permission.description}</span>}</span>
        </label>)}</div>
      </details>)}
      {!groups.size && <p className="text-sm text-muted-foreground">Nenhuma funcionalidade encontrada.</p>}
    </div>
    {!selected.length && <p className="text-sm text-muted-foreground">Selecione ao menos um acesso organizacional para o perfil personalizado.</p>}
    {mutation.isError && <ErrorState message={mutation.error.message} />}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>Cancelar</Button><Button loading={mutation.isPending} disabled={!selected.length || !name.trim()}>Salvar perfil</Button></div>
  </form>;
}
