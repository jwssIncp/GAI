import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { companiesApi } from '@/api/endpoints';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { StatusBadge } from '@/components/base/StatusBadge';
import { ErrorState, LoadingState } from '@/components/base/States';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/usePermissions';
import { CompanyStatusAction } from './CompaniesPage';
import { companyListReturn, companySections, maskCnpj } from './companyFields';

export function CompanyDetailPage() {
  const { id } = useParams();
  const validId = Boolean(id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)));
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, isPlatformAdmin, roles } = usePermissions();
  const query = useQuery({ queryKey: ['companies', 'detail', Number(id)], queryFn: () => companiesApi.get(Number(id)), enabled: validId });
  const company = query.data;
  const returnTo = companyListReturn(location.search);
  if (!validId) return <PageContainer><ErrorState message="Empresa inválida." /></PageContainer>;
  if (query.isLoading) return <PageContainer><LoadingState label="Carregando empresa" /></PageContainer>;
  if (query.isError) return <PageContainer><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></PageContainer>;
  if (!company) return null;
  return <PageContainer>
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground"><Link to={returnTo} className="hover:text-primary">Empresas</Link><span aria-hidden="true"> / </span>{company.name}</nav>
    <PageHeader title={company.name} description={company.corporate_name || 'Dados cadastrais da empresa.'} action={<><Button variant="secondary" onClick={() => navigate(returnTo)}><ArrowLeft size={16} /> Voltar à listagem</Button>{hasPermission('companies:update') && !company.deleted_at ? <Button onClick={() => navigate(`/app/companies/${company.id}/edit${location.search}`)}><Pencil size={16} /> Editar empresa</Button> : null}<CompanyStatusAction company={company} /></>} />
    <div className="mx-auto grid w-full max-w-5xl gap-6">
      {companySections.map((section, index) => <section className="premium-panel p-5 sm:p-7" key={section.title} aria-labelledby={`detail-section-${index}`}><h2 id={`detail-section-${index}`} className="mb-6 text-lg font-bold">{section.title}</h2><dl className="grid gap-5 sm:grid-cols-2">{section.fields.map(([field, label]) => <div key={field} className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{company[field] ? field === 'document' ? maskCnpj(company[field]) : company[field] : 'Não informado'}</dd></div>)}{index === 0 ? <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Situação operacional no GAI</dt><dd className="mt-1"><StatusBadge value={company.status} /></dd></div> : null}</dl></section>)}
      {isPlatformAdmin || roles.includes('ORG_ADMIN') ? <section className="premium-panel p-5 sm:p-7"><h2 className="mb-6 text-lg font-bold">Informações administrativas</h2><dl className="grid gap-5 sm:grid-cols-2">{[
        ['Organização vinculada', `#${company.organization_id}`], ['Responsável pela criação', company.created_by_id ? `Usuário #${company.created_by_id}` : 'Não informado'],
        ['Última alteração por', company.updated_by_id ? `Usuário #${company.updated_by_id}` : 'Não informado'],
        ['Cadastrada em', new Date(company.created_at).toLocaleString('pt-BR')], ['Atualizada em', new Date(company.updated_at).toLocaleString('pt-BR')],
        ['Desativada em', company.deleted_at ? new Date(company.deleted_at).toLocaleString('pt-BR') : 'Não informado'],
      ].map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>)}</dl></section> : null}
    </div>
  </PageContainer>;
}
