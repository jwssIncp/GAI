import { describe, expect, it } from "vitest";
import { EXPORT_STATUS, formatCivilDate, formatDate, formatMonth, formatMoney, formatPercent, negativeClass, parseCivilDate } from "./format";

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
  it("entrada dd/mm/aaaa vira AAAA-MM-DD; ISO passa como está", () => {
    expect(parseCivilDate("31/01/2026")).toBe("2026-01-31");
    expect(parseCivilDate(" 2026-01-31 ")).toBe("2026-01-31");
  });
  it("situação da exportação em português", () => {
    expect(EXPORT_STATUS.processing).toBe("Gerando");
    expect(EXPORT_STATUS.finished).toBe("Pronto");
  });
});
