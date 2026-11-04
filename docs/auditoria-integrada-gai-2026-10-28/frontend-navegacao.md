# Frontend e navegação

## Estrutura e interfaces reais

Router global reúne autenticação, overview, organizações/usuários/perfis/empresas, projetos, orçamentos, recebíveis/caixa/DRE e inventariantes. Rotas do projeto ficam sob ProjectLayout e oferecem resumo, dashboard, contratos, preparação, campo, inventário, base contábil, pendências, financeiro, prestação, imports, exports e laudos. `gai-frontend/src/router/router.tsx:1`; `gai-frontend/src/router/projectRoutes.tsx:1`; `gai-frontend/src/features/projects/ProjectLayout.tsx:1`.

PermissionGate/ProtectedRoute controlam menu e rotas; autorização real continua no backend. As telas dos módulos novos usam loading/erro, formulários, validação e tabelas conectadas a APIs reais. As listas/históricos têm contratos de paginação; a tabela de movimentos de caixa exibe no máximo 200 com aviso explícito e possibilidade de exportação/refino. Não declarar responsividade completa só porque existe breakpoint CSS.

247 testes Vitest passaram. Playwright desta auditoria usa backend real e MySQL sintético em 33319, frontend em 33320, viewport desktop 1440×1000 e mobile 390×844, além dos viewports das nove suítes de negócio reaproveitadas. Resultados finais por cenário, falhas e evidências estão em testes.md e evidencias/playwright.json. Os erros de health/CSS ocorridos durante configuração do harness foram isolados da avaliação do produto.

## Contexto do projeto

As abas internas preservam projectId e o layout montado; refresh e links diretos devem refazer consulta com sessão do navegador. Sessão usa sessionStorage, portanto uma nova aba não deve ser presumida autenticada. Voltar/avançar deve preservar rota e parâmetros.

Há perda de contexto ao transitar por layouts globais: abas do projeto apontam /app/budgets?project_id=..., enquanto os NavLinks de BudgetLayout apontam /app/budgets e /app/budgets/pricing sem query. Em recebíveis, o link da lista para detalhe também omite project_id. DRE possui Retornar ao projeto quando o parâmetro está presente. `gai-frontend/src/features/budgets/BudgetLayout.tsx:19`; `gai-frontend/src/features/receivables/ReceivablesPage.tsx:55`; `gai-frontend/src/features/dre/DreLayout.tsx:1`. GAI-005 documenta a quebra da navegação integrada; não corrigida nesta auditoria.

O novo teste de navegação registra e afirma o comportamento de perda do filtro para reproduzir o defeito; esse teste passando não significa que o comportamento seja aceito. O critério futuro é preservar filtro e oferecer retorno ao projeto em todas as telas relacionadas. O spec original project-navigation-real.spec.ts pressupõe que todas as abas tenham href /projects/:id, mas novas abas globais violam essa premissa; precisa atualização para expressar contexto funcional, sem classificar todo link global como proibido.

## Rotas incompletas e limites

Há placeholders globais e a rota area; inventário-atual.md identifica os caminhos. Eles não contam como capacidade implementada. O backend de catálogo existe, mas a tela global ainda é placeholder. Orçamentos mostram intenção de conversão, sem contrato/projeto/recebível criado automaticamente. Laudos não compõem fotografias de ativos, apesar de existirem imagens no detalhe do item.

Listas com IDs numéricos manuais, retorno a projeto em layouts globais, indicadores de fonte obsoleta entre abas, estados de erro e textos de limitação são critérios de homologação funcional. A auditoria não garante toda combinação de filtro/modal em desktop/mobile apenas pela visita de rota. Evidência atual e lacunas permanecem explícitas na matriz e nos testes.
