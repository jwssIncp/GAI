import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientEmailPanel } from './ClientEmailPanel';
import { emailHtml, emailLines } from './clientEmailFormat';
import { preparationApi } from './preparationQueries';
import type { ClientEmail } from './preparationTypes';

const original = [
  'Ana, bom dia.',
  '',
  'RESUMO DO PROJETO:',
  '',
  '01- Escopo: INVENTÁRIO',
  '',
  'PENDÊNCIAS:',
  '01- Base contábil – 27/11 - (CLIENTE <ALFA>)',
].join('\n');
const email = (extra: Partial<ClientEmail> = {}): ClientEmail => ({
  subject: 'Kick-off CLIENTE ALFA',
  original,
  text: original,
  strong_lines: ['RESUMO DO PROJETO:', 'PENDÊNCIAS:'],
  pending_title: 'PENDÊNCIAS:',
  pendings: 1,
  edited: false,
  stale: false,
  revision: 4,
  email_version: 0,
  updated_by_name: null,
  updated_at: null,
  ...extra,
});
function renderPanel(canEdit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ClientEmailPanel projectId={10} instance={20} canEdit={canEdit} onClose={() => undefined} />
    </QueryClientProvider>,
  );
}

describe('Client e-mail formatting', () => {
  it('colors pendings in red, highlights headings and bolds the deadline, escaping the text', () => {
    const lines = emailLines(original, ['RESUMO DO PROJETO:', 'PENDÊNCIAS:'], 'PENDÊNCIAS:');
    expect(lines[2]).toMatchObject({ strong: true, pending: false });
    expect(lines[6]).toMatchObject({ strong: true, pending: true });
    expect(lines[7].tail).toBe('– 27/11 - (CLIENTE <ALFA>)');
    const html = emailHtml(lines);
    expect(html).toContain('color:#C00000');
    expect(html).toContain('<b>– 27/11 - (CLIENTE &lt;ALFA&gt;)</b>');
    expect(html).not.toContain('<ALFA>');
  });
});

describe('ClientEmailPanel', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('saves edits automatically with the e-mail version and the source revision', async () => {
    const ui = userEvent.setup();
    vi.spyOn(preparationApi, 'email').mockResolvedValue(email());
    const save = vi
      .spyOn(preparationApi, 'saveEmail')
      .mockImplementation(async (_p, _i, payload) =>
        email({ text: payload.text, edited: true, email_version: 1, updated_by_name: 'ana' }),
      );
    renderPanel();
    await screen.findByLabelText('Prévia do e-mail');
    await ui.click(screen.getByRole('button', { name: 'Editar texto' }));
    const box = screen.getByLabelText('Texto do e-mail');
    await ui.type(box, ' Obrigado.');
    await waitFor(() => expect(save).toHaveBeenCalled(), { timeout: 3000 });
    expect(save).toHaveBeenLastCalledWith(10, 20, {
      email_version: 0,
      source_revision: 4,
      text: `${original} Obrigado.`,
    });
    expect(await screen.findByText('Edição salva.')).toBeInTheDocument();
  });

  it('warns when answers changed after the edit and regenerates on confirmation', async () => {
    const ui = userEvent.setup();
    vi.spyOn(preparationApi, 'email').mockResolvedValue(
      email({ text: 'Texto antigo', edited: true, stale: true, email_version: 3 }),
    );
    const restore = vi.spyOn(preparationApi, 'restoreEmail').mockResolvedValue(email({ email_version: 4 }));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('As respostas do kick-off mudaram');
    await ui.click(screen.getByRole('button', { name: 'Gerar de novo' }));
    await ui.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(restore).toHaveBeenCalledWith(10, 20, 3);
    expect(await screen.findByText(/E-mail restaurado/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('is read-only without edit permission', async () => {
    vi.spyOn(preparationApi, 'email').mockResolvedValue(email({ edited: true }));
    renderPanel(false);
    await screen.findByLabelText('Prévia do e-mail');
    expect(screen.queryByRole('button', { name: 'Editar texto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restaurar original' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
  });
});
