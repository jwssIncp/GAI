import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { organizationsApi, rbacApi, usersApi } from '@/api/endpoints';
import { FormField } from '@/components/base/FormField';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog, DrawerForm } from '@/components/ui/dialog';
import { useAuth } from '@/features/auth/AuthContext';
import { usePermissions } from '@/features/auth/usePermissions';
import type { AccessProfile, User } from '@/types/api';
import { cumulativeAccess, permissionArea, selectClass } from './accessProfiles';
import { CustomRoleDialog } from './CustomRoleDialog';
import { ProfileUserDialog } from './ProfileUserDialog';

export function RolesPage() {
  const { user } = useAuth();
  const { isPlatformAdmin, hasPermission } = usePermissions();
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get('organization_id'));
  const organizationId = isPlatformAdmin ? (Number.isSafeInteger(requested) && requested > 0 ? requested : undefined) : user?.organization_id ?? undefined;
  const [orgSearch, setOrgSearch] = useState('');
  const [orgPage, setOrgPage] = useState(1);
  const [assignment, setAssignment] = useState<{ roleId?: number; user?: User } | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ roleId?: number } | null>(null);
  const profiles = useQuery({ queryKey: ['access-profiles', organizationId], queryFn: () => rbacApi.profiles(organizationId) });
  const organizations = useQuery({ queryKey: ['role-organizations', orgSearch, orgPage], queryFn: () => organizationsApi.list({ status: 'ACTIVE', search: orgSearch, page: orgPage, page_size: 20 }), enabled: isPlatformAdmin });
  const linkedUserId = Number(params.get('user_id'));
  const linkedUser = useQuery({ queryKey: ['profile-linked-user', linkedUserId], queryFn: () => usersApi.get(linkedUserId), enabled: Number.isSafeInteger(linkedUserId) && linkedUserId > 0 });
  const details = profiles.data?.find((profile) => profile.id === detailsId);
  const canAssign = hasPermission('users:write');
  const canEdit = hasPermission('org_roles:write');
  function closeAssignment() { setAssignment(null); if (params.has('user_id')) { const next = new URLSearchParams(params); next.delete('user_id'); setParams(next, { replace: true }); } }
  const validLinkedUser = linkedUser.data && (linkedUser.data.organization_id ?? undefined) === organizationId ? linkedUser.data : undefined;

  return <PageContainer>
    <PageHeader title="Perfis e acessos" description="Gerencie os perfis e níveis de acesso dos usuários da sua organização." action={<>
      {canAssign && <Button className="w-full sm:w-auto" disabled={!profiles.data?.length} onClick={() => setAssignment({})}><UsersRound size={17} />Atribuir perfil</Button>}
      {canEdit && organizationId && <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setEditor({})}><Plus size={17} />Criar perfil personalizado</Button>}
    </>} />
    {isPlatformAdmin && <section className="premium-panel grid gap-4 p-5" aria-label="Contexto de administração">
      <div><h2 className="font-semibold">Contexto de administração</h2><p className="mt-1 text-sm text-muted-foreground">Separe os acessos globais da administração de cada organização.</p></div>
      <FormField label="Pesquisar organização"><Input value={orgSearch} onChange={(event) => { setOrgSearch(event.target.value); setOrgPage(1); }} /></FormField>
      <FormField label="Organização ativa"><select className={selectClass} value={organizationId ?? ''} onChange={(event) => { setDetailsId(null); setAssignment(null); setEditor(null); const next = new URLSearchParams(); if (event.target.value) next.set('organization_id', event.target.value); setParams(next); }}><option value="">Plataforma · administração global</option>{organizationId && !organizations.data?.items.some((org) => org.id === organizationId) && <option value={organizationId}>Organização {organizationId}</option>}{organizations.data?.items.map((org) => <option key={org.id} value={org.id}>{org.trade_name || org.legal_name}</option>)}</select></FormField>
      {organizations.isLoading && <p role="status" className="text-sm text-muted-foreground">Carregando organizações…</p>}
      {organizations.isError && <ErrorState message={organizations.error.message} onRetry={() => void organizations.refetch()} />}
      {(organizations.data?.total_pages ?? 0) > 1 && <Pagination page={orgPage} totalPages={organizations.data!.total_pages} onPageChange={setOrgPage} />}
    </section>}
    <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">{cumulativeAccess}</div>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{organizationId ? 'Perfis da organização' : 'Perfis da plataforma'}</h2>{profiles.data && <span className="text-sm text-muted-foreground">{profiles.data.length} perfil(is) disponível(is)</span>}</div>
    {profiles.isLoading ? <LoadingState label="Carregando perfis disponíveis" /> : profiles.isError ? <ErrorState message={profiles.error.message} onRetry={() => void profiles.refetch()} /> : !profiles.data?.length ? <EmptyState title="Nenhum perfil disponível" description="Não há perfis ativos que você possa conceder neste contexto." /> : <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {profiles.data.map((profile) => <article key={profile.id} className="premium-panel flex min-w-0 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${profile.type === 'SYSTEM' ? 'bg-primary-subtle text-primary' : 'bg-muted text-muted-foreground'}`}>{profile.type === 'SYSTEM' ? <ShieldCheck size={23} /> : <UserRound size={23} />}</span><span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{profile.type === 'SYSTEM' ? 'Sistema · protegido' : 'Personalizado'}</span></div>
        <h3 className="mt-4 break-words text-lg font-semibold tracking-tight">{profile.name}</h3>
        <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{profile.description || 'Perfil personalizado com acessos definidos pela organização.'}</p>
        <p className="mt-4 text-sm font-medium">{profile.user_count} usuário(s) vinculado(s)</p>
        <p className="mb-5 mt-2 text-sm leading-6 text-muted-foreground">{accessSummary(profile)}</p>
        <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:flex-wrap"><Button variant="secondary" size="sm" onClick={() => setDetailsId(profile.id)}>Ver detalhes</Button>{canAssign && <Button size="sm" onClick={() => setAssignment({ roleId: profile.id })}>Atribuir perfil</Button>}</div>
      </article>)}
    </div>}
    {linkedUser.isError && <ErrorState message={linkedUser.error.message} />}
    {linkedUser.data && !validLinkedUser && <ErrorState message="O usuário não pertence ao contexto selecionado." />}
    {(assignment || (validLinkedUser && canAssign)) && profiles.data && <ProfileUserDialog key={`${organizationId}-${assignment?.roleId}-${assignment?.user?.id ?? validLinkedUser?.id}`} profiles={profiles.data} organizationId={organizationId} initialRoleId={assignment?.roleId} initialUser={assignment?.user ?? validLinkedUser} onClose={closeAssignment} />}
    {editor && organizationId && <CustomRoleDialog organizationId={organizationId} roleId={editor.roleId} onClose={() => setEditor(null)} />}
    {details && <ProfileDetails key={details.id} profile={details} organizationId={organizationId} canEdit={canEdit} canAssign={canAssign} onClose={() => setDetailsId(null)} onEdit={() => { setDetailsId(null); setEditor({ roleId: details.id }); }} onManage={(member) => { setDetailsId(null); setAssignment({ user: member }); }} />}
  </PageContainer>;
}

function accessSummary(profile: AccessProfile) {
  if (!profile.permission_count) return 'Sem permissões associadas. Este perfil, sozinho, não libera funcionalidades.';
  if (profile.administrative) return profile.key === 'PLATFORM_ADMIN' ? 'Administração global da plataforma.' : 'Administração ampla dos recursos da organização.';
  const areas = [...new Set(profile.access_areas.map(permissionArea))];
  return `Acessos configurados em: ${areas.join(', ')}. Algumas ações também exigem perfil administrativo.`;
}

function ProfileDetails({ profile, organizationId, canEdit, canAssign, onClose, onEdit, onManage }: { profile: AccessProfile; organizationId?: number; canEdit: boolean; canAssign: boolean; onClose: () => void; onEdit: () => void; onManage: (user: User) => void }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(false);
  const client = useQueryClient();
  const members = useQuery({ queryKey: ['profile-users', organizationId, profile.id, page, search], queryFn: () => usersApi.list({ organization_id: organizationId, scope: organizationId ? 'ORGANIZATION' : 'PLATFORM', role_id: profile.id, page, page_size: 20, search }) });
  const remove = useMutation({ mutationFn: () => rbacApi.deleteRole(organizationId!, profile.id), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['access-profiles'] }); onClose(); } });
  return <DrawerForm open onOpenChange={(open) => { if (!open) onClose(); }} title={profile.name}>
    <div className="grid min-w-0 gap-5">
      <p className="break-words text-sm leading-6 text-muted-foreground">{profile.description}</p>
      <p className="text-sm">{accessSummary(profile)}</p>
      {profile.type === 'SYSTEM' && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Perfil de sistema protegido contra edição.</p>}
      {profile.editable && canEdit && <div className="flex flex-col gap-2 sm:flex-row"><Button variant="secondary" onClick={onEdit}>Editar perfil</Button><Button variant="danger" onClick={() => setDeleting(true)}>Excluir perfil</Button></div>}
      <h3 className="font-semibold">Usuários vinculados</h3>
      <FormField label="Pesquisar usuários vinculados"><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></FormField>
      {members.isLoading ? <LoadingState /> : members.isError ? <ErrorState message={members.error.message} onRetry={() => void members.refetch()} /> : !members.data?.data.length ? <EmptyState title="Nenhum usuário encontrado" description="Nenhum vínculo corresponde à busca neste contexto." /> : members.data.data.map((member) => <div key={member.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4"><div className="min-w-0"><p className="break-words font-medium">{member.login}</p><p className="break-words text-sm text-muted-foreground">{member.email} · {member.status === 'ACTIVE' ? 'Ativo' : 'Inativo ou bloqueado'}</p></div>{canAssign && <Button variant="secondary" size="sm" onClick={() => onManage(member)}>Gerenciar perfis</Button>}</div>)}
      {(members.data?.meta.total_pages ?? 0) > 1 && <Pagination page={page} totalPages={members.data!.meta.total_pages} onPageChange={setPage} />}
      <p className="text-sm leading-6 text-muted-foreground">{cumulativeAccess}</p>
      {remove.isError && <ErrorState message={remove.error.message} />}
      <Button variant="secondary" onClick={onClose}>Fechar detalhes</Button>
    </div>
    <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="Excluir perfil personalizado?" description="O perfil será desativado e seu histórico será preservado. Revogue os vínculos existentes antes de continuar." busy={remove.isPending} onConfirm={() => remove.mutate()} />
    {deleting && remove.isError && <p role="alert" className="fixed bottom-4 left-4 right-4 z-[60] rounded-lg border border-destructive bg-popover p-4 text-sm text-destructive">{remove.error.message}</p>}
  </DrawerForm>;
}
