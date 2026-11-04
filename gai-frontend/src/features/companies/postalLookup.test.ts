import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupPostalAddress } from './postalLookup';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Postal lookup service', () => {
  it('validates CEP before making a request', async () => { const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); await expect(lookupPostalAddress('123')).rejects.toThrow('8 dígitos'); expect(fetch).not.toHaveBeenCalled(); });
  it('maps only address fields and caches successful responses', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ logradouro: 'Rua teste', bairro: 'Centro', localidade: 'Curitiba', uf: 'PR', complemento: 'Não copiar' }) }); vi.stubGlobal('fetch', fetch);
    const expected = { address: 'Rua teste', district: 'Centro', city: 'Curitiba', state: 'PR' };
    expect(await lookupPostalAddress('80010-000')).toEqual(expected); expect(await lookupPostalAddress('80010000')).toEqual(expected); expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([{ erro: true }, { surprise: true }])('rejects missing or malformed addresses', async (data) => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data })); await expect(lookupPostalAddress('99999001')).rejects.toThrow(); });
  it('times out requests and leaves manual entry possible', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, { signal }: { signal: AbortSignal }) => new Promise((_, reject) => { signal.addEventListener('abort', () => reject(new Error('aborted'))); })));
    const promise = expect(lookupPostalAddress('99999002')).rejects.toThrow('tempo esgotado'); await vi.advanceTimersByTimeAsync(8000); await promise;
  });
  it('reports unavailable services', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false })); await expect(lookupPostalAddress('99999003')).rejects.toThrow('indisponível'); });
});
