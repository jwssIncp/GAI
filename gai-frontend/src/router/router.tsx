import { DreLayout } from "@/features/dre/DreLayout";
import { DreReportPage } from "@/features/dre/DreReportPage";
import { DreMonthlyPage } from "@/features/dre/DreMonthlyPage";
import { DreMonthlyRedirect } from "@/features/dre/DreLayout";
import {
  DreEntriesPage,
  DreEntryDetailPage,
} from "@/features/dre/DreEntriesPage";
import { DreAccountsPage } from "@/features/dre/DreAccountsPage";
import { DrePeriodsPage } from "@/features/dre/DrePeriodsPage";
import { FinanceLayout } from "@/features/receivables/FinanceLayout";
import { ReceivablesPage } from "@/features/receivables/ReceivablesPage";
import { ReceivableForm } from "@/features/receivables/ReceivableForm";
import { ReceivableDetailPage } from "@/features/receivables/ReceivableDetailPage";
import { CashFlowPage } from "@/features/receivables/CashFlowPage";
import { FinanceSettingsPage } from "@/features/finance-settings/FinanceSettingsPage";
import { RemunerationProjectsPage } from "@/features/remuneration/RemunerationProjectsPage";
import { FieldAgentPaymentsPage } from "@/features/field-agent-payments/FieldAgentPaymentsPage";
import { ExpenseProjectsPage } from "@/features/expenses/ExpenseProjectsPage";
import { AssetTagsPage } from "@/features/asset-tags/AssetTagsPage";
import { CommissionsPage } from "@/features/commissions/CommissionsPage";
import { projectRoute } from "./projectRoutes";
import { BudgetLayout } from "@/features/budgets/BudgetLayout";
import { BudgetsPage } from "@/features/budgets/BudgetsPage";
import { BudgetPricingPage } from "@/features/budgets/BudgetPricingPage";
import { BudgetDetailPage } from "@/features/budgets/BudgetDetailPage";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { navigationPermissions } from "@/constants/navigation";
import { AuthLayout } from "@/layouts/AuthLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import {
  AccountLockedPage,
  AccessDeniedInAppPage,
  AccessDeniedPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  SessionExpiredPage,
} from "@/features/auth/PasswordPages";
import { LoginPage } from "@/features/auth/LoginPage";
import { ProfilePage } from "@/features/auth/ProfilePage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { OrganizationsPage } from "@/features/organizations/OrganizationsPage";
import { UserFormPage, UserDetailPage } from "@/features/users/UserFormPage";
import {
  ActivateAccountPage,
  ChangePasswordPage,
} from "@/features/auth/CredentialPages";
import { UsersPage } from "@/features/users/UsersPage";
import { RolesPage } from "@/features/roles/RolesPage";
import { CompaniesPage } from "@/features/companies/CompaniesPage";
import { CompanyFormPage } from "@/features/companies/CompanyFormPage";
import { CompanyDetailPage } from "@/features/companies/CompanyDetailPage";
import { ProjectCreatePage } from '@/features/projects/ProjectCreatePage';
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import { ProjectAreaPicker } from "@/features/projects/ProjectAreaPicker";
import { projectAreaTabs } from "@/features/projects/projectArea";
import { FieldAgentsPage } from "@/features/field-agents/FieldAgentsPage";
import { FirstAllowedRedirect, LegacyRedirect } from "./LegacyRedirects";

/**
 * Endereços reservados antigos (em inglês) que nunca tiveram tela: levam à tela atual
 * equivalente. Com projeto no contexto (?project_id=), abre a aba do projeto; sem, a lista.
 */
export const legacyRedirects: ReadonlyArray<{ path: string; to: string; projectTab?: string }> = [
  { path: "payments", to: "/app/finance/field-agent-payments" },
  { path: "expenses", to: "/app/finance/expenses" },
  { path: "catalog-assets", to: "/app/projects", projectTab: "inventory-items" },
  { path: "inventory-items", to: "/app/projects", projectTab: "inventory-items" },
  { path: "inventory-item-images", to: "/app/projects", projectTab: "inventory-items" },
  { path: "accounting-items", to: "/app/projects", projectTab: "accounting-items" },
  { path: "pending-issues", to: "/app/projects", projectTab: "pending-issues" },
  { path: "import-sessions", to: "/app/projects", projectTab: "import-sessions" },
  { path: "export-jobs", to: "/app/projects", projectTab: "export-jobs" },
  // Configurações pessoais (tema, senha) ficam no Perfil.
  { path: "settings", to: "/app/profile" },
];

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app/dashboard" replace /> },
  {
    element: <AuthLayout />,
    children: [
      { path: "/activate-account", element: <ActivateAccountPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
    ],
  },
  { path: "/session-expired", element: <SessionExpiredPage /> },
  { path: "/access-denied", element: <AccessDeniedPage /> },
  { path: "/account-locked", element: <AccountLockedPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/app",
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/app/dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          // Acesso negado dentro do layout (menu e topo continuam disponíveis).
          { path: "access-denied", element: <AccessDeniedInAppPage /> },
          {
            element: <ProtectedRoute permissions={["organizations:read"]} />,
            children: [
              { path: "organizations", element: <OrganizationsPage /> },
            ],
          },
          {
            element: <ProtectedRoute permissions={["users:read"]} />,
            children: [
              { path: "users", element: <UsersPage /> },
              { path: "users/:id", element: <UserDetailPage /> },
            ],
          },
          {
            element: <ProtectedRoute permissions={["org_roles:read"]} />,
            children: [{ path: "roles", element: <RolesPage /> }],
          },
          {
            element: <ProtectedRoute permissions={["companies:read"]} />,
            children: [
              { path: "companies", element: <CompaniesPage /> },
              { path: "companies/:id", element: <CompanyDetailPage /> },
            ],
          },
          {
            element: <ProtectedRoute permissions={["companies:create"]} />,
            children: [{ path: "companies/new", element: <CompanyFormPage /> }],
          },
          {
            element: (
              <ProtectedRoute
                permissions={["companies:read", "companies:update"]}
              />
            ),
            children: [
              { path: "companies/:id/edit", element: <CompanyFormPage /> },
            ],
          },
          {
            element: <ProtectedRoute permissions={["projects:read"]} />,
            children: [{ path: "projects", element: <ProjectsPage /> }],
          },
          // Sub-abas da área Projetos (padrão do sistema anterior): escolhem o projeto e abrem
          // a tela dele. Rotas estáticas: têm precedência sobre /app/projects/:projectId.
          ...projectAreaTabs
            .filter((tab) => tab.id !== "overview")
            .map((tab) => ({
              element: <ProtectedRoute permissions={tab.permissions} />,
              children: [
                {
                  path: tab.to.replace("/app/", ""),
                  element: <ProjectAreaPicker tabId={tab.id} />,
                },
              ],
            })),
          { element: <ProtectedRoute permissions={['projects:create']} />, children: [{ path: 'projects/new', element: <ProjectCreatePage /> }] },
          projectRoute,
          {
            path: "finance",
            element: <FinanceLayout />,
            children: [
              // /app/finance não tem tela própria: abre a 1ª tela financeira permitida.
              { index: true, element: <FirstAllowedRedirect section="finance" prefix="/app/finance" /> },
              {
                element: <ProtectedRoute permissions={["dre:read"]} />,
                children: [
                  {
                    path: "dre",
                    element: <DreLayout />,
                    children: [
                      { index: true, element: <DreMonthlyPage /> },
                      { path: "monthly", element: <DreMonthlyRedirect /> },
                      { path: "statement", element: <DreReportPage /> },
                      { path: "entries", element: <DreEntriesPage /> },
                      {
                        path: "entries/:entryId",
                        element: <DreEntryDetailPage />,
                      },
                      { path: "accounts", element: <DreAccountsPage /> },
                      { path: "periods", element: <DrePeriodsPage /> },
                    ],
                  },
                ],
              },
              {
                element: <ProtectedRoute permissions={["receivables:read"]} />,
                children: [
                  { path: "receivables", element: <ReceivablesPage /> },
                  {
                    path: "receivables/:receivableId",
                    element: <ReceivableDetailPage />,
                  },
                ],
              },
              {
                element: (
                  <ProtectedRoute
                    permissions={["receivables:read", "receivables:edit"]}
                  />
                ),
                children: [
                  { path: "receivables/new", element: <ReceivableForm /> },
                ],
              },
              {
                element: <ProtectedRoute permissions={["cash-flow:read"]} />,
                children: [{ path: "cash-flow", element: <CashFlowPage /> }],
              },
              {
                element: <ProtectedRoute permissions={["finance-settings:read"]} />,
                children: [
                  { path: "parameters", element: <FinanceSettingsPage /> },
                ],
              },
              // Mesma permissão do item do menu (uma fonte só: navigation.ts).
              ...(
                [
                  ["remuneration", <RemunerationProjectsPage />],
                  ["field-agent-payments", <FieldAgentPaymentsPage />],
                  ["expenses", <ExpenseProjectsPage />],
                  ["asset-tags", <AssetTagsPage />],
                  ["commissions", <CommissionsPage />],
                ] as const
              ).map(([path, element]) => ({
                element: <ProtectedRoute permissions={navigationPermissions(`/app/finance/${path}`)} />,
                children: [{ path, element }],
              })),
            ],
          },
          {
            element: <ProtectedRoute permissions={["budgets:read"]} />,
            children: [
              {
                path: "budgets",
                element: <BudgetLayout />,
                children: [
                  { index: true, element: <BudgetsPage /> },
                  { path: "pricing", element: <BudgetPricingPage /> },
                  { path: ":budgetId", element: <BudgetDetailPage /> },
                ],
              },
            ],
          },
          {
            element: <ProtectedRoute permissions={["field-agents:read"]} />,
            children: [{ path: "field-agents", element: <FieldAgentsPage /> }],
          },
          ...legacyRedirects.map(({ path, to, projectTab }) => ({
            path,
            element: <LegacyRedirect to={to} projectTab={projectTab} />,
          })),
          {
            element: <ProtectedRoute permissions={["users:write"]} />,
            children: [
              { path: "users/new", element: <UserFormPage /> },
              { path: "users/:id/edit", element: <UserFormPage /> },
            ],
          },
          { path: "change-password", element: <ChangePasswordPage /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
]);
