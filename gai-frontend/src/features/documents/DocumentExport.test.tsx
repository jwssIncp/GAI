import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentExport } from './DocumentExport';
const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), permission: vi.fn() }));
vi.mock('@/api/http', () => ({ api: { post: mocks.post, get: mocks.get } }));
vi.mock('@/features/auth/usePermissions', () => ({ usePermissions: () => ({ hasPermission: mocks.permission }) }));
describe('Professional document downloads', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.permission.mockReturnValue(false); URL.createObjectURL = vi.fn(() => 'blob:synthetic-document'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined); });
  it('generates selected format, downloads the authenticated artifact and reports version metadata', async () => {
    mocks.post.mockResolvedValue({ data: { id: 11, filename: 'laudo.pdf', checksum: 'sha256', version_id: 7, visual_version: 'visual-2', status: 'Versão aprovada preservada' } });
    mocks.get.mockResolvedValue({ data: new Blob(['%PDF-test'], { type: 'application/pdf' }) });
    render(<DocumentExport endpoint="/source/versions/7/documents" />);
    await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Download iniciado'));
    expect(mocks.post).toHaveBeenCalledWith('/source/versions/7/documents', { format: 'pdf' }, expect.any(Object));
    expect(mocks.get).toHaveBeenCalledWith('/source/versions/7/documents/11', expect.objectContaining({ responseType: 'blob' }));
    expect(screen.getByText(/Versão ID 7/)).toBeInTheDocument();
  });
  it('never selects internal memory by default and hides unavailable formats', async () => {
    mocks.permission.mockReturnValue(true); mocks.post.mockRejectedValue(new Error('Arquivo indisponível'));
    render(<DocumentExport endpoint="/budget/documents" formats={['pdf']} allowMemory />);
    expect(screen.queryByRole('button', { name: 'Baixar DOCX' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Arquivo indisponível'));
    expect(mocks.post).toHaveBeenCalledWith('/budget/documents', { format: 'pdf', include_memory: false }, expect.any(Object));
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
