import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Kpi } from "./Cards";
import { DataTable } from "./DataTable";

describe("DataTable", () => {
  afterEach(() => vi.restoreAllMocks());

  it("coluna numeric: valor à direita, tabular e sem quebra (R$ nunca vai para outra linha)", () => {
    render(
      <DataTable
        caption="Parcelas"
        items={[{ id: 1, total: "R$ 100,01" }]}
        getKey={(r) => r.id}
        columns={[
          { header: "Descrição", cell: () => "Parcela 1" },
          { header: "Valor", numeric: true, cell: (r) => r.total },
        ]}
      />,
    );
    expect(screen.getByText("R$ 100,01")).toHaveClass("numeric", "text-right");
    expect(screen.getByRole("columnheader", { name: "Valor" })).toHaveClass("text-right");
    expect(screen.getByText("Parcela 1")).not.toHaveClass("numeric");
  });

  it("chaves repetidas não geram aviso de chave duplicada nem somem linhas", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <DataTable
        items={[{ label: "Empresa X", n: 1 }, { label: "Empresa X", n: 2 }]}
        getKey={(g) => g.label}
        columns={[
          { header: "Empresa", cell: (g) => g.label },
          { header: "Contratos", cell: (g) => g.n },
        ]}
      />,
    );
    expect(screen.getAllByText("Empresa X")).toHaveLength(2);
    expect(error.mock.calls.flat().join(" ")).not.toMatch(/same key/);
  });
});

describe("Kpi compartilhado", () => {
  it("valor negativo usa o token de texto negativo AA; nota de aviso usa o texto âmbar AA", () => {
    render(<Kpi label="Saldo" value="-R$ 10,00" negative note="Sem conta na DRE" />);
    expect(screen.getByText("-R$ 10,00")).toHaveClass("numeric", "text-destructive-text");
    expect(screen.getByText("Sem conta na DRE")).toHaveClass("text-warning-text");
  });

  it("com onClick vira filtro (aria-pressed)", () => {
    render(<Kpi label="Em atraso" value="R$ 5,00" tone="danger" active onClick={() => undefined} />);
    expect(screen.getByRole("button", { name: /Em atraso/ })).toHaveAttribute("aria-pressed", "true");
  });
});
