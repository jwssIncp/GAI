import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { ExpenseBoard, ExpenseBoardItem, ReimbursementBatch } from '@/features/expenses/expensesApi';
import { equalInstallments } from '@/features/expenses/expensesApi';
import { ProjectFinancePage } from './ProjectFinancePage';
import type { CurrentUser, ExpenseAttachment } from '@/types/api';

const mocks = vi.hoisted(() => ({
  board: vi.fn(),
  batches: vi.fn(),
  advances: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  action: vi.fn(),
  reject: vi.fn(),
  reopen: vi.fn(),
  changeType: vi.fn(),
  remove: vi.fn(),
  addToBatch: vi.fn(),
  batchAction: vi.fn(),
  closeFinance: vi.fn(),
  reopenFinance: vi.fn(),
  saveAdvance: vi.fn(),
  removeAdvance: vi.fn(),
  importPreview: vi.fn(),
  importCommit: vi.fn(),
  exportFile: vi.fn(),
  zip: vi.fn(),
  attachmentsList: vi.fn(),
  createUploadUrl: vi.fn(),
  confirmUpload: vi.fn(),
  uploadToPresignedUrl: vi.fn(),
}));

vi.mock('@/api/http', () => ({ uploadToPresignedUrl: mocks.uploadToPresignedUrl }));
vi.mock('@/api/endpoints', () => ({
  expenseAttachmentsApi: {
    list: mocks.attachmentsList,
    createUploadUrl: mocks.createUploadUrl,
    confirmUpload: mocks.confirmUpload,
    downloadUrl: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('@/features/expenses/expensesApi', async (original) => ({
  ...(await original<object>()),
  expensesApi: mocks,
}));

const admin: CurrentUser = {
  id: 1,
  login: 'admin',
  email: 'admin@gai.local',
  status: 'ACTIVE',
  organization_id: 1,
  role_assignments: [{ assignment_id: 1, role_id: 1, role_key: 'ORG_ADMIN', role_name: 'Admin', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }],
};
const reader: CurrentUser = {
  ...admin,
  role_assignments: [],
  permissions: [{ key: 'expenses:read', scope: 'ORGANIZATION' }],
} as unknown as CurrentUser;

const item = (id: number, patch: Partial<ExpenseBoardItem> = {}): ExpenseBoardItem => ({
  id,
  sequence: id,
  expense_type: 'reimbursable',
  expense_type_label: 'Reembolsável',
  contract_type_label: 'Reembolsável',
  reason_code: 'Transporte',
  description: 'Táxi do aeroporto',
  legacy_reason: null,
  expense_date: '2026-10-05',
  field_agent_id: 7,
  field_agent_name: 'Ana Campo',
  payment_method: 'cash',
  payment_method_label: 'À vista',
  installments: [],
  invoiced_payment_date: null,
  attachments: 1,
  amount: '100.00',
  deposited_amount: '150.00',
  balance: '50.00',
  status: 'pending',
  rejection_reason: null,
  batch: null,
  to_reimburse: true,
  reopened_at: null,
  updated_at: '2026-10-05T10:00:00.000Z',
  ...patch,
});

const board = (patch: Partial<ExpenseBoard> = {}): ExpenseBoard => ({
  project: { id: 20, name: 'Projeto Alfa', status: 'active' },
  today: '2026-11-13',
  closure: null,
  parameters: { configured: true, reasons: ['Transporte', 'Refeição', 'Lanche', 'Lavanderia', 'Outros'], attachment_max_bytes: 8 * 1024 * 1024, attachment_max_files: 2 },
  default_expense_type: 'reimbursable',
  contract_type_label: 'Reembolsável',
  kpis: {
    total: '1340.00', count: 3, reimbursable: '240.00', reimbursable_pct: '17.91', non_reimbursable: '1100.00', non_reimbursable_pct: '82.09',
    unclassified: '50.00', unclassified_count: 1, to_reimburse: '100.00', contract_value: '10000.00', contract_pct: '13.40',
  },
  summary: [
    { field_agent_id: 7, name: 'Ana Campo', entries: 2, advances: '500.00', advances_count: 1, expenses: '1200.00', balance: '-700.00' },
    { field_agent_id: null, name: 'Despesas gerais', entries: 1, advances: '0.00', advances_count: 0, expenses: '140.00', balance: '-140.00' },
  ],
  agents: [{ id: 7, name: 'Ana Campo', linked: true }],
  items: [
    item(1),
    item(2, { expense_type: 'non_reimbursable', expense_type_label: 'Não reembolsável', amount: '1100.00', payment_method: 'installments', payment_method_label: 'A prazo', installments: [{ number: 1, due_date: '2026-11-05', amount: '550.00' }, { number: 2, due_date: '2026-12-05', amount: '550.00' }], status: 'approved', deposited_amount: null, balance: null, to_reimburse: false }),
    item(3, { field_agent_id: null, field_agent_name: 'Despesas gerais', amount: '140.00', status: 'paid', batch: { id: 4, number: 1, status: 'billed', batch_date: '2026-11-01' }, to_reimburse: false, rejection_reason: null }),
    item(4, { status: 'rejected', rejection_reason: 'Sem nota fiscal', description: 'Almoço', reason_code: 'Refeição' }),
  ],
  totals: { count: 4, amount: '1340.00', non_reimbursable_amount: '1100.00' },
  ...patch,
});

const batch: ReimbursementBatch = { id: 4, number: 1, batch_date: '2026-11-01', expected_receipt_on: null, status: 'billed', status_label: 'Faturado', receivable_id: null, notes: null, count: 1, amount: '140.00', billed_at: '2026-11-02T00:00:00.000Z' };
const openBatch: ReimbursementBatch = { ...batch, id: 5, number: 2, status: 'open', status_label: 'Aberto', count: 0, amount: '0.00', billed_at: null };

function renderPage(user: CurrentUser = admin, path = '/app/projects/20/finance') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId/finance" element={<ProjectFinancePage />} />
            <Route path="/app/projects/:projectId/finance/remuneration" element={<p>Remuneração (destino do redirecionamento)</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Projeto › Despesas (etapa 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.board.mockResolvedValue(board());
    mocks.batches.mockResolvedValue([batch, openBatch]);
    mocks.advances.mockResolvedValue([{ id: 9, field_agent_id: 7, field_agent_name: 'Ana Campo', advanced_on: '2026-10-01', amount: '500.00', notes: null, deposited_by_name: 'Financeiro' }]);
    mocks.changeType.mockResolvedValue({ done: 1, failed: 0, results: [{ id: 1, ok: true }] });
    mocks.remove.mockResolvedValue({ done: 1, failed: 1, results: [{ id: 1, ok: true }, { id: 3, ok: false, message: 'Despesa paga não pode ser excluída.' }] });
    mocks.addToBatch.mockResolvedValue({ batch_id: 6, batch_number: 3, done: 1, failed: 0, results: [{ id: 1, ok: true }] });
    mocks.create.mockResolvedValue({ id: 99 });
    mocks.attachmentsList.mockResolvedValue([] as ExpenseAttachment[]);
  });

  it('?tab=payments (endereço antigo) redireciona para Remuneração', async () => {
    renderPage(admin, '/app/projects/20/finance?tab=payments');
    expect(await screen.findByText('Remuneração (destino do redirecionamento)')).toBeInTheDocument();
  });

  it('KPIs com "A reembolsar", aviso das antigas sem tipo, resumo com saldo e colunas do INVESTOR', async () => {
    renderPage();
    const kpis = within(await screen.findByRole('region', { name: 'Indicadores das despesas' }));
    expect(kpis.getByText('A reembolsar').nextSibling).toHaveTextContent('R$ 100,00');
    expect(kpis.getByText('Reembolsável').parentElement).toHaveTextContent('17,91% do total');
    expect(screen.getByText(/1 despesa\(s\) antiga\(s\) sem tipo/)).toBeInTheDocument();
    const summary = within(screen.getByRole('region', { name: 'Resumo por inventariante' }));
    expect(summary.getByText('-R$ 700,00')).toHaveClass('text-destructive');
    const table = within(screen.getByRole('region', { name: 'Lançamentos de despesas' }));
    expect(table.getByText('A prazo (2x)')).toBeInTheDocument();
    expect(table.getByText(/Lote 1 · 01\/11\/2026 ✓/)).toBeInTheDocument();
    expect(table.getByText('Rejeitada: Sem nota fiscal')).toBeInTheDocument(); // motivo da rejeição à parte
    expect(table.getAllByText('saldo R$ 50,00').length).toBeGreaterThan(0);
    expect(table.getByText(/Sem reembolso do cliente: R\$ 1\.100,00/)).toBeInTheDocument();
  });

  it('alternar o tipo pede confirmação; lote faturado não alterna', async () => {
    const u = userEvent.setup();
    renderPage();
    const table = within(await screen.findByRole('region', { name: 'Lançamentos de despesas' }));
    await u.click(table.getByRole('button', { name: 'Alternar tipo da despesa 1: Reembolsável' }));
    expect(mocks.changeType).not.toHaveBeenCalled();
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.changeType).toHaveBeenCalledWith(20, [1], 'non_reimbursable'));
    expect(table.queryByRole('button', { name: /Alternar tipo da despesa 3/ })).not.toBeInTheDocument();
  });

  it('excluir em lote relata o resultado de cada despesa', async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(await screen.findByLabelText('Selecionar despesa 1'));
    await u.click(screen.getByLabelText('Selecionar despesa 3'));
    await u.click(screen.getByRole('button', { name: 'Excluir (2)' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(20, [1, 3]));
    expect(await screen.findByRole('alert')).toHaveTextContent('1 despesa(s) excluída(s). Não concluídas: 3: Despesa paga não pode ser excluída.');
  });

  it('prestar conta: só reembolsáveis entram, em lote novo ou aberto', async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(await screen.findByLabelText('Selecionar despesa 1'));
    await u.click(screen.getByLabelText('Selecionar despesa 2'));
    await u.click(screen.getByRole('button', { name: 'Prestar conta (2)' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/1 de 2 selecionada\(s\) são reembolsáveis/)).toBeInTheDocument();
    await u.selectOptions(dialog.getByLabelText('Lote de reembolso'), '5');
    await u.click(dialog.getByRole('button', { name: 'Incluir no lote' }));
    await waitFor(() => expect(mocks.addToBatch).toHaveBeenCalledWith(20, { ids: [1], batch_id: 5 }));
  });

  it('nova despesa: motivo da lista, tipo padrão do contrato e parcelas iguais (resto na última)', async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(await screen.findByRole('button', { name: /Nova despesa/ }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByLabelText('Tipo de despesa')).toHaveValue('reimbursable');
    await u.click(dialog.getByRole('button', { name: 'Lançar despesa' }));
    expect(dialog.getByText('Escolha o motivo.')).toBeInTheDocument();
    await u.selectOptions(dialog.getByLabelText('Motivo'), 'Refeição');
    await u.type(dialog.getByLabelText('Valor da despesa (R$)'), '100,00');
    await u.click(dialog.getByLabelText('A prazo'));
    await u.clear(dialog.getByLabelText('Número de parcelas'));
    await u.type(dialog.getByLabelText('Número de parcelas'), '3');
    expect(dialog.getByLabelText('Valor da parcela 3')).toHaveValue('33,34');
    await u.click(dialog.getByRole('button', { name: 'Lançar despesa' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][1]).toMatchObject({
      reason_code: 'Refeição',
      description: 'Refeição',
      expense_type: 'reimbursable',
      amount: '100.00',
      payment_method: 'installments',
      installment_count: 3,
      installments: [
        { due_date: '2026-12-13', amount: '33.33' },
        { due_date: '2027-01-13', amount: '33.33' },
        { due_date: '2027-02-13', amount: '33.34' },
      ],
    });
  });

  it('grade editada precisa somar o valor', async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(await screen.findByRole('button', { name: /Nova despesa/ }));
    const dialog = within(screen.getByRole('dialog'));
    await u.selectOptions(dialog.getByLabelText('Motivo'), 'Lanche');
    await u.type(dialog.getByLabelText('Valor da despesa (R$)'), '100');
    await u.click(dialog.getByLabelText('A prazo'));
    await u.click(dialog.getByLabelText('Parcelas iguais (resto na última)'));
    await u.clear(dialog.getByLabelText('Valor da parcela 1'));
    await u.type(dialog.getByLabelText('Valor da parcela 1'), '60,00');
    await u.click(dialog.getByRole('button', { name: 'Lançar despesa' }));
    expect(dialog.getByRole('alert')).toHaveTextContent('A soma das parcelas (R$ 110,00) difere do valor (R$ 100,00).');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('adiantamentos: excluir pede confirmação', async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Gerenciar adiantamentos de Ana Campo' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Adiantamentos de Ana Campo' }));
    await u.click(await dialog.findByRole('button', { name: 'Excluir adiantamento de 01/10/2026' }));
    expect(mocks.removeAdvance).not.toHaveBeenCalled();
    await u.click(within(screen.getByRole('dialog', { name: 'Excluir adiantamento' })).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.removeAdvance).toHaveBeenCalledWith(20, 9));
  });

  it('concluir o financeiro exige justificativa; concluído bloqueia novas despesas e mostra reabrir', async () => {
    const u = userEvent.setup();
    mocks.closeFinance.mockResolvedValue({});
    renderPage();
    await u.click(await screen.findByRole('button', { name: /Concluir financeiro/ }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Concluir' })).toBeDisabled();
    await u.type(dialog.getByLabelText('Justificativa'), 'Projeto encerrado');
    await u.click(dialog.getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(mocks.closeFinance).toHaveBeenCalledWith(20, 'Projeto encerrado'));
  });

  it('com o financeiro concluído: sem nova despesa nem prestar conta, com faixa e reabrir', async () => {
    mocks.board.mockResolvedValue(board({ closure: { closed_at: '2026-11-10T12:00:00.000Z', closed_by: 'Admin', reason: 'Encerrado' } }));
    renderPage();
    expect(await screen.findByText(/Financeiro concluído em/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nova despesa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Prestar conta/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reabrir financeiro/ })).toBeInTheDocument();
  });

  it('importar: pré-visualização com erros por linha e grava só as válidas', async () => {
    const u = userEvent.setup();
    mocks.importPreview.mockResolvedValue({
      file_name: 'despesas.csv',
      columns: { expense_date: 'Data', amount: 'Total' },
      ignored_columns: ['Projeto'],
      rows: [
        { line: 2, values: { expense_date: '2026-10-03', field_agent_id: 7, field_agent_name: 'Ana Campo', reason_code: 'Transporte', description: null, expense_type: null, amount: '1234.56', deposited_amount: null, payment_method: null, installment_count: null, invoiced_payment_date: null }, errors: [] },
        { line: 3, values: { expense_date: null, field_agent_id: null, field_agent_name: null, reason_code: null, description: null, expense_type: null, amount: null, deposited_amount: null, payment_method: null, installment_count: null, invoiced_payment_date: null }, errors: ['Data inválida.'] },
      ],
      valid: 1,
      invalid: 1,
    });
    mocks.importCommit.mockResolvedValue({ done: 1, failed: 0, results: [{ line: 2, ok: true }] });
    renderPage();
    await u.click(await screen.findByRole('button', { name: /Importar/ }));
    const dialog = within(screen.getByRole('dialog'));
    await u.upload(dialog.getByLabelText('Arquivo para importar'), new File(['x'], 'despesas.csv', { type: 'text/csv' }));
    expect(await dialog.findByText('Data inválida.')).toBeInTheDocument();
    expect(dialog.getByText(/Valor ← "Total"/)).toBeInTheDocument();
    await u.click(dialog.getByRole('button', { name: 'Importar 1 linha(s) válida(s)' }));
    await waitFor(() => expect(mocks.importCommit).toHaveBeenCalledWith(20, [expect.objectContaining({ line: 2 })]));
  });

  it('perfil só de leitura não vê ações de alteração', async () => {
    renderPage(reader);
    await screen.findByRole('region', { name: 'Lançamentos de despesas' });
    for (const name of [/Nova despesa/, /Importar/, /Prestar conta/, /Excluir \(/, /Concluir financeiro/, /ZIP/])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alternar tipo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Lotes de reembolso' })).not.toBeInTheDocument();
  });

  it('comprovantes: respeita o limite de arquivos dos parâmetros', async () => {
    const u = userEvent.setup();
    mocks.attachmentsList.mockResolvedValue([
      { id: 1, organization_id: 1, expense_id: 1, original_name: 'a.pdf', mime_type: 'application/pdf', size_bytes: 10, checksum: null, status: 'uploaded', created_at: '2026-10-05T00:00:00.000Z' },
      { id: 2, organization_id: 1, expense_id: 1, original_name: 'b.pdf', mime_type: 'application/pdf', size_bytes: 10, checksum: null, status: 'uploaded', created_at: '2026-10-05T00:00:00.000Z' },
    ]);
    renderPage();
    await u.click(await screen.findByRole('button', { name: 'Comprovantes da despesa 1' }));
    expect(await screen.findByText(/no máximo 2 por despesa/)).toBeInTheDocument();
    await screen.findByText('b.pdf');
    await u.upload(screen.getByLabelText('Enviar comprovante'), new File(['x'], 'c.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/Limite de 2 comprovante\(s\) por despesa/)).toBeInTheDocument();
    expect(mocks.createUploadUrl).not.toHaveBeenCalled();
  });
});

describe('parcelas iguais (mesma regra da API)', () => {
  it('R$ 100,00 em 3x: 33,33 + 33,33 + 33,34; 31/01 + 1 mês = 28/02', () => {
    expect(equalInstallments('100.00', 3, '2026-01-31')).toEqual([
      { number: 1, due_date: '2026-02-28', amount: '33.33' },
      { number: 2, due_date: '2026-03-31', amount: '33.33' },
      { number: 3, due_date: '2026-04-30', amount: '33.34' },
    ]);
    expect(equalInstallments('0.05', 10, '2026-01-01')).toEqual([]);
  });
});
