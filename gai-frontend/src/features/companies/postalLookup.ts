export type PostalAddress = { address: string; district: string; city: string; state: string };
const cache = new Map<string, PostalAddress>();

export async function lookupPostalAddress(zipcode: string, signal?: AbortSignal): Promise<PostalAddress> {
  const cep = zipcode.replace(/\D/g, '');
  if (!/^\d{8}$/.test(cep)) throw new Error('Informe um CEP com 8 dígitos.');
  const cached = cache.get(cep);
  if (cached) return cached;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 8000);
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Serviço de CEP indisponível. Preencha o endereço manualmente.');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') throw new Error('Resposta inválida do serviço de CEP.');
    const row = data as Record<string, unknown>;
    if (row.erro) throw new Error('CEP não encontrado. Confira o número ou preencha manualmente.');
    if (typeof row.localidade !== 'string' || typeof row.uf !== 'string') throw new Error('Resposta inválida do serviço de CEP.');
    const address = { address: typeof row.logradouro === 'string' ? row.logradouro : '', district: typeof row.bairro === 'string' ? row.bairro : '', city: row.localidade, state: row.uf };
    if (cache.size >= 100) cache.clear();
    cache.set(cep, address);
    return address;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Consulta de CEP interrompida ou com tempo esgotado. Preencha manualmente ou tente novamente.');
    throw error instanceof Error ? error : new Error('Não foi possível consultar o CEP. Preencha manualmente.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
