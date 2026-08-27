# GAI Backend — Functional and Technical Gap Analysis

Date: 2026-08-26

## 1. Architecture found

NestJS 11 and TypeScript, organized by domain modules with application,
domain, infrastructure/persistence and presentation layers. Persistence uses
TypeORM and MySQL 8 with manual migrations and `synchronize: false` outside
tests. The API uses session bearer authentication, permissions/RBAC,
organization scoping, class-validator DTOs, Swagger decorators, structured
Pino logging, domain audit tables, soft deletion where history requires it,
external object-storage metadata/presigned URLs, and SQLite integration tests.

The legacy audit PDF named in the request was not present in the repository or
the supplied attachments. The supplied functional text was used as the legacy
reference; current specs, migrations, code and tests remained the architectural
source of truth.

## 2. Final functional matrix

| Domain                | Initial state | State after this review                     | Notes                                                                         |
| --------------------- | ------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| Organizations         | implemented   | implemented                                 | tenant root, lifecycle and audit                                              |
| Companies             | implemented   | implemented                                 | organization-scoped                                                           |
| Projects              | implemented   | implemented                                 | company FK, lifecycle and audit                                               |
| Units                 | implemented   | implemented                                 | company units and project links                                               |
| Sectors               | absent        | requires functional definition              | `sector_text` is preserved in field evidence; no duplicate hierarchy invented |
| Field agents          | implemented   | implemented                                 | validated Brazilian contact/document and soft lifecycle                       |
| Field agent × project | implemented   | implemented                                 | active-link uniqueness and history                                            |
| Items / physical base | partial       | implemented for master + field executions   | stable IDs and project/tenant FKs                                             |
| Plates                | partial       | implemented                                 | old/new/accounting values plus source-aware immutable evidence history        |
| Accounting base       | implemented   | implemented                                 | XLSX import, normalized data and row errors                                   |
| Inventory             | partial       | implemented                                 | campaigns, rounds and immutable observations                                  |
| Reinventories         | absent        | implemented                                 | numbered rounds, reason, actor and prior-observation link                     |
| Pending issues        | implemented   | implemented                                 | derived/manual, no project hard-coding                                        |
| Divergences           | partial       | implemented                                 | formal reconciliation statuses and evidence                                   |
| Reconciliation        | partial       | implemented                                 | append-only runs over latest physical evidence and accounting data            |
| Consolidation         | absent        | implemented                                 | immutable decision and evidence snapshot; duplicates block it                 |
| Valuation             | partial       | implemented                                 | append-only manual source/value/date/responsible history                      |
| Remuneration          | implemented   | implemented                                 | `days × daily_rate + additional - discount`, server-calculated                |
| Payments              | implemented   | implemented                                 | controlled transitions and effective payment date                             |
| Expenses              | partial       | implemented for requested operational scope | workflow, agent/project, attachments, accountabilities and installments       |
| Accountabilities      | absent        | implemented                                 | transactional close and server-calculated total                               |
| Installments          | absent        | implemented                                 | deterministic cent allocation preserving exact total                          |
| Documents             | partial       | requires functional definition              | item photos and receipts exist; field-agent document taxonomy is unspecified  |
| Receipts              | implemented   | implemented                                 | external storage metadata and authorized download                             |
| Photos                | implemented   | implemented                                 | item image metadata and signed upload/download                                |
| Imports / errors      | implemented   | implemented                                 | sessions, payloads, files and structured row errors                           |
| Exports               | implemented   | implemented                                 | authenticated asynchronous XLSX jobs                                          |
| Audit                 | implemented   | extended                                    | new inventory and accountability audit tables                                 |
| Dashboard             | partial       | partial                                     | real metrics exist; sector/productivity require reliable new relationships    |
| Field app API         | partial       | implemented for inventory flows             | idempotent observation ingestion and history endpoints                        |

## 3. Implemented in this execution

- Inventory sessions and initial rounds.
- Item-specific reinventory requests with mandatory reason and prior evidence.
- Immutable, idempotent field observations with field-agent assignment checks.
- Source-aware plate history without silently overwriting master values.
- Append-only physical/accounting reconciliation runs, surplus and duplicate
  classification.
- Consolidation snapshots and duplicate blocking.
- Manual valuation history.
- Expense accountabilities, unique expense membership and transactional close.
- Expense installment generation with exact cent preservation.
- Fixed new payment/expense/attachment persistence so auto-generated IDs are
  used instead of explicitly persisting `0`.
- MySQL pessimistic locking with SQLite-compatible test behavior.

## 4. Database

Migrations:

- `1741200000001-create-inventory-operations.ts`
- `1741300000001-create-expense-accountabilities.ts`

New tables:

- `inventory_sessions`, `inventory_rounds`, `inventory_observations`
- `inventory_plate_history`, `inventory_reconciliations`
- `inventory_consolidations`, `asset_valuations`
- `inventory_operation_audit_logs`
- `expense_accountabilities`, `expense_accountability_items`
- `expense_installments`, `expense_accountability_audit_logs`

The migrations add tenant/project indexes, uniqueness for round numbers,
idempotency keys, one consolidation per reconciliation, one accountability per
expense, one installment number per expense, and foreign keys to all master
records and actors.

## 5. New APIs and permissions

| Method   | Route                                                            | Purpose                        | Permission                             |
| -------- | ---------------------------------------------------------------- | ------------------------------ | -------------------------------------- |
| POST/GET | `/projects/:projectId/inventory-sessions`                        | create/list campaign           | `inventory-sessions:create/read`       |
| GET      | `/projects/:projectId/inventory-sessions/:sessionId`             | session detail                 | `inventory-sessions:read`              |
| POST     | `.../:sessionId/start`                                           | start and create initial round | `inventory-sessions:update`            |
| POST     | `.../:sessionId/reinventory`                                     | request historical reinventory | `inventory-rounds:reinventory`         |
| POST     | `.../rounds/:roundId/observations`                               | idempotent field result        | `inventory-observations:create`        |
| POST     | `.../rounds/:roundId/finish`                                     | finish round                   | `inventory-sessions:update`            |
| GET      | `.../:sessionId/observations`                                    | full observation history       | `inventory-sessions:read`              |
| POST/GET | `.../:sessionId/reconciliations`                                 | run/list reconciliation        | `reconciliations:create/read`          |
| POST     | `.../reconciliations/:id/consolidate`                            | immutable decision             | `consolidations:create`                |
| POST/GET | `/projects/:projectId/inventory-items/:itemId/valuations`        | valuation history              | `asset-valuations:create/read`         |
| GET      | `/projects/:projectId/inventory-items/:itemId/plate-history`     | plate evidence                 | `plate-history:read`                   |
| POST/GET | `/projects/:projectId/expense-accountabilities`                  | open/list                      | `expense-accountabilities:create/read` |
| GET      | `.../expense-accountabilities/:id`                               | detail and linked expenses     | `expense-accountabilities:read`        |
| POST     | `.../:id/expenses`                                               | link expense                   | `expense-accountabilities:update`      |
| POST     | `.../:id/close`                                                  | close and calculate total      | `expense-accountabilities:close`       |
| POST     | `/projects/:projectId/expenses/:expenseId/installments/generate` | generate installments          | `expense-installments:create`          |
| GET      | `/projects/:projectId/expenses/:expenseId/installments`          | list installments              | `expense-installments:read`            |

Swagger runtime decorators and OpenAPI contracts are under specs 016 and 017.

## 6. Business and security rules formalized

- Organization is derived from the project and checked against the authenticated
  actor; clients cannot choose the tenant for child resources.
- All nested lookups verify project membership, preventing ID-based cross-project
  access.
- Operational mutations are blocked for inactive/finished/cancelled/archived
  projects.
- Field observations require an active inventoriante/project assignment.
- Mobile retry uses organization-unique idempotency keys; key reuse in another
  context is a conflict.
- Reinventories preserve and link to the previous result.
- Plate observations are normalized and stored as evidence, not copied over the
  master item.
- Reconciliation is versioned by run; earlier runs remain queryable.
- Duplicate evidence blocks consolidation.
- Accountability closure and installment creation are transactional and
  server-calculated.

## 7. Tests and validation

Coverage added at unit, contract and E2E levels for normalization/state rules,
reinventory history, plate evidence, accountability totals and exact installment
allocation. The shared integration application now loads the new modules and
entities.

## 8. Remaining work

### Backend

- Connect dashboard consolidation/productivity metrics to the new operational
  tables.
- Add import processors that materialize physical observations directly from
  every legacy spreadsheet variant; the generic import infrastructure already
  exists.
- Add pagination to the new history endpoints if production volumes require it.

### Frontend

- Consume the new session, reinventory, reconciliation, consolidation,
  accountability and installment contracts. No frontend was changed.

### Field application

- Send a stable `idempotency_key` per observation and retain `prior_observation_id`
  returned by the API. No application code was changed.

### Infrastructure

- Apply the two migrations and rerun the permission seed before rollout.
- Configure production object storage for existing image/receipt modules.
- Review dependency audit findings separately; no automatic breaking upgrade was
  performed.

### Functional definition required

- Decide whether “sector” is an independent hierarchy or a type of existing
  `company_unit`; duplicating the concept was intentionally avoided.
- Define field-agent document types, retention and compliance rules before adding
  another storage owner.
- Define controlled expense categories and payment-method catalogue.
- Define whether accounting/physical duplicate resolution needs four-eyes approval.
- RFID, NFC, barcode and QR are not in current backend specs and remain out of scope.

---

# Segunda rodada de revisão pós-implementação — 2026-08-26

## 1. Resumo executivo

Esta rodada revisou diretamente código, entidades TypeORM, migrations, serviços,
controllers, DTOs, seeds, contratos e testes do `gai-backend`. Os três gaps
técnicos declarados na rodada anterior foram tratados: paginação nas novas
listagens, processamento de importação física e consumo das novas tabelas pelo
dashboard. Também foram corrigidas lacunas de concorrência, histórico de placas,
isolamento entre projetos e validações financeiras.

O backend compila e todas as suítes funcionais passam. Ele **ainda não está pronto
para produção sem ressalvas**, porque o gate global de cobertura falha em branches
e functions, o lint global possui dívida preexistente relevante, as migrations não
puderam ser executadas contra MySQL 8 real neste ambiente e a auditoria online de
dependências foi bloqueada pelo sandbox. Esses pontos não foram reclassificados
como sucesso.

## 2. O que foi corrigido nesta rodada

- Listagens de sessões, observações, reconciliações, valorações,
  histórico de placas, prestações de contas e parcelas agora usam o envelope
  padrão `items`, `page`, `page_size`, `total_items`, `total_pages`, com página 1,
  tamanho padrão 20 e máximo 100.
- Filtros foram adicionados onde têm utilidade operacional: status, rodada, item,
  agente de campo, período da prestação e execução da reconciliação.
- Observações passaram a ter unicidade por rodada/item no banco e tratamento de
  corrida para replay idempotente, além do índice único de idempotência por tenant.
- A numeração de execuções de reconciliação é serializada com lock pessimista da
  sessão no MySQL; execuções anteriores continuam imutáveis e consultáveis.
- Toda placa observada gera histórico, inclusive quando coincide com a placa
  mestre. O valor mestre do item não é sobrescrito pela coleta física.
- A cadeia de reinventário grava `prior_observation_id` e mantém as observações
  anteriores intactas.
- A inclusão de despesa valida tenant, projeto, agente, período da prestação e
  unicidade de vínculo. Não há remoção implícita após o fechamento.
- A geração de parcelas continua em `DECIMAL(15,2)` e distribui centavos de forma
  determinística, preservando exatamente o total.
- Foi implementado o tipo de sessão
  `physical_observations_import`, com parser XLSX, aliases centralizados de
  cabeçalhos em português/inglês, staging em `import_payloads`, erros por linha em
  `import_payload_errors`, processamento parcial, evidência imutável, histórico de
  placa e replay idempotente.
- O endpoint multipart
  `POST /projects/:projectId/import-sessions/:sessionId/physical-observations/import`
  reutiliza a infraestrutura de import sessions/payloads e exige
  `import-payloads:create`.
- O resumo/dashboard passou a consultar sessões, rodadas, observações,
  reconciliações, consolidações e prestações de contas, expondo progresso do
  inventário, rodadas de reinventário, resultado da última reconciliação e totais
  financeiros agregados.
- Os contratos 016 e 017 foram atualizados com paginação, filtros, permissões e
  estados relevantes; o contrato do aplicativo de campo foi formalizado no spec 016.

## 3. Arquitetura, modelo e migrations

As novas responsabilidades continuam separadas nos módulos
`inventory-operations` e `expense-accountabilities`, com integração pontual em
`import-sessions` e `project-dashboard`. Não foi introduzido acesso ao frontend.

As migrations criam as tabelas em ordem compatível com suas FKs e o `down()` as
remove na ordem inversa. Há FKs para organização, projeto, item, agente, usuário,
despesa e entidades operacionais; índices cobrem tenant/projeto, status,
datas, números de rodada e chaves de pesquisa. As restrições importantes incluem:

- uma observação por rodada/item;
- idempotência da observação por organização/chave;
- número de rodada por sessão;
- uma consolidação por reconciliação;
- uma despesa em apenas uma prestação;
- um número de parcela por despesa.

IDs `0` ainda aparecem como sentinela em construtores de domínio legados. Nos
repositórios revisados, eles são omitidos antes da persistência para permitir
`AUTO_INCREMENT`; foi mantida a correção específica de pagamentos, despesas e
anexos. Não foi encontrada migration nova que persista deliberadamente `id = 0`.

Compatibilidade MySQL analisada estaticamente:

- valores monetários usam `DECIMAL(15,2)`, sem `float` para persistência;
- locks pessimistas são ativados somente no driver MySQL, mantendo testes SQLite;
- FKs e índices possuem nomes explícitos e tamanhos compatíveis;
- timestamps e colunas JSON seguem os padrões já usados no projeto;
- migrations possuem testes estruturais de `up`/`down`, ordem, unicidade e escala.

Limitação: Docker está instalado, mas o daemon e `localhost:3306` não estavam
disponíveis. Portanto não houve prova de `migration:run`, `migration:revert` e
reaplicação em MySQL 8 real. Esse é um bloqueio de infraestrutura, não evidência de
compatibilidade executada.

## 4. Regras de negócio e concorrência

### Inventário físico

- Sessão: criada, iniciada, finalizada e protegida contra mutações fora de estado.
- Rodada inicial e reinventários: numeração sequencial, ator/data/motivo auditáveis.
- Observação: exige item do projeto, sessão/rodada ativas e vínculo ativo do agente.
- Replay: a mesma chave no mesmo contexto retorna o registro existente; reutilização
  em outro contexto causa conflito.
- Reinventário: liga cada resultado ao anterior sem sobrescrever histórico.
- Placa: normalização centralizada; observada e anterior são evidência, enquanto a
  placa mestre permanece inalterada.
- Reconciliação: execuções append-only, com classificação de compatível, sobra
  física, sobra contábil e duplicidade.
- Consolidação: snapshot imutável; duplicidade bloqueia consolidação automática e
  a unicidade no banco evita decisão dupla concorrente.
- Valoração: histórico manual, com usuário, data e motivo.

### Prestação de contas e parcelas

- A prestação pertence a organização, projeto e agente coerentes.
- A despesa precisa pertencer ao mesmo tenant/projeto e estar dentro do período.
- A mesma despesa não pode ser vinculada a duas prestações.
- O fechamento é transacional, calcula o total no servidor e impede alterações
  posteriores.
- Não existe endpoint de remoção; a regra atual é vínculo permanente após inclusão.
- Parcelas são únicas por despesa/número e o rateio de centavos conserva o total.

Ponto residual: em corridas de unicidade de consolidação ou vínculo de despesa, o
banco protege a integridade, mas alguns adapters ainda podem propagar erro técnico
do driver em vez de um código de conflito de domínio uniforme. Integridade está
preservada; ergonomia de API permanece parcial.

## 5. Segurança, RBAC, tenant e projeto

As novas rotas usam `SessionAuthGuard`, `PermissionsGuard` e chaves cadastradas no
seed. O tenant é derivado do projeto e do usuário autenticado; recursos filhos não
aceitam organização arbitrária do cliente. Lookups aninhados validam projeto, e os
testes cobrem 401 sem sessão, 403 sem permissão e tentativa de usar despesa de outro
projeto.

Operações críticas gravam ator, timestamps, motivo/evidência e audit logs. Os logs
HTTP continuam com redaction de autorização. Nenhuma credencial foi adicionada.

Risco residual: a revisão manual não substitui SAST/DAST nem a auditoria do grafo de
dependências. `npm audit --json` falhou no sandbox e a tentativa de acesso ao
endpoint público foi rejeitada por poder transmitir a árvore de dependências. A
auditoria deve ser repetida em CI autorizado.

## 6. Paginação e performance

As listagens novas não retornam mais histórico ilimitado. O contrato aplicado é:

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total_items": 0,
  "total_pages": 0
}
```

O limite máximo é 100. A implementação usa `findAndCount` com ordenação estável.
Índices de organização/projeto/status/data reduzem os scans mais comuns. O
dashboard usa contagens agregadas e busca somente a execução de reconciliação mais
recente.

Risco residual: não houve benchmark com volume de produção. O resumo executa
diversas queries independentes por requisição; antes de alto volume, recomenda-se
medir p95 e avaliar agregação/cache, sem pré-otimização especulativa.

## 7. Importação física

O fluxo suportado é: upload XLSX -> aliases centralizados -> payloads staged ->
validação por linha -> observações/histórico/auditoria -> erros por linha -> replay
seguro. Campos podem vir na linha ou como defaults da metadata da import session.
São validados tenant, projeto, item, sessão, rodada, agente e vínculo ativo.

O processamento é parcial: uma linha inválida não invalida linhas válidas. O
reprocessamento não duplica observações porque a chave é derivada de sessão,
payload e linha e também está protegida por unicidade no banco.

Lacunas internas restantes:

- o endpoint atual interpreta o XLSX no processo HTTP; não há worker assíncrono
  específico para arquivos físicos muito grandes;
- `raw_payload_path` usa referência `inline-xlsx://`; armazenamento durável do
  arquivo bruto depende da definição/infraestrutura de object storage;
- apenas XLSX está formalizado para este endpoint; CSV e variantes legadas não
  mapeadas continuam fora do contrato.

## 8. Dashboard e analytics

O resumo por projeto agora inclui:

- itens ativos e itens distintos observados;
- percentual de progresso;
- sessões, rodadas, reinventários e observações;
- número da última reconciliação e contagens por classificação;
- itens consolidados;
- prestações abertas/fechadas e valor fechado, quando financeiro é solicitado.

O E2E confirma que esses valores mudam após observações/reinventários. O endpoint
de analytics legado ainda calcula parte da produtividade com base no modelo
anterior e não possui dimensão formal de setor; por isso dashboard/analytics é
classificado como `PARCIAL`, apesar do resumo novo estar conectado.

## 9. Contrato do aplicativo de campo

O cliente deve enviar `inventory_item_id`, `idempotency_key`, resultado,
`field_agent_id` e `captured_at`; placa, série, setor, localização, notas e evidência
são opcionais. O cliente deve gerar uma chave estável antes da primeira tentativa e
reutilizá-la até receber resposta conclusiva.

No retry com o mesmo contexto, a API retorna a observação existente. Chave repetida
em rodada/item/agente diferente retorna conflito. Reinventário usa o mesmo endpoint
na nova rodada; a API devolve `prior_observation_id`. A coleta nunca deve interpretar
placa observada como atualização automática do cadastro mestre.

## 10. Decisões funcionais ainda necessárias

| Tema                      | O que já existe                                                    | O que falta                                            | Alternativas                                              | Recomendação                                                                                            |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Setores                   | `company_units` e `sector_text` na observação                      | taxonomia, hierarquia e vínculo canônico               | setor como tipo de unidade; entidade própria; texto livre | manter texto como evidência e estender `company_units` somente após a regra de hierarquia ser aprovada  |
| Documentos de agentes     | metadata do agente e storage genérico para imagens/anexos/arquivos | tipos, validade, retenção, sigilo e permissões         | owner genérico; módulo próprio                            | definir a matriz documental/compliance e então reutilizar o storage genérico                            |
| Categorias de despesa     | despesa, motivo/metadata e prestação                               | catálogo permitido, escopo e vigência                  | enum fixo; catálogo global; catálogo por organização      | catálogo por organização com desativação e histórico                                                    |
| Formas de pagamento       | pagamentos e despesas existentes                                   | catálogo, campos obrigatórios e conciliação            | enum; catálogo administrável                              | catálogo por organização, separado de categoria                                                         |
| Aprovação de duplicidades | bloqueio de consolidação duplicada                                 | papéis, alçadas, segunda aprovação e trilha de decisão | bloqueio manual externo; four-eyes interno                | manter bloqueado até a especificação; depois criar entidade de decisão explícita, sem inferir aprovação |

## 11. Validação executada

| Verificação                                | Resultado                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `npm run build`                            | passou                                                                                       |
| `npm test -- --runInBand --silent`         | 88 suítes, 356 testes, todos passaram                                                        |
| `npm run test:e2e -- --runInBand --silent` | 29 suítes, 97 testes, todos passaram                                                         |
| `npm run test:cov -- --runInBand --silent` | testes passaram; gate falhou                                                                 |
| Cobertura                                  | statements 84,28%; branches 65,68%; functions 77,42%; lines 84,56%                           |
| Limite configurado                         | 80% para statements, branches, functions e lines                                             |
| Lint global sem autofix                    | falhou: 1.420 ocorrências (1.118 errors, 302 warnings), majoritariamente dívida preexistente |
| `git diff --check -- gai-backend`          | passou; somente avisos de conversão LF/CRLF                                                  |
| OpenAPI 016/017                            | YAML parseado/formatado e testes de contrato passaram                                        |
| Migrations SQLite/test doubles             | passaram em unit/integration/E2E                                                             |
| Migrations MySQL 8 real                    | não executadas: daemon/porta indisponíveis                                                   |
| `npm audit --json`                         | inconclusivo: rede bloqueada e escalonamento rejeitado pelo sandbox                          |

## 12. Matriz de prontidão

`READY` exige implementação, migration válida quando aplicável, validação, RBAC,
isolamento, testes e OpenAPI suficientes. `PARCIAL` indica exatamente o item faltante.

| Domínio                   | Backend | Frontend pode integrar | Justificativa / pendência                                         |
| ------------------------- | ------- | ---------------------- | ----------------------------------------------------------------- |
| Projects                  | READY   | READY                  | contrato e testes existentes                                      |
| Units                     | READY   | READY                  | CRUD/escopo existentes; não equivale ainda a setor formal         |
| Field Agents              | READY   | READY                  | CRUD, status, RBAC e tenant cobertos                              |
| Field Agent Project Links | READY   | READY                  | vínculo ativo e isolamento cobertos                               |
| Inventory Items           | READY   | READY                  | cadastro mestre preservado e contratos existentes                 |
| Plates                    | READY   | READY                  | histórico paginado, normalização e mestre imutável                |
| Inventory Sessions        | PARCIAL | READY                  | falta execução da migration em MySQL real                         |
| Rounds                    | PARCIAL | READY                  | falta execução da migration em MySQL real                         |
| Reinventory               | PARCIAL | READY                  | cadeia testada; falta validação MySQL concorrente real            |
| Observations              | PARCIAL | READY                  | idempotência testada; falta stress concorrente em MySQL           |
| Pending Issues            | READY   | READY                  | módulo legado continua coberto                                    |
| Accounting Items          | READY   | READY                  | importação/consulta existentes                                    |
| Reconciliation            | PARCIAL | READY                  | lock implementado; falta prova concorrente MySQL                  |
| Consolidation             | PARCIAL | READY                  | integridade garantida; erro concorrente pode não ser uniforme     |
| Valuation                 | PARCIAL | READY                  | histórico/contrato prontos; falta MySQL real                      |
| Remuneration              | READY   | READY                  | fluxo anterior preservado                                         |
| Payments                  | READY   | READY                  | persistência de IDs corrigida e testes existentes                 |
| Expenses                  | PARCIAL | READY                  | fluxo pronto; catálogo funcional de categoria/forma pendente      |
| Accountabilities          | PARCIAL | READY                  | regras e paginação prontas; falta MySQL real                      |
| Installments              | PARCIAL | READY                  | centavos testados; falta MySQL real e maior cobertura de branches |
| Receipts                  | READY   | READY                  | storage e isolamento existentes                                   |
| Photos                    | READY   | READY                  | storage e isolamento existentes                                   |
| Imports                   | PARCIAL | PARCIAL                | físico funciona; arquivo bruto durável/worker/variantes pendentes |
| Exports                   | READY   | READY                  | fluxo anterior preservado                                         |
| Dashboard                 | PARCIAL | READY                  | resumo novo funciona; analytics/setor e benchmark pendentes       |

## 13. Gaps internos do backend ainda abertos

1. Elevar branches de 65,68% e functions de 77,42% até o gate de 80%.
2. Resolver a dívida de lint global ou estabelecer baseline incremental aprovado.
3. Executar e reverter migrations em MySQL 8 limpo e em snapshot representativo.
4. Adicionar teste concorrente real para observação, reconciliação, consolidação e
   vínculo de despesa.
5. Traduzir violações únicas concorrentes restantes para conflitos de domínio
   estáveis.
6. Completar schemas de resposta/examples do OpenAPI de importação física e alinhar
   o documento agregado de APIs, se ele for a fonte publicada.
7. Definir processamento assíncrono e retenção do XLSX bruto para grandes cargas.
8. Medir dashboard com volume e completar analytics usando as novas tabelas.

## 14. Gaps externos ao backend

- decisão funcional para setores, documentos, categorias, formas de pagamento e
  aprovação de duplicidades;
- MySQL 8/Docker ou banco de homologação disponível;
- object storage e política de retenção para arquivo bruto;
- CI autorizado a consultar advisories de dependências;
- implementação/integração no frontend e no aplicativo de campo;
- plano de rollout do seed de permissões e migrations.

## 15. Recomendações finais priorizadas

1. Antes do merge/release: executar MySQL 8 `up -> down -> up`, seed de permissões,
   teste concorrente e `npm audit` em CI autorizado.
2. Antes de declarar o backend pronto: levar branches/functions a 80% e zerar ou
   aprovar formalmente o baseline de lint.
3. Publicar os contratos 016/017 e o contrato mobile; integrar o frontend sem
   atualizar placa mestre a partir de evidência física.
4. Para importações grandes: mover parsing/processamento para worker, persistir o
   arquivo bruto no object storage e manter o mesmo modelo de staging/idempotência.
5. Após definições de negócio: modelar catálogos e workflow de duplicidade como
   entidades explícitas, evitando enums/regras inferidos sem aprovação.

---

# Rodada cirúrgica de integração do inventário — 2026-08-26

## Gaps confirmados

A validação foi limitada aos `BACKEND_GAP` do relatório do frontend e confrontou
controller, service, repositórios TypeORM usados pelo service, entities, DTOs,
migrations, permissions, OpenAPI e testes. Não foi feita uma nova auditoria geral.

| Gap                             | Classificação anterior | Evidência encontrada                                                            |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Recuperação de rodadas          | CONFIRMADO             | rodada persistida, mas sem GET e sem referência ativa no detalhe                |
| Lifecycle de sessão             | CONFIRMADO             | enum possuía `finished/cancelled`, sem ações explícitas                         |
| Evidências da observação        | CONFIRMADO             | observação era somente textual; storage presigned existia em outros módulos     |
| Contexto do histórico de placas | CONFIRMADO             | mapper retornava `observation_id` sem sessão/rodada                             |
| Conflitos concorrentes          | PARCIAL                | replay idempotente existia; algumas constraints ainda podiam vazar erro técnico |

## Alterações realizadas

- endpoint paginado de rodadas, com filtros `status` e `type`, ordenado por
  `round_number` decrescente;
- `current_round_id` no detalhe da sessão, definido como a rodada ativa de maior
  número;
- lifecycle explícito `draft -> active -> finished` e
  `draft|active -> cancelled`;
- finish bloqueado enquanto houver rodada ativa; cancel exige motivo, cancela
  rodadas ativas e mantém todo o histórico;
- evidência append-only com metadata no MySQL e binário em object storage por URL
  presigned;
- histórico de placas enriquecido por joins, sem N+1 e sem alterar placa mestre;
- tradução de corridas previsíveis de observação, idempotência, número de rodada e
  consolidação para 409 com códigos estáveis.

## Endpoints novos/alterados

| Método | Endpoint                                                     | Permission                      |
| ------ | ------------------------------------------------------------ | ------------------------------- |
| GET    | `/projects/:projectId/inventory-sessions/:sessionId`         | `inventory-sessions:read`       |
| GET    | `/projects/:projectId/inventory-sessions/:sessionId/rounds`  | `inventory-sessions:read`       |
| POST   | `/projects/:projectId/inventory-sessions/:sessionId/finish`  | `inventory-sessions:update`     |
| POST   | `/projects/:projectId/inventory-sessions/:sessionId/cancel`  | `inventory-sessions:update`     |
| POST   | `.../observations/:observationId/evidence/upload-url`        | `inventory-observations:create` |
| POST   | `.../evidence/:evidenceId/confirm-upload`                    | `inventory-observations:create` |
| GET    | `.../observations/:observationId/evidence`                   | `inventory-sessions:read`       |
| POST   | `.../evidence/:evidenceId/download-url`                      | `inventory-sessions:read`       |
| GET    | `/projects/:projectId/inventory-items/:itemId/plate-history` | `plate-history:read`            |

O detalhe de sessão apenas adiciona `current_round_id`; nenhum campo existente foi
removido ou renomeado. Rodadas continuam expondo `kind` para compatibilidade e
também expõem `type`, além de `created_at` e `created_by_id`.

## Migrations

`1741400000001-close-inventory-operation-gaps.ts` é incremental. Ela adiciona
`cancelled_at` e `cancellation_reason` a `inventory_sessions` e cria
`inventory_observation_evidence` com FKs para organization, project, session,
round, observation e user, índices de escopo/paginação e storage key única. O
`down()` remove primeiro a tabela e depois as colunas.

MySQL 8 não estava disponível: não havia listener em `localhost:3306` e o daemon
Docker não estava iniciado. Portanto a migration foi validada estruturalmente e
via SQLite/test doubles, mas **não** foi marcada como executada em MySQL.

## Permissions

Nenhuma permission nova foi necessária. Controller, seed existente, spec 016 e
testes usam as chaves semânticas já cadastradas:
`inventory-sessions:read`, `inventory-sessions:update`,
`inventory-observations:create` e `plate-history:read`.

## Regras de lifecycle

- `draft -> active`: `start`, criando a rodada inicial;
- `active -> finished`: `finish`, somente com zero rodadas ativas;
- `draft|active -> cancelled`: `cancel` com `reason` obrigatório;
- cancelamento ativo transforma rodadas ativas em `cancelled` na mesma transação;
- sessões `finished/cancelled` não podem iniciar, receber observações,
  reinventários nem novas evidências;
- listagem e download de evidências históricas continuam permitidos após o
  fechamento;
- auditoria de finish/cancel registra ator, timestamp implícito do log, status
  anterior/novo, projeto, sessão e motivo quando aplicável.

## Evidências

O fluxo reutiliza `ConfiguredStorageSignerService` e
`InventoryItemImageScopeService`. Tipos aceitos: JPEG/JPG, PNG e WebP. O limite
padrão reutilizado é 10 MiB e o TTL padrão é 300 segundos, ambos configuráveis.
O banco guarda provider, bucket, `storage_key`, nome original, MIME, tamanho,
checksum, status, ator e timestamps; não guarda base64 nem binário.

O fluxo é `upload-url -> PUT direto no storage -> confirm-upload`. Somente status
`uploaded` recebe `download-url`. Toda ação resolve e valida organization, project,
session, round, observation e evidence; conhecer um ID isolado não concede acesso.
Não existe update ou delete de evidência nesta rodada.

## Histórico de placas

Cada linha agora inclui, quando a origem possui observação, `session_id`,
`round_id`, `round_number`, `captured_at` e `field_agent_id`. Os campos são
resolvidos em uma query com left joins; origens sem observação permanecem válidas
com contexto nulo. A semântica permanece: placa observada é evidência e nunca
sobrescreve `old_plate/new_plate` do item mestre.

## Conflitos 409

- `OBSERVATION_ALREADY_RECORDED`: mesma rodada/item;
- `IDEMPOTENCY_KEY_REUSED`: mesma chave em outro contexto;
- replay da mesma chave/contexto continua retornando a observação original;
- `INVENTORY_ROUND_CONCURRENT_MODIFICATION`: disputa por número de rodada;
- `RECONCILIATION_ALREADY_CONSOLIDATED`: consolidação concorrente/duplicada;
- `INVENTORY_SESSION_HAS_ACTIVE_ROUNDS`: finish prematuro;
- `INVENTORY_SESSION_STATUS_INVALID` e `INVENTORY_SESSION_NOT_ACTIVE`: transições
  e mutações incompatíveis.

## Testes

O novo E2E cobre criação/início, refresh lógico, recuperação de rodada ativa,
observação, evidência, reinventário, novo refresh, `prior_observation_id`, histórico
de placas, finish/cancel, transições inválidas, 401, 403, outro tenant, outro
projeto, recurso inexistente e evidência após sessão finalizada. Unit tests cobrem
as policies de lifecycle; teste de migration cobre `up`, `down`, índices e FKs.

Validação final executada nesta rodada:

| Gate                                      | Resultado                                                           |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Build                                     | aprovado                                                            |
| Lint incremental dos arquivos alterados   | aprovado                                                            |
| Testes unitários/integração/contrato      | 89 suítes e 363 testes aprovados                                    |
| E2E completo                              | 30 suítes e 100 testes aprovados                                    |
| Cobertura                                 | statements 84,61%; branches 65,97%; functions 78,22%; lines 84,96%  |
| Threshold global de cobertura             | não aprovado: branches e functions abaixo dos 80% configurados      |
| Migration e stress concorrente em MySQL 8 | não executados: daemon Docker e listener local `3306` indisponíveis |

O código 1 do comando de cobertura decorre exclusivamente dos thresholds de
branches/functions; as 89 suítes e os 363 testes executados com instrumentação
foram aprovados.

## OpenAPI

O spec 016 foi elevado para versão 1.2.0 e descreve os endpoints, schemas,
paginação, filtros, permissions, status codes, conflitos, exemplos de storage e
campos enriquecidos. O teste de contrato verifica também retomada, lifecycle,
storage autorizado e códigos concorrentes.

## Compatibilidade frontend e contrato mobile

O frontend atual não foi alterado. A mudança é backward-compatible: ele pode ler
`current_round_id` no detalhe e/ou listar `rounds?status=active`. Após restart, o
cliente não precisa inferir rodada por observações. Para reinventário, recupera a
rodada ativa de maior número, envia a observação normalmente e recebe a cadeia
`prior_observation_id` calculada pelo servidor.

## Pendências restantes

- executar `up -> down -> up` da migration em MySQL 8 quando o serviço estiver
  disponível;
- executar stress concorrente real em MySQL para confirmar locks e traduções sob
  disputa simultânea;
- integrar no frontend os novos contratos; nenhuma alteração de UI foi autorizada
  nesta rodada.

## Matriz final

| Gap                             | Estado anterior | Implementação                           | Testes                 | OpenAPI | Estado final |
| ------------------------------- | --------------- | --------------------------------------- | ---------------------- | ------- | ------------ |
| Recuperação de rodadas          | CONFIRMADO      | GET paginado + `current_round_id`       | unit/E2E/contract      | 1.2.0   | READY        |
| Lifecycle de sessão             | CONFIRMADO      | finish/cancel transacionais e auditados | unit/E2E/migration     | 1.2.0   | PARTIAL      |
| Evidências                      | CONFIRMADO      | presigned append-only e autorizada      | E2E/migration/contract | 1.2.0   | PARTIAL      |
| Contexto do histórico de placas | CONFIRMADO      | joins com sessão/rodada/agente          | E2E                    | 1.2.0   | READY        |
| Conflitos concorrentes          | PARCIAL         | tradução estável para 409               | unit/E2E               | 1.2.0   | PARTIAL      |

Os itens `PARTIAL` têm código, testes SQLite e contrato concluídos; a única prova
faltante é migration/stress concorrente em MySQL 8 real, indisponível nesta
execução. Não há gap funcional conhecido nesses fluxos fora dessa validação.
