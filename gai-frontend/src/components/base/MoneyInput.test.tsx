import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MoneyInput } from "./MoneyInput";
import { formatMoneyInput, parseMoneyInput } from "./moneyInputFormat";

describe("MoneyInput (valor em R$, padrão pt-BR)", () => {
  it("lê o que se cola em pt-BR ou no formato da API e devolve o número da API", () => {
    expect(parseMoneyInput("50.000,00")).toBe("50000.00");
    expect(parseMoneyInput("50000,00")).toBe("50000.00");
    expect(parseMoneyInput("50000.00")).toBe("50000.00");
    expect(parseMoneyInput("R$ 1.234,5")).toBe("1234.50");
    expect(parseMoneyInput("1.234")).toBe("1234.00");
    expect(parseMoneyInput("0,07")).toBe("0.07");
    expect(parseMoneyInput("12,345")).toBeNull();
    expect(parseMoneyInput("1.23.4")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("-10,50")).toBeNull();
    expect(parseMoneyInput("-10,50", true)).toBe("-10.50");
    expect(formatMoneyInput("50000.00")).toBe("50.000,00");
  });

  for (const pasted of ["50.000,00", "50000,00", "50000.00"]) {
    it(`colar "${pasted}" envia 50000.00 e mostra 50.000,00`, async () => {
      const onValue = vi.fn();
      render(
        <form>
          <label>
            Valor total (R$)
            <MoneyInput name="amount" onValueChange={onValue} />
          </label>
        </form>,
      );
      const field = screen.getByRole("textbox", { name: "Valor total (R$)" });
      field.focus();
      await userEvent.paste(pasted);
      expect(onValue).toHaveBeenLastCalledWith("50000.00");
      fireEvent.blur(field);
      expect(field).toHaveValue("50.000,00");
      const form = field.closest("form")!;
      expect(new FormData(form).get("amount")).toBe("50000.00");
    });
  }

  it("valor inicial da API aparece em pt-BR; inválido é barrado pelo formulário", async () => {
    function Box() {
      const [v, setV] = useState<string>("1234.5");
      return (
        <>
          <label>
            Diária (R$)
            <MoneyInput value={v} onValueChange={setV} />
          </label>
          <output>{v}</output>
        </>
      );
    }
    render(<Box />);
    const field = screen.getByRole("textbox", { name: "Diária (R$)" }) as HTMLInputElement;
    expect(field).toHaveValue("1.234,50");
    await userEvent.clear(field);
    await userEvent.type(field, "12,345");
    expect(field.validationMessage).toBe("Valor inválido. Use o formato 50.000,00.");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
