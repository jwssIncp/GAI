import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/http';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { CurrentUser, InventoryEvidence, InventoryObservation, InventoryRound, InventorySession, PaginatedItems } from '@/types/api';
import { InventorySessionDetailPage } from './InventorySessionDetailPage';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  getSession: vi.fn(),
  listRounds: vi.fn(),
  startSession: vi.fn(),
  finishSession: vi.fn(),
  cancelSession: vi.fn(),
  requestReinventory: vi.fn(),
  createObservation: vi.fn(),
  finishRound: vi.fn(),
  listObservations: vi.fn(),
  createEvidenceUploadUrl: vi.fn(),
  confirmEvidenceUpload: vi.fn(),
  listEvidence: vi.fn(),
  evidenceDownloadUrl: vi.fn(),
  reconcile: vi.fn(),
  listReconciliations: vi.fn(),
  consolidate: vi.fn(),
  uploadToPresignedUrl: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({ inventoryOperationsApi: {
  getSession: mocks.getSession,
  listRounds: mocks.listRounds,
  startSession: mocks.startSession,
  finishSession: mocks.finishSession,
  cancelSession: mocks.cancelSession,
  requestReinventory: mocks.requestReinventory,
  createObservation: mocks.createObservation,
  finishRound: mocks.finishRound,
  listObservations: mocks.listObservations,
  createEvidenceUploadUrl: mocks.createEvidenceUploadUrl,
  confirmEvidenceUpload: mocks.confirmEvidenceUpload,
  listEvidence: mocks.listEvidence,
  evidenceDownloadUrl: mocks.evidenceDownloadUrl,
  reconcile: mocks.reconcile,
  listReconciliations: mocks.listReconciliations,
  consolidate: mocks.consolidate,
} }));

vi.mock('@/api/http', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/http')>(),
  uploadToPresignedUrl: mocks.uploadToPresignedUrl,
  api: { get: mocks.apiGet },
}));

const permissions = [
  'inventory-sessions:read',
  'inventory-sessions:update',
  'inventory-rounds:reinventory',
  'inventory-observations:create',
  'reconciliations:create',
  'reconciliations:read',
  'consolidations:create',
  'inventory-items:read',
  'project-field-agents:read',
];

const user: CurrentUser = {
  id: 1,
  login: 'admin',
  email: 'admin@gai.local',
  status: 'ACTIVE',
  organization_id: 1,
  permissions: permissions.map((key) => ({ key, scope: 'ORGANIZATION' })),
  role_assignments: [],
};

const activeSession: InventorySession = {
  id: 5,
  organization_id: 1,
  project_id: 10,
  name: 'Inventário final',
  status: 'active',
  current_round_id: 22,
  started_at: '2026-08-20T10:00:00.000Z',
  finished_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  created_by_id: 1,
  created_at: '2026-08-20T09:00:00.000Z',
  updated_at: '2026-08-20T10:00:00.000Z',
};

const initialRound: InventoryRound = {
  id: 21,
  session_id: 5,
  round_number: 1,
  kind: 'initial',
  type: 'initial',
  inventory_item_id: null,
  reason: null,
  status: 'finished',
  requested_by_id: 1,
  requested_by_name: 'Ana Coordenadora',
  created_by_id: 1,
  started_at: '2026-08-20T10:00:00.000Z',
  finished_at: '2026-08-20T11:00:00.000Z',
  created_at: '2026-08-20T10:00:00.000Z',
};

const currentRound: InventoryRound = {
  ...initialRound,
  id: 22,
  round_number: 2,
  kind: 'reinventory',
  type: 'reinventory',
  inventory_item_id: 11,
  reason: 'Conferir placa',
  status: 'active',
  started_at: '2026-08-20T12:00:00.000Z',
  finished_at: null,
  created_at: '2026-08-20T12:00:00.000Z',
};

const observation: InventoryObservation = {
  id: 31,
  session_id: 5,
  round_id: 22,
  inventory_item_id: 11,
  field_agent_id: 7,
  field_agent_name: 'Maria Souza',
  prior_observation_id: 30,
  idempotency_key: 'idem-observation-31',
  result: 'divergent',
  observed_plate: 'ABC1D23',
  observed_serial_number: 'SN-1',
  sector_text: 'TI',
  location_text: 'Sala 1',
  notes: 'Revisar',
  captured_at: '2026-08-20T12:15:00.000Z',
  received_at: '2026-08-20T12:16:00.000Z',
};

const evidence: InventoryEvidence = {
  id: 41,
  organization_id: 1,
  project_id: 10,
  session_id: 5,
  round_id: 22,
  observation_id: 31,
  storage_provider: 's3',
  bucket: 'private',
  storage_key: 'private/evidence.webp',
  original_name: 'evidence.webp',
  mime_type: 'image/webp',
  size_bytes: 2048,
  checksum: null,
  status: 'uploaded',
  created_by_id: 7,
  created_by_name: 'Pedro Campo',
  confirmed_at: '2026-08-20T12:20:00.000Z',
  created_at: '2026-08-20T12:19:00.000Z',
  updated_at: '2026-08-20T12:20:00.000Z',
};

function page<T>(items: T[], pageSize = 20): PaginatedItems<T> {
  return { items, page: 1, page_size: pageSize, total_items: items.length, total_pages: items.length ? 1 : 0 };
}

const items = [
  { id: 11, project_id: 10, description: 'Notebook Dell', new_plate: 'PAT-0011', old_plate: null, brand: 'Dell', model: 'Latitude', serial_number: 'SN-1' },
  { id: 12, project_id: 10, description: 'Cadeira giratória', new_plate: null, old_plate: 'OLD-12', brand: null, model: null, serial_number: null },
];
const links = [{ id: 70, field_agent_id: 7, field_agent_name: 'Maria Souza', role: null, status: 'active' }, { id: 80, field_agent_id: 8, field_agent_name: 'Carlos Dias', role: 'Coletor', status: 'active' }];
const fold = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Simula a API: só responde às rotas do projeto 10 / sessão 5, com busca no servidor. */
function fakeApi(url: string, config?: { params?: { search?: string } }) {
  const q = fold(config?.params?.search ?? '');
  const paged = <T,>(rows: T[]) => ({ data: { items: rows, page: 1, page_size: 20, total_items: rows.length, total_pages: 1 } });
  if (url === '/projects/10/inventory-items') return Promise.resolve(paged(items.filter((i) => fold(`${i.description} ${i.new_plate ?? ''} ${i.old_plate ?? ''}`).includes(q))));
  const one = /^\/projects\/10\/inventory-items\/(\d+)$/.exec(url);
  if (one) { const item = items.find((i) => i.id === Number(one[1])); return item ? Promise.resolve({ data: item }) : Promise.reject(new Error('404')); }
  if (url === '/projects/10/field-agents') return Promise.resolve(paged(links.filter((l) => fold(l.field_agent_name).includes(q))));
  if (url === '/projects/10/inventory-sessions/5/rounds') return Promise.resolve(paged([currentRound, initialRound]));
  return Promise.reject(new Error('URL inesperada: ' + url));
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: null, bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/app/projects/10/inventory/sessions/5']}>
          <Routes><Route path="/app/projects/:projectId/inventory/sessions/:sessionId" element={<InventorySessionDetailPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('InventorySessionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiGet.mockImplementation(fakeApi);
    mocks.getSession.mockResolvedValue(activeSession);
    mocks.listRounds.mockResolvedValue(page([currentRound, initialRound]));
    mocks.listObservations.mockResolvedValue(page([observation]));
    mocks.listReconciliations.mockResolvedValue(page([]));
    mocks.listEvidence.mockResolvedValue(page([], 10));
    mocks.startSession.mockResolvedValue({ session: activeSession, round: initialRound });
    mocks.finishSession.mockResolvedValue({ ...activeSession, status: 'finished', current_round_id: null });
    mocks.cancelSession.mockResolvedValue({ ...activeSession, status: 'cancelled', current_round_id: null });
    mocks.requestReinventory.mockResolvedValue(currentRound);
    mocks.createObservation.mockResolvedValue(observation);
    mocks.finishRound.mockResolvedValue({ ...currentRound, status: 'finished' });
    mocks.reconcile.mockResolvedValue({ run_number: 1, records: [] });
    mocks.consolidate.mockResolvedValue({});
    mocks.createEvidenceUploadUrl.mockResolvedValue({ evidence: { ...evidence, status: 'pending_upload' }, upload_url: 'https://storage.example/upload', expires_in_seconds: 300 });
    mocks.confirmEvidenceUpload.mockResolvedValue(evidence);
    mocks.evidenceDownloadUrl.mockResolvedValue({ evidence, download_url: 'https://storage.example/download', expires_in_seconds: 300 });
    mocks.uploadToPresignedUrl.mockImplementation(async (_url: string, _file: File, onProgress?: (progress: number) => void) => onProgress?.(100));
  });

  it('reconstroi deep link e rodada atual apenas pelas APIs', async () => {
    renderPage();
    expect(await screen.findByText('Inventário final')).toBeInTheDocument();
    expect(screen.getAllByText('Rodada 2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ATIVA').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Adicionar observação' })).toBeEnabled();
    expect(mocks.getSession).toHaveBeenCalledWith(10, 5);
    expect(mocks.listRounds).toHaveBeenCalledWith(10, 5, expect.objectContaining({ page: 1, page_size: 20 }));
  });

  it('recupera a nova rodada após reinventário e nova montagem', async () => {
    const round3 = { ...currentRound, id: 23, round_number: 3, reason: 'Nova conferência' };
    const session3 = { ...activeSession, current_round_id: 23 };
    mocks.getSession.mockResolvedValueOnce(activeSession).mockResolvedValue(session3);
    mocks.listRounds.mockResolvedValueOnce(page([currentRound, initialRound])).mockResolvedValue(page([round3, currentRound, initialRound]));
    mocks.requestReinventory.mockResolvedValue(round3);
    const view = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar reinventário' }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Item divergente' }), 'notebook');
    await userEvent.click(await screen.findByRole('option', { name: /Notebook Dell \(PAT-0011\)/ }));
    await userEvent.type(screen.getByLabelText('Motivo'), 'Nova conferência');
    await userEvent.click(screen.getByRole('button', { name: 'Criar nova rodada' }));
    await waitFor(() => expect(mocks.requestReinventory).toHaveBeenCalledWith(10, 5, { inventory_item_id: 11, reason: 'Nova conferência' }));
    expect(await screen.findAllByText('Rodada 3')).not.toHaveLength(0);
    view.unmount();
    renderPage();
    expect(await screen.findAllByText('Rodada 3')).not.toHaveLength(0);
  });

  it('finaliza uma sessao sem rodada ativa e remove acoes operacionais', async () => {
    const ready = { ...activeSession, current_round_id: null };
    const finished = { ...ready, status: 'finished' as const, finished_at: '2026-08-20T15:00:00.000Z' };
    mocks.getSession.mockResolvedValueOnce(ready).mockResolvedValue(finished);
    mocks.listRounds.mockResolvedValue(page([{ ...currentRound, status: 'finished', finished_at: '2026-08-20T14:00:00.000Z' }]));
    mocks.finishSession.mockResolvedValue(finished);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Finalizar sessão' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.finishSession).toHaveBeenCalledWith(10, 5));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Finalizar sessão' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Adicionar observação' })).not.toBeInTheDocument();
  });

  it('cancela a sessao somente com motivo explicito', async () => {
    const cancelled = { ...activeSession, status: 'cancelled' as const, current_round_id: null, cancelled_at: '2026-08-20T15:00:00.000Z', cancellation_reason: 'Campanha suspensa' };
    mocks.getSession.mockResolvedValueOnce(activeSession).mockResolvedValue(cancelled);
    mocks.cancelSession.mockResolvedValue(cancelled);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar sessão' }));
    const submit = screen.getByRole('button', { name: 'Confirmar cancelamento' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Motivo do cancelamento'), 'Campanha suspensa');
    await userEvent.click(submit);
    await waitFor(() => expect(mocks.cancelSession).toHaveBeenCalledWith(10, 5, { reason: 'Campanha suspensa' }));
    expect(await screen.findByText('Campanha suspensa')).toBeInTheDocument();
  });

  it('apresenta mensagem de dominio quando o lifecycle muda concorrentemente', async () => {
    const ready = { ...activeSession, current_round_id: null };
    mocks.getSession.mockResolvedValue(ready);
    mocks.listRounds.mockResolvedValue(page([{ ...currentRound, status: 'finished', finished_at: '2026-08-20T14:00:00.000Z' }]));
    mocks.finishSession.mockRejectedValue(new ApiError(409, { code: 'INVENTORY_SESSION_STATUS_INVALID', message: 'Only active sessions can be finished' }));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Finalizar sessão' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('A sessão mudou de estado e esta ação não está mais disponível.')).toBeInTheDocument();
  });

  it('traduz 409 por codigo e reutiliza a idempotency_key no retry', async () => {
    mocks.createObservation.mockRejectedValueOnce(new ApiError(409, { code: 'OBSERVATION_ALREADY_RECORDED', message: 'Item already has an observation in this round' })).mockResolvedValue(observation);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar observação' }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Item patrimonial' }), 'PAT-0011');
    await userEvent.click(await screen.findByRole('option', { name: /Notebook Dell/ }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Inventariante' }), 'maria');
    await userEvent.click(await screen.findByRole('option', { name: /Maria Souza/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar observação' }));
    expect(await screen.findByText('Este item já possui uma observação nesta rodada.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar observação' }));
    await waitFor(() => expect(mocks.createObservation).toHaveBeenCalledTimes(2));
    const firstKey = mocks.createObservation.mock.calls[0][3].idempotency_key;
    const retryKey = mocks.createObservation.mock.calls[1][3].idempotency_key;
    expect(retryKey).toBe(firstKey);
  });

  it('executa upload presigned, confirmacao, listagem e download sob demanda', async () => {
    mocks.listEvidence.mockResolvedValue(page([evidence], 10));
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Abrir' }))[0]);
    expect(await screen.findByText('evidence.webp')).toBeInTheDocument();
    expect(screen.getByText(/por Pedro Campo/)).toBeInTheDocument();
    const file = new File(['image'], 'nova.webp', { type: 'image/webp' });
    await userEvent.upload(screen.getByLabelText('Anexar evidência'), file);
    await waitFor(() => expect(mocks.confirmEvidenceUpload).toHaveBeenCalledWith(10, 5, 22, 31, 41, { size_bytes: file.size }));
    expect(mocks.createEvidenceUploadUrl).toHaveBeenCalledWith(10, 5, 22, 31, { original_name: 'nova.webp', mime_type: 'image/webp', size_bytes: file.size });
    expect(mocks.uploadToPresignedUrl).toHaveBeenCalledWith('https://storage.example/upload', file, expect.any(Function));
    await userEvent.click(screen.getByRole('button', { name: 'Visualizar' }));
    expect(await screen.findByRole('img', { name: 'evidence.webp' })).toHaveAttribute('src', 'https://storage.example/download');
    expect(mocks.evidenceDownloadUrl).toHaveBeenCalledWith(10, 5, 22, 31, 41);
  });

  it('mostra item (descrição e placa) e inventariante pelo nome nas observações', async () => {
    renderPage();
    expect(await screen.findByText('Notebook Dell (PAT-0011)')).toBeInTheDocument();
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    expect(screen.queryByText('#11')).not.toBeInTheDocument();
    expect(screen.queryByText('#7')).not.toBeInTheDocument();
    expect(mocks.apiGet).toHaveBeenCalledWith('/projects/10/inventory-items/11');
  });

  it('mostra o solicitante da rodada pelo nome, nunca pelo ID', async () => {
    renderPage();
    expect((await screen.findAllByText('Ana Coordenadora')).length).toBeGreaterThan(0);
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
  });

  it('filtros de observação são combobox com nome e enviam os IDs à API', async () => {
    renderPage();
    await screen.findByText('Inventário final');
    expect(screen.queryByPlaceholderText('ID da rodada')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('ID do item')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('ID do inventariante')).not.toBeInTheDocument();
    const roundBox = screen.getByRole('combobox', { name: 'Filtrar por rodada' });
    await userEvent.click(roundBox);
    await userEvent.click(await screen.findByRole('option', { name: /Rodada 1/ }));
    expect(roundBox).toHaveValue('Rodada 1');
    await waitFor(() => expect(mocks.listObservations).toHaveBeenLastCalledWith(10, 5, expect.objectContaining({ round_id: 21, page: 1 })));
    await userEvent.type(screen.getByRole('combobox', { name: 'Filtrar por item' }), 'cadeira');
    await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledWith('/projects/10/inventory-items', { params: { page: 1, page_size: 20, search: 'cadeira' } }));
    await userEvent.click(await screen.findByRole('option', { name: /Cadeira giratória \(OLD-12\)/ }));
    await waitFor(() => expect(mocks.listObservations).toHaveBeenLastCalledWith(10, 5, expect.objectContaining({ round_id: 21, inventory_item_id: 12 })));
    await userEvent.type(screen.getByRole('combobox', { name: 'Filtrar por inventariante' }), 'carlos');
    await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledWith('/projects/10/field-agents', { params: { page: 1, page_size: 20, search: 'carlos' } }));
    await userEvent.click(await screen.findByRole('option', { name: /Carlos Dias/ }));
    await waitFor(() => expect(mocks.listObservations).toHaveBeenLastCalledWith(10, 5, expect.objectContaining({ round_id: 21, inventory_item_id: 12, field_agent_id: 8 })));
  });

  it('nova observação envia os IDs escolhidos pelo nome', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar observação' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Item patrimonial' }));
    await userEvent.click(await screen.findByRole('option', { name: /Cadeira giratória/ }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Inventariante' }));
    await userEvent.click(await screen.findByRole('option', { name: /Carlos Dias/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar observação' }));
    await waitFor(() => expect(mocks.createObservation).toHaveBeenCalledWith(10, 5, 22, expect.objectContaining({ inventory_item_id: 12, field_agent_id: 8 })));
  });
});
