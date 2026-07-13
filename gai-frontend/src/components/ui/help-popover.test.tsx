import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HelpPopover } from './help-popover';

describe('HelpPopover', () => {
  it('abre a ajuda por teclado e fecha com Escape devolvendo o foco', async () => {
    const user = userEvent.setup();
    render(
      <HelpPopover label="Ajuda sobre Usuário vinculado">
        Conteúdo explicativo do campo.
      </HelpPopover>,
    );

    const trigger = screen.getByRole('button', { name: 'Ajuda sobre Usuário vinculado' });
    expect(trigger).toHaveAttribute('type', 'button');
    expect(screen.queryByText('Conteúdo explicativo do campo.')).not.toBeInTheDocument();

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Conteúdo explicativo do campo.')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Conteúdo explicativo do campo.')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
