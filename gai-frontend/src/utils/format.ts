export function formatDate(value?: string | null) {
  if (!value) return '-';
  // data civil: sem fuso (new Date("AAAA-MM-DD") é UTC e mostraria o dia anterior)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatCivilDate(value);
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

const CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Data civil (AAAA-MM-DD) como dd/mm/aaaa, sem passar por `Date` (que lê a
 * data como UTC e, em Brasília, mostraria o dia anterior). Vazio → "".
 */
export function formatCivilDate(value?: string | null): string {
  if (!value) return "";
  const m = CIVIL.exec(value.slice(0, 10));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/** Competência (AAAA-MM) como MM/AAAA — o mesmo formato em todas as telas. */
export function formatMonth(value?: string | null): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})/.exec(value);
  return m ? `${m[2]}/${m[1]}` : value;
}

/** Percentual pt-BR com 2 casas ("12.5" → "12,50%"); nulo/indefinido → "—". */
export function formatPercent(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Aceita dd/mm/aaaa (ou AAAA-MM-DD) e devolve AAAA-MM-DD; inválida → o texto original. */
export function parseCivilDate(value: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : value.trim();
}

/** Situação de uma exportação, como a tela mostra. */
export const EXPORT_STATUS: Record<string, string> = {
  pending: "Na fila",
  processing: "Gerando",
  finished: "Pronto",
  failed: "Falhou",
  cancelled: "Cancelado",
  expired: "Expirado",
};

/** Classe do valor negativo: a mesma regra em todas as telas (vermelho). */
export const negativeClass = (value?: string | number | null) =>
  value !== null && value !== undefined && Number(value) < 0 ? "text-destructive" : undefined;
