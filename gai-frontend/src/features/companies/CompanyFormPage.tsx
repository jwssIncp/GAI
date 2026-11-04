import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, MapPin, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import { companiesApi, organizationsApi } from '@/api/endpoints';
import { normalizePage } from '@/api/pagination';
import { ApiError } from '@/api/http';
import { FormField } from '@/components/base/FormField';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { SearchInput } from '@/components/base/SearchInput';
import { ErrorState, LoadingState } from '@/components/base/States';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-context';
import { useAuth } from '@/features/auth/AuthContext';
import { usePermissions } from '@/features/auth/usePermissions';
import { isValidPhone, maskPhone, normalizePhone } from '@/features/field-agents/brazilianContact';
import type { Company, CompanyStatus, CreateCompanyRequest } from '@/types/api';
import { companyFieldNames, companyListReturn, companySections, companyStatusLabels, isValidCnpj, maskCnpj, maskZipcode, normalizeCnpj, type CompanyField } from './companyFields';
import { lookupPostalAddress, type PostalAddress } from './postalLookup';

type Values = Record<CompanyField, string> & { organization_id: string; status: CompanyStatus };
const selectClass = 'min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function initialValues(company?: Company): Values {
  const values = {
    ...Object.fromEntries(companyFieldNames.map((name) => [name, company?.[name] ?? (name === 'country' && !company ? 'BR' : '')])),
    organization_id: company ? String(company.organization_id) : '', status: company?.status ?? 'active',
  } as Values;
  values.document = maskCnpj(values.document);
  if (values.country.trim().toUpperCase() === 'BR') {
    values.zipcode = maskZipcode(values.zipcode);
    values.phone = maskPhone(values.phone);
  }
  return values;
}

export function CompanyFormPage() {
  const { id } = useParams();
  const validId = id === undefined || (/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)));
  const query = useQuery({ queryKey: ['companies', 'detail', Number(id)], queryFn: () => companiesApi.get(Number(id)), enabled: id !== undefined && validId });
  if (!validId) return <PageContainer><ErrorState message="Empresa inválida." /></PageContainer>;
  if (id && query.isLoading) return <PageContainer><LoadingState label="Carregando empresa" /></PageContainer>;
  if (id && query.isError) return <PageContainer><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></PageContainer>;
  if (id && !query.data) return null;
  return <CompanyEditor key={id ?? 'new'} company={query.data} />;
}

function CompanyEditor({ company }: { company?: Company }) {
  const { user } = useAuth();
  const { isPlatformAdmin, hasPermission } = usePermissions();
  const { toast } = useToast();
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = companyListReturn(location.search);
  const form = useForm<Values>({ defaultValues: initialValues(company), mode: 'onBlur' });
  const { register, control, getValues, setValue, setError, formState: { errors, isDirty, isSubmitting, dirtyFields } } = form;
  const country = useWatch({ control, name: 'country' });
  const zipcode = useWatch({ control, name: 'zipcode' });
  const isBrazil = country.trim().toUpperCase() === 'BR';
  const [organizationPage, setOrganizationPage] = useState(1);
  const [organizationSearch, setOrganizationSearch] = useState('');
  const selectedOrganization = useWatch({ control, name: 'organization_id' });
  const organizations = useQuery({ queryKey: ['organizations', 'company-create', organizationPage, organizationSearch], queryFn: () => organizationsApi.list({ page: organizationPage, page_size: 100, search: organizationSearch || undefined, status: 'ACTIVE' }), enabled: isPlatformAdmin && !company });
  const organizationOptions = organizations.data ? normalizePage(organizations.data) : null;
  const [cepBusy, setCepBusy] = useState(false);
  const [cepMessage, setCepMessage] = useState('');
  const [proposal, setProposal] = useState<Partial<PostalAddress> | null>(null);
  const [saveError, setSaveError] = useState('');
  const submitted = useRef(false);
  const saved = useRef(false);
  const postalRequest = useRef<AbortController | null>(null);
  const lastCep = useRef('');
  const blocker = useBlocker(() => !saved.current && (isDirty || submitted.current));
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!saved.current && (isDirty || submitted.current)) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [isDirty]);
  useEffect(() => {
    postalRequest.current?.abort(); setCepBusy(false); setProposal(null); setCepMessage('');
    return () => postalRequest.current?.abort();
  }, [country, zipcode]);
  useEffect(() => { form.setFocus('name'); }, [form]);

  const mutation = useMutation({ mutationFn: (payload: CreateCompanyRequest) => company ? companiesApi.update(company.id, payload) : companiesApi.create(payload) });
  const busy = mutation.isPending || isSubmitting;
  const missingOrganization = !isPlatformAdmin && !user?.organization_id;
  const readOnly = Boolean(company?.deleted_at);

  function applyAddress(address: Partial<PostalAddress>) {
    for (const [key, value] of Object.entries(address)) if (value) setValue(key as keyof PostalAddress, value, { shouldDirty: true, shouldValidate: true });
    setProposal(null); setCepMessage('Endereço preenchido. Revise os dados e informe o número.');
  }

  async function consultCep(force = false) {
    const cep = getValues('zipcode').replace(/\D/g, '');
    if (!isBrazil || cepBusy || !/^\d{8}$/.test(cep) || (!force && lastCep.current === cep)) return;
    postalRequest.current?.abort();
    const controller = new AbortController(); postalRequest.current = controller;
    const snapshot = getValues();
    setCepBusy(true); setCepMessage('Consultando CEP...');
    try {
      const result = await lookupPostalAddress(cep, controller.signal);
      if (controller.signal.aborted || getValues('zipcode').replace(/\D/g, '') !== cep || getValues('country').trim().toUpperCase() !== 'BR') return;
      lastCep.current = cep;
      const candidate: Partial<PostalAddress> = {};
      let replacesExisting = false;
      for (const key of Object.keys(result) as (keyof PostalAddress)[]) {
        if (result[key] && getValues(key) === snapshot[key] && result[key] !== snapshot[key]) {
          candidate[key] = result[key]; if (snapshot[key]) replacesExisting = true;
        }
      }
      if (replacesExisting) { setProposal(candidate); setCepMessage('Confirme a substituição dos campos já preenchidos.'); }
      else applyAddress(candidate);
    } catch (error) {
      if (!controller.signal.aborted) setCepMessage(error instanceof Error ? error.message : 'Falha na consulta. Preencha manualmente.');
    } finally { if (postalRequest.current === controller) setCepBusy(false); }
  }

  function invalid(fields: FieldErrors<Values>) {
    const name = Object.keys(fields)[0] as keyof Values;
    const element = document.getElementsByName(name)[0];
    element?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); form.setFocus(name);
  }

  async function submit(values: Values) {
    if (submitted.current || readOnly || missingOrganization) return;
    submitted.current = true; setSaveError('');
    const payload: Record<string, unknown> = {};
    for (const name of companyFieldNames) {
      if (company && !dirtyFields[name]) continue;
      let value = values[name].trim();
      if (name === 'document') value = normalizeCnpj(value);
      if (name === 'phone' && isBrazil) value = normalizePhone(value);
      if (name === 'zipcode' && isBrazil) value = value.replace(/\D/g, '');
      payload[name] = value || null;
    }
    if (!company || dirtyFields.status) payload.status = values.status;
    if (!company && isPlatformAdmin) payload.organization_id = Number(values.organization_id);
    try {
      const result = await mutation.mutateAsync(payload as CreateCompanyRequest);
      saved.current = true;
      client.setQueryData(['companies', 'detail', result.id], result);
      await client.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: company ? 'Empresa atualizada' : 'Empresa cadastrada', tone: 'success' });
      navigate(`/app/companies/${result.id}${location.search}`, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.';
      setSaveError(message);
      if (error instanceof ApiError) for (const detail of error.details ?? []) {
        if (companyFieldNames.includes(detail.field as CompanyField)) setError(detail.field as CompanyField, { message: detail.message });
      }
      toast({ title: 'Não foi possível salvar', description: message, tone: 'error' });
    } finally { submitted.current = false; }
  }

  return <PageContainer>
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground"><Link to={returnTo} className="hover:text-primary">Empresas</Link><span aria-hidden="true"> / </span>{company ? 'Editar empresa' : 'Cadastrar empresa'}</nav>
    <PageHeader title={company ? 'Editar empresa' : 'Cadastrar empresa'} description="Mantenha os dados empresariais organizados e atualizados." action={<Button variant="secondary" disabled={busy} onClick={() => navigate(returnTo)}><ArrowLeft size={16} /> Voltar à listagem</Button>} />
    {missingOrganization ? <ErrorState message="Nenhuma organização válida está vinculada à sessão. Solicite a regularização do acesso." /> : null}
    {readOnly ? <ErrorState message="Esta empresa está desativada. Reative-a na página de detalhes antes de editar." /> : null}
    <form className="mx-auto grid w-full max-w-5xl gap-6" noValidate onSubmit={form.handleSubmit(submit, invalid)}>
      {Object.keys(errors).length ? <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-4 text-sm text-destructive">Revise os campos destacados antes de salvar.</div> : null}
      {saveError ? <ErrorState message={saveError} /> : null}
      <fieldset disabled={busy || readOnly || missingOrganization} className="grid min-w-0 gap-6">
        {isPlatformAdmin && !company ? <section className="premium-panel grid gap-4 p-5 sm:p-7">
          <SearchInput value={organizationSearch} onChange={(value) => { setOrganizationSearch(value); setOrganizationPage(1); }} placeholder="Buscar organização" />
          <FormField label="Organização" error={errors.organization_id?.message} hint="O vínculo será validado pelo servidor."><select required className={selectClass} {...register('organization_id', { required: 'Selecione uma organização.' })}><option value="">Selecione uma organização</option>{selectedOrganization && !organizationOptions?.items.some((org) => String(org.id) === selectedOrganization) ? <option value={selectedOrganization}>Organização #{selectedOrganization} selecionada</option> : null}{organizationOptions?.items.map((org) => <option key={org.id} value={org.id}>{org.trade_name || org.legal_name}</option>)}</select></FormField>
          {organizationOptions && organizationOptions.totalPages > 1 ? <div className="flex items-center justify-between gap-2 text-sm"><Button type="button" variant="secondary" disabled={organizationPage <= 1 || organizations.isFetching} onClick={() => setOrganizationPage((page) => page - 1)}>Organizações anteriores</Button><span>{organizationPage} / {organizationOptions.totalPages}</span><Button type="button" variant="secondary" disabled={organizationPage >= organizationOptions.totalPages || organizations.isFetching} onClick={() => setOrganizationPage((page) => page + 1)}>Próximas organizações</Button></div> : null}
          {organizations.isLoading ? <p role="status" className="text-sm">Carregando organizações...</p> : null}{organizations.isError ? <ErrorState message="Não foi possível carregar as organizações." onRetry={() => void organizations.refetch()} /> : null}
        </section> : null}
        {!company && !isPlatformAdmin && !missingOrganization ? <p className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"><Building2 size={18} /> A empresa será vinculada automaticamente à sua organização.</p> : null}
        {companySections.map((section, index) => <section className="premium-panel p-5 sm:p-7" key={section.title} aria-labelledby={`company-section-${index}`}>
          <h2 id={`company-section-${index}`} className="text-lg font-bold">{section.title}</h2><p className="mb-6 mt-1 text-sm text-muted-foreground">{section.description}</p>
          <div className="grid gap-5 md:grid-cols-2">
            {section.fields.map(([name, label, maxLength]) => <FormField key={name} label={label} error={errors[name]?.message} optional={name !== 'name'} hint={name === 'document' ? 'CNPJ numérico ou alfanumérico, com 14 posições.' : name === 'country' ? 'Use BR para Brasil. Outros países permitem endereço manual.' : undefined}>
              <Input maxLength={maxLength} required={name === 'name'} type={name === 'email' ? 'email' : 'text'} inputMode={name === 'phone' ? 'tel' : name === 'zipcode' && isBrazil ? 'numeric' : 'text'} autoComplete={name === 'email' ? 'email' : name === 'phone' ? 'tel-national' : name === 'zipcode' ? 'postal-code' : 'off'} {...register(name, {
                required: name === 'name' ? 'Informe o nome da empresa.' : false,
                validate: (value) => {
                  if (name === 'name') return value.trim().length >= 2 || 'Use pelo menos 2 caracteres.';
                  if (!value.trim()) return true;
                  if (name === 'document') return isValidCnpj(value) || 'CNPJ inválido. Confira os caracteres e dígitos verificadores.';
                  if (name === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Informe um e-mail válido.';
                  if (name === 'phone' && isBrazil) return isValidPhone(value) || 'Informe DDD e telefone fixo ou celular.';
                  if (name === 'zipcode' && isBrazil) return /^\d{8}$/.test(value.replace(/\D/g, '')) || 'Informe um CEP com 8 dígitos.';
                  return true;
                },
                onChange: (event) => {
                  const value = String(event.target.value);
                  if (name === 'document') setValue(name, maskCnpj(value), { shouldDirty: true });
                  if (name === 'phone' && isBrazil) setValue(name, maskPhone(value), { shouldDirty: true });
                  if (name === 'zipcode' && isBrazil) setValue(name, maskZipcode(value), { shouldDirty: true });
                },
                onBlur: name === 'zipcode' ? () => void consultCep() : undefined,
              })} />
            </FormField>)}
            {index === 0 ? <FormField label="Situação" hint="Situação operacional interna do GAI; não corresponde à situação cadastral da Receita."><select className={selectClass} {...register('status')}><option value={company?.status ?? 'active'}>{companyStatusLabels[company?.status ?? 'active']}</option>{(['active', 'inactive', 'blocked'] as const).filter((status) => status !== (company?.status ?? 'active') && hasPermission(status === 'active' ? 'companies:reactivate' : 'companies:deactivate')).map((status) => <option key={status} value={status}>{companyStatusLabels[status]}</option>)}</select></FormField> : null}
          </div>
          {index === 2 ? <div className="mt-5 grid gap-3"><div><Button type="button" variant="secondary" disabled={!isBrazil || cepBusy || !/^\d{8}$/.test(zipcode.replace(/\D/g, ''))} loading={cepBusy} onClick={() => void consultCep(true)}><MapPin size={16} /> Consultar CEP</Button></div><p role="status" aria-live="polite" className="text-sm text-muted-foreground">{isBrazil ? cepMessage || 'Número e complemento devem ser informados por você.' : 'Consulta de CEP disponível apenas para Brasil (BR). Preencha o endereço manualmente.'}</p></div> : null}
        </section>)}
      </fieldset>
      <div className="flex flex-wrap justify-end gap-3 rounded-xl border border-border bg-card p-4 shadow-panel">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => navigate(returnTo)}>Cancelar</Button>
        <Button type="submit" loading={busy} disabled={readOnly || missingOrganization || (Boolean(company) && !isDirty)}><Save size={16} /> {company ? 'Salvar alterações' : 'Cadastrar empresa'}</Button>
      </div>
    </form>
    <ConfirmDialog open={blocker.state === 'blocked'} onOpenChange={(open) => { if (!open && blocker.state === 'blocked') blocker.reset(); }} title="Descartar alterações?" description="Há alterações não salvas. Ao sair, elas serão descartadas." onConfirm={() => { if (blocker.state === 'blocked' && !submitted.current) blocker.proceed(); }} busy={busy} />
    <ConfirmDialog open={Boolean(proposal)} onOpenChange={(open) => { if (!open) setProposal(null); }} title="Atualizar endereço pelo CEP?" description="A consulta encontrou um endereço diferente. Confirme para substituir os campos de endereço já preenchidos. Número e complemento serão preservados." onConfirm={() => proposal && applyAddress(proposal)} />
  </PageContainer>;
}
