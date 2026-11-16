import { describe, expect, it } from "vitest";
import {
  EXPORT_STATUS,
  formatCivilDate,
  formatCurrency,
  formatDate,
  formatDecimal,
  formatInteger,
  formatMonth,
  formatMoney,
  formatPercent,
  negativeClass,
  parseCivilDate,
} from "./format";

describe("formatos únicos (moeda, data, mês, percentual)", () => {
  it("data civil sem fuso: nunca mostra o dia anterior", () => {
    expect(formatCivilDate("2026-03-10")).toBe("10/03/2026");
    expect(formatDate("2026-03-10")).toBe("10/03/2026");
    expect(formatCivilDate(null)).toBe("");
  });
  it("competência em MM/AAAA em todas as telas", () => {
    expect(formatMonth("2026-11")).toBe("11/2026");
    expect(formatMonth("2026-11-05")).toBe("11/2026");
  });
  it("percentual sempre com 2 casas; nulo vira travessão", () => {
    expect(formatPercent("12.5")).toBe("12,50%");
    expect(formatPercent("12.5000")).toBe("12,50%");
    expect(formatPercent(-3)).toBe("-3,00%");
    expect(formatPercent(null)).toBe("—");
  });
  it("negativo: hífen antes do R$ e a mesma classe vermelha", () => {
    expect(formatMoney(-10)).toMatch(/^-R\$\s?10,00$/);
    expect(negativeClass("-0.01")).toBe("text-destructive");
    expect(negativeClass("0.00")).toBeUndefined();
  });
  it("percentual com as casas pedidas (percentual efetivo do pagamento)", () => {
    expect(formatPercent("33.3333", 4)).toBe("33,3333%");
    expect(formatPercent("10.00")).toBe("10,00%");
    expect(formatPercent(96.67)).toBe("96,67%");
  });
  it("moeda exata (sem float) com símbolo pt-BR, igual ao Intl", () => {
    expect(formatCurrency("1913.72", "BRL")).toBe("R$\u00a01.913,72");
    expect(formatCurrency("9999999999999.99", "BRL")).toBe("R$\u00a09.999.999.999.999,99");
    expect(formatCurrency("1913.72", "USD")).toBe("US$\u00a01.913,72");
    expect(formatCurrency("1913.72", "EUR")).toBe("€\u00a01.913,72");
    expect(formatCurrency("-10", "BRL")).toBe(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(-10));
    expect(formatMoney("1234.5")).toBe("R$\u00a01.234,50");
    expect(formatMoney(null)).toBe("R$\u00a00,00");
  });
  it("decimal com as casas do dado, arredondamento na string e inteiro com milhar", () => {
    expect(formatDecimal("1.0000")).toBe("1,0000");
    expect(formatDecimal("1234.5", 2)).toBe("1.234,50");
    expect(formatDecimal("0.995", 2)).toBe("1,00");
    expect(formatDecimal("-0.001", 2)).toBe("0,00");
    expect(formatDecimal(null)).toBe("—");
    expect(formatInteger(1000)).toBe("1.000");
    expect(formatInteger("1234567")).toBe("1.234.567");
    expect(formatInteger(12)).toBe("12");
  });
  it("entrada dd/mm/aaaa vira AAAA-MM-DD; ISO passa como está", () => {
    expect(parseCivilDate("31/01/2026")).toBe("2026-01-31");
    expect(parseCivilDate(" 2026-01-31 ")).toBe("2026-01-31");
  });
  it("situação da exportação em português", () => {
    expect(EXPORT_STATUS.processing).toBe("Gerando");
    expect(EXPORT_STATUS.finished).toBe("Pronto");
  });
});
