import { describe, expect, it } from "vitest";
import { money } from "./financeApi";
describe("Exact financial presentation", () => {
  it("preserves aggregate cents beyond Number precision", () => {
    expect(money("9999999999999999.99", "BRL")).toBe(
      "R$ 9.999.999.999.999.999,99",
    );
  });
  it("preserves reversal sign and cents", () => {
    expect(money("-0.01", "BRL")).toBe("R$ -0,01");
  });
  it("never invents currency for legacy outflows", () => {
    expect(money("100.10", "UNSPECIFIED")).toBe("100,10 (moeda não informada)");
  });
});
