import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectExportJobsPage } from './ProjectExportJobsPage';
import type { ProjectSummary } from '@/types/api';

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  projectsApi: {
    summary: mocks.summary,
  },
}));

const summary: ProjectSummary = {
  project: { id: 10, name: 'Projeto Alpha', status: 'active', organization_id: 1, created_at: '2026-01-01T00:00:00.000Z' },
  inventory: { total_items: 0, evaluated_items: 0, pending_items: 0, divergent_items: 0, not_found_items: 0, duplicated_items: 0, removed_items: 0, inactive_items: 0, progress_percentage: 0 },
  images: { total_images: 0, uploaded_images: 0, pending_upload_images: 0, removed_images: 0 },
  accounting: { total_accounting_items: 0, matched_accounting_items: 0, divergent_accounting_items: 0, not_found_accounting_items: 0, ignored_accounting_items: 0 },
  pending_issues: { total_pending_issues: 0, open_pending_issues: 0, in_review_pending_issues: 0, resolved_pending_issues: 0, ignored_pending_issues: 0, cancelled_pending_issues: 0, critical_pending_issues: 0, high_pending_issues: 0, medium_pending_issues: 0, low_pending_issues: 0 },
  field_agents: { total_field_agents: 0, active_field_agents: 0, inactive_field_agents: 0, finished_field_agents: 0 },
  exports: {
    total_export_jobs: 0,
    pending_export_jobs: 0,
    processing_export_jobs: 0,
    finished_export_jobs: 0,
    failed_export_jobs: 0,
    cancelled_export_jobs: 0,
    expired_export_jobs: 0,
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/projects/10/export-jobs']}>
        <Routes>
          <Route path="/app/projects/:projectId/export-jobs" element={<ProjectExportJobsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProjectExportJobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.summary.mockResolvedValue(summary);
  });

  it('renderiza resumo real de exportacoes', async () => {
    renderPage();
    expect(await screen.findByText('Export jobs ainda nao disponiveis')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Exportacoes' })).toBeInTheDocument();
    expect(mocks.summary).toHaveBeenCalledWith(10);
  });

  it('renderiza loading', () => {
    mocks.summary.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando resumo de exportacoes')).toBeInTheDocument();
  });

  it('renderiza erro', async () => {
    mocks.summary.mockRejectedValue(new Error('Falha no summary'));
    renderPage();
    expect(await screen.findByText('Falha no summary')).toBeInTheDocument();
  });

  it('mantem nova exportacao desabilitada enquanto endpoints estao ausentes', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /nova exportacao/i })).toBeDisabled();
  });

  it('mantem filtros desabilitados sem chamar endpoints ficticios', async () => {
    renderPage();
    expect(await screen.findByLabelText('Filtrar exportacao por tipo')).toBeDisabled();
    expect(screen.getByLabelText('Filtrar exportacao por status')).toBeDisabled();
  });

  it('lista endpoints pendentes sem expor bucket ou path interno', async () => {
    renderPage();
    expect(await screen.findByText('GET /projects/{projectId}/export-jobs')).toBeInTheDocument();
    expect(screen.queryByText(/bucket/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/storage_path/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal_url/i)).not.toBeInTheDocument();
  });
});
