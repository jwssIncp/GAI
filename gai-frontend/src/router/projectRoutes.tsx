import { ReportsLayout } from "@/features/technical-reports/ReportsLayout";
import { ReportsPage } from "@/features/technical-reports/ReportsPage";
import {
  ReportTemplatesPage,
  ReportTemplateEditorPage,
  ReportResponsiblesPage,
} from "@/features/technical-reports/ReportTemplatesPage";
import { ReportDetailPage } from "@/features/technical-reports/ReportDetailPage";
import { type RouteObject } from "react-router-dom";
import { ContextRedirect } from "./ContextRedirect";
import { ProjectContractsPage } from "@/features/contracts/ProjectContractsPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { PlaceholderPage } from "@/features/placeholders/PlaceholderPage";
import { ProjectLayout } from "@/features/projects/ProjectLayout";
import { FieldCoordinationPage } from "@/features/field-coordination/FieldCoordinationPage";
import { ProjectSummaryPage } from "@/features/projects/ProjectSummaryPage";
import { ProjectDashboardPage } from "@/features/project-dashboard/ProjectDashboardPage";
import { ProjectPreparationPage } from "@/features/project-preparation/ProjectPreparationPage";
import { ProjectExportJobsPage } from "@/features/export-jobs/ProjectExportJobsPage";
import { ProjectImportSessionsPage } from "@/features/import-sessions/ProjectImportSessionsPage";
import { ProjectInventoryItemsPage } from "@/features/inventory-items/ProjectInventoryItemsPage";
import { ProjectInventorySessionsPage } from "@/features/inventory-operations/ProjectInventorySessionsPage";
import { InventorySessionDetailPage } from "@/features/inventory-operations/InventorySessionDetailPage";
import { ProjectAccountingItemsPage } from "@/features/accounting-items/ProjectAccountingItemsPage";
import { ProjectPendingIssuesPage } from "@/features/pending-issues/ProjectPendingIssuesPage";
import { ProjectFinancePage } from "@/features/finance/ProjectFinancePage";
import { ProjectAccountabilitiesPage } from "@/features/accountabilities/ProjectAccountabilitiesPage";

export const projectRoute: RouteObject = {
  path: "projects/:projectId",
  element: <ProjectLayout />,
  children: [
    {
      element: (
        <ProtectedRoute
          permissions={["projects:read", "technical-reports:read"]}
        />
      ),
      children: [
        {
          path: "technical-reports",
          element: <ReportsLayout />,
          children: [
            { index: true, element: <ReportsPage /> },
            { path: "templates", element: <ReportTemplatesPage /> },
            {
              path: "templates/:templateId",
              element: <ReportTemplateEditorPage />,
            },
            {
              element: (
                <ProtectedRoute permissions={["technical-reports:templates"]} />
              ),
              children: [
                { path: "responsibles", element: <ReportResponsiblesPage /> },
              ],
            },
            { path: ":reportId", element: <ReportDetailPage /> },
          ],
        },
      ],
    },
    {
      element: (
        <ProtectedRoute permissions={["projects:read", "contracts:read"]} />
      ),
      children: [{ path: "contracts", element: <ProjectContractsPage /> }],
    },
    {
      element: <ProtectedRoute permissions={["field-coordination:read"]} />,
      children: [
        { path: "field-coordination", element: <FieldCoordinationPage /> },
      ],
    },
    {
      element: <ProtectedRoute permissions={["projects:read"]} />,
      children: [
        { index: true, element: <ContextRedirect to="summary" /> },
        { path: "summary", element: <ProjectSummaryPage /> },
        { path: "dashboard", element: <ProjectDashboardPage /> },
        {
          path: "area",
          element: (
            <PlaceholderPage
              title="Project Area"
              dependency="Abas preparadas; os fluxos profundos entram na proxima rodada."
            />
          ),
        },
      ],
    },
    {
      element: <ProtectedRoute permissions={["export-jobs:read"]} />,
      children: [{ path: "export-jobs", element: <ProjectExportJobsPage /> }],
    },
    {
      element: <ProtectedRoute permissions={["project-preparation:read"]} />,
      children: [
        { path: "preparation", element: <ContextRedirect to="kickoff" /> },
        { path: "preparation/:kind", element: <ProjectPreparationPage /> },
      ],
    },
    {
      element: <ProtectedRoute permissions={["import-sessions:read"]} />,
      children: [
        { path: "import-sessions", element: <ProjectImportSessionsPage /> },
      ],
    },
    {
      element: <ProtectedRoute permissions={["inventory-items:read"]} />,
      children: [
        { path: "inventory-items", element: <ProjectInventoryItemsPage /> },
      ],
    },
    {
      element: <ProtectedRoute permissions={["inventory-sessions:read"]} />,
      children: [
        {
          path: "inventory/sessions",
          element: <ProjectInventorySessionsPage />,
        },
        {
          path: "inventory/sessions/:sessionId",
          element: <InventorySessionDetailPage />,
        },
      ],
    },
    {
      element: (
        <ProtectedRoute permissions={["inventory-accounting-items:read"]} />
      ),
      children: [
        { path: "accounting-items", element: <ProjectAccountingItemsPage /> },
      ],
    },
    {
      element: (
        <ProtectedRoute permissions={["inventory-pending-issues:read"]} />
      ),
      children: [
        { path: "pending-issues", element: <ProjectPendingIssuesPage /> },
      ],
    },
    {
      element: (
        <ProtectedRoute permissions={["payments:read", "expenses:read"]} />
      ),
      children: [{ path: "finance", element: <ProjectFinancePage /> }],
    },
    {
      element: (
        <ProtectedRoute permissions={["expense-accountabilities:read"]} />
      ),
      children: [
        {
          path: "finance/accountabilities",
          element: <ProjectAccountabilitiesPage />,
        },
      ],
    },
  ],
};
