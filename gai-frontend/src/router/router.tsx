import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { AccountLockedPage, AccessDeniedPage, ForgotPasswordPage, ResetPasswordPage, SessionExpiredPage } from '@/features/auth/PasswordPages';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { OrganizationsPage } from '@/features/organizations/OrganizationsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { RolesPage } from '@/features/roles/RolesPage';
import { CompaniesPage } from '@/features/companies/CompaniesPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { ProjectSummaryPage } from '@/features/projects/ProjectSummaryPage';
import { PlaceholderPage } from '@/features/placeholders/PlaceholderPage';
import { FieldAgentsPage } from '@/features/field-agents/FieldAgentsPage';
import { ProjectInventoryItemsPage } from '@/features/inventory-items/ProjectInventoryItemsPage';
import { ProjectAccountingItemsPage } from '@/features/accounting-items/ProjectAccountingItemsPage';
import { ProjectPendingIssuesPage } from '@/features/pending-issues/ProjectPendingIssuesPage';
import { ProjectFinancePage } from '@/features/finance/ProjectFinancePage';
import { ProjectExportJobsPage } from '@/features/export-jobs/ProjectExportJobsPage';
import { ProjectImportSessionsPage } from '@/features/import-sessions/ProjectImportSessionsPage';
import { ProjectDashboardPage } from '@/features/project-dashboard/ProjectDashboardPage';
import { ProjectInventorySessionsPage } from '@/features/inventory-operations/ProjectInventorySessionsPage';
import { InventorySessionDetailPage } from '@/features/inventory-operations/InventorySessionDetailPage';
import { ProjectAccountabilitiesPage } from '@/features/accountabilities/ProjectAccountabilitiesPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app/dashboard" replace /> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  { path: '/session-expired', element: <SessionExpiredPage /> },
  { path: '/access-denied', element: <AccessDeniedPage /> },
  { path: '/account-locked', element: <AccountLockedPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/app',
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/app/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { element: <ProtectedRoute permissions={['organizations:read']} />, children: [{ path: 'organizations', element: <OrganizationsPage /> }] },
          { element: <ProtectedRoute permissions={['users:read']} />, children: [{ path: 'users', element: <UsersPage /> }] },
          { element: <ProtectedRoute permissions={['org_roles:read']} />, children: [{ path: 'roles', element: <RolesPage /> }] },
          { element: <ProtectedRoute permissions={['companies:read']} />, children: [{ path: 'companies', element: <CompaniesPage /> }] },
          { element: <ProtectedRoute permissions={['projects:read']} />, children: [
            { path: 'projects', element: <ProjectsPage /> },
            { path: 'projects/:projectId/summary', element: <ProjectSummaryPage /> },
            { path: 'projects/:projectId/dashboard', element: <ProjectDashboardPage /> },
            { path: 'projects/:projectId/area', element: <PlaceholderPage title="Project Area" dependency="Abas preparadas; os fluxos profundos entram na proxima rodada." /> },
          ] },
          { element: <ProtectedRoute permissions={['export-jobs:read']} />, children: [{ path: 'projects/:projectId/export-jobs', element: <ProjectExportJobsPage /> }] },
          { element: <ProtectedRoute permissions={['import-sessions:read']} />, children: [{ path: 'projects/:projectId/import-sessions', element: <ProjectImportSessionsPage /> }] },
          { element: <ProtectedRoute permissions={['inventory-items:read']} />, children: [{ path: 'projects/:projectId/inventory-items', element: <ProjectInventoryItemsPage /> }] },
          { element: <ProtectedRoute permissions={['inventory-sessions:read']} />, children: [
            { path: 'projects/:projectId/inventory/sessions', element: <ProjectInventorySessionsPage /> },
            { path: 'projects/:projectId/inventory/sessions/:sessionId', element: <InventorySessionDetailPage /> },
          ] },
          { element: <ProtectedRoute permissions={['inventory-accounting-items:read']} />, children: [{ path: 'projects/:projectId/accounting-items', element: <ProjectAccountingItemsPage /> }] },
          { element: <ProtectedRoute permissions={['inventory-pending-issues:read']} />, children: [{ path: 'projects/:projectId/pending-issues', element: <ProjectPendingIssuesPage /> }] },
          { element: <ProtectedRoute permissions={['payments:read', 'expenses:read']} />, children: [{ path: 'projects/:projectId/finance', element: <ProjectFinancePage /> }] },
          { element: <ProtectedRoute permissions={['expense-accountabilities:read']} />, children: [{ path: 'projects/:projectId/finance/accountabilities', element: <ProjectAccountabilitiesPage /> }] },
          { element: <ProtectedRoute permissions={['field-agents:read']} />, children: [{ path: 'field-agents', element: <FieldAgentsPage /> }] },
          { path: 'catalog-assets', element: <PlaceholderPage title="Catalog Assets" /> },
          { path: 'inventory-items', element: <PlaceholderPage title="Inventory Items" /> },
          { path: 'inventory-item-images', element: <PlaceholderPage title="Inventory Item Images" /> },
          { path: 'accounting-items', element: <PlaceholderPage title="Accounting Items" /> },
          { path: 'pending-issues', element: <PlaceholderPage title="Pending Issues" /> },
          { path: 'payments', element: <PlaceholderPage title="Payments" /> },
          { path: 'expenses', element: <PlaceholderPage title="Expenses" /> },
          { path: 'import-sessions', element: <PlaceholderPage title="Import Sessions" /> },
          { path: 'export-jobs', element: <PlaceholderPage title="Export Jobs" /> },
          { path: 'profile', element: <PlaceholderPage title="Perfil do usuario" /> },
          { path: 'settings', element: <PlaceholderPage title="Configuracoes" /> },
        ],
      },
    ],
  },
]);
