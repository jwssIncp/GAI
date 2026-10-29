# Auditoria visual

Referência anterior preservada antes das edições em [baseline](evidencias/baseline), com hashes em [initial-files.json](evidencias/initial-files.json) e capturas em [before](evidencias/before). Leitura dos relatórios das Ondas 0, 1 e 2 e dos contratos existentes orientou a preservação funcional.

O sistema já possuía blocos claro/escuro, raio, Tailwind semântico, Radix e componentes reutilizáveis. A implementação evolui essa base, sem criar um design system ou gerenciador de tema paralelo.

| Inconsistência comprovada | Intervenção |
| --- | --- |
| Verde vivo em links e textos pequenos claros | primary-text mais escuro; verde original preservado nos preenchimentos e na marca |
| Sucesso sobre fundo sutil com contraste de 3,52:1 | Ajuste da tonalidade semântica de sucesso, validado por contraste calculado |
| Inputs brancos forçados nos filtros mesmo em tema escuro | FilterPanel e filtros do dashboard passam a usar background/input/foreground |
| Filtros, cabeçalhos de tabela e abas competiam com a sidebar em azul saturado | Superfícies neutras e seleção sutil, preservando o azul estrutural |
| Símbolo genérico G com decoração de brilho | Símbolo geométrico G e lettering GAI próprios em SVG |
| Sidebar sem recolhimento e mobile com diálogo manual | Sidebar compacta persistente e Radix para foco, Escape e scroll lock |
| Fechar menu mobile não devolvia foco ao acionador na primeira implementação | Retorno explícito ao botão; regressão real de teclado |
| Abas de projeto começavam por laudos/financeiro | Visão geral e Dashboard primeiro; todas as rotas e permissões mantidas |
| Breadcrumbs apenas textuais | Links para ancestrais válidos e semântica de navegação |
| Dois painéis sticky competindo no dashboard de projeto | Filtros deixam de disputar a posição das abas de projeto |
| Métricas com aparência de cartões clicáveis e tipografia apertada | Sem elevação ao passar o mouse; valores com quebra e números tabulares |
| Modais translúcidos e controles de fechamento pequenos | Superfícies opacas e áreas de toque maiores |
| Tabela larga sem região focável | Região nomeada, caption, scope e indicação de rolagem no mobile |
| Navegação financeira, orçamento, DRE e laudos com tratamentos distintos | Classe compartilhada section-navigation, sem mudar os links |
| Cores literais e tooltip padrão nos gráficos da DRE | Tokens de gráficos e estilos compartilhados para Recharts |
| Preferência do sistema não acompanhava mudanças posteriores | Preferência system, observação de mídia e sincronização entre consumidores/abas |
| Busca e página de listas administrativas só em memória | Parâmetros de URL, refresh e histórico |
| Aba Pagamentos/Despesas só em memória | Parâmetro tab na URL |
| Recuperação/redefinição sem feedback de erro da API | Erro visível, limpeza do sucesso antigo e possibilidade de tentar novamente |
| Perfil abria placeholder | Dados reais da sessão em página de consulta |

Não foram encontrados handlers vazios ou links href="#" usados como ação fictícia na busca de código. Três alertas heurísticos de botão sem onClick correspondem ao próprio componente Button e a dois submits de formulário, não a botões desconectados. Recursos ainda reservados permanecem explicitamente indisponíveis.

## Inventário integral de arquivos de renderização

O JSON registra controles, atributos, conexões e sinais estáticos por declaração. A varredura estática abrange todos os arquivos listados; a validação visual é representativa dos percursos documentados e não de todos os estados possíveis.

| Arquivo | Linhas | Controles | Tabelas próprias |
| --- | ---: | ---: | ---: |
| app/AppProviders.tsx | 31 | 0 | 0 |
| components/base/Cards.tsx | 52 | 0 | 0 |
| components/base/DataTable.tsx | 34 | 0 | 1 |
| components/base/FilterPanel.tsx | 14 | 0 | 0 |
| components/base/FormField.tsx | 43 | 1 | 0 |
| components/base/GaiLogo.tsx | 19 | 0 | 0 |
| components/base/Inputs.tsx | 15 | 3 | 0 |
| components/base/PageContainer.tsx | 6 | 0 | 0 |
| components/base/PageHeader.tsx | 15 | 0 | 0 |
| components/base/Pagination.tsx | 21 | 2 | 0 |
| components/base/SearchInput.tsx | 17 | 2 | 0 |
| components/base/States.tsx | 53 | 1 | 0 |
| components/base/StatusBadge.tsx | 87 | 0 | 0 |
| components/base/Tabs.tsx | 18 | 1 | 0 |
| components/ui/button.tsx | 55 | 1 | 0 |
| components/ui/dialog.tsx | 68 | 4 | 0 |
| components/ui/help-popover.tsx | 47 | 1 | 0 |
| components/ui/icon-input.tsx | 24 | 1 | 0 |
| components/ui/input.tsx | 20 | 1 | 0 |
| components/ui/toast.tsx | 68 | 1 | 0 |
| features/accountabilities/ProjectAccountabilitiesPage.tsx | 34 | 15 | 0 |
| features/accounting-items/AccountingImportsPanel.tsx | 100 | 3 | 0 |
| features/accounting-items/AccountingItemDetailDrawer.tsx | 65 | 0 | 0 |
| features/accounting-items/AccountingItemForm.tsx | 69 | 17 | 0 |
| features/accounting-items/ProjectAccountingItemsPage.tsx | 129 | 11 | 0 |
| features/auth/AuthProvider.tsx | 83 | 0 | 0 |
| features/auth/LoginPage.tsx | 74 | 6 | 0 |
| features/auth/PasswordPages.tsx | 97 | 9 | 0 |
| features/auth/PermissionGate.tsx | 8 | 0 | 0 |
| features/auth/ProfilePage.tsx | 25 | 0 | 0 |
| features/budgets/BudgetDetailPage.tsx | 480 | 19 | 0 |
| features/budgets/BudgetForm.tsx | 655 | 35 | 0 |
| features/budgets/BudgetLayout.tsx | 41 | 2 | 0 |
| features/budgets/BudgetMemory.tsx | 168 | 1 | 0 |
| features/budgets/BudgetPricingPage.tsx | 246 | 14 | 0 |
| features/budgets/BudgetsPage.tsx | 195 | 9 | 0 |
| features/companies/CompaniesPage.tsx | 44 | 6 | 0 |
| features/contracts/CommercialOverview.tsx | 514 | 12 | 0 |
| features/contracts/ProjectContractsPage.tsx | 586 | 28 | 0 |
| features/dashboard/DashboardPage.tsx | 128 | 2 | 0 |
| features/dashboard/OrganizationOverviewPage.tsx | 102 | 15 | 0 |
| features/dashboard/OverviewDetails.tsx | 73 | 20 | 2 |
| features/documents/DocumentExport.tsx | 33 | 3 | 0 |
| features/documents/VisualTemplateEditor.tsx | 34 | 9 | 0 |
| features/dre/DreAccountsPage.tsx | 266 | 14 | 0 |
| features/dre/DreEntriesPage.tsx | 645 | 29 | 0 |
| features/dre/DreLayout.tsx | 42 | 1 | 0 |
| features/dre/DrePeriodsPage.tsx | 250 | 13 | 0 |
| features/dre/DreReportPage.tsx | 553 | 15 | 0 |
| features/export-jobs/ProjectExportJobsPage.tsx | 213 | 12 | 0 |
| features/field-agents/FieldAgentDetailDrawer.tsx | 47 | 0 | 0 |
| features/field-agents/FieldAgentForm.tsx | 75 | 7 | 0 |
| features/field-agents/FieldAgentSelect.tsx | 69 | 5 | 0 |
| features/field-agents/FieldAgentsPage.tsx | 144 | 9 | 0 |
| features/field-agents/ProjectFieldAgentsPanel.tsx | 209 | 16 | 0 |
| features/field-coordination/FieldCoordinationPage.tsx | 1420 | 49 | 0 |
| features/field-coordination/FieldTemplates.tsx | 592 | 27 | 0 |
| features/finance/ExpenseAttachmentsPanel.tsx | 148 | 4 | 0 |
| features/finance/ExpenseForm.tsx | 45 | 7 | 0 |
| features/finance/PaymentForm.tsx | 55 | 11 | 0 |
| features/finance/ProjectFinancePage.tsx | 366 | 35 | 0 |
| features/import-sessions/ProjectImportSessionsPage.tsx | 392 | 34 | 0 |
| features/inventory-item-images/InventoryItemImagesGallery.tsx | 144 | 3 | 0 |
| features/inventory-items/InventoryItemDetailDrawer.tsx | 70 | 0 | 0 |
| features/inventory-items/InventoryItemForm.tsx | 77 | 20 | 0 |
| features/inventory-items/ItemEvidencePanels.tsx | 19 | 6 | 0 |
| features/inventory-items/ProjectInventoryItemsPage.tsx | 143 | 12 | 0 |
| features/inventory-items/ValuationBatchPanel.tsx | 664 | 18 | 0 |
| features/inventory-operations/AssistedReconciliationPanel.tsx | 555 | 11 | 0 |
| features/inventory-operations/InventorySessionDetailPage.tsx | 236 | 30 | 0 |
| features/inventory-operations/ObservationEvidenceDrawer.tsx | 154 | 3 | 0 |
| features/inventory-operations/ProjectInventorySessionsPage.tsx | 62 | 7 | 0 |
| features/organizations/OrganizationDetailDrawer.tsx | 48 | 0 | 0 |
| features/organizations/OrganizationForm.tsx | 97 | 8 | 0 |
| features/organizations/OrganizationsPage.tsx | 177 | 6 | 0 |
| features/pending-issues/PendingIssueDetailDrawer.tsx | 68 | 2 | 0 |
| features/pending-issues/PendingIssueForm.tsx | 70 | 12 | 0 |
| features/pending-issues/ProjectPendingIssuesPage.tsx | 214 | 22 | 0 |
| features/placeholders/PlaceholderPage.tsx | 13 | 0 | 0 |
| features/project-dashboard/BrazilProjectMap.tsx | 80 | 1 | 0 |
| features/project-dashboard/dashboardVisuals.tsx | 175 | 0 | 0 |
| features/project-dashboard/ProjectDashboardPage.tsx | 364 | 11 | 2 |
| features/project-preparation/PreparationForms.tsx | 584 | 24 | 0 |
| features/project-preparation/ProjectPreparationPage.tsx | 822 | 17 | 0 |
| features/project-preparation/TemplateManager.tsx | 773 | 31 | 0 |
| features/projects/ProjectContextLink.tsx | 24 | 1 | 0 |
| features/projects/ProjectForm.tsx | 167 | 6 | 0 |
| features/projects/ProjectLayout.tsx | 179 | 2 | 0 |
| features/projects/ProjectLifecycleActions.tsx | 94 | 1 | 0 |
| features/projects/ProjectSelectors.tsx | 181 | 4 | 0 |
| features/projects/ProjectsPage.tsx | 152 | 4 | 0 |
| features/projects/ProjectSummaryPage.tsx | 417 | 5 | 0 |
| features/projects/ProjectUnitsPanel.tsx | 107 | 2 | 0 |
| features/receivables/CashFlowPage.tsx | 204 | 2 | 0 |
| features/receivables/FinanceLayout.tsx | 46 | 1 | 0 |
| features/receivables/FinanceShared.tsx | 185 | 10 | 0 |
| features/receivables/ReceivableDetailPage.tsx | 386 | 18 | 0 |
| features/receivables/ReceivableForm.tsx | 335 | 13 | 0 |
| features/receivables/ReceivablesPage.tsx | 107 | 2 | 0 |
| features/roles/RolesPage.tsx | 41 | 0 | 0 |
| features/shared/ResourceListPage.tsx | 81 | 1 | 0 |
| features/technical-reports/ReportDetailPage.tsx | 490 | 24 | 0 |
| features/technical-reports/ReportForms.tsx | 441 | 27 | 0 |
| features/technical-reports/ReportPreview.tsx | 257 | 1 | 1 |
| features/technical-reports/reports.css | 53 | 0 | 0 |
| features/technical-reports/ReportsLayout.tsx | 41 | 3 | 0 |
| features/technical-reports/ReportsPage.tsx | 146 | 8 | 0 |
| features/technical-reports/ReportTemplatesPage.tsx | 318 | 13 | 0 |
| features/users/UsersPage.tsx | 44 | 6 | 0 |
| layouts/AppLayout.tsx | 31 | 1 | 0 |
| layouts/AuthLayout.tsx | 56 | 2 | 0 |
| layouts/Sidebar.tsx | 92 | 3 | 0 |
| layouts/Topbar.tsx | 128 | 8 | 0 |
| main.tsx | 15 | 0 | 0 |
| router/ContextRedirect.tsx | 7 | 0 | 0 |
| router/projectRoutes.tsx | 163 | 0 | 0 |
| router/ProtectedRoute.tsx | 27 | 0 | 0 |
| router/router.tsx | 84 | 0 | 0 |
| styles/globals.css | 376 | 0 | 0 |

[Inventário estático completo](evidencias/inventario-controles.json). Cores literais remanescentes são decoração branca em superfícies de marca e a cor editável de modelos documentais; valores de identidade de clientes não foram convertidos automaticamente.
