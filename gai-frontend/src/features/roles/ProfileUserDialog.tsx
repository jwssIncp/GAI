import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/endpoints';
import { FormField } from '@/components/base/FormField';
import { Pagination } from '@/components/base/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog, ModalForm } from '@/components/ui/dialog';
import { useAuth } from '@/features/auth/AuthContext';
import type { AccessProfile, User } from '@/types/api';
import { cumulativeAccess, roleName, selectClass } from './accessProfiles';

export function ProfileUserDialog({ profiles, organizationId, initialRoleId, initialUser, onClose }: {
  profiles: AccessProfile[]; organizationId?: number; initialRoleId?: number; initialUser?: User; onClose: () => void;
}) {
  const auth = useAuth();
  const client = useQueryClient();
  const [userId, setUserId] = useState(initialUser?.id ?? 0);
  const [roleId, setRoleId] = useState(initialRoleId ?? 0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [replacing, setReplacing] = useState(false);
  const [desired, setDesired] = useState<number[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; execute: () => Promise<unknown> } | null>(null);
  const users = useQuery({ queryKey: ['profile-users', organizationId, search, page], queryFn: () => usersApi.list({ organization_id: organizationId, scope: organizationId ? 'ORGANIZATION' : 'PLATFORM', search, page, page_size: 20 }), enabled: !initialUser });
  const assignments = useQuery({ queryKey: ['user-role-assignments', userId], queryFn: () => usersApi.assignments(userId), enabled: Boolean(userId) });
  const selected = profiles.find((profile) => profile.id === roleId);
  const assignedIds = assignments.data?.map((assignment) => assignment.role_id) ?? [];
  const administrative = replacing ? profiles.some((profile) => desired.includes(profile.id) && profile.administrative) : selected?.administrative;
  const mutation = useMutation({
    mutationFn: (execute: () => Promise<unknown>) => execute(),
    onSuccess: async () => {
      setFeedback('Perfis atualizados com sucesso.');
      setConfirmation(null); setReplacing(false); setAcknowledged(false);
      await Promise.all(['access-profiles', 'users', 'profile-users', 'user-role-assignments'].map((key) => client.invalidateQueries({ queryKey: [key] })));
      if (userId === auth.user?.id) await auth.restore();
    },
  });
  const busy = mutation.isPending;
  function chooseUser(id: number) {
    setUserId(id); setReplacing(false); setAcknowledged(false); setFeedback(''); mutation.reset();
  }

  return <ModalForm open onOpenChange={(open) => { if (!open && !busy) onClose(); }} title={initialUser ? `Perfis de ${initialUser.login}` : 'Atribuir perfil'}>
    <div className="grid min-w-0 gap-5">
      <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">{cumulativeAccess}</p>
      {!initialUser && <>
        <FormField label="Pesquisar usuário" hint="Busque por nome de usuário ou e-mail na organização selecionada."><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); chooseUser(0); }} /></FormField>
        {users.isLoading ? <LoadingState label="Carregando usuários" /> : users.isError ? <ErrorState message={users.error.message} onRetry={() => void users.refetch()} /> : <>
          <FormField label="Usuário"><select className={selectClass} value={userId} onChange={(event) => chooseUser(Number(event.target.value))}><option value={0}>Selecione um usuário</option>{users.data?.data.map((user) => <option value={user.id} key={user.id}>{user.login} — {user.email}</option>)}</select></FormField>
          {users.data?.data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum usuário encontrado neste contexto.</p>}
          {(users.data?.meta.total_pages ?? 0) > 1 && <Pagination page={page} totalPages={users.data!.meta.total_pages} onPageChange={setPage} />}
        </>}
      </>}
      {initialUser && <p className="break-words text-sm text-muted-foreground">{initialUser.email}</p>}
      {userId > 0 && (assignments.isLoading ? <LoadingState label="Consultando perfis do usuário" /> : assignments.isError ? <ErrorState message={assignments.error.message} onRetry={() => void assignments.refetch()} /> : <>
        <section aria-label="Perfis associados" className="grid gap-3">
          <h3 className="font-semibold">Perfis associados</h3>
          {!assignments.data?.length ? <p className="text-sm text-muted-foreground">Este usuário ainda não possui perfis efetivos.</p> : assignments.data.map((assignment) => <div key={assignment.assignment_id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 break-words text-sm font-medium">{roleName(assignment.role_key, assignment.role_name)}</span>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => { mutation.reset(); setConfirmation({ title: 'Revogar perfil?', description: `Revogar ${roleName(assignment.role_key, assignment.role_name)} deste usuário? ${cumulativeAccess} A remoção do último administrador ativo será bloqueada.`, execute: () => usersApi.revokeRole(userId, assignment.assignment_id) }); }}>Revogar</Button>
          </div>)}
        </section>
        {!replacing ? <>
          <FormField label="Perfil"><select className={selectClass} value={roleId} onChange={(event) => { setRoleId(Number(event.target.value)); setAcknowledged(false); mutation.reset(); }}><option value={0}>Selecione um perfil</option>{profiles.map((profile) => <option key={profile.id} value={profile.id} disabled={assignedIds.includes(profile.id)}>{profile.name}{assignedIds.includes(profile.id) ? ' (já atribuído)' : ''}</option>)}</select></FormField>
          {selected && <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6"><p className="font-semibold">{selected.name}</p><p className="text-muted-foreground">{selected.description || 'Perfil personalizado da organização.'}</p>{selected.permission_count === 0 && <p className="mt-2 text-muted-foreground">Sem permissões associadas. Não concede acesso a funcionalidades por si só.</p>}</div>}
        </> : <fieldset className="grid gap-3"><legend className="mb-3 font-semibold">Conjunto de perfis desejado</legend><p className="text-sm text-muted-foreground">Os perfis não selecionados serão revogados na mesma operação.</p>{profiles.map((profile) => <label key={profile.id} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={desired.includes(profile.id)} onChange={(event) => { setDesired((current) => event.target.checked ? [...current, profile.id] : current.filter((id) => id !== profile.id)); setAcknowledged(false); }} /><span>{profile.name}</span></label>)}</fieldset>}
        {administrative && <label className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>Entendo que o perfil administrativo concede privilégios amplos, incluindo o gerenciamento de usuários e acessos.</span></label>}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button disabled={busy || !assignments.data || (!replacing && (!selected || assignedIds.includes(roleId))) || Boolean(administrative && !acknowledged)} loading={busy} onClick={() => {
            mutation.reset(); setFeedback('');
            if (replacing) setConfirmation({ title: 'Substituir perfis?', description: `O conjunto atual será substituído pelos perfis selecionados. Perfis desmarcados serão revogados. ${cumulativeAccess}`, execute: () => usersApi.replaceRoles(userId, desired) });
            else mutation.mutate(() => usersApi.assignRole(userId, roleId));
          }}>{replacing ? 'Confirmar substituição' : 'Confirmar atribuição'}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => { setReplacing(!replacing); setDesired(assignedIds); setAcknowledged(false); mutation.reset(); }}>{replacing ? 'Cancelar substituição' : 'Substituir perfis'}</Button>
        </div>
      </>)}
      {!profiles.length && <EmptyState title="Nenhum perfil disponível" description="Não há perfis concedíveis neste contexto." />}
      {feedback && <p role="status" className="text-sm text-primary-text">{feedback}</p>}
      {mutation.isError && <ErrorState message={mutation.error.message} />}
      <Button variant="secondary" disabled={busy} onClick={onClose}>{feedback ? 'Fechar' : 'Cancelar'}</Button>
    </div>
    <ConfirmDialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !busy) setConfirmation(null); }} title={confirmation?.title ?? ''} description={confirmation?.description ?? ''} busy={busy} onConfirm={() => { if (confirmation) mutation.mutate(confirmation.execute); }} />
    {confirmation && mutation.isError && <p role="alert" className="fixed bottom-4 left-4 right-4 z-[60] rounded-lg border border-destructive bg-popover p-4 text-sm text-destructive">{mutation.error.message}</p>}
  </ModalForm>;
}
