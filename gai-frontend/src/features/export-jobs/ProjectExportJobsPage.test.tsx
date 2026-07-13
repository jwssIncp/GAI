import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { CurrentUser, ExportJob } from '@/types/api';
import { ProjectExportJobsPage } from './ProjectExportJobsPage';

const mocks = vi.hoisted(() => ({
  list: vi.fn(), create: vi.fn(), cancel: vi.fn(), retry: vi.fn(),
  downloadUrl: vi.fn(), download: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  exportJobsApi: {
    list: mocks.list,
    create: mocks.create,
    cancel: mocks.cancel,
    retry: mocks.retry,
    downloadUrl: mocks.downloadUrl,
    download: mocks.download,
  },
}));

const baseJob: ExportJob = {
  id: 41,
  organization_id: 1,
  project_id: 10,
  type: 'inventory_items_xlsx',
  status: 'finished',
  file_name: 'inventario.xlsx',
  mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  size_bytes: 2048,
  requested_by_id: 1,
  attempt_count: 1,
  requested_at: '2026-07-13T12:00:00.000Z',
  finished_at: '2026-07-13T12:01:00.000Z',
  created_at: '2026-07-13T12:00:00.000Z',
  updated_at: '2026-07-13T12:01:00.000Z',
};

const permissionKeys = [
  'export-jobs:read',
  'export-jobs:create',
  'export-jobs:download',
  'export-jobs:cancel',
  'export-jobs:retry',
];
const user: CurrentUser = {
  id: 1,
  login: 'operador',
  email: 'operador@gai.local',
  status: 'ACTIVE',
  organization_id: 1,
  permissions: permissionKeys.map((key) => ({ key, scope: 'ORGANIZATION' })),
  role_assignments: [],
};

function page(items: ExportJob[]) {
  return { items, page: 1, page_size: 20, total_items: items.length, total_pages: items.length ? 1 : 0 };
}

function renderPage(initialEntry = '/app/projects/10/export-jobs') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = {
    user,
    accessToken: 'token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    bootstrapping: false,
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes><Route path="/app/projects/:projectId/export-jobs" element={<ProjectExportJobsPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ProjectExportJobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(page([baseJob]));
    mocks.create.mockResolvedValue({ ...baseJob, id: 42, status: 'pending' });
    mocks.cancel.mockResolvedValue({ ...baseJob, status: 'cancelled' });
    mocks.retry.mockResolvedValue({ ...baseJob, id: 43, status: 'pending', retry_of_id: baseJob.id, attempt_count: 2 });
    mocks.downloadUrl.mockResolvedValue({
      job: baseJob,
      download_url: `/api/v1/projects/10/export-jobs/${baseJob.id}/download`,
      expires_in_seconds: 300,
      requires_authentication: true,
    });
    mocks.download.mockResolvedValue(new Blob(['xlsx']));
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:export'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('lista jobs reais e renderiza o estado vazio', async () => {
    renderPage();
    expect(await screen.findByText('inventario.xlsx')).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith(10, expect.objectContaining({ page: 1, page_size: 20 }));

    mocks.list.mockResolvedValue(page([]));
    renderPage('/app/projects/10/export-jobs?search=sem-resultados');
    expect(await screen.findByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  it('exibe erro real da listagem', async () => {
    mocks.list.mockRejectedValue(new Error('Falha ao carregar exportacoes'));
    renderPage();
    expect(await screen.findByText('Falha ao carregar exportacoes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('solicita uma nova exportacao com tipo validado', async () => {
    renderPage();
    await screen.findByText('inventario.xlsx');
    await userEvent.click(screen.getByRole('button', { name: 'Nova exportacao' }));
    await userEvent.selectOptions(screen.getByLabelText('Tipo de exportacao'), 'project_backup_xlsx');
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar exportacao' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(10, 'project_backup_xlsx'));
  });

  it('obtem a URL autorizada antes de baixar o blob autenticado', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Baixar' }));
    await waitFor(() => expect(mocks.downloadUrl).toHaveBeenCalledWith(10, baseJob.id));
    expect(mocks.download).toHaveBeenCalledWith(`/api/v1/projects/10/export-jobs/${baseJob.id}/download`);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('confirma cancelamento e cria nova tentativa para estados permitidos', async () => {
    const pending = { ...baseJob, id: 51, status: 'pending' as const, file_name: null };
    const failed = { ...baseJob, id: 52, status: 'failed' as const, file_name: null, error_message: 'Falha de geracao' };
    mocks.list.mockResolvedValue(page([pending, failed]));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith(10, pending.id));

    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.retry).toHaveBeenCalledWith(10, failed.id));
  });
});
