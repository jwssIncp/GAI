import { DreLayout } from '@/features/dre/DreLayout';
import { DreReportPage } from '@/features/dre/DreReportPage';
import { DreEntriesPage,DreEntryDetailPage } from '@/features/dre/DreEntriesPage';
import { DreAccountsPage } from '@/features/dre/DreAccountsPage';
import { DrePeriodsPage } from '@/features/dre/DrePeriodsPage';
import { FinanceLayout } from '@/features/receivables/FinanceLayout';
import { ReceivablesPage } from '@/features/receivables/ReceivablesPage';
import { ReceivableForm } from '@/features/receivables/ReceivableForm';
import { ReceivableDetailPage } from '@/features/receivables/ReceivableDetailPage';
import { CashFlowPage } from '@/features/receivables/CashFlowPage';
import { projectRoute } from './projectRoutes';
import { BudgetLayout } from '@/features/budgets/BudgetLayout';
import { BudgetsPage } from '@/features/budgets/BudgetsPage';
import { BudgetPricingPage } from '@/features/budgets/BudgetPricingPage';
import { BudgetDetailPage } from '@/features/budgets/BudgetDetailPage';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { AccountLockedPage, AccessDeniedPage, ForgotPasswordPage, ResetPasswordPage, SessionExpiredPage } from '@/features/auth/PasswordPages';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { OrganizationsPage } from '@/features/organizations/OrganizationsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { RolesPage } from '@/features/roles/RolesPage';
import { CompaniesPage } from '@/features/companies/CompaniesPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { PlaceholderPage } from '@/features/placeholders/PlaceholderPage';
import { FieldAgentsPage } from '@/features/field-agents/FieldAgentsPage';

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
          { element: <ProtectedRoute permissions={['projects:read']} />, children: [{ path: 'projects', element: <ProjectsPage /> }] },
          projectRoute,
          { path:'finance', element:<FinanceLayout/>, children:[
            {element:<ProtectedRoute permissions={['dre:read']}/>,children:[{path:'dre',element:<DreLayout/>,children:[{index:true,element:<DreReportPage/>},{path:'entries',element:<DreEntriesPage/>},{path:'entries/:entryId',element:<DreEntryDetailPage/>},{path:'accounts',element:<DreAccountsPage/>},{path:'periods',element:<DrePeriodsPage/>}]}]},
            {element:<ProtectedRoute permissions={['receivables:read']}/>,children:[{path:'receivables',element:<ReceivablesPage/>},{path:'receivables/:receivableId',element:<ReceivableDetailPage/>}]},
            {element:<ProtectedRoute permissions={['receivables:read','receivables:edit']}/>,children:[{path:'receivables/new',element:<ReceivableForm/>}]},
            {element:<ProtectedRoute permissions={['cash-flow:read']}/>,children:[{path:'cash-flow',element:<CashFlowPage/>}]}
          ]},
          { element: <ProtectedRoute permissions={['budgets:read']} />, children: [{ path: 'budgets', element: <BudgetLayout />, children: [{ index: true, element: <BudgetsPage /> }, { path: 'pricing', element: <BudgetPricingPage /> }, { path: ':budgetId', element: <BudgetDetailPage /> }] }] },
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
          { path: 'profile', element: <ProfilePage /> },
          { path: 'settings', element: <PlaceholderPage title="Configuracoes" /> },
        ],
      },
    ],
  },
]);
