import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { expect, it } from 'vitest';
import { useListState } from './useListState';

function List() {
  const state = useListState(), location = useLocation(), navigate = useNavigate();
  return <><output aria-label="Estado">{state.page}:{state.search}:{location.search}</output>
    <button onClick={() => state.setSearch('novo')}>Buscar</button>
    <button onClick={() => state.setPage(2)}>Próxima</button>
    <button onClick={() => navigate(-1)}>Voltar</button></>;
}
it('restores filters from the URL, resets page on search and preserves context through history', async () => {
  render(<MemoryRouter initialEntries={['/users?page=3&search=antigo&project_id=7']}><List /></MemoryRouter>);
  expect(screen.getByLabelText('Estado')).toHaveTextContent('3:antigo');
  await userEvent.click(screen.getByText('Buscar'));
  expect(screen.getByLabelText('Estado')).toHaveTextContent('1:novo:?search=novo&project_id=7');
  await userEvent.click(screen.getByText('Próxima'));
  expect(screen.getByLabelText('Estado')).toHaveTextContent('2:novo');
  await userEvent.click(screen.getByText('Voltar'));
  expect(screen.getByLabelText('Estado')).toHaveTextContent('1:novo');
});
