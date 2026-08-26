import { describe, expect, it, vi } from 'vitest';
import { createIdempotencyKey } from './idempotency';

describe('createIdempotencyKey', () => {
  it('gera uma chave valida uma vez para ser reutilizada em retries', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('123e4567-e89b-12d3-a456-426614174000');
    const key = createIdempotencyKey();
    expect(key).toBe('web-123e4567-e89b-12d3-a456-426614174000');
    expect(key.length).toBeGreaterThanOrEqual(8);
  });
});
