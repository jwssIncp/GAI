import '@testing-library/jest-dom/vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
  });
}

// Nenhum teste pode fazer requisição HTTP real: a origem do jsdom é
// localhost:3000, onde pode estar a API de desenvolvimento, e o resultado
// passaria a depender do ambiente (tempo, 401, conexão recusada). A requisição
// é recusada na hora e o teste falha, com a URL, até a API ser simulada.
{
  const realRequests: string[] = [];
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    realRequests.push(`${String(args[0])} ${String(args[1])}`);
    throw new Error(`Requisição HTTP real em teste: ${String(args[0])} ${String(args[1])}. Simule a API.`);
  } as typeof XMLHttpRequest.prototype.open;
  afterEach(() => {
    const found = realRequests.splice(0);
    if (found.length) throw new Error(`Requisição HTTP real em teste (simule a API): ${[...new Set(found)].join('; ')}`);
  });
}
