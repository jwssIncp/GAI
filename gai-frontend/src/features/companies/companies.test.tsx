import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { Company, CurrentUser } from '@/types/api';
import { CompaniesPage } from './CompaniesPage';
import { CompanyFormPage } from './CompanyFormPage';
import { CompanyDetailPage } from './CompanyDetailPage';
import { isValidCnpj, maskCnpj, normalizeCnpj } from './companyFields';

const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), reactivate: vi.fn(), organizations: vi.fn(), cep: vi.fn() }));
vi.mock('@/api/endpoints', () => ({ companiesApi: mocks, organizationsApi: { list: mocks.organizations } }));
vi.mock('./postalLookup', () => ({ lookupPostalAddress: mocks.cep }));
const company: Company = { id: 7, name: 'Empresa original', organization_id: 1, document: '12ABC34501DE35', email: 'original@empresa.com', phone: '1133334444', zipcode: '01001000', address: 'Rua original', city: 'São Paulo', country: 'BR', metadata: { keep: true }, status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const user: CurrentUser = { id: 2, login: 'org.admin', email: 'admin@gai.local', organization_id: 1, status: 'ACTIVE', role_assignments: [{ assignment_id: 1, role_id: 2, role_key: 'ORG_ADMIN', role_name: 'Admin', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01' }] };

function setup(path = '/app/companies/new', currentUser = user) {
  const router = createMemoryRouter([
    { path: '/app/companies', element: <CompaniesPage /> },
    { path: '/app/companies/new', element: <CompanyFormPage /> },
    { path: '/app/companies/:id/edit', element: <CompanyFormPage /> },
    { path: '/app/companies/:id', element: <CompanyDetailPage /> },
  ], { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<AuthContext.Provider value={{ user: currentUser } as AuthState}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></AuthContext.Provider>);
  return { router, user: userEvent.setup() };
}

beforeEach(() => {
  // React Router's Node Request and jsdom's AbortSignal use different realms.
  const NativeRequest = globalThis.Request;
  vi.stubGlobal('Request', class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, { ...init, signal: undefined }); }
  });
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(company);
  mocks.list.mockResolvedValue({ items: [company], page: 1, page_size: 20, total_items: 1, total_pages: 1 });
  mocks.create.mockResolvedValue(company); mocks.update.mockResolvedValue(company);
  mocks.cep.mockResolvedValue({ address: 'Praça da Sé', district: 'Sé', city: 'São Paulo', state: 'SP' });
});
afterEach(() => vi.unstubAllGlobals());

describe('Company pages', () => {
  it('navigates from the list to dedicated create and edit pages and preserves filters', async () => {
    const ctx = setup('/app/companies?search=Empresa&page=2');
    await ctx.user.click(await screen.findByRole('button', { name: 'Nova empresa' }));
    expect(await screen.findByRole('heading', { name: 'Cadastrar empresa' })).toBeInTheDocument();
    expect(ctx.router.state.location.search).toBe('?search=Empresa&page=2');
    await ctx.user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await ctx.user.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(await screen.findByRole('heading', { name: 'Editar empresa' })).toBeInTheDocument();
    expect(await screen.findByLabelText('E-mail')).toHaveValue('original@empresa.com');
  });

  it('automatically associates ORG_ADMIN and sends full data without an organization from the browser', async () => {
    const ctx = setup();
    expect(screen.queryByLabelText('Organização')).not.toBeInTheDocument();
    await ctx.user.type(screen.getByLabelText('Nome da empresa'), 'Empresa nova');
    await ctx.user.type(screen.getByLabelText('CNPJ'), '12abc34501de35');
    expect(screen.getByLabelText('CNPJ')).toHaveValue('12.ABC.345/01DE-35');
    await ctx.user.type(screen.getByLabelText('Cidade'), 'Curitiba');
    await ctx.user.click(screen.getByRole('button', { name: 'Cadastrar empresa' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ name: 'Empresa nova', document: '12ABC34501DE35', city: 'Curitiba', country: 'BR' });
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('organization_id');
    expect(await screen.findByRole('heading', { name: company.name })).toBeInTheDocument();
  });

  it('validates fields and keeps the first invalid input focused', async () => {
    const ctx = setup();
    await ctx.user.click(screen.getByRole('button', { name: 'Cadastrar empresa' }));
    expect(await screen.findByText('Informe o nome da empresa.')).toBeInTheDocument();
    await ctx.user.type(screen.getByLabelText('Nome da empresa'), 'Inválida');
    await ctx.user.type(screen.getByLabelText('CNPJ'), '12ABC34501DE34');
    await ctx.user.click(screen.getByRole('button', { name: 'Cadastrar empresa' }));
    expect(await screen.findByText(/CNPJ inválido/)).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveFocus();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('sends only edited fields, supports explicit clearing and preserves server metadata', async () => {
    const ctx = setup('/app/companies/7/edit');
    const email = await screen.findByLabelText('E-mail');
    await ctx.user.clear(email);
    await ctx.user.type(screen.getByLabelText('Complemento'), 'Sala nova');
    await ctx.user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(7, { email: null, complement: 'Sala nova' }));
  });

  it('consults CEP, fills available fields and keeps number and complement', async () => {
    const ctx = setup();
    await ctx.user.type(screen.getByLabelText('Número'), '52');
    await ctx.user.type(screen.getByLabelText('Complemento'), 'Casa');
    await ctx.user.type(screen.getByLabelText('CEP'), '01001000');
    await ctx.user.tab();
    await waitFor(() => expect(screen.getByLabelText('Logradouro')).toHaveValue('Praça da Sé'));
    expect(screen.getByLabelText('Número')).toHaveValue('52');
    expect(screen.getByLabelText('Complemento')).toHaveValue('Casa');
    expect(mocks.cep).toHaveBeenCalledOnce();
    await ctx.user.click(screen.getByLabelText('CEP')); await ctx.user.tab();
    expect(mocks.cep).toHaveBeenCalledOnce();
  });

  it('keeps manual entry available after lookup errors and disables Brazilian lookup abroad', async () => {
    mocks.cep.mockRejectedValue(new Error('CEP não encontrado. Preencha manualmente.'));
    const ctx = setup();
    await ctx.user.type(screen.getByLabelText('CEP'), '99999999'); await ctx.user.tab();
    expect(await screen.findByText(/CEP não encontrado/)).toBeInTheDocument();
    await ctx.user.type(screen.getByLabelText('Logradouro'), 'Rua manual');
    await ctx.user.clear(screen.getByLabelText('País')); await ctx.user.type(screen.getByLabelText('País'), 'US');
    expect(screen.getByRole('button', { name: 'Consultar CEP' })).toBeDisabled();
    expect(screen.getByLabelText('Logradouro')).toHaveValue('Rua manual');
  });

  it('asks before discarding changes and preserves the form when canceled', async () => {
    const ctx = setup();
    await ctx.user.type(screen.getByLabelText('Nome da empresa'), 'Pendente');
    await ctx.user.click(screen.getByRole('button', { name: 'Voltar à listagem' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Descartar alterações?');
    await ctx.user.click(screen.getAllByRole('button', { name: 'Cancelar' }).at(-1)!);
    expect(screen.getByLabelText('Nome da empresa')).toHaveValue('Pendente');
    await ctx.user.click(screen.getByRole('button', { name: 'Voltar à listagem' }));
    await ctx.user.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(ctx.router.state.location.pathname).toBe('/app/companies'));
  });

  it('renders errors and loading without permitting duplicate saves', async () => {
    let rejectSave!: (error: Error) => void;
    mocks.create.mockImplementation(() => new Promise((_, reject) => { rejectSave = reject; }));
    const ctx = setup();
    await ctx.user.type(screen.getByLabelText('Nome da empresa'), 'Nova empresa');
    await ctx.user.click(screen.getByRole('button', { name: 'Cadastrar empresa' }));
    expect(screen.getByRole('button', { name: 'Cadastrar empresa' })).toBeDisabled();
    expect(mocks.create).toHaveBeenCalledOnce();
    rejectSave(new Error('CNPJ duplicado'));
    expect(await screen.findByText('CNPJ duplicado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar empresa' })).toBeEnabled();
  });

  it('requires an organization for global administrators and allows searching authorized options', async () => {
    const globalUser: CurrentUser = { ...user, organization_id: null, role_assignments: [{ ...user.role_assignments[0], role_key: 'PLATFORM_ADMIN', organization_id: null }] };
    mocks.organizations.mockResolvedValue({ items: [{ id: 42, legal_name: 'Organização autorizada', status: 'ACTIVE' }], page: 1, page_size: 100, total_items: 1, total_pages: 1 });
    const ctx = setup('/app/companies/new', globalUser);
    await ctx.user.type(screen.getByLabelText('Nome da empresa'), 'Empresa global');
    await ctx.user.click(screen.getByRole('button', { name: 'Cadastrar empresa' }));
    expect(await screen.findByText('Selecione uma organização.')).toBeInTheDocument();
    await ctx.user.type(screen.getByPlaceholderText('Buscar organização'), 'autorizada');
    await ctx.user.selectOptions(screen.getByLabelText('Organização'), '42');
    await ctx.user.click(screen.getByRole('button', { name: 'Cadastrar empresa' }));
    await waitFor(() => expect(mocks.create.mock.calls[0][0]).toMatchObject({ organization_id: 42, name: 'Empresa global' }));
  });

  it('blocks registration when the authenticated session has no organization', () => {
    setup('/app/companies/new', { ...user, organization_id: null });
    expect(screen.getByText(/Nenhuma organização válida/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar empresa' })).toBeDisabled();
  });

  it('asks before replacing an existing address and permits an explicit CEP retry', async () => {
    const ctx = setup('/app/companies/7/edit');
    await screen.findByLabelText('Logradouro');
    await ctx.user.click(screen.getByRole('button', { name: 'Consultar CEP' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Atualizar endereço pelo CEP?');
    expect(screen.getByLabelText('Logradouro')).toHaveValue('Rua original');
    await ctx.user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(screen.getByLabelText('Logradouro')).toHaveValue('Praça da Sé');
    await ctx.user.click(screen.getByRole('button', { name: 'Consultar CEP' }));
    expect(mocks.cep).toHaveBeenCalledTimes(2);
  });

  it('protects edits made while a CEP response is pending and warns on browser unload', async () => {
    let resolveCep!: (value: { address: string; district: string; city: string; state: string }) => void;
    mocks.cep.mockImplementation(() => new Promise((resolve) => { resolveCep = resolve; }));
    const ctx = setup();
    await ctx.user.type(screen.getByLabelText('CEP'), '01001000'); await ctx.user.tab();
    await ctx.user.type(screen.getByLabelText('Logradouro'), 'Meu endereço manual');
    resolveCep({ address: 'Outro endereço', district: 'Sé', city: 'São Paulo', state: 'SP' });
    await waitFor(() => expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo'));
    expect(screen.getByLabelText('Logradouro')).toHaveValue('Meu endereço manual');
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('CNPJ presentation', () => {
  it.each(['12.ABC.345/01DE-35', '11.444.777/0001-61', '04.252.011/0001-10'])('validates and masks %s without losing information', (value) => {
    expect(isValidCnpj(value)).toBe(true); expect(maskCnpj(normalizeCnpj(value))).toBe(value);
  });
  it.each(['12ABC34501DE34', '12ABC34501DEAA', '00000000000000', '12ÁBC34501DE35'])('rejects %s', (value) => expect(isValidCnpj(value)).toBe(false));
});
