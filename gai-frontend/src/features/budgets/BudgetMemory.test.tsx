import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetMemory, PaymentMemory } from "./BudgetMemory";
import { snapshot } from "./budgetTestFixture";

const s = structuredClone(snapshot);
s.calculation.inputs.assets = 1000;
s.calculation.lines[0] = { ...s.calculation.lines[0], quantity: 1000, unit_value: "1913.72", subtotal: "1913720.00" };
s.calculation.rates = { tax_pct: "10.00", commission_pct: "5.00", margin_pct: "15.00" };
s.pricing.values = { ...s.pricing.values, tax_pct: "10.00", daily_rate: "1234.56" };

describe("Memória do orçamento: formatos pt-BR", () => {
  it("moeda, percentual, fator e inteiros com milhar; nada de 10.00% ou 1.0000", () => {
    const { container } = render(<BudgetMemory snapshot={s} />);
    const text = (container.textContent ?? "").replace(/\u00a0/g, " ");
    for (const value of ["R$ 1.913,72", "R$ 1.913.720,00", "R$ 1.234,56", "10,00%", "5,00%", "15,00%", "1,0000", "1.000 bens"])
      expect(text).toContain(value);
    expect(text).not.toMatch(/\d\.\d{2}%|\b1\.0000\b|BRL /);
  });
  it("percentual efetivo das parcelas com quatro casas", () => {
    const { container } = render(<PaymentMemory payment={s.calculation.payment} currency="BRL" />);
    expect(container.textContent).toContain("100,0000%");
  });
});
