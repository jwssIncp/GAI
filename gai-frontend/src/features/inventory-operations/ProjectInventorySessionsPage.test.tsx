import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { CurrentUser, InventorySession } from '@/types/api';
import { ProjectInventorySessionsPage } from './ProjectInventorySessionsPage';

const mocks = vi.hoisted(() => ({ listSessions: vi.fn(), createSession: vi.fn() }));
vi.mock('@/api/endpoints', () => ({ inventoryOperationsApi: { listSessions: mocks.listSessions, createSession: mocks.createSession } }));
const session: InventorySession = { id: 5, organization_id: 1, project_id: 10, name: 'Inventario 2026', status: 'draft', current_round_id: null, created_by_id: 1, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' };
const user: CurrentUser = { id: 1, login: 'admin', email: 'admin@gai.local', status: 'ACTIVE', organization_id: 1, permissions: ['inventory-sessions:read', 'inventory-sessions:create'].map((key) => ({ key, scope: 'ORGANIZATION' })), role_assignments: [] };
function renderPage() { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); const auth: AuthState = { user, accessToken: 'token', expiresAt: null, bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() }; return render(<QueryClientProvider client={client}><AuthContext.Provider value={auth}><MemoryRouter initialEntries={['/app/projects/10/inventory/sessions']}><Routes><Route path="/app/projects/:projectId/inventory/sessions" element={<ProjectInventorySessionsPage />} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>); }
describe('ProjectInventorySessionsPage', () => { beforeEach(() => { vi.clearAllMocks(); mocks.listSessions.mockResolvedValue({ items: [session], page: 1, page_size: 20, total_items: 1, total_pages: 1 }); mocks.createSession.mockResolvedValue(session); }); it('lista sessoes reais e aplica filtro de status', async () => { renderPage(); expect(await screen.findByText('Inventario 2026')).toBeInTheDocument(); await userEvent.selectOptions(screen.getByLabelText('Filtrar sessao por status'), 'draft'); await waitFor(() => expect(mocks.listSessions).toHaveBeenLastCalledWith(10, expect.objectContaining({ status: 'draft' }))); }); it('cria sessao com loading e validacao', async () => { renderPage(); await userEvent.click(await screen.findByRole('button', { name: 'Nova sessao' })); await userEvent.type(screen.getByLabelText('Nome'), 'Campanha nova'); await userEvent.click(screen.getByRole('button', { name: 'Criar sessao' })); await waitFor(() => expect(mocks.createSession).toHaveBeenCalledWith(10, { name: 'Campanha nova' })); }); });
