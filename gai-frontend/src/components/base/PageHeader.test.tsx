import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { navigationSectionFor } from "@/constants/navigation";
import { PageHeader } from "./PageHeader";

function renderAt(path: string, eyebrow?: string | null) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <PageHeader title="Título" eyebrow={eyebrow} />
    </MemoryRouter>,
  );
}

describe("PageHeader: rótulo acima do título pelo módulo do menu", () => {
  it.each([
    ["/app/dashboard", "Visão geral"],
    ["/app/projects", "Projetos"],
    ["/app/projects/10/inventory/sessions/3", "Projetos"],
    ["/app/projects/10/technical-reports/templates", "Projetos"],
    ["/app/field-agents", "Financeiro"],
    ["/app/budgets/4", "Comercial"],
    ["/app/companies/2/edit", "Comercial"],
    ["/app/finance/receivables/12", "Financeiro"],
    ["/app/finance/dre/entries/5", "Financeiro"],
    ["/app/finance", "Financeiro"],
    ["/app/finance/parameters", "Administração"],
    ["/app/users/3", "Administração"],
  ])("%s → %s", (path, label) => {
    renderAt(path);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("Gestão patrimonial")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Título" })).toBeInTheDocument();
  });

  it("tela fora do menu (Perfil) não mostra rótulo", () => {
    expect(navigationSectionFor("/app/profile")).toBeNull();
    renderAt("/app/profile");
    expect(document.querySelector(".eyebrow")).toBeNull();
  });

  it("aceita substituir ou ocultar o rótulo por prop", () => {
    renderAt("/app/finance/receivables", "Relatório");
    expect(screen.getByText("Relatório")).toBeInTheDocument();
    expect(screen.queryByText("Financeiro")).not.toBeInTheDocument();
  });

  it("eyebrow={null} oculta o rótulo", () => {
    renderAt("/app/finance/receivables", null);
    expect(document.querySelector(".eyebrow")).toBeNull();
  });

  it("funciona fora de um Router (sem rótulo)", () => {
    render(<PageHeader title="Isolado" />);
    expect(screen.getByRole("heading", { level: 1, name: "Isolado" })).toBeInTheDocument();
    expect(document.querySelector(".eyebrow")).toBeNull();
  });
});
