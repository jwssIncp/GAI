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
  return formatCurrency(value ?? 0, "BRL");
}

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;
const groupThousands = (digits: string) =>
  digits.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Número pt-BR exato a partir da string decimal da API (sem passar por float:
 * valores de 13 dígitos não perdem centavos). Sem `digits`, mantém as casas que
 * o dado tem ("1.0000" → "1,0000"); com `digits`, completa com zeros ou
 * arredonda meio para cima. Nulo/vazio → "—"; texto não numérico volta como está.
 */
export function formatDecimal(value?: string | number | null, digits?: number): string {
  if (value === null || value === undefined || value === "") return "—";
  const m = DECIMAL.exec(typeof value === "number" ? String(value) : value.trim());
  if (!m) {
    const n = Number(value);
    return Number.isFinite(n)
      ? n.toLocaleString("pt-BR", digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits })
      : String(value);
  }
  let whole = m[2],
    fraction = m[3] ?? "";
  if (digits !== undefined && fraction.length > digits) {
    const drop = 10n ** BigInt(fraction.length - digits),
      scaled = BigInt(whole + fraction);
    const kept = (scaled / drop + ((scaled % drop) * 2n >= drop ? 1n : 0n)).toString().padStart(digits + 1, "0");
    whole = kept.slice(0, kept.length - digits);
    fraction = kept.slice(kept.length - digits);
  } else if (digits !== undefined) fraction = fraction.padEnd(digits, "0");
  const negative = m[1] === "-" && !/^0*$/.test(whole + fraction);
  return `${negative ? "-" : ""}${groupThousands(whole)}${fraction ? `,${fraction}` : ""}`;
}

/** Inteiro com milhar: 1000 → "1.000". */
export const formatInteger = (value?: string | number | null) => formatDecimal(value, 0);

/** Símbolo pt-BR da moeda (BRL → "R$", USD → "US$", EUR → "€"); código se o Intl não conhecer. */
export function currencySymbol(currency: string): string {
  try {
    return (
      new Intl.NumberFormat("pt-BR", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")
        ?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/**
 * Moeda pt-BR exata, igual ao Intl ("R$ 1.913,72", "US$ 1.913,72", "-R$ 10,00",
 * com espaço não separável), mas sem converter a string da API para float.
 */
export function formatCurrency(value: string | number, currency: string): string {
  const n = formatDecimal(value, 2);
  if (!/^-?[\d.]+,\d{2}$/.test(n)) return n;
  const negative = n.startsWith("-");
  return `${negative ? "-" : ""}${currencySymbol(currency)}\u00a0${negative ? n.slice(1) : n}`;
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

/** Percentual pt-BR com 2 casas (ou as pedidas): "12.5" → "12,50%"; nulo/indefinido → "—". */
export function formatPercent(value?: string | number | null, digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  if (!Number.isFinite(Number(value))) return "—";
  return `${formatDecimal(value, digits)}%`;
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
