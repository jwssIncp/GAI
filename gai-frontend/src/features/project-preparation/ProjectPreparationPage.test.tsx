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
        performed_by_name: 'Ana Souza',
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
      screen.getByRole('button', { name: 'Detalhes: Já houve inventário?' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Detalhes: Lições anteriores' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('BLOQUEADO'),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 não aplicáveis/)).toBeInTheDocument();
  });
  it('lista kick-offs no painel azul, filtra por situação e responde listas na linha como no sistema anterior', async () => {
    const ui = userEvent.setup();
    vi.spyOn(preparationApi, 'answers').mockResolvedValue(structuredClone(seed));
    renderPage();
    const [list] = await screen.findAllByRole('region', { name: 'Kick-offs' });
    expect(list).toHaveTextContent('Reunião inicial');
    expect(list).toHaveTextContent('0 de 1 (0%)');
    expect(list).toHaveTextContent('Em andamento');
    const [group] = await screen.findAllByRole('region', { name: 'Escopo' });
    expect(group).toHaveTextContent('PENDENTE');
    expect(screen.getByText('0 de 1 verificado(s)')).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Realizados' }));
    expect(screen.getByText('Nenhum item nesta situação.')).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Todos' }));
    await ui.selectOptions(
      screen.getByLabelText('Resposta: Já houve inventário?'),
      'true',
    );
    await waitFor(() =>
      expect(preparationApi.answers).toHaveBeenCalledWith(10, 20, 1, [
        expect.objectContaining({
          question_id: 'flag',
          state: 'completed',
          value: true,
        }),
      ]),
    );
    // Responder não conclui: o "Realizado" é um botão à parte, como no sistema anterior.
    expect(vi.mocked(preparationApi.answers).mock.calls[0][3][0]).not.toHaveProperty('realized');
    await ui.click(screen.getByRole('button', { name: 'Realizado: Já houve inventário?' }));
    await waitFor(() =>
      expect(preparationApi.answers).toHaveBeenLastCalledWith(10, 20, 1, [
        expect.objectContaining({ question_id: 'flag', realized: true }),
      ]),
    );
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
        name: 'Detalhes: Já houve inventário?',
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
        name: 'Detalhes: Lições anteriores',
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Resposta salva/)).toBeInTheDocument();
  });
  it('separates the client checklist tab and shows an empty state without reusing kickoff responses', async () => {
    renderPage(['read'], 'client-checklist');
    expect(
      await screen.findByText('Nenhum Checklist do cliente criado'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Detalhes: Já houve inventário?' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Novo checklist' }),
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
      screen.queryByRole('button', { name: 'Concluir' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Detalhes: Já houve inventário?' }),
    ).not.toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(await screen.findByText('Preparação criada')).toBeInTheDocument();
    // Quem fez a ação aparece pelo nome, nunca pelo ID técnico.
    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();
    expect(screen.queryByText(/usuário #/i)).not.toBeInTheDocument();
  });
  it('creates a real instance using the selected organization template and civil dates', async () => {
    const ui = userEvent.setup();
    vi.spyOn(preparationApi, 'create').mockResolvedValue({ ...seed, id: 21 });
    renderPage();
    await ui.click(
      await screen.findByRole('button', { name: '+ Novo kick-off' }),
    );
    // Como no sistema anterior, basta o nome do cliente (já vem com a empresa do projeto).
    const name = screen.getByLabelText('Nome do cliente');
    expect(name).toHaveValue(context.company!.name);
    await ui.clear(name);
    await ui.type(name, 'Nova reunião');
    await ui.click(screen.getByText('Mais opções'));
    await ui.type(screen.getByLabelText('Data da preparação'), '2028-02-29');
    await ui.click(screen.getByRole('button', { name: 'Criar' }));
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
        name: 'Detalhes: Já houve inventário?',
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
  it('lista no padrão do sistema anterior: busca sem acento, Concluir na linha e Excluir com motivo', async () => {
    const ui = userEvent.setup();
    vi.spyOn(preparationApi, 'list').mockResolvedValue({
      items: [
        { ...structuredClone(seed), title: 'São Paulo Indústria' },
        { ...structuredClone(seed), id: 12, title: 'Arquivado antigo', status: 'archived' },
        { ...structuredClone(seed), id: 13, title: 'Concluído', status: 'approved' },
      ],
    });
    vi.spyOn(preparationApi, 'get').mockResolvedValue({ ...structuredClone(seed), title: 'São Paulo Indústria' });
    const transition = vi.spyOn(preparationApi, 'transition').mockResolvedValue(structuredClone(seed));
    renderPage();
    const table = (await screen.findAllByRole('region', { name: 'Kick-offs' }))[0];
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Cliente', 'Data', 'Check list', 'Situação', 'Ações']);
    // Arquivados ficam fora da lista até "Mostrar arquivados".
    expect(within(table).queryByText('Arquivado antigo')).not.toBeInTheDocument();
    expect(within(table).getByText('Em andamento')).toBeInTheDocument();
    expect(within(table).getByText('Concluída')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Reabrir Concluído' })).toBeInTheDocument();
    await ui.type(screen.getByRole('searchbox', { name: 'Buscar cliente' }), 'sao paulo');
    expect(within(table).queryByText('Concluído')).not.toBeInTheDocument();
    expect(within(table).getByText('São Paulo Indústria')).toBeInTheDocument();
    await ui.click(within(table).getByRole('button', { name: 'Concluir São Paulo Indústria' }));
    await ui.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(transition).toHaveBeenCalledWith(10, seed.id, seed.revision, 'approve', undefined));
    // Excluir (arquiva) exige motivo de pelo menos 5 caracteres.
    await ui.click(screen.getByRole('button', { name: 'Excluir' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Excluir' });
    expect(confirm).toBeDisabled();
    await ui.type(within(dialog).getByLabelText('Motivo'), 'Criado por engano');
    await ui.click(confirm);
    await waitFor(() => expect(transition).toHaveBeenCalledWith(10, seed.id, seed.revision, 'archive', 'Criado por engano'));
  });
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
      screen.queryByRole('button', { name: /Novo kick-off/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Concluir' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Detalhes: Já houve inventário?' }),
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
        operator: 'equals',
        value: 'GAI',
      },
    ]);
    expect(client.questions.some((q) => q.type === 'unit_allocations')).toBe(
      true,
    );
    kickoff.questions[0].label = 'Alterado';
    expect(client.questions[0].label).not.toBe('Alterado');
  });
});
