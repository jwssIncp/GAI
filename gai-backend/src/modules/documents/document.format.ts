/**
 * Formatos pt-BR dos documentos (PDF e DOCX): um lugar só para moeda,
 * percentual, decimal e inteiro. Trabalha sobre a string decimal exata (como o
 * backend guarda os valores), sem passar por float: preços de 13 dígitos não
 * perdem centavos. Separador entre símbolo e número: espaço comum, para o texto
 * do documento ser pesquisável e copiável ("R$ 1.913,72").
 */
const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

const group = (digits: string) =>
  digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Decimal exato a partir de string ou número; null quando não é decimal simples. */
function parse(value: string | number) {
  const text = typeof value === 'number' ? String(value) : value.trim();
  const m = DECIMAL.exec(text);
  return m
    ? { negative: m[1] === '-', whole: m[2], fraction: m[3] ?? '' }
    : null;
}

/**
 * Número pt-BR com milhar e vírgula. Sem `digits`, mantém as casas que o dado
 * tem ("1.0000" → "1,0000"); com `digits`, completa com zeros ou arredonda
 * (meio para cima) na string, sem float.
 */
export function documentDecimal(value: string | number, digits?: number) {
  const p = parse(value);
  if (!p) return String(value);
  let { whole, fraction } = p;
  if (digits !== undefined && fraction.length > digits) {
    const drop = 10n ** BigInt(fraction.length - digits);
    const scaled = BigInt(whole + fraction);
    let kept = scaled / drop;
    if ((scaled % drop) * 2n >= drop) kept += 1n;
    const s = kept.toString().padStart(digits + 1, '0');
    whole = s.slice(0, s.length - digits);
    fraction = s.slice(s.length - digits);
  } else if (digits !== undefined) fraction = fraction.padEnd(digits, '0');
  const zero = /^0*$/.test(whole + fraction);
  return `${p.negative && !zero ? '-' : ''}${group(whole)}${fraction ? `,${fraction}` : ''}`;
}

/** Inteiro com milhar: 1000 → "1.000". */
export const documentInteger = (value: string | number) =>
  documentDecimal(value, 0);

/** Percentual com 2 casas (ou as pedidas): "10.00" → "10,00%". */
export const documentPercent = (value: string | number, digits = 2) =>
  `${documentDecimal(value, digits)}%`;

/** Símbolo pt-BR da moeda pelo Intl (BRL → "R$", USD → "US$", EUR → "€"). */
export function currencySymbol(currency: string) {
  try {
    return (
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/** Moeda exata: ("1913.72", "BRL") → "R$ 1.913,72"; negativo → "-R$ 10,00". */
export function documentMoney(value: string | number, currency: string) {
  const n = documentDecimal(value, 2);
  const negative = n.startsWith('-');
  return `${negative ? '-' : ''}${currencySymbol(currency)} ${negative ? n.slice(1) : n}`;
}

/** Data civil (AAAA-MM-DD ou instante) como dd/mm/aaaa, sem fuso. */
export const documentDate = (value: string | Date) => {
  const s = value instanceof Date ? value.toISOString() : value;
  return s.slice(0, 10).split('-').reverse().join('/');
};

/** Valor numérico de um indicador: número com o formato pt-BR; texto como está. */
export const documentNumber = (value: string | number) =>
  typeof value === 'number' ? documentDecimal(value) : value;
