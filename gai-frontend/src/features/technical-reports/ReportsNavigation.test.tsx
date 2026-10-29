import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsLayout } from "./ReportsLayout";
import { ReportsPage } from "./ReportsPage";
import {
  ReportTemplatesPage,
  ReportResponsiblesPage,
} from "./ReportTemplatesPage";
import { ReportDetailPage } from "./ReportDetailPage";
import { ReportPreview } from "./ReportPreview";
import { TemplateForm } from "./ReportForms";
import {
  reportApi,
  emptyTemplate,
  type Content,
  type Report,
} from "./reportApi";
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: 2, organization_id: 1 } }),
}));
const grants = new Set([
  "technical-reports:read",
  "technical-reports:edit",
  "technical-reports:templates",
  "technical-reports:approve",
]);
vi.mock("@/features/auth/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: (k: string) => grants.has(k) }),
}));
vi.mock("./reportApi", async (original) => ({
  ...(await original<typeof import("./reportApi")>()),
  reportApi: {
    list: vi.fn(),
    templates: vi.fn(),
    responsibles: vi.fn(),
    detail: vi.fn(),
    validate: vi.fn(),
    save: vi.fn(),
  },
}));
function content(): Content {
  return {
    title: "SINTETICO Laudo",
    template: {
      id: 1,
      version_id: 2,
      hash: "template-hash",
      data: emptyTemplate(),
    },
    sections: [
      {
        key: "identificacao",
        title: "Identificação",
        text: "Projeto {{projeto}}",
        origin: "template",
      },
      {
        key: "objetivo",
        title: "Objetivo e escopo",
        text: "SINTETICO escopo existente",
        origin: "manual",
      },
    ],
    fields: [
      {
        key: "projeto",
        label: "Projeto",
        value: "Nome manual identificado",
        origin: "manual",
        source_key: "project.name",
        original_value: "Nome oficial do projeto",
      },
    ],
    sources: {
      selection: { families: ["identity"] },
      generated_at: "2026-10-28T12:00:00Z",
      hash: "source-hash",
      permissions: ["projects:read", "companies:read"],
      tables: [
        {
          family: "identity",
          columns: ["Projeto ID"],
          rows: [[25]],
          hash: "table-hash",
          references: [{ id: 25, version: "row-hash" }],
        },
      ],
      fields: { "project.name": "Nome oficial do projeto", "project.id": "25" },
      metrics: {},
      missing: [],
      unresolved: null,
    },
    responsibles: [],
    technical_notes: "",
    conclusion: "",
  };
}
const row = (): Report => ({
  id: 7,
  projectId: 25,
  revision: 2,
  status: "draft",
  approvedVersionId: null,
  data: content(),
  versions: [],
});
function Location() {
  const l = useLocation();
  return <output data-testid="location">{l.pathname + l.search}</output>;
}
function mount(url: string) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[url]}>
        <Location />
        <Routes>
          <Route
            path="/app/projects/:projectId/technical-reports"
            element={<ReportsLayout />}
          >
            <Route index element={<ReportsPage />} />
            <Route path="templates" element={<ReportTemplatesPage />} />
            <Route path="responsibles" element={<ReportResponsiblesPage />} />
            <Route path=":reportId" element={<ReportDetailPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  grants.add("technical-reports:edit");
  grants.add("technical-reports:templates");
  vi.mocked(reportApi.list).mockResolvedValue([
    {
      id: 7,
      projectId: 25,
      revision: 2,
      status: "draft",
      approvedVersionId: null,
      title: "SINTETICO Laudo",
      report_type: "Relatório patrimonial",
    },
  ]);
  vi.mocked(reportApi.templates).mockResolvedValue([]);
  vi.mocked(reportApi.responsibles).mockResolvedValue([]);
  vi.mocked(reportApi.detail).mockResolvedValue(row());
  vi.mocked(reportApi.validate).mockResolvedValue({
    engine: "technical-report-v1",
    valid: true,
    source_hash: "source-hash",
    issues: [],
  });
});
describe("Project technical report navigation and editing", () => {
  it("keeps project identity through list, templates, responsible registry and return", async () => {
    mount("/app/projects/25/technical-reports");
    await screen.findByRole("link", { name: "SINTETICO Laudo" });
    fireEvent.click(
      screen.getByRole("link", { name: "Modelos da organização" }),
    );
    await screen.findByRole("heading", {
      name: "Modelos versionados da organização",
    });
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/25/technical-reports/templates",
    );
    fireEvent.click(
      screen.getByRole("link", { name: "Responsáveis cadastrados" }),
    );
    await screen.findByRole("heading", {
      name: "Responsáveis previamente cadastrados",
    });
    fireEvent.click(screen.getByRole("link", { name: "Laudos do projeto" }));
    await screen.findByRole("link", { name: "SINTETICO Laudo" });
    expect(
      screen.getByRole("navigation", { name: "Navegação dos laudos" }),
    ).toBeVisible();
  });
  it("hides mutation controls from a read-only profile", async () => {
    grants.delete("technical-reports:edit");
    grants.delete("technical-reports:templates");
    mount("/app/projects/25/technical-reports");
    await screen.findByRole("link", { name: "SINTETICO Laudo" });
    expect(
      screen.queryByRole("button", { name: "Criar laudo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Responsáveis cadastrados" }),
    ).not.toBeInTheDocument();
  });
  it("preserves unsaved text when a concurrent revision is rejected", async () => {
    vi.mocked(reportApi.save).mockRejectedValue(
      new Error("Revisão divergente. Atualize."),
    );
    mount("/app/projects/25/technical-reports/7");
    const field = await screen.findByRole("textbox", {
      name: "Seção: Objetivo e escopo",
    });
    fireEvent.change(field, {
      target: { value: "SINTETICO edicao local preservada" },
    });
    fireEvent.change(screen.getByLabelText("Justificativa"), {
      target: { value: "Teste sintetico de concorrencia" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar rascunho do laudo" }),
    );
    await screen.findByText("Revisão divergente. Atualize.");
    expect(field).toHaveValue("SINTETICO edicao local preservada");
    expect(reportApi.save).toHaveBeenCalledWith(
      25,
      7,
      expect.objectContaining({
        revision: 2,
        sections: expect.arrayContaining([
          { key: "objetivo", text: "SINTETICO edicao local preservada" },
        ]),
      }),
    );
  });
  it("loads structured server validation through the actual route view", async () => {
    mount("/app/projects/25/technical-reports/7");
    await screen.findByRole("textbox", { name: "Título do laudo" });
    fireEvent.click(screen.getByRole("button", { name: "Validação prévia" }));
    await screen.findByRole("heading", {
      name: "Sem bloqueios na validação atual",
    });
    expect(reportApi.validate).toHaveBeenCalledWith(25, 7);
    expect(screen.getByTestId("location")).toHaveTextContent("view=validation");
  });
  it("submits an explicit model with configurable rules and sections", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<TemplateForm onSave={save} />);
    fireEvent.change(screen.getByLabelText("Nome do modelo"), {
      target: { value: "SINTETICO Modelo de teste" },
    });
    fireEvent.change(screen.getByLabelText("Justificativa"), {
      target: { value: "Teste sintetico de configuracao" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Confirmo as regras e o conteúdo do modelo",
      }),
    );
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Salvar rascunho do modelo" })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "SINTETICO Modelo de teste",
          rules: expect.objectContaining({
            stale_sources: "block",
            professional_registration_required: false,
          }),
        }),
        "Teste sintetico de configuracao",
      ),
    );
  });
  it("renders provenance, dynamic fields and plain text without executing markup", () => {
    const c = content();
    c.sections[1].text = "<script>window.hacked=true</script>";
    render(
      <ReportPreview
        data={c}
        revision={4}
        status="approved"
        hash="approved-hash"
      />,
    );
    expect(screen.getByText("Projeto Nome manual identificado")).toBeVisible();
    expect(
      screen.getByText(/valor original extraído: Nome oficial/),
    ).toBeVisible();
    expect(
      screen.getByText("<script>window.hacked=true</script>"),
    ).toBeVisible();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText(/Versão aprovada preservada/)).toBeVisible();
  });
});
