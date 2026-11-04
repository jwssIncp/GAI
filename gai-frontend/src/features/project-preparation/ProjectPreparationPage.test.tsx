import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { CurrentUser } from '@/types/api';
import { ProjectPreparationPage } from './ProjectPreparationPage';
import { preparationApi } from './preparationQueries';
import type {
  Preparation,
  PreparationContext,
  PreparationTemplate,
} from './preparationTypes';
import { referenceTemplate } from './referenceTemplates';

const context: PreparationContext = {
  project: {
    id: 10,
    organization_id: 1,
    name: 'Projeto Alfa',
    status: 'active',
  },
  company: { id: 1, name: 'Empresa Alfa' },
  units: [{ id: 5, name: 'Unidade Alfa', address: 'Rua Alfa' }],
  responsible_users: [{ id: 2, label: 'ana' }],
};
const seed: Preparation = {
  id: 20,
  organization_id: 1,
  project_id: 10,
  kind: 'kickoff',
  title: 'Reunião inicial',
  revision: 1,
  template_version_id: 1,
  snapshot: {
    name: 'Modelo da organização',
    version: 1,
    questions: [
      {
        id: 'flag',
        label: 'Já houve inventário?',
        category: 'Escopo',
        type: 'boolean',
        order: 0,
        required: true,
        visible: true,
        allow_not_applicable: false,
      },
      {
        id: 'details',
        label: 'Lições anteriores',
        category: 'Escopo',
        type: 'text',
        order: 1,
        required: false,
        visible: true,
        allow_not_applicable: true,
        enabled_when: [
          { question_id: 'flag', operator: 'equals', value: true },
        ],
      },
    ],
  },
  status: 'draft',
  responsible_user_id: 2,
  scheduled_date: '2028-02-29',
  due_date: null,
  notes: null,
  approved_by_id: null,
  approved_at: null,
  created_at: '2026-10-27T12:00:00Z',
  updated_at: '2026-10-27T12:00:00Z',
  progress: {
    total: 1,
    completed: 0,
    not_applicable: 0,
    pending: 1,
    hidden: 0,
    conditionally_disabled: 1,
    percent: 0,
    missing_required: ['flag'],
  },
  answers: ['flag', 'details'].map((question_id) => ({
    question_id,
    applicable: question_id === 'flag',
    state: 'pending',
    value: null,
    notes: null,
    responsible_user_id: null,
    due_date: null,
    answered_by_id: null,
    answered_at: null,
    allocations: [],
  })),
};
const model: PreparationTemplate = {
  id: 1,
  organization_id: 1,
  name: 'Modelo da organização',
  kind: 'kickoff',
  current_version: 1,
  archived_at: null,
  questions: seed.snapshot.questions,
  versions: [
    {
      version: 1,
      name: 'Modelo da organização',
      created_at: '2026-10-27T12:00:00Z',
      created_by_id: 2,
    },
  ],
};
function renderPage(keys = ['read', 'edit', 'approve'], kind = 'kickoff') {
  const user: CurrentUser = {
    id: 2,
    login: 'ana',
    email: 'ana@example.test',
    status: 'ACTIVE',
    organization_id: 1,
    permissions: keys.map((key) => ({
      key: `project-preparation:${key}`,
      scope: 'ORGANIZATION',
    })),
    role_assignments: [],
  };
  const auth: AuthState = {
    user,
    accessToken: 'synthetic',
    expiresAt: '2099-01-01',
    bootstrapping: false,
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[`/app/projects/10/preparation/${kind}`]}>
          <Routes>
            <Route
              path="/app/projects/:projectId/preparation/:kind"
              element={<ProjectPreparationPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(preparationApi, 'context').mockResolvedValue(
    structuredClone(context),
  );
  vi.spyOn(preparationApi, 'list').mockResolvedValue({
    items: [structuredClone(seed)],
  });
  vi.spyOn(preparationApi, 'get').mockResolvedValue(structuredClone(seed));
  vi.spyOn(preparationApi, 'templates').mockResolvedValue({
    items: [structuredClone(model)],
  });
  vi.spyOn(preparationApi, 'template').mockResolvedValue(
    structuredClone(model),
  );
  vi.spyOn(preparationApi, 'history').mockResolvedValue({
    items: [
      {
        id: 1,
        operation: 'INSTANCE_CREATED',
        performed_by_id: 2,
        created_at: seed.created_at,
        changes: { snapshot: seed.snapshot },
      },
    ],
    next_before_id: null,
  });
});
describe('Project preparation UI', () => {
  it('shows loading and authorized project/company/unit context with server progress and disabled conditions', async () => {
    vi.mocked(preparationApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByText('Empresa Alfa')).toBeInTheDocument();
    expect(screen.getByText(/Unidade Alfa/)).toBeInTheDocument();
    expect(screen.getByText('Carregando respostas')).toBeInTheDocument();
  });
  it('renders answers, dates and separate N/A/pending progress and blocks disabled question editing', async () => {
    renderPage();
    await screen.findByText('Reunião inicial', { selector: 'h2' });
    expect(
      screen.getByRole('button', { name: 'Responder: Já houve inventário?' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Responder: Lições anteriores' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Desabilitada pelas respostas atuais/),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 não aplicáveis/)).toBeInTheDocument();
  });
  it('persists a typed answer with revision and refreshes enablement from the backend', async () => {
    const ui = userEvent.setup();
    const changed = structuredClone(seed);
    changed.revision = 2;
    changed.answers[0] = {
      ...changed.answers[0],
      state: 'completed',
      value: true,
      answered_by_id: 2,
      answered_at: seed.created_at,
    };
    changed.answers[1].applicable = true;
    changed.progress = {
      ...changed.progress,
      total: 2,
      completed: 1,
      percent: 50,
      conditionally_disabled: 0,
      missing_required: [],
    };
    vi.spyOn(preparationApi, 'answers').mockImplementation(async () => {
      vi.mocked(preparationApi.get).mockResolvedValue(changed);
      return changed;
    });
    renderPage();
    await ui.click(
      await screen.findByRole('button', {
        name: 'Responder: Já houve inventário?',
      }),
    );
    await ui.selectOptions(screen.getByLabelText('Situação'), 'completed');
    await ui.selectOptions(screen.getByLabelText('Resposta'), 'true');
    await ui.click(screen.getByRole('button', { name: 'Salvar resposta' }));
    await waitFor(() =>
      expect(preparationApi.answers).toHaveBeenCalledWith(10, 20, 1, [
        expect.objectContaining({
          question_id: 'flag',
          state: 'completed',
          value: true,
        }),
      ]),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Responder: Lições anteriores',
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Resposta salva/)).toBeInTheDocument();
  });
  it('separates the client checklist tab and shows an empty state without reusing kickoff responses', async () => {
    renderPage(['read'], 'client-checklist');
    expect(
      await screen.findByText('Nenhum Checklist do Cliente criado'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Responder: Já houve inventário?' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Nova preparação' }),
    ).not.toBeInTheDocument();
  });
  it('shows API errors with retry and does not show protected content', async () => {
    vi.mocked(preparationApi.context).mockRejectedValue(
      new Error('Acesso negado ao projeto'),
    );
    renderPage();
    expect(
      await screen.findByText('Acesso negado ao projeto'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Empresa Alfa')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
  });
  it('keeps read-only access without editing/approval actions and exposes audit actor/date', async () => {
    const ui = userEvent.setup();
    renderPage(['read']);
    await screen.findByText('Reunião inicial', { selector: 'h2' });
    expect(
      screen.queryByRole('button', { name: 'Aprovar preparação' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Responder: Já houve inventário?' }),
    ).not.toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByText('Preparação criada')).toBeInTheDocument();
    expect(screen.getByText(/usuário #2/)).toBeInTheDocument();
  });
  it('creates a real instance using the selected organization template and civil dates', async () => {
    const ui = userEvent.setup();
    vi.spyOn(preparationApi, 'create').mockResolvedValue({ ...seed, id: 21 });
    renderPage();
    await ui.click(
      await screen.findByRole('button', { name: 'Nova preparação' }),
    );
    await ui.type(screen.getByLabelText('Título'), 'Nova reunião');
    await ui.type(screen.getByLabelText('Data da preparação'), '2028-02-29');
    await ui.click(screen.getByRole('button', { name: 'Criar preparação' }));
    await waitFor(() =>
      expect(preparationApi.create).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          template_id: 1,
          title: 'Nova reunião',
          scheduled_date: '2028-02-29',
        }),
      ),
    );
  });
  it('generates preview only after explicit action and copies the visible content without sending', async () => {
    const ui = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    vi.spyOn(preparationApi, 'communication').mockResolvedValue({
      channel: 'email',
      recipient: null,
      subject: 'Ata Alfa',
      body: 'Conteúdo autorizado da reunião',
      delivery_status: 'preview_only',
    });
    renderPage();
    await ui.click(
      await screen.findByRole('button', { name: 'Prévia de comunicação' }),
    );
    expect(preparationApi.communication).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Copiar texto revisado' }),
    ).not.toBeInTheDocument();
    await ui.click(
      screen.getByRole('button', { name: 'Gerar prévia de e-mail' }),
    );
    expect(
      await screen.findByDisplayValue('Conteúdo autorizado da reunião'),
    ).toBeInTheDocument();
    await ui.click(
      screen.getByRole('button', { name: 'Copiar texto revisado' }),
    );
    expect(copy).toHaveBeenCalledWith(
      'Ata Alfa\n\nConteúdo autorizado da reunião',
    );
    expect(
      await screen.findByText('Texto copiado. Nenhuma mensagem foi enviada.'),
    ).toBeInTheDocument();
  });
  it('manages organization templates and creates an explicit reusable reference model', async () => {
    const ui = userEvent.setup();
    vi.spyOn(preparationApi, 'createTemplate').mockResolvedValue(model);
    renderPage();
    await ui.click(
      await screen.findByRole('button', { name: 'Modelos da organização' }),
    );
    await ui.click(
      await screen.findByRole('button', { name: 'Novo modelo de referência' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Criar modelo' });
    await ui.click(
      within(dialog).getByRole('button', { name: 'Salvar modelo' }),
    );
    await waitFor(() =>
      expect(preparationApi.createTemplate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          kind: 'kickoff',
          questions: expect.arrayContaining([
            expect.objectContaining({ id: 'label-sequence', type: 'sequence' }),
          ]),
        }),
      ),
    );
    expect(await screen.findByText(/Modelo salvo/)).toBeInTheDocument();
  });
  it('shows backend conflicts without claiming that answers were saved', async () => {
    const ui = userEvent.setup();
    vi.spyOn(preparationApi, 'answers').mockRejectedValue(
      new Error('Dados alterados; recarregue antes de salvar'),
    );
    renderPage();
    await ui.click(
      await screen.findByRole('button', {
        name: 'Responder: Já houve inventário?',
      }),
    );
    await ui.click(screen.getByRole('button', { name: 'Salvar resposta' }));
    expect(
      await screen.findByText('Dados alterados; recarregue antes de salvar'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Resposta salva/)).not.toBeInTheDocument();
  });
});
describe('Preparation on closed projects', () => {
  it('preserves consultation while hiding instance mutations and approval on finished projects', async () => {
    vi.spyOn(preparationApi, 'context').mockResolvedValue({
      ...context,
      project: { ...context.project, status: 'finished' },
    });
    renderPage();
    expect(
      await screen.findByText(
        'O status atual do projeto permite apenas consulta da preparação.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Nova preparação' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Aprovar preparação' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Responder: Já houve inventário?' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Histórico' }),
    ).toBeInTheDocument();
  });
});
describe('Audited reference model suggestions', () => {
  it('uses stable IDs, separate definitions and explicit conditional sequence/unit contracts', () => {
    const kickoff = referenceTemplate('kickoff');
    const client = referenceTemplate('client_checklist');
    expect(kickoff.kind).not.toBe(client.kind);
    expect(new Set(kickoff.questions.map((q) => q.id)).size).toBe(
      kickoff.questions.length,
    );
    const sequence = kickoff.questions.find((q) => q.id === 'label-sequence')!;
    expect(sequence.quantity_question_id).toBe('label-quantity');
    expect(sequence.enabled_when).toEqual([
      {
        question_id: 'label-supplier',
        operator: 'not_equals',
        value: 'Não aplicável',
      },
    ]);
    expect(client.questions.some((q) => q.type === 'unit_allocations')).toBe(
      true,
    );
    kickoff.questions[0].label = 'Alterado';
    expect(client.questions[0].label).not.toBe('Alterado');
  });
});
