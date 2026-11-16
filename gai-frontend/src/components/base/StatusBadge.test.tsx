import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { financeStatuses, type FinanceStatus } from "./financeStatus";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge com o mapa único de status financeiros", () => {
  it.each([
    ["forecast", "Previsto", "bg-muted"],
    ["payable", "A pagar", "bg-muted"],
    ["unconfirmed", "Não confirmado", "text-warning-text"],
    ["overdue", "Em atraso", "text-destructive-text"],
    ["received", "Recebido", "text-success"],
    ["paid", "Pago", "text-success"],
    ["reversed", "Estornado", "line-through"],
    ["cancelled", "Cancelado", "text-destructive-text"],
    ["pending", "Pendente", "text-warning-text"],
    ["approved", "Aprovado", "text-info"],
    ["posted", "Lançado", "bg-muted"],
    ["estimated", "Estimado", "italic"],
    ["closed", "Fechada", "text-muted-foreground"],
  ] as Array<[FinanceStatus, string, string]>)("%s → %s", (status, label, tone) => {
    render(<StatusBadge finance={status} />);
    const badge = screen.getByText(label);
    expect(badge.className).toContain(tone);
    expect(badge.className).toContain("whitespace-nowrap");
    expect(badge).toHaveAttribute("title", financeStatuses[status].hint);
  });

  it("Fechada leva cadeado; Em atraso usa o token de texto negativo AA (não o --destructive puro)", () => {
    const { container } = render(
      <>
        <StatusBadge finance="closed" />
        <StatusBadge finance="overdue" />
      </>,
    );
    expect(container.querySelector('[data-status="closed"] svg')).not.toBeNull();
    expect(screen.getByText("Em atraso").className).not.toMatch(/(^|\s)text-destructive(\s|$)/);
  });

  it("rótulo do domínio substitui só o texto (Despesas: Paga), mantendo o tom", () => {
    render(<StatusBadge finance="paid" label="Paga" />);
    expect(screen.getByText("Paga").className).toContain("text-success");
  });

  it("continua aceitando o status cru da API", () => {
    render(<StatusBadge value="cancelled" />);
    expect(screen.getByText("Cancelado").className).toContain("text-destructive-text");
  });
});
