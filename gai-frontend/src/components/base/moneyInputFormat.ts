/**
 * Lê um valor digitado ou colado em pt-BR ou no formato da API e devolve o
 * número para a API ("50000.00"), ou null se não for um valor.
 * Aceita "50.000,00", "50000,00", "50000.00", "R$ 1.234,56", "1.234" (milhar)
 * e "-10,5" (quando `negative`). `decimals` = casas aceitas e enviadas
 * (padrão 2; placas de patrimônio usam 4).
 */
export function parseMoneyInput(text: string, negative = false, decimals = 2): string | null {
  // \s cobre também o espaço não separável que o Intl usa em "R$ 1.234,56"
  let t = text.replace(/R\$|\s/g, "");
  if (!t) return null;
  let sign = "";
  if (t.startsWith("-")) {
    if (!negative) return null;
    sign = "-";
    t = t.slice(1);
  }
  const d = `{0,${decimals}}`;
  if (t.includes(",")) {
    // vírgula = decimal; pontos = milhar
    if (!new RegExp(`^\\d{1,3}(\\.\\d{3})*(,\\d${d})?$|^\\d+(,\\d${d})?$`).test(t)) return null;
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    // só pontos agrupando de 3 em 3: milhar ("1.234", "50.000")
    t = t.replace(/\./g, "");
  } else if (!new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return `${sign}${String(Number(whole))}.${frac.padEnd(decimals, "0").slice(0, decimals)}`;
}

/** "50000.00" → "50.000,00" (sem "R$": o rótulo do campo já diz "(R$)"). */
export function formatMoneyInput(api: string | number | null | undefined, decimals = 2): string {
  if (api === null || api === undefined || api === "") return "";
  const n = Number(api);
  if (!Number.isFinite(n)) return String(api);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: decimals });
}
