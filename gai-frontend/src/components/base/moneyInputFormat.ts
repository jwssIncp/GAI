/**
 * Lê um valor digitado ou colado em pt-BR ou no formato da API e devolve o
 * número para a API ("50000.00"), ou null se não for um valor.
 * Aceita "50.000,00", "50000,00", "50000.00", "R$ 1.234,56", "1.234" (milhar)
 * e "-10,5" (quando `negative`).
 */
export function parseMoneyInput(text: string, negative = false): string | null {
  let t = text.replace(/R\$|\s/g, "");
  if (!t) return null;
  let sign = "";
  if (t.startsWith("-")) {
    if (!negative) return null;
    sign = "-";
    t = t.slice(1);
  }
  if (t.includes(",")) {
    // vírgula = decimal; pontos = milhar
    if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/.test(t)) return null;
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    // só pontos agrupando de 3 em 3: milhar ("1.234", "50.000")
    t = t.replace(/\./g, "");
  } else if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return `${sign}${String(Number(whole))}.${frac.padEnd(2, "0").slice(0, 2)}`;
}

/** "50000.00" → "50.000,00" (sem "R$": o rótulo do campo já diz "(R$)"). */
export function formatMoneyInput(api: string | number | null | undefined): string {
  if (api === null || api === undefined || api === "") return "";
  const n = Number(api);
  if (!Number.isFinite(n)) return String(api);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
