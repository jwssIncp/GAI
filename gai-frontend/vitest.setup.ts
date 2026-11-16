import '@testing-library/jest-dom/vitest';
import { cloneElement, createElement, isValidElement, type ReactNode } from 'react';
import { afterEach, vi } from 'vitest';

// O jsdom não calcula layout: o ResponsiveContainer do Recharts mede 0×0 e
// avisa no console ("width(0) and height(0)"). Nos testes, o contêiner tem um
// tamanho fixo e repassa esse tamanho ao gráfico, que desenha normalmente.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  const width = 800;
  const height = 400;
  function ResponsiveContainer({ children }: { children?: ReactNode }) {
    const child = isValidElement<{ width?: number; height?: number }>(children) ? cloneElement(children, { width, height }) : children;
    return createElement('div', { className: 'recharts-responsive-container', style: { width, height } }, child);
  }
  return { ...actual, ResponsiveContainer };
});

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
  // Sem depender dos tipos do DOM: este arquivo também passa pela checagem do build.
  const xhr = (globalThis as { XMLHttpRequest?: { prototype: { open: (...args: unknown[]) => void } } }).XMLHttpRequest;
  if (xhr)
    xhr.prototype.open = (...args: unknown[]) => {
      realRequests.push(`${String(args[0])} ${String(args[1])}`);
      throw new Error(`Requisição HTTP real em teste: ${String(args[0])} ${String(args[1])}. Simule a API.`);
    };
  afterEach(() => {
    const found = realRequests.splice(0);
    if (found.length) throw new Error(`Requisição HTTP real em teste (simule a API): ${[...new Set(found)].join('; ')}`);
  });
}
