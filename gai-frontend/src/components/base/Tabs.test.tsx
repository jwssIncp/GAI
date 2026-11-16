import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

it('retains the authorized return context when switching preparation sections', () => {
  const query = '?return_to=' + encodeURIComponent('/app/dashboard?search=alfa');
  render(<MemoryRouter initialEntries={['/app/projects/7/preparation/kickoff' + query]}>
    <Tabs tabs={[{ label: 'Checklist', to: '/app/projects/7/preparation/client-checklist' }]} />
  </MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Checklist' })).toHaveAttribute('href', '/app/projects/7/preparation/client-checklist' + query);
});

describe('Tabs: barra de abas única (.section-navigation + aria-current)', () => {
  it('abas de rota: a ativa tem aria-current="page"; end evita marcar a aba inicial nas filhas', () => {
    render(<MemoryRouter initialEntries={['/app/finance/dre/accounts']}>
      <Tabs label="Navegação da DRE" tabs={[{ label: 'DRE mensal', to: '/app/finance/dre', end: true }, { label: 'Plano de contas', to: '/app/finance/dre/accounts' }]} />
    </MemoryRouter>);
    expect(screen.getByRole('navigation', { name: 'Navegação da DRE' })).toHaveClass('section-navigation');
    expect(screen.getByRole('link', { name: 'Plano de contas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'DRE mensal' })).not.toHaveAttribute('aria-current');
  });

  it('abas da mesma tela (ex.: ?tab= do detalhe): botões com aria-current e onChange', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Detalhe do recebível" value="history" onChange={onChange} tabs={[{ label: 'Parcelas', value: 'installments' }, { label: 'Histórico', value: 'history' }]} />);
    expect(screen.getByRole('button', { name: 'Histórico' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Parcelas' })).not.toHaveAttribute('aria-current');
    await userEvent.click(screen.getByRole('button', { name: 'Parcelas' }));
    expect(onChange).toHaveBeenCalledWith('installments');
  });
});
