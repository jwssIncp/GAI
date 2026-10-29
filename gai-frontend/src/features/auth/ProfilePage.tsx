import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { GaiLogo } from '@/components/base/GaiLogo';
import { useAuth } from './AuthContext';

export function ProfilePage() {
  const { user, expiresAt } = useAuth();
  return <PageContainer>
    <PageHeader title="Meu perfil" description="Identificação e acessos da sessão atual." />
    <section className="premium-panel max-w-3xl p-5 sm:p-7" aria-label="Dados do usuário">
      <GaiLogo variant="compact" />
      <dl className="mt-7 grid gap-6 text-sm sm:grid-cols-2">
        {[
          ['Login', user?.login], ['Email', user?.email],
          ['Organização', user?.organization_id ? `#${user.organization_id}` : 'Plataforma'],
          ['Situação da conta', user?.status === 'ACTIVE' ? 'Ativa' : user?.status],
          ['Perfis de acesso', user?.role_assignments.map(role => role.role_name).join(', ')],
          ['Expiração da sessão', expiresAt ? new Date(expiresAt).toLocaleString('pt-BR') : 'Não informada'],
        ].map(([label, value]) => <div key={label}><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value || 'Não informado'}</dd></div>)}
      </dl>
      <p className="mt-7 border-t border-border pt-5 text-sm leading-6 text-muted-foreground">Para alterar dados cadastrais ou permissões, solicite a um administrador da sua organização.</p>
    </section>
  </PageContainer>;
}
