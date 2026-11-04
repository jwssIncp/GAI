import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { OrganizationOverviewPage } from './OrganizationOverviewPage';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/http', () => ({ api: { get: mocks.get } }));
const empty = { total_projects: 0, open_projects: 0, open_percentage: 0, statuses: [], timeline: [], projects: [] };
function mount(path = '/app/dashboard') {
  const auth = { user: { id: 1, organization_id: 7 }, bootstrapping: false } as AuthState;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AuthContext.Provider value={auth}><MemoryRouter initialEntries={[path]}><OrganizationOverviewPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>);
}
describe('Organization overview', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/organization-overview' ? empty : { items: [], total: 0, page: 1, page_size: 10 } })); });
  it('shows operational zero counts without exposing commercial metrics to users without permission', async () => {
    mount();
    expect(await screen.findByText('Nenhum projeto encontrado')).toBeInTheDocument();
    expect(screen.queryByText('Contratos e indicadores comerciais')).not.toBeInTheDocument();
    expect(screen.getByText(/0% dos projetos filtrados/)).toBeInTheDocument();
  });
  it('restores URL filters and only requests when applying a combined selection', async () => {
    const user = userEvent.setup();
    mount('/app/dashboard?year=2026&status=active');
    await screen.findByText('Nenhum projeto encontrado');
    expect(mocks.get).toHaveBeenCalledWith('/organization-overview', expect.objectContaining({ params: { year: '2026', status: 'active' } }));
    await user.type(screen.getByLabelText('Buscar projeto'), 'Alpha');
    expect(mocks.get.mock.calls.filter(call => call[0] === '/organization-overview')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/organization-overview', expect.objectContaining({ params: { year: '2026', status: 'active', search: 'Alpha' } })));
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/organization-overview', expect.objectContaining({ params: {} })));
  });
  it('rejects reversed date ranges without a request', async () => {
    mount('/app/dashboard?date_from=2026-10-01&date_to=2026-01-01');
    expect(screen.getByRole('alert')).toHaveTextContent('A data inicial');
    expect(mocks.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Exportar Excel' })).not.toBeInTheDocument();
  });
  it('handles service failures without misleading zero cards', async () => {
    mocks.get.mockRejectedValue(new Error('offline'));
    mount();
    expect(await screen.findByText('Nao foi possivel carregar os dados.')).toBeInTheDocument();
    expect(screen.queryByText('Quantidade de projetos')).not.toBeInTheDocument();
    expect(screen.queryByText('Indisponível')).not.toBeInTheDocument();
  });
  it('cross-filters status, map and company through the shared URL selection', async () => {
    const user = userEvent.setup();
    mocks.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/organization-overview' ? { ...empty, total_projects: 1, open_projects: 1, open_percentage: 100, statuses: [{ status: 'active', total: 1 }], geography: [{ state: 'SP', total: 1 }] } : path.endsWith('/companies') ? { items: [{ id: 10, name: 'Empresa local', total: 1 }], total: 1, page: 1, page_size: 10 } : { items: [], total: 0, page: 1, page_size: 10 } }));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Em aberto (ativo): 1 (100%)' }));
    await user.click(screen.getByRole('button', { name: 'SP: 1 projetos' }));
    await user.click(await screen.findByRole('button', { name: 'Empresa local' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/organization-overview', expect.objectContaining({ params: { status: 'active', state: 'SP', company_id: '10' } })));
    expect(screen.getByRole('button', { name: 'Remover filtro empresa #10' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.queryByRole('button', { name: 'Remover filtro empresa #10' })).not.toBeInTheDocument();
  });
  it('sorts, paginates, selects and configures project columns without editing data', async () => {
    const user = userEvent.setup();
    mocks.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/organization-overview' ? empty : path.endsWith('/projects') ? { items: [{ id: 1, name: 'Projeto paginado', status: 'active', created_at: '2026-01-01T12:00:00Z', company: null, addresses: 2, states: 'SP' }], total: 12, page: 1, page_size: 10 } : { items: [], total: 0, page: 1, page_size: 10 } }));
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Selecionar Projeto paginado' }));
    expect(screen.getByText('1 selecionado(s), sem ações em massa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projeto paginado' })).toHaveAttribute('href', '/app/projects/1/summary?return_to=%2Fapp%2Fdashboard');
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'name');
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/organization-overview/projects', expect.objectContaining({ params: expect.objectContaining({ sort: 'name' }) })));
    await user.click(screen.getAllByRole('button', { name: 'Próxima' }).find(button => !(button as HTMLButtonElement).disabled)!);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/organization-overview/projects', expect.objectContaining({ params: expect.objectContaining({ page: 2 }) })));
    await user.click(screen.getByText('Colunas visíveis'));
    await user.click(screen.getByRole('checkbox', { name: 'Empresa' }));
    expect(within(screen.getByRole('link', { name: 'Projeto paginado' }).closest('table')!).queryByRole('columnheader', { name: /^Empresa/ })).not.toBeInTheDocument();
  });
});
