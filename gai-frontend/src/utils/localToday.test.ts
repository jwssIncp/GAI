import { describe, expect, it } from "vitest";
import { localMonth, localToday } from "./format";

describe("hoje no fuso do usuário", () => {
  it("às 22h30 do dia 15 (hora local) continua sendo o dia 15, nunca o dia seguinte em UTC", () => {
    const night = new Date(2026, 10, 15, 22, 30);
    expect(localToday(night)).toBe("2026-11-15");
    expect(localMonth(new Date(2026, 10, 30, 23, 59))).toBe("2026-11");
  });
  it("preenche com zero à esquerda", () => {
    expect(localToday(new Date(2027, 0, 5, 1, 0))).toBe("2027-01-05");
  });
});
