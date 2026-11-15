export function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function formatMoney(value?: string | number | null) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
}

/**
 * Data civil de hoje (AAAA-MM-DD) no fuso do usuário. Nunca use
 * `toISOString()` para "hoje": é UTC e, depois das 21h em Brasília, já é amanhã.
 */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Mês civil corrente (AAAA-MM) no fuso do usuário. */
export const localMonth = (now = new Date()) => localToday(now).slice(0, 7);
