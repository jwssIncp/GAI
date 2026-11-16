import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./dialog";

const base = { open: true, title: "Estornar recebimento?", description: "O valor volta a ficar em aberto." };

describe("ConfirmDialog", () => {
  it("padrão: ação perigosa com Confirmar e Voltar", async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm.className).toContain("bg-destructive");
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("variant primary e rótulos da ação", () => {
    render(
      <ConfirmDialog {...base} variant="primary" confirmLabel="Registrar pagamento" cancelLabel="Agora não" onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    const confirm = screen.getByRole("button", { name: "Registrar pagamento" });
    expect(confirm.className).toContain("bg-primary");
    expect(confirm.className).not.toContain("bg-destructive");
    expect(screen.getByRole("button", { name: "Agora não" })).toBeInTheDocument();
  });

  it("mostra a falha da ação sem fechar e trava os botões enquanto executa", () => {
    render(<ConfirmDialog {...base} busy error="Não foi possível estornar." onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível estornar.");
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
