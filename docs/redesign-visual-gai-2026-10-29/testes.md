# Testes e reprodução

| Conjunto | Resultado |
| --- | --- |
| Backend padrão: 113 suítes | 683/683; 0 falhas; 0 ignorados |
| MySQL real descartável | 325/325; 0 falhas; 0 ignorados |
| Frontend Vitest | 273/273; 0 falhas; 0 ignorados |
| Playwright UI/tema/responsividade | 23/23; 0 falhas; 0 ignorados |
| Playwright fluxos reais/Onda 2 | 14/14; 0 falhas; 0 ignorados |
| Rechecagem final de teclado/URL (casos já contados acima) | 4/4; 0 falhas; 0 ignorados |

TypeScript de app/config do frontend, Vite, ESLint global; TypeScript, Nest build e ESLint global do backend têm logs e arquivos *-result.json. O backend não recebeu alterações. O build frontend mantém o aviso preexistente de chunk maior que 500 kB; nenhum limite foi elevado para ocultá-lo.

## Casos Playwright de redesign

- passed: visual after light 1366
- passed: visual after dark 1366
- passed: visual after light 390
- passed: visual after dark 390
- passed: runtime evidence directory
- passed: responsive modules light 360
- passed: responsive modules dark 360
- passed: responsive modules light 390
- passed: responsive modules dark 390
- passed: responsive modules light 768
- passed: responsive modules dark 768
- passed: responsive modules light 1024
- passed: responsive modules dark 1024
- passed: responsive modules light 1366
- passed: responsive modules dark 1366
- passed: responsive modules light 1920
- passed: responsive modules dark 1920
- passed: theme persistence, system changes, portal menu, profile and keyboard skip link
- passed: semantic contrast in both themes
- passed: real project creation, filters, pagination, ordering, confirmation and export
- passed: invalid reset token is explained with the real API
- passed: preparation context and project financial view survive refresh and history
- passed: touch phones and tablets keep UF targets and portal navigation usable

## Fluxos reais reexecutados

- passed: ORG_ADMIN reviews and persists assisted reconciliation while retaining project navigation
- passed: ORG_ADMIN publishes explicit prices, builds a standalone budget, compares scenarios and approves an immutable proposal
- passed: ORG_ADMIN manages contracts/amendments, refreshes history and exports filtered commercial overview
- passed: ORG_ADMIN generates and downloads approved PDF/DOCX and commercial versions
- passed: ORG_ADMIN classifies accrual, adjusts, drills, exports and refreshes
- passed: ORG_ADMIN creates a versioned field model, assigns and approves a task, completes/reopens field and retains workspace navigation
- passed: ORG_ADMIN preserves context, history and tenant boundaries at 1440px
- passed: restricted reader preserves context, history and tenant boundaries at 1440px
- passed: ORG_ADMIN preserves context, history and tenant boundaries at 390px
- passed: restricted reader preserves context, history and tenant boundaries at 390px
- passed: ORG_ADMIN continuously navigates real project pages, history, deep links, mobile and tenant boundaries
- passed: ORG_ADMIN operates installments, partial/full receipts, reversal, cash, export and refresh
- passed: ORG_ADMIN creates model, drafts, validates, approves and preserves historical report
- passed: ORG_ADMIN selects between pages, previews and applies common/individual valuations with persisted results and protected XLSX

## Isolamento

Cópias próprias de fontes/dependências em evidencias/workspace, ignoradas pelo Git. Pacotes vieram da instalação isolada validada na Onda 2; sem reinstalar dependências originais. Configurações .env privadas não integram a baseline entregue. Nenhum banco 3306 ou API 3000 é alvo de teste.

MySQL: container descartável já existente gai-wave2-20261029-mysql, 127.0.0.1:33347. Regressão usa gai_validation_disposable; navegador usa gai_navigation_disposable. O harness valida o opt-in, alvo fixo, credenciais sintéticas e schema antes de recriar tabelas/migrations. API Nest em 33349; Vite preview em 33350; reuso de servidores desativado. Storage em memória no harness de navegador é explícito; não representa revalidação S3/AWS.

Fixture adicional de UI: um item sintético para o dashboard; vinte projetos via API e um via formulário, mínimo para testar paginação real de 20 linhas. Demais fluxos usam as fixtures sintéticas existentes. Não houve edição de dados históricos/persistentes.

Na raiz: node docs/redesign-visual-gai-2026-10-29/validate.cjs sync; depois modos frontend-checks, backend-checks, frontend, default, mysql, visual e e2e. visual pressupõe build atualizado. Não executar dois modos de navegador simultaneamente: ambos usam as mesmas portas e schema sintético. init preserva baseline uma única vez e recusa sobrescrevê-la.

## Tentativas e correções

Logs/resultados anteriores preservados em evidencias/attempts. A primeira captura foi bloqueada pela sandbox ao carregar esbuild; o servidor descartável foi identificado e encerrado antes de repetir. Jest não descobriu testes sob .local; a cópia foi movida para evidencias/workspace, sem relaxar o runner. Dois labels tiveram o nome acessível alterado pelo asterisco e foram corrigidos. O teste de lista recebeu MemoryRouter para a nova persistência de URL. Capturas iniciais em Vite dev tiveram reload de otimização de dependências; a validação final usa preview do build. Contraste de sucesso e semântica de aviso foram corrigidos. O teste mobile detectou retorno de foco ausente e motivou correção explícita. Resultados intermediários não são aceites finais.

Rechecagem final de quatro casos já existentes (teclado, navegação, contraste/tooltips e toque) após impedir que o skip link altere o hash da rota e reforçar alvos de toque compactos; não é somada como quatro fluxos novos. Tooltips reais do gráfico de status foram abertos nos dois temas, com cores de texto verificadas em tooltip-checks.json e capturas próprias. Um log de manutenção de exportações com "Pool is closed" no encerramento de fixture MySQL ocorreu tanto nesta rodada como na Onda 2 anterior (uma ocorrência em cada). Não houve falha dos 325 testes; não foi alterado o backend para tratar esse log de shutdown do harness.
