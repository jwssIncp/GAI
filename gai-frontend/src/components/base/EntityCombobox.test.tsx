import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { EntityCombobox, type EntityOption, type EntitySource } from "./EntityCombobox";
import { clientFilter, named, pageOf } from "./entitySources";

const all: EntityOption[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  label: named(`Projeto ${String(i + 1).padStart(2, "0")}`, `P-${i + 1}`),
}));

function fakeSource(over: Partial<EntitySource<{ company_id?: number | null }>> = {}) {
  const search = vi.fn(async ({ search, page }: { search: string; page: number }) => clientFilter(all, search, page));
  const one = vi.fn(async (id: number) => all.find((o) => o.id === id) ?? null);
  return { source: { key: "fake-" + Math.random(), search, one, ...over } as EntitySource<{ company_id?: number | null }>, search, one };
}

function mount(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
}

describe("EntityCombobox (seleção com busca pelo nome)", () => {
  it("busca no servidor ao digitar, mostra nome (código) e devolve o ID ao escolher", async () => {
    const { source, search } = fakeSource();
    const onChange = vi.fn();
    mount(<EntityCombobox aria-label="Projeto" source={source} onChange={onChange} />);
    const box = screen.getByRole("combobox", { name: "Projeto" });
    await userEvent.type(box, "07");
    await waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({ search: "07", page: 1 })));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    await userEvent.click(screen.getByRole("option", { name: "Projeto 07 (P-7)" }));
    expect(onChange).toHaveBeenCalledWith(7, expect.objectContaining({ label: "Projeto 07 (P-7)" }));
    expect(box).toHaveValue("Projeto 07 (P-7)");
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("nomes longos e parecidos: nome inteiro em até 2 linhas, código à parte e destaque no texto", async () => {
    const long: EntityOption[] = [
      { id: 1, label: "SINTETICO Projeto laudos de avaliação patrimonial da filial norte 1793212674812 (PRJ-A1)", name: "SINTETICO Projeto laudos de avaliação patrimonial da filial norte 1793212674812", code: "PRJ-A1", description: "Cliente Norte" },
      { id: 2, label: "SINTETICO Projeto laudos de avaliação patrimonial da filial norte 1793212674999 (PRJ-A2)", name: "SINTETICO Projeto laudos de avaliação patrimonial da filial norte 1793212674999", code: "PRJ-A2", description: "Cliente Norte" },
    ];
    const source: EntitySource = { key: "long", search: async () => ({ items: long, hasMore: false }) };
    mount(<EntityCombobox aria-label="Projeto" source={source} value={2} />);
    const box = screen.getByRole("combobox", { name: "Projeto" });
    box.focus();
    const [a, b] = await screen.findAllByRole("option");
    // nome inteiro (sem reticências), em até 2 linhas, e o código visível
    for (const [opt, o] of [[a, long[0]], [b, long[1]]] as const) {
      const name = within(opt).getByText(o.name!);
      expect(name).toHaveClass("line-clamp-2");
      expect(name).not.toHaveClass("truncate");
      expect(within(opt).getByText(o.code!)).toBeInTheDocument();
    }
    // destaque (▸) e escolhido (✓) também pelo texto
    expect(a.textContent).toMatch(/^▸/);
    expect(b.textContent).toMatch(/^✓/);
  });

  it("teclado: setas, Home/End, Enter escolhe e Esc fecha", async () => {
    const { source } = fakeSource();
    const onChange = vi.fn();
    mount(<EntityCombobox aria-label="Projeto" source={source} onChange={onChange} />);
    const box = screen.getByRole("combobox", { name: "Projeto" });
    box.focus();
    await screen.findByRole("option", { name: "Projeto 01 (P-1)" });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(box.getAttribute("aria-activedescendant")).toMatch(/-3$/);
    await userEvent.keyboard("{Home}");
    expect(box.getAttribute("aria-activedescendant")).toMatch(/-1$/);
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(1, expect.anything());
    box.focus();
    await userEvent.keyboard("{Escape}");
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("valor inicial (ex.: vindo da URL) mostra o rótulo, nunca o ID", async () => {
    const { source, one } = fakeSource();
    mount(<EntityCombobox aria-label="Projeto" source={source} value={12} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Projeto" })).toHaveValue("Projeto 12 (P-12)"));
    expect(one).toHaveBeenCalledWith(12, {});
  });

  it("formulário com FormData: campo oculto com o ID e Limpar", async () => {
    const { source } = fakeSource();
    function Form() {
      const [seen, setSeen] = useState("");
      return (
        <form onSubmit={(e) => { e.preventDefault(); setSeen(String(new FormData(e.currentTarget).get("project_id"))); }}>
          <EntityCombobox aria-label="Projeto" name="project_id" source={source} defaultValue={3} />
          <button type="submit">Enviar</button>
          <output>{seen}</output>
        </form>
      );
    }
    mount(<Form />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Projeto" })).toHaveValue("Projeto 03 (P-3)"));
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByRole("status")).toHaveTextContent("3");
    await userEvent.click(screen.getByRole("button", { name: "Limpar Projeto" }));
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("obrigatório sem escolha: o formulário não é enviado (validação nativa)", async () => {
    const { source } = fakeSource();
    const sent = vi.fn();
    mount(
      <form onSubmit={(e) => { e.preventDefault(); sent(); }}>
        <EntityCombobox aria-label="Projeto" name="project_id" source={source} required />
        <button type="submit">Enviar</button>
      </form>,
    );
    const box = screen.getByRole("combobox", { name: "Projeto" });
    expect((box as HTMLInputElement).validationMessage).toBe("Escolha um item da lista.");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(sent).not.toHaveBeenCalled();
    box.focus();
    await userEvent.click(await screen.findByRole("option", { name: "Projeto 02 (P-2)" }));
    expect((box as HTMLInputElement).validationMessage).toBe("");
  });

  it("filtro de contexto: sem ele fica desabilitado e explica; com ele, busca com o contexto", async () => {
    const { source, search } = fakeSource();
    const { rerender } = mount(
      <EntityCombobox aria-label="Contrato" source={source} context={{ company_id: null }} requiresContext="Escolha o cliente primeiro" />,
    );
    const box = screen.getByRole("combobox", { name: "Contrato" });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute("placeholder", "Escolha o cliente primeiro");
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <EntityCombobox aria-label="Contrato" source={source} context={{ company_id: 9 }} requiresContext="Escolha o cliente primeiro" />
      </QueryClientProvider>,
    );
    screen.getByRole("combobox", { name: "Contrato" }).focus();
    await waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({ context: { company_id: 9 } })));
  });

  it("sem resultado avisa; com mais páginas, Carregar mais traz a próxima", async () => {
    const { source } = fakeSource();
    mount(<EntityCombobox aria-label="Projeto" source={source} />);
    const box = screen.getByRole("combobox", { name: "Projeto" });
    box.focus();
    const list = await screen.findByRole("listbox", { name: "Projeto" });
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(20));
    await userEvent.click(within(list).getByRole("button", { name: "Carregar mais" }));
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(25));
    await userEvent.type(box, "não existe");
    expect(await within(list).findByText("Nenhum resultado.")).toBeInTheDocument();
  });

  it("paginação da API em items/total_pages, data/meta, total/page_size ou lista simples", () => {
    const map = (x: { id: number }) => ({ id: x.id, label: String(x.id) });
    expect(pageOf({ items: [{ id: 1 }], total_pages: 2 }, 1, map).hasMore).toBe(true);
    expect(pageOf({ data: [{ id: 1 }], meta: { total_pages: 1 } }, 1, map).hasMore).toBe(false);
    expect(pageOf({ items: [{ id: 1 }], total: 45, page_size: 20 }, 2, map).hasMore).toBe(true);
    expect(pageOf([{ id: 1 }], 1, map)).toEqual({ items: [{ id: 1, label: "1" }], hasMore: false });
  });
});
