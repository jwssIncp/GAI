# GAI Frontend — gap analysis

Data da revisão: 2026-08-26. Escopo de escrita: exclusivamente `gai-frontend`. O backend foi usado somente para leitura.

## 1. Arquitetura encontrada

- React 19 e TypeScript 5.7 em modo estrito; Vite 6 como bundler.
- React Router 7 com rotas protegidas e URLs contextuais por projeto.
- Axios único em `src/api/http.ts`, base configurável por `VITE_API_BASE_URL` (padrão `/api/v1`), Bearer token, normalização de erro e expiração em 401.
- TanStack Query 5 para cache, queries, mutations e invalidação seletiva.
- React Hook Form e Zod nos formulários existentes; validação HTML controlada nos novos formulários simples.
- Tailwind, Radix UI, componentes locais e Lucide; Recharts já presente no dashboard.
- Vitest/Testing Library para unidade e componentes; Playwright para E2E.
- Não existe client OpenAPI gerado. Tipos e endpoints são centralizados manualmente em `src/types/api.ts` e `src/api/endpoints.ts`.
- Não há error boundary global. Estados de loading, empty e error são componentes compartilhados.

## 2. Estado inicial

| Domínio | Tela existente | API utilizada | Estado inicial |
| --- | --- | --- | --- |
| Autenticação | Login, reset e sessão expirada | `/auth/*` | IMPLEMENTADO |
| Organizações | Listagem/CRUD | `/organizations` | IMPLEMENTADO |
| Empresas | Listagem/CRUD | `/companies` | IMPLEMENTADO |
| Projetos | Lista, formulário, lifecycle, resumo | `/projects/*` | IMPLEMENTADO |
| Unidades | Painel contextual | `/projects/:id/units` e `/companies/:id/units` | IMPLEMENTADO |
| Inventariantes | Lista, busca, CRUD | `/field-agents` | IMPLEMENTADO |
| Vínculos | Painel contextual | `/projects/:id/field-agents` | IMPLEMENTADO |
| Itens | Lista, CRUD e detalhe | `/projects/:id/inventory-items` | IMPLEMENTADO |
| Placas | Somente placas antiga/nova do item | inventory items | PARCIAL |
| Fotos | Galeria e presigned upload | inventory item images | IMPLEMENTADO |
| Pendências | Lista, filtros e ações | `/pending-issues` | IMPLEMENTADO |
| Base contábil | Lista, edição e importação XLSX | accounting items/imports | IMPLEMENTADO |
| Importações | Sessões, payloads, arquivos e erros | `/import-sessions` | PARCIAL |
| Exportações | Jobs, retry, cancelamento e download | `/export-jobs` | IMPLEMENTADO |
| Pagamentos/Remuneração | Lista, cálculo retornado e lifecycle | `/payments` | IMPLEMENTADO |
| Despesas/Comprovantes | CRUD, lifecycle e presigned upload | `/expenses` | IMPLEMENTADO |
| Dashboard | Resumo e analytics | `/dashboard` e `/dashboard/analytics` | PARCIAL |
| Sessões/Rodadas/Observações/Reinventário | Inexistente | nenhuma | AUSENTE |
| Conciliação/Divergências/Consolidação | Inexistente | nenhuma | AUSENTE |
| Avaliação/Histórico de placas | Inexistente | nenhuma | AUSENTE |
| Prestação de contas/Parcelas | Inexistente | nenhuma | AUSENTE |

Não foram encontrados dados fake nas telas operacionais existentes. Os mocks ficam nos testes. Rotas globais antigas ainda apontam para `PlaceholderPage`, enquanto os fluxos reais são contextuais ao projeto.

## 3. Matriz de gaps

| Domínio | Tela atual | Contrato backend | Gap | Ação |
| --- | --- | --- | --- | --- |
| Fundação HTTP/auth/RBAC | Centralizada | Specs 001/003 | Sem timeout explícito e sem error boundary | Mantida; gaps registrados |
| Projetos/unidades/inventariantes/vínculos | Funcional | Specs 004/005/014 | Sem histórico global de vínculos por agente no backend | Mantida |
| Itens/fotos | Funcional | Specs 006/007 | Sem histórico de placa e avaliação | Integrado spec 016 |
| Importações | Sessão genérica | Specs 012/016 | Tipo e upload físico XLSX ausentes | Implementado |
| Inventário operacional | Ausente | Spec 016 | Módulo completo ausente | Implementado parcialmente |
| Conciliação/consolidação | Ausente | Spec 016 | Módulo completo ausente | Implementado parcialmente |
| Prestação/parcelas | Ausente | Spec 017 | Módulo completo ausente | Implementado parcialmente |
| Dashboard | Usa endpoints reais | Spec 013 + mudanças atuais | Analytics antigo pode não refletir operações 016/017 | Mantido e marcado PARTIAL |

## 4. Alterações implementadas

- Tipos e clientes centralizados para os specs 016 e 017.
- Rotas contextuais de sessões, detalhe operacional e prestações.
- Listagem, criação e início de sessão; observações, filtros, finalização de rodada e reinventário.
- Chave idempotente criada antes do envio e preservada durante retries da mesma mutation.
- Histórico por `prior_observation_id` e identificação explícita de rodada.
- Conciliação versionada, filtros e consolidação com confirmação; duplicidades impeditivas ficam bloqueadas e textualmente explicadas.
- Histórico de placas por origem e avaliação manual append-only no detalhe do item.
- Prestação de contas, seleção de despesas elegíveis, fechamento confirmado e parcelas.
- Importação de observações físicas por multipart XLSX, com payload number, idempotency key, resumo e erros por linha.
- Navegação contextual no workspace do projeto e link no financeiro.

## 5. Integrações com API

Todas as integrações novas reutilizam o Axios existente e TanStack Query. Não há URL de backend hard-coded em componentes nem segundo client HTTP. Paginação usa o envelope `items/page/page_size/total_items/total_pages` e `normalizePage`.

## 6. Autenticação

Login grava token/sessão no storage, `/auth/me` restaura o usuário, o interceptor injeta Bearer e 401 limpa a sessão e emite `gai:session-expired`. Logout usa a API real. Não há login offline, senha padrão ou PIN embutido.

## 7. RBAC

Rotas usam `ProtectedRoute`; ações usam `PermissionGate`/`usePermissions`. As permissões novas seguem exatamente os contratos: `inventory-sessions:*`, `inventory-rounds:reinventory`, `inventory-observations:create`, `reconciliations:*`, `consolidations:create`, `asset-valuations:*`, `plate-history:read`, `expense-accountabilities:*` e `expense-installments:*`.

## 8. Projetos

Listagem, filtros, paginação, CRUD, lifecycle, detalhe, empresa, unidades, inventariantes e dashboard já usavam APIs reais. O workspace ganhou atalhos para Inventário e Prestação de contas sem reescrever os fluxos existentes.

## 9. Inventariantes

CRUD, busca, paginação, status, documento, contato e vínculos já estavam integrados. `organization_id` não é editável. Conflitos 409 de vínculo recebem mensagem do backend.

## 10. Itens e placas

O detalhe diferencia “Placa mestre anterior/atual” do “Histórico de placas”. Evidências mostram origem, valor anterior/observado, observação e responsável. A observação `ABC002` nunca faz mutation do item mestre `ABC001`.

## 11. Inventário

Nova rota `/app/projects/:projectId/inventory/sessions`, lista paginada, filtro de status, criação e início. O detalhe mantém contexto e apresenta status/datas.

## 12. Reinventário

Solicitação exige item e motivo. A rodada retornada passa a ser a rodada ativa na UI. Observações anteriores permanecem imutáveis e a coluna Histórico apresenta `prior_observation_id`.

## 13. Importações

O tipo `physical_observations_import` foi adicionado. A aba “Importar XLSX” envia arquivo multipart ao endpoint real, sem processar linhas no navegador e sem anunciar CSV/XLS/XLSB. Payloads e erros estruturados continuam nas abas existentes.

## 14. Conciliação

Execuções são criadas sem sobrescrever anteriores; `run_number` identifica versões. A listagem permite filtro por execução e status e mostra placas física e contábil.

## 15. Consolidação

Ação exige confirmação e decisão oficial (`accepted`, `corrected`, `rejected`). Resultado `duplicate` desabilita a ação com texto explicativo. 409 é exibido com a mensagem da API.

## 16. Avaliação

Histórico paginado e criação manual com fonte, valor novo/usado e data. Valores são apresentados em BRL; strings decimais são enviadas sem cálculo financeiro em `float`.

## 17. Despesas

Fluxo existente foi preservado: lista, criação, detalhe, lifecycle e comprovantes por presigned storage. Categorias e formas de pagamento continuam refletindo o DTO atual, sem catálogo inventado.

## 18. Prestação de contas

Nova área lista e filtra prestações, cria por inventariante/período, consulta detalhe, oferece despesas do mesmo agente/período e fecha com confirmação. O total exibido é o `total_amount` do backend.

## 19. Parcelas

Geração recebe quantidade e primeiro vencimento. Listagem mostra número/total, vencimento, valor e origem exatamente como retornados; não há recalculo de centavos.

## 20. Dashboard

O dashboard atual permanece conectado a dados reais. Métricas novas de sessões, rodadas, conciliações e prestações dependem do response atual do backend e não foram inventadas.

## 21. Rodada de fechamento pós BACKEND_GAP

### Alterações realizadas

- O detalhe da sessão deixou de manter `roundId` como fonte de verdade local. A retomada usa `GET` da sessão, `current_round_id` e a listagem paginada de rodadas.
- O histórico de rodadas mostra número, tipo, status, início, término, motivo e responsável, com identificação da rodada atual somente pelo ID oficial do backend.
- Finalização e cancelamento de sessão foram integrados com confirmação acessível; cancelamento exige motivo.
- Ações operacionais são condicionadas pelo status real da sessão e pelas permissões existentes.
- Evidências de observação foram integradas pelo fluxo presigned upload, PUT binário, confirmação, listagem paginada e download temporário sob demanda. Nenhum binário/base64 entra no JSON.
- O histórico de placas passou a exibir data capturada, sessão, rodada e agente retornados pelo endpoint, sem request por linha e sem mutation da placa mestre.
- Conflitos previsíveis são traduzidos centralmente por `error.code`; mensagens de backend não são inspecionadas por substring.
- Invalidações atualizam sessão, rodadas, observações, evidências, histórico de placas e dashboard conforme a mutation.

### Contratos consumidos

- `GET /projects/:projectId/inventory-sessions/:sessionId`, incluindo `current_round_id`, cancelamento e lifecycle.
- `GET /projects/:projectId/inventory-sessions/:sessionId/rounds`, paginado e filtrável por `status`/`type`.
- `POST .../inventory-sessions/:sessionId/finish` e `POST .../cancel` com `reason` obrigatório no cancelamento.
- `POST/GET .../observations/:observationId/evidence/*` para upload URL, confirmação, listagem e download URL.
- `GET /projects/:projectId/inventory-items/:itemId/plate-history`, incluindo `session_id`, `round_id`, `round_number`, `captured_at` e `field_agent_id`.
- Códigos 409 estáveis: `OBSERVATION_ALREADY_RECORDED`, `IDEMPOTENCY_KEY_REUSED`, `INVENTORY_ROUND_CONCURRENT_MODIFICATION`, `RECONCILIATION_ALREADY_CONSOLIDATED` e demais transições documentadas.

### Fluxo de retomada

O deep link `/app/projects/:projectId/inventory/sessions/:sessionId` dispara sessão e rodadas pela API. Após F5 ou nova aba, `current_round_id` seleciona a rodada oficial e as observações são carregadas sem `location.state`, `Math.max(...)` ou memória de navegação. O E2E comprova reinventário, refresh, recuperação da nova rodada e nova observação.

### Lifecycle

Sessões `draft` oferecem início e cancelamento; `active` oferece operações enquanto existe rodada atual, cancelamento e finalização somente após o encerramento das rodadas ativas. Sessões `finished`/`cancelled` não oferecem início, observação, reinventário, cancelamento ou nova finalização. O backend continua sendo a fonte de verdade e 409 permanece tratado.

### Evidências

O upload aceita JPEG/JPG/PNG/WebP até 10 MiB, mostra progresso/sucesso/erro e bloqueia reenvio concorrente. Upload depende de `inventory-observations:create`; consulta/download dependem de `inventory-sessions:read`. URLs temporárias permanecem apenas no estado efêmero do drawer e são geradas novamente em cada visualização.

### Histórico de placas

A tabela apresenta data, origem, placa, sessão, rodada e responsável diretamente do response enriquecido. A regra “placa observada não atualiza placa mestre” continua explícita e não foi adicionada mutation de item.

### Conflitos tratados

Foi criado um tradutor único para códigos de domínio. O teste de 409 comprova mensagem amigável para observação duplicada. A chave idempotente é criada antes da primeira tentativa, permanece igual no retry após erro e só é renovada após sucesso.

### Testes adicionados

- Deep link e refresh sem estado anterior do componente.
- Reinventário, recuperação da rodada seguinte e nova montagem.
- Finalização e cancelamento com motivo.
- 409 por código e preservação da `idempotency_key` no retry.
- Upload presigned, PUT mockado, confirmação, listagem e download de evidência.
- Contexto enriquecido do histórico de placas sem N+1.
- Quatro E2E novos para retomada, cadeia com evidência/reinventário, lifecycle e conflito.

### Playwright

- Total: 55.
- Passed: 55.
- Failed: 0.
- Flaky: 0.
- Skipped: 0.
- Não há retries configurados. A execução completa passou em um worker e não usa `waitForTimeout`; locators de drawers são reavaliados após rerender.

### Testes unitários/componentes

- Arquivos: 23.
- Testes: 149.
- Resultado: 149 passed, 0 failed.
- Aviso não bloqueante preexistente: Recharts reporta container 0x0 no JSDOM.

### Build/lint/typecheck

- `npx tsc -b --pretty false`: PASS.
- `npm run lint`: PASS.
- `npm run test`: PASS.
- `npm run build`: PASS.
- Bundle principal: 1.371,29 kB minificado; 381,44 kB gzip.
- Warning: chunk acima de 500 kB. Não foi iniciada otimização ampla de bundle nesta rodada.

### Backend gaps

Os quatro `BACKEND_GAP` anteriores — recuperação de rodadas, lifecycle de sessão, evidências e contexto do histórico de placas — foram resolvidos pelo contrato 016 atual e consumidos pelo frontend. Nenhum novo `BACKEND_GAP` foi identificado nesta rodada.

## 22. Pendências frontend/funcionais

- `REQUIRES_FUNCTIONAL_DEFINITION`: setores (somente `sector_text`, sem CRUD/hierarquia).
- `REQUIRES_FUNCTIONAL_DEFINITION`: catálogo/validação definitiva de documentos dos inventariantes.
- `REQUIRES_FUNCTIONAL_DEFINITION`: categorias de despesa.
- `REQUIRES_FUNCTIONAL_DEFINITION`: formas de pagamento.
- `REQUIRES_FUNCTIONAL_DEFINITION`: aprovação de duplicidades; consolidação permanece bloqueada por contrato.
- Otimização de bundle por route-level splitting permanece recomendação futura, fora do escopo cirúrgico desta rodada.

## 23. Matriz final de prontidão

| Domínio | UI | API | RBAC | Paginação | Testes | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| Auth | Sim | Sim | Sim | N/A | Sim | READY |
| Projetos/unidades | Sim | Sim | Sim | Sim | Sim | READY |
| Inventariantes/vínculos | Sim | Sim | Sim | Sim | Sim | READY |
| Itens/fotos | Sim | Sim | Sim | Sim | Sim | READY |
| Placas/avaliações | Sim | Sim | Sim | Sim | Parcial | PARTIAL |
| Sessões | Sim | Sim | Sim | Sim | Sim | READY |
| Rodadas/reinventário | Sim | Sim | Sim | Sim | Sim | READY |
| Observações | Sim | Sim | Sim | Sim | Sim | READY |
| Evidências | Sim | Sim | Sim | Sim | Sim | READY |
| Importação física | Sim | Sim | Sim | Erros/payloads | Parcial | PARTIAL |
| Conciliação/divergências | Sim | Sim | Sim | Sim | Parcial | PARTIAL |
| Consolidação | Sim | Sim | Sim | N/A | Parcial | PARTIAL |
| Despesas/comprovantes | Sim | Sim | Sim | Sim | Sim | READY |
| Prestação de contas | Sim | Sim | Sim | Sim | Sim | PARTIAL |
| Parcelas | Sim | Sim | Sim | Sim | Parcial | PARTIAL |
| Dashboard | Sim | Sim | Sim | N/A | Sim | PARTIAL |
| Exportações | Sim | Sim | Sim | Sim | Sim | READY |

Rodadas/reinventário agora atendem integralmente o critério de READY: refresh, deep link, rodada oficial via API, reinventário após refresh e testes aprovados. Evidências atendem upload presigned, confirmação, consulta, download autorizado, RBAC, estados de UI e testes.
