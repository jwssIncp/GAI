import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/http';
import { ToastContext } from '@/components/ui/toast-context';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { CurrentUser, Project } from '@/types/api';
import { ProjectLifecycleActions } from './ProjectLifecycleActions';

const mocks = vi.hoisted(() => ({
  activate: vi.fn(), pause: vi.fn(), resume: vi.fn(), finish: vi.fn(), cancel: vi.fn(), archive: vi.fn(), toast: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  projectsApi: {
    activate: mocks.activate,
    pause: mocks.pause,
    resume: mocks.resume,
    finish: mocks.finish,
    cancel: mocks.cancel,
    archive: mocks.archive,
  },
  projectUnitsApi: { list: vi.fn(), assign: vi.fn(), remove: vi.fn() },
}));

const project: Project = {
  id: 10,
  organization_id: 1,
  company_id: 3,
  name: 'Projeto Alpha',
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  available_actions: [
    { action: 'finish', permission: 'projects:finish-approved' },
    { action: 'pause', permission: 'projects:pause' },
  ],
};

function renderActions(permissionKeys: string[]) {
  const user: CurrentUser = {
    id: 1,
    login: 'operador',
    email: 'operador@gai.local',
    status: 'ACTIVE',
    organization_id: 1,
    role_assignments: [],
    permissions: permissionKeys.map((key) => ({ key, scope: 'ORGANIZATION' })),
  };
  const auth: AuthState = {
    user,
    accessToken: 'token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    bootstrapping: false,
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <ToastContext.Provider value={{ toast: mocks.toast, dismiss: vi.fn() }}>
          <ProjectLifecycleActions project={project} />
        </ToastContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ProjectLifecycleActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('respeita available_actions, a permissao informada pelo backend e detalha blockers 409', async () => {
    mocks.finish.mockRejectedValue(new ApiError(409, {
      code: 'PROJECT_HAS_OPEN_OPERATIONS',
      message: 'Existem operacoes em aberto.',
      details: { operations: [{ type: 'import_sessions', count: 2 }, { type: 'pending_issues', count: 1 }] },
    }));
    renderActions(['projects:finish-approved']);

    expect(screen.getByRole('button', { name: 'Finalizar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(mocks.finish).toHaveBeenCalledWith(10));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Projeto possui operacoes abertas',
      description: expect.stringContaining('import_sessions: 2'),
      tone: 'error',
    }));
  });

  it('executa sem confirmacao uma acao liberada pelo backend', async () => {
    const paused = { ...project, status: 'paused' as const };
    mocks.pause.mockResolvedValue(paused);
    renderActions(['projects:pause']);
    await userEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(mocks.pause).toHaveBeenCalledWith(10));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }));
  });

  it('diferencia 403 de indisponibilidade por status', async () => {
    mocks.pause.mockRejectedValue(new ApiError(403, { code: 'FORBIDDEN', message: 'Insufficient permissions' }));
    renderActions(['projects:pause']);
    await userEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Sem permissao',
      description: 'Seu acesso nao permite executar esta acao.',
    })));
  });

  it('trata 404 quando o projeto deixa de existir', async () => {
    mocks.pause.mockRejectedValue(new ApiError(404, { code: 'PROJECT_NOT_FOUND', message: 'Project not found' }));
    renderActions(['projects:pause']);
    await userEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Projeto nao encontrado',
      description: 'O projeto nao esta mais disponivel.',
    })));
  });
});
