import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { InventoryItemImagesGallery } from './InventoryItemImagesGallery';
import type { CurrentUser, InventoryItemImage, PaginatedItems } from '@/types/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  createUploadUrl: vi.fn(),
  confirmUpload: vi.fn(),
  downloadUrl: vi.fn(),
  remove: vi.fn(),
  uploadToPresignedUrl: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  inventoryItemImagesApi: {
    list: mocks.list,
    createUploadUrl: mocks.createUploadUrl,
    confirmUpload: mocks.confirmUpload,
    downloadUrl: mocks.downloadUrl,
    remove: mocks.remove,
  },
}));

vi.mock('@/api/http', () => ({
  uploadToPresignedUrl: mocks.uploadToPresignedUrl,
}));

const admin: CurrentUser = {
  id: 1,
  login: 'admin',
  email: 'admin@gai.local',
  status: 'ACTIVE',
  organization_id: 1,
  role_assignments: [{ assignment_id: 1, role_id: 1, role_key: 'ORG_ADMIN', role_name: 'Admin', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }],
};

const readonlyUser: CurrentUser = {
  ...admin,
  role_assignments: [{ assignment_id: 2, role_id: 3, role_key: 'ORG_USER', role_name: 'User', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }],
};

const image: InventoryItemImage = {
  id: 31,
  organization_id: 1,
  inventory_item_id: 11,
  storage_provider: 's3',
  original_name: 'frente.webp',
  mime_type: 'image/webp',
  size_bytes: 2048,
  checksum: null,
  status: 'uploaded',
  uploaded_by_id: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
};

function page(items: InventoryItemImage[]): PaginatedItems<InventoryItemImage> {
  return { items, page: 1, page_size: 12, total_items: items.length, total_pages: items.length ? 1 : 0 };
}

function renderGallery(user: CurrentUser = admin) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <InventoryItemImagesGallery projectId={10} itemId={11} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('InventoryItemImagesGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(page([image]));
    mocks.createUploadUrl.mockResolvedValue({ image: { ...image, id: 32, status: 'pending_upload' }, upload_url: 'https://upload.example/private-put', expires_in_seconds: 300 });
    mocks.confirmUpload.mockResolvedValue({ ...image, id: 32 });
    mocks.downloadUrl.mockResolvedValue({ image, download_url: 'https://signed.example/bucket/internal/frente.webp', expires_in_seconds: 300 });
    mocks.remove.mockResolvedValue({ ...image, status: 'removed' });
    mocks.uploadToPresignedUrl.mockImplementation(async (_url: string, _file: File, onProgress?: (progress: number) => void) => {
      onProgress?.(100);
    });
  });

  it('renderiza a galeria com metadados seguros', async () => {
    renderGallery();
    expect(await screen.findByText('frente.webp')).toBeInTheDocument();
    expect(screen.getByText('image/webp - 2.0 KB')).toBeInTheDocument();
    expect(screen.queryByText('s3')).not.toBeInTheDocument();
    expect(screen.queryByText(/bucket\/internal/i)).not.toBeInTheDocument();
  });

  it('renderiza loading', () => {
    mocks.list.mockReturnValue(new Promise(() => undefined));
    renderGallery();
    expect(screen.getByText('Carregando imagens')).toBeInTheDocument();
  });

  it('renderiza vazio', async () => {
    mocks.list.mockResolvedValue(page([]));
    renderGallery();
    expect(await screen.findByText('Nenhuma imagem cadastrada')).toBeInTheDocument();
  });

  it('renderiza erro', async () => {
    mocks.list.mockRejectedValue(new Error('Falha nas imagens'));
    renderGallery();
    expect(await screen.findByText('Falha nas imagens')).toBeInTheDocument();
  });

  it('oculta upload e remocao sem permissao', async () => {
    renderGallery(readonlyUser);
    await screen.findByText('frente.webp');
    expect(screen.queryByLabelText('Adicionar imagem')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remover frente.webp')).not.toBeInTheDocument();
  });

  it('valida formato de arquivo antes de solicitar upload-url', async () => {
    renderGallery();
    const file = new File(['dados'], 'nota.txt', { type: 'text/plain' });
    await userEvent.upload(await screen.findByLabelText('Adicionar imagem'), file, { applyAccept: false });
    expect(await screen.findByText('Formato nao permitido. Envie JPEG, PNG ou WEBP.')).toBeInTheDocument();
    expect(mocks.createUploadUrl).not.toHaveBeenCalled();
  });

  it('executa upload-url, envio direto e confirm-upload', async () => {
    renderGallery();
    const file = new File(['image'], 'nova.webp', { type: 'image/webp' });
    await userEvent.upload(await screen.findByLabelText('Adicionar imagem'), file);
    await waitFor(() => expect(mocks.confirmUpload).toHaveBeenCalledWith(10, 11, 32, { size_bytes: file.size }));
    expect(mocks.createUploadUrl).toHaveBeenCalledWith(10, 11, { original_name: 'nova.webp', mime_type: 'image/webp', size_bytes: file.size });
    expect(mocks.uploadToPresignedUrl).toHaveBeenCalledWith('https://upload.example/private-put', file, expect.any(Function));
    expect(await screen.findByText('Imagem enviada com sucesso.')).toBeInTheDocument();
  });

  it('gera download-url sob demanda e exibe preview', async () => {
    renderGallery();
    await userEvent.click(await screen.findByRole('button', { name: /visualizar/i }));
    expect(await screen.findByRole('img', { name: 'frente.webp' })).toHaveAttribute('src', 'https://signed.example/bucket/internal/frente.webp');
    expect(mocks.downloadUrl).toHaveBeenCalledWith(10, 11, 31);
  });

  it('remove imagem com confirmacao', async () => {
    renderGallery();
    await userEvent.click(await screen.findByLabelText('Remover frente.webp'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(10, 11, 31));
  });
});
