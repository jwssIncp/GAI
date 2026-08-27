import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { CurrentUser, PlateHistoryEntry } from '@/types/api';
import { ItemEvidencePanels } from './ItemEvidencePanels';

const mocks = vi.hoisted(() => ({ plateHistory: vi.fn(), listValuations: vi.fn(), createValuation: vi.fn() }));
vi.mock('@/api/endpoints', () => ({ inventoryOperationsApi: mocks }));

const user: CurrentUser = {
  id: 1,
  login: 'auditor',
  email: 'auditor@gai.local',
  status: 'ACTIVE',
  organization_id: 1,
  permissions: ['plate-history:read', 'asset-valuations:read'].map((key) => ({ key, scope: 'ORGANIZATION' })),
  role_assignments: [],
};

const history: PlateHistoryEntry = {
  id: 51,
  inventory_item_id: 11,
  source: 'field',
  observation_id: 31,
  session_id: 5,
  round_id: 22,
  round_number: 2,
  captured_at: '2026-08-20T12:15:00.000Z',
  field_agent_id: 7,
  previous_plate: 'OLD1234',
  observed_plate: 'ABC1D23',
  recorded_by_id: 1,
  created_at: '2026-08-20T12:16:00.000Z',
};

function renderPanels() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: null, bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(<QueryClientProvider client={client}><AuthContext.Provider value={auth}><ItemEvidencePanels projectId={10} itemId={11} /></AuthContext.Provider></QueryClientProvider>);
}

describe('ItemEvidencePanels plate history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.plateHistory.mockResolvedValue({ items: [history], page: 1, page_size: 10, total_items: 1, total_pages: 1 });
    mocks.listValuations.mockResolvedValue({ items: [], page: 1, page_size: 10, total_items: 0, total_pages: 0 });
  });

  it('mostra contexto resolvido sem requisicoes adicionais por linha', async () => {
    renderPanels();
    expect(await screen.findByText('ABC1D23')).toBeInTheDocument();
    expect(screen.getByText('#5')).toBeInTheDocument();
    expect(screen.getByText('Rodada 2')).toBeInTheDocument();
    expect(screen.getByText('Agente #7')).toBeInTheDocument();
    expect(mocks.plateHistory).toHaveBeenCalledTimes(1);
    expect(mocks.plateHistory).toHaveBeenCalledWith(10, 11, { page: 1, page_size: 10 });
  });
});
