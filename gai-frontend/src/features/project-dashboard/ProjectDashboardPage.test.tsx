import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDashboardAnalytics } from '@/types/api';
import { ProjectDashboardPage } from './ProjectDashboardPage';

const mocks = vi.hoisted(() => ({ dashboardAnalytics: vi.fn() }));

vi.mock('@/api/endpoints', () => ({
  projectsApi: { dashboardAnalytics: mocks.dashboardAnalytics },
}));

const response: ProjectDashboardAnalytics = {
  project: { id: 10, name: 'Projeto Alpha', status: 'active', organization_id: 1, company_id: 2 },
  summary: {
    total_items: 100,
    inventoried_items: 65,
    not_inventoried_items: 35,
    consolidated_items: null,
    pending_consolidation_items: null,
    completion_percentage: 65,
    consolidation_percentage: null,
    total_sectors: null,
    total_units: 2,
    total_field_agents: 3,
    active_days: 5,
    average_items_per_active_day: 13,
    inventoried_today: 4,
    inventoried_last_7_days: 25,
    inventoried_last_30_days: 65,
    last_activity_at: '2026-07-24T12:00:00.000Z',
    estimated_completion_date: '2026-07-31',
  },
  timeline: [
    { period: '2026-07-23', inventoried_items: 20, moving_average: 20, cumulative_inventoried_items: 20, cumulative_consolidated_items: null, total_items_reference: 100 },
    { period: '2026-07-24', inventoried_items: 45, moving_average: 32.5, cumulative_inventoried_items: 65, cumulative_consolidated_items: null, total_items_reference: 100 },
  ],
  status_distribution: [
    { status: 'evaluated', total_items: 65, percentage: 65 },
    { status: 'pending', total_items: 35, percentage: 35 },
  ],
  units: [
    { unit: 'Matriz', total_items: 70, inventoried_items: 50, pending_items: 20, consolidated_items: null, completion_percentage: 71.43 },
    { unit: 'Filial', total_items: 30, inventoried_items: 15, pending_items: 15, consolidated_items: null, completion_percentage: 50 },
  ],
  geography: [
    { state: 'SP', total_items: 70, inventoried_items: 50, pending_items: 20, consolidated_items: null, total_units: 1, total_sectors: null, completion_percentage: 71.43 },
  ],
  unlocated_items: 30,
  data_quality: { items_without_unit: 0, items_without_location: 8, items_without_description: 2, items_without_state: 30 },
  recent_activity: [{ id: 1, inventory_item_id: 55, operation: 'update', resulting_status: 'evaluated', occurred_at: '2026-07-24T12:00:00.000Z' }],
  attention_units: [{ unit: 'Filial', total_items: 30, inventoried_items: 15, pending_items: 15, consolidated_items: null, completion_percentage: 50 }],
  sectors: { available: false, reason: 'O modelo atual não possui setor.' },
  consolidation: { available: false, reason: 'O modelo atual não possui consolidação.' },
  productivity: { available: false, reason: 'Sem vínculo confiável.' },
  filters: {
    period: '30d',
    date_from: '2026-06-25',
    date_to: '2026-07-24',
    grouping: 'day',
    unit: null,
    state: null,
    status: null,
    available_units: ['Filial', 'Matriz'],
    available_states: ['SP'],
    available_statuses: ['pending', 'evaluated', 'divergent', 'not_found', 'duplicated', 'removed', 'inactive'],
  },
  limitations: ['A série temporal usa updated_at.'],
  timezone: 'America/Sao_Paulo',
};

function renderPage(entry = '/app/projects/10/dashboard?period=30d&grouping=day') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/app/projects/:projectId/dashboard" element={<ProjectDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProjectDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dashboardAnalytics.mockResolvedValue(response);
  });

  it('renders cards, charts, map data and unavailable domains', async () => {
    renderPage();
    expect(await screen.findByText('Dashboard · Projeto Alpha')).toBeInTheDocument();
    expect(screen.getByText('65 de 100 itens inventariados')).toBeInTheDocument();
    expect(screen.getByText('Cobertura geográfica')).toBeInTheDocument();
    expect(screen.getByText('Qualidade dos dados')).toBeInTheDocument();
    expect(screen.getByText('O modelo atual não possui consolidação.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SP' })).toBeInTheDocument();
  });

  it('synchronizes filter changes with the API query', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Dashboard · Projeto Alpha');
    await user.selectOptions(screen.getByLabelText('Status'), 'evaluated');

    await waitFor(() =>
      expect(mocks.dashboardAnalytics).toHaveBeenLastCalledWith(
        10,
        expect.objectContaining({ period: '30d', grouping: 'day', status: 'evaluated' }),
      ),
    );
  });

  it('renders the standard error state', async () => {
    mocks.dashboardAnalytics.mockRejectedValueOnce(new Error('network'));
    renderPage();
    expect(await screen.findByText('Nao foi possivel concluir')).toBeInTheDocument();
  });
});
