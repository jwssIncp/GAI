import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { ProjectImportSessionsPage } from './ProjectImportSessionsPage';
import type { CurrentUser, ImportFile, ImportPayload, ImportPayloadError, ImportSession, PaginatedItems } from '@/types/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  finish: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  payloads: vi.fn(),
  createPayload: vi.fn(),
  reprocessPayload: vi.fn(),
  errors: vi.fn(),
  files: vi.fn(),
  createFileUploadUrl: vi.fn(),
  confirmFileUpload: vi.fn(),
  fileDownloadUrl: vi.fn(),
  uploadToPresignedUrl: vi.fn(),
}));

vi.mock('@/api/http', () => ({ uploadToPresignedUrl: mocks.uploadToPresignedUrl }));
vi.mock('@/api/endpoints', () => ({
  importSessionsApi: {
    list: mocks.list,
    create: mocks.create,
    get: mocks.get,
    finish: mocks.finish,
    cancel: mocks.cancel,
    retry: mocks.retry,
    payloads: mocks.payloads,
    createPayload: mocks.createPayload,
    reprocessPayload: mocks.reprocessPayload,
    sessionErrors: mocks.errors,
    files: mocks.files,
    createFileUploadUrl: mocks.createFileUploadUrl,
    confirmFileUpload: mocks.confirmFileUpload,
    fileDownloadUrl: mocks.fileDownloadUrl,
  },
}));

const admin: CurrentUser = {
  id: 1,
  login: 'admin',
  email: 'admin@gai.local',
  status: 'ACTIVE',
  organization_id: 1,
  role_assignments: [{ assignment_id: 1, role_id: 1, role_key: 'ORG_ADMIN', role_name: 'Admin', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }],
};
const noPermissions: CurrentUser = { ...admin, role_assignments: [{ assignment_id: 2, role_id: 3, role_key: 'ORG_USER', role_name: 'User', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }] };

const session: ImportSession = {
  id: 50,
  organization_id: 1,
  project_id: 10,
  type: 'mobile_sync',
  source: 'mobile_app',
  status: 'open',
  session_uuid: 'uuid-50',
  expected_payloads: 2,
  received_payloads: 1,
  processed_payloads: 0,
  failed_payloads: 1,
  total_items: 4,
  total_images: 2,
  total_created: 1,
  total_updated: 2,
  total_deleted: 0,
  total_failed: 1,
  raw_backup_path: 'private/raw.zip',
  error_message: null,
  metadata: { device: 'mobile' },
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:05:00.000Z',
};
const payload: ImportPayload = { id: 70, payload_number: 1, idempotency_key: 'idem-1', checksum: 'abc', status: 'failed', items_count: 4, images_count: 2, created_count: 1, updated_count: 2, deleted_count: 0, failed_count: 1, raw_payload_path: 'raw/payload.json', error_message: 'Erro de teste' };
const error: ImportPayloadError = { id: 90, row_number: 3, item_reference: 'PAT-1', error_code: 'INVALID_ITEM', error_message: 'Item invalido', created_at: '2026-01-01T00:06:00.000Z' };
const file: ImportFile = { id: 81, type: 'raw_payload', storage_provider: 's3', bucket: 'private', path: 'imports/raw.json', original_name: 'raw.json', mime_type: 'application/json', size_bytes: 1200, checksum: 'xyz', status: 'uploaded' };

function page<T>(items: T[], overrides: Partial<PaginatedItems<T>> = {}): PaginatedItems<T> {
  return { items, page: 1, page_size: 20, total_items: items.length, total_pages: items.length ? 1 : 0, ...overrides };
}

function renderPage(user: CurrentUser = admin) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/app/projects/10/import-sessions']}>
          <Routes><Route path="/app/projects/:projectId/import-sessions" element={<ProjectImportSessionsPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ProjectImportSessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(page([session]));
    mocks.create.mockResolvedValue(session);
    mocks.get.mockResolvedValue(session);
    mocks.finish.mockResolvedValue({ ...session, status: 'processing' });
    mocks.cancel.mockResolvedValue({ ...session, status: 'cancelled' });
    mocks.retry.mockResolvedValue({ ...session, status: 'processing' });
    mocks.payloads.mockResolvedValue(page([payload]));
    mocks.createPayload.mockResolvedValue(payload);
    mocks.reprocessPayload.mockResolvedValue({ ...payload, status: 'processing' });
    mocks.errors.mockResolvedValue(page([error]));
    mocks.files.mockResolvedValue([file]);
    mocks.createFileUploadUrl.mockResolvedValue({ file: { ...file, id: 82, status: 'pending_upload' }, upload_url: 'https://upload.example/import-file', expires_in_seconds: 300 });
    mocks.confirmFileUpload.mockResolvedValue({ ...file, id: 82 });
    mocks.fileDownloadUrl.mockResolvedValue({ file, download_url: 'https://signed.example/raw.json', expires_in_seconds: 300 });
    mocks.uploadToPresignedUrl.mockResolvedValue(undefined);
  });

  it('renderiza listagem de importacoes', async () => {
    renderPage();
    expect(await screen.findByText('uuid-50')).toBeInTheDocument();
    expect(screen.getAllByText('Sincronizacao mobile').length).toBeGreaterThan(0);
  });

  it('renderiza loading, vazio e erro', async () => {
    mocks.list.mockReturnValueOnce(new Promise(() => undefined));
    const first = renderPage();
    expect(screen.getByText('Carregando dados')).toBeInTheDocument();
    first.unmount();
    mocks.list.mockResolvedValueOnce(page([]));
    renderPage();
    expect(await screen.findByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  it('renderiza erro', async () => {
    mocks.list.mockRejectedValue(new Error('Falha nas importacoes'));
    renderPage();
    expect(await screen.findByText('Falha nas importacoes')).toBeInTheDocument();
  });

  it('oculta nova importacao sem permissao', async () => {
    renderPage(noPermissions);
    await screen.findByText('Sincronizacao mobile');
    expect(screen.queryByRole('button', { name: /nova importacao/i })).not.toBeInTheDocument();
  });

  it('valida formulario de nova importacao', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /nova importacao/i }));
    await userEvent.click(screen.getByRole('button', { name: /criar importacao/i }));
    expect(await screen.findByText('Selecione o tipo')).toBeInTheDocument();
  });

  it('cria sessao com payload real', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /nova importacao/i }));
    await userEvent.selectOptions(document.querySelector('select[name="type"]') as HTMLSelectElement, 'mobile_sync');
    await userEvent.selectOptions(document.querySelector('select[name="source"]') as HTMLSelectElement, 'mobile_app');
    await userEvent.type(document.querySelector('input[name="expected_payloads"]') as HTMLInputElement, '2');
    await userEvent.click(screen.getByRole('button', { name: /criar importacao/i }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(10, { type: 'mobile_sync', source: 'mobile_app', expected_payloads: 2 }));
  });

  it('filtra por status com parametro real', async () => {
    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText('Filtrar importacao por status'), 'open');
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(10, expect.objectContaining({ status: 'open', page: 1, page_size: 20 })));
  });

  it('pagina usando page/page_size', async () => {
    mocks.list.mockResolvedValue(page([session], { total_items: 30, total_pages: 2 }));
    renderPage();
    await userEvent.click(await screen.findByLabelText('Proxima pagina'));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(10, expect.objectContaining({ page: 2, page_size: 20 })));
  });

  it('detalhe renderiza abas, contadores e omite paths internos', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Visualizar importacao'));
    expect(await screen.findByText('Payloads recebidos')).toBeInTheDocument();
    expect(screen.getAllByText('uuid-50').length).toBeGreaterThan(0);
    expect(screen.queryByText('private/raw.zip')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erros' }));
    expect(await screen.findByText('Item invalido')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Arquivos' }));
    expect(await screen.findByText('raw.json')).toBeInTheDocument();
    expect(screen.queryByText('private')).not.toBeInTheDocument();
    expect(screen.queryByText('imports/raw.json')).not.toBeInTheDocument();
  });

  it('upload chama upload-url e confirm-upload', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Visualizar importacao'));
    await userEvent.click(await screen.findByRole('button', { name: 'Arquivos' }));
    const uploadFile = new File(['{}'], 'raw.json', { type: 'application/json' });
    await userEvent.upload(await screen.findByLabelText('Enviar arquivo de importacao'), uploadFile);
    await waitFor(() => expect(mocks.createFileUploadUrl).toHaveBeenCalledWith(10, 50, expect.objectContaining({ type: 'raw_payload', original_name: 'raw.json' })));
    expect(mocks.uploadToPresignedUrl).toHaveBeenCalledWith('https://upload.example/import-file', uploadFile, expect.any(Function));
    await waitFor(() => expect(mocks.confirmFileUpload).toHaveBeenCalledWith(10, 50, 82, { size_bytes: uploadFile.size }));
  });

  it('download usa endpoint download-url', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Visualizar importacao'));
    await userEvent.click(await screen.findByRole('button', { name: 'Arquivos' }));
    await userEvent.click(await screen.findByRole('button', { name: /baixar/i }));
    await waitFor(() => expect(mocks.fileDownloadUrl).toHaveBeenCalledWith(10, 50, 81));
  });

  it('retry usa confirmacao quando sessao falhou', async () => {
    mocks.list.mockResolvedValue(page([{ ...session, status: 'failed' as const }]));
    renderPage();
    await screen.findByText('uuid-50');
    await userEvent.click(screen.getByLabelText('Retry importacao'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.retry).toHaveBeenCalledWith(10, 50));
  });

  it('finalizar e cancelar usam confirmacao', async () => {
    renderPage();
    await screen.findByText('uuid-50');
    await userEvent.click(screen.getByLabelText('Finalizar importacao'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.finish).toHaveBeenCalledWith(10, 50));
    await userEvent.click(screen.getByLabelText('Cancelar importacao'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith(10, 50));
  });
});
