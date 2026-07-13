import axios, { AxiosError } from 'axios';
import { clearStoredSession, readStoredSession } from './session-storage';
import type { ApiErrorResponse, ApiValidationDetail } from '@/types/api';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: ApiValidationDetail[];
  rawDetails?: unknown;

  constructor(status: number, body?: Partial<ApiErrorResponse>) {
    super(body?.message ?? 'Erro inesperado');
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code;
    this.rawDetails = body?.details;
    this.details = Array.isArray(body?.details)
      ? body.details.filter((detail): detail is ApiValidationDetail => Boolean(detail && typeof detail === 'object' && 'field' in detail && 'message' in detail))
      : undefined;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const session = readStoredSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status ?? 0;
    if (status === 401) {
      clearStoredSession();
      window.dispatchEvent(new CustomEvent('gai:session-expired'));
    }
    throw new ApiError(status, error.response?.data);
  },
);

export async function getPresignedUrl(url: string) {
  return api.get<{ url: string }>(url).then((response) => response.data.url);
}

export async function uploadToPresignedUrl(url: string, file: File, onProgress?: (progress: number) => void) {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error('Nao foi possivel enviar o arquivo.'));
      }
    };
    request.onerror = () => reject(new Error('Nao foi possivel enviar o arquivo.'));
    request.send(file);
  });
}
