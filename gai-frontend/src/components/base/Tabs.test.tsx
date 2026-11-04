import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { Tabs } from './Tabs';

it('retains the authorized return context when switching preparation sections', () => {
  const query = '?return_to=' + encodeURIComponent('/app/dashboard?search=alfa');
  render(<MemoryRouter initialEntries={['/app/projects/7/preparation/kickoff' + query]}>
    <Tabs tabs={[{ label: 'Checklist', to: '/app/projects/7/preparation/client-checklist' }]} />
  </MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Checklist' })).toHaveAttribute('href', '/app/projects/7/preparation/client-checklist' + query);
});
