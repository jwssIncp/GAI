# Matriz de compatibilidade: Investor → GAI

Todas as rotas novas abaixo levam o prefixo `/api/v1` ([main.ts:13](../../gai-backend/src/main.ts#L13)). Todas exigem `Authorization: Bearer <access_token>`, validado pelo `SessionAuthGuard`, e as permissões são checadas pelo `PermissionsGuard`, salvo indicação em contrário. Os caminhos de código abaixo são relativos a `gai-backend/src/`.

**Legenda das ações:**
- **A**: reutilizar como está.
- **B**: adaptar o app.
- **C**: adaptar o backend.
- **D**: criar endpoint.
- **E**: camada de compatibilidade mobile.

**Perfil de campo:** indica se o perfil padrão do inventariante (`FIELD_AGENT_ORG_*`) tem a permissão exigida. Esse perfil tem só `projects:read`, `inventory-items:read`, `inventory-sessions:read` e `inventory-observations:create` ([field-agent-management.service.ts:40-45](../../gai-backend/src/modules/field-agents/application/services/field-agent-management.service.ts#L40-L45)).

## Matriz

| # | Funcionalidade | Rota legado | Rota novo GAI | Método novo | Status | Autenticação | Permissões (perfil de campo tem?) | Ação recomendada |
|---|---|---|---|---|---|---|---|---|
| 1 | Login | POST /auth/login | /auth/login | POST | IMPLEMENTADA COM ADAPTAÇÕES | Pública + throttling 10/min | — | B (+C: incluir projetos autorizados e dados do inventariante na resposta) |
| 2 | Renovação de sessão | POST /auth/refresh | — | — | NÃO IMPLEMENTADA | — | — | D (refresh token rotativo) |
| 3 | Listar projetos autorizados | GET /gai/projects | /projects | GET | IMPLEMENTADA COM ADAPTAÇÕES | Bearer | projects:read (sim) | B + C (campos extras do projeto; filtro de vínculo para perfis personalizados) |
| 4 | Criar/editar item com fotos (fila) | POST /gai/sync_items | /projects/:projectId/inventory-items (POST/PATCH) + images/upload-url + PUT S3 + confirm-upload; ou import-sessions/:sessionId/payloads (`operation: upsert`) | POST, PATCH | PARCIALMENTE IMPLEMENTADA | Bearer | inventory-items:create/update, inventory-item-images:create/update ou import-payloads:create (**não**) | D/E (upsert idempotente reaproveitando `applyItem`) + C (chave única, fotos vinculadas) |
| 5 | Atualizar itens já enviados | POST /gai/update_items | /projects/:projectId/inventory-items | GET | PARCIALMENTE IMPLEMENTADA | Bearer | inventory-items:read (sim) | D (consulta em lote por `external_item_id` ou sync incremental) |
| 6 | Excluir item | POST /gai/item/delete | /projects/:projectId/inventory-items/:id/deactivate; ou payload com `operation: delete` | POST | PARCIALMENTE IMPLEMENTADA | Bearer | inventory-items:deactivate ou import-payloads:create (**não**) | C + E (exclusão por `external_item_id`, idempotente, na fila) |
| 7 | Checar duplicidade de placa | POST /gai/projects/{id}/check_duplicate | /projects/:projectId/inventory-items?new_plate=X (ou ?old_plate=X) | GET | IMPLEMENTADA COM ADAPTAÇÕES | Bearer | inventory-items:read (sim) | B (usar `total_items > 0` e filtrar status ≠ inactive/removed); E opcional |
| 8 | Pendências (placas faltantes e duplicadas) | POST /gai/projects/pendencias | — (o módulo `pending-issues` é outra funcionalidade) | — | NÃO IMPLEMENTADA | — | inventory-pending-issues:* (**não**) | D (cálculo somente leitura) |
| 9 | Despesa com foto da nota | POST /gai/projects/financeiro | /projects/:projectId/expenses + attachments/upload-url + PUT S3 + confirm-upload | POST | IMPLEMENTADA COM ADAPTAÇÕES | Bearer | expenses:create, expenses:upload-attachment (**não**) | B + C (permissão de campo; `field_agent_id` derivado do usuário) |
| 10 | Criar item (rota antiga) | POST /gai/item/create | /projects/:projectId/inventory-items | POST | IMPLEMENTADA COM ADAPTAÇÕES | Bearer | inventory-items:create (**não**) | Não migrar (o 1.4.6 não usa; ver nota 1) |
| 11 | Editar item (rota antiga) | POST /gai/item/update | /projects/:projectId/inventory-items/:id | PATCH | IMPLEMENTADA COM ADAPTAÇÕES | Bearer | inventory-items:update (**não**) | Não migrar (nota 1) |
| 12 | Criar sessão de importação | POST /gai/items/import-sessions | /projects/:projectId/import-sessions | POST | IMPLEMENTADA COM ADAPTAÇÕES | Bearer | import-sessions:create (**não**) | B + C (TTL, unidade) |
| 13 | Presign de imagens | POST …/{uuid}/images/presign | /projects/:projectId/import-sessions/:sessionId/files/upload-url (um arquivo por chamada) + …/files/:fileId/confirm-upload | POST | IMPLEMENTADA COM ADAPTAÇÕES | Bearer | import-files:create (**não**) | B (presign sob demanda, confirmar dentro do TTL) |
| 14 | Envio dos bytes | PUT {upload_url} | {upload_url} (S3, fora do Nest) | PUT | NÃO VERIFICADA | Assinatura S3 (sem Bearer) | — | B (headers exatos) + homologar |
| 15 | Enviar payloads | POST …/{uuid}/payloads | /projects/:projectId/import-sessions/:sessionId/payloads | POST | PARCIALMENTE IMPLEMENTADA | Bearer | import-payloads:create (**não**) | C (falhas, checksum, fotos, chave única) + B (nomes de campo) |
| 16 | Finalizar sessão | POST …/{uuid}/finish | /projects/:projectId/import-sessions/:sessionId/finish | POST | PARCIALMENTE IMPLEMENTADA | Bearer | import-sessions:finish (**não**) | C (transições e status final) |
| 17 | Consultar processamento | GET …/{uuid} | /projects/:projectId/import-sessions/by-uuid/:sessionUuid ou /:sessionId | GET | IMPLEMENTADA COM ADAPTAÇÕES | Bearer | import-sessions:read (**não**) | B (mapear status e contadores) |
| 18 | Consultar erros | GET …/{uuid}/errors | /projects/:projectId/import-sessions/:sessionId/errors | GET | IMPLEMENTADA COM ADAPTAÇÕES | Bearer | import-errors:read (**não**) | B (+C: devolver `payload_number`) |
| 19 | Backup da sessão | POST /gai/import-sessions/{uuid}/backup | …/files/upload-url (`type: raw_backup`) + PUT S3 + confirm-upload | POST | IMPLEMENTADA COM ADAPTAÇÕES | Bearer | import-files:create (**não**) | B + C (limite de tamanho e TTL na AWS) |
| 20 | Baixar itens para reconciliação | GET /external/projects/{id}/items/sync | — (só a listagem paginada por offset) | — | NÃO IMPLEMENTADA | — | — | D (sync incremental com cursor) |

**Nota 1.** Trocar a base URL já exige publicar uma nova versão do app. Versões antigas continuam apontando para o Laravel. Manter `item/create` e `item/update` no GAI não traz compatibilidade nenhuma; elas só seriam necessárias se o domínio `investorcp.com/si/api` fosse redirecionado ao GAI, e isso não é recomendado.

## Justificativa e evidências por linha

### 1. Login: COM ADAPTAÇÕES
- **Rota:** `AuthController.login` em [auth.controller.ts:90-104](../../gai-backend/src/modules/auth/presentation/auth.controller.ts#L90-L104). É pública, com throttling de 10/min (:92).
- **Corpo:** `{identifier, password}` ([login.dto.ts:4-20](../../gai-backend/src/modules/auth/application/dto/login.dto.ts#L4-L20)). O legado manda `email`. Com `forbidNonWhitelisted` ([main.ts:21-27](../../gai-backend/src/main.ts#L21-L27)), o campo `email` gera **400**. O `identifier` aceita e-mail ou login ([credential-transactions.service.ts:94-101](../../gai-backend/src/modules/auth/application/services/credential-transactions.service.ts#L94-L101)).
- **Resposta:** `{access_token, expires_at, user}` ([login-response.dto.ts:64-73](../../gai-backend/src/modules/auth/application/dto/login-response.dto.ts#L64-L73); [login.use-case.ts:30-42](../../gai-backend/src/modules/auth/application/use-cases/login.use-case.ts#L30-L42)). O legado lê `token`, `token_type`, `expires_in`, `user.name` e `user.projects`.
  - O `access_token` é um UUID de sessão, **não um JWT**. O app não consegue ler `exp`; precisa usar `expires_at`.
  - O nome vem em `user.full_name`.
  - **Não existe** `user.projects`. Os projetos vêm do `GET /projects`.
  - **Não existe** o id do inventariante (`field_agent_id`) em nenhuma resposta acessível ao perfil de campo.

### 2. Refresh: NÃO IMPLEMENTADA
- Não há rota `refresh` no `AuthController`, que só tem activation, password/change, login, logout, me e password-reset.
- A sessão é deslizante: cada requisição autenticada adia `expires_at` para agora + `SESSION_TTL_HOURS`, que é 8 por padrão ([session-auth.guard.ts:146-153](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts#L146-L153); [auth.config.ts:10](../../gai-backend/src/common/config/auth.config.ts#L10)).
- Sessão vencida ou revogada não é aceita ([typeorm-session.repository.ts:26-34](../../gai-backend/src/modules/auth/infrastructure/persistence/typeorm-session.repository.ts#L26-L34)). Por isso o comportamento do legado (renovar com o token vencido) **não é possível**, e não deve ser reproduzido.

### 3. Projetos: COM ADAPTAÇÕES
- **Rota:** [projects.controller.ts:90-102](../../gai-backend/src/modules/projects/presentation/projects.controller.ts#L90-L102).
- **Filtro no backend:**
  - A organização vem do servidor ([project-scope.service.ts](../../gai-backend/src/modules/projects/application/services/project-scope.service.ts)).
  - Para o perfil de campo, `allowedProjectIds` reúne os projetos com vínculo ativo e vigente e o inventariante ativo ([session-auth.guard.ts:159-209](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts#L159-L209)).
  - Lista vazia resulta em `1=0`, ou seja, nenhum projeto ([typeorm-project.repository.ts:77-82](../../gai-backend/src/modules/projects/infrastructure/persistence/typeorm-project.repository.ts#L77-L82)).
- **Diferenças de contrato:**
  - A resposta é paginada (`{items, page, page_size, total_items, total_pages, status_counts}`, com `page_size` até 100), não um array.
  - Os campos são `name` e `description`, no lugar de `nome` e `descricao`.
  - **Não existe `extra_fields`.** Há `settings` e `metadata` JSON livres, mas não verifiquei se guardam a lista de campos extras.
- **Limite do filtro:** usuários sem o perfil `FIELD_AGENT_ORG_*` (perfis personalizados) veem todos os projetos da organização.

### 4. sync_items: PARCIAL
Há dois caminhos possíveis, e nenhum atende sozinho.

**(a) CRUD de itens** ([inventory-items.controller.ts:69-147](../../gai-backend/src/modules/inventory-items/presentation/inventory-items.controller.ts#L69-L147)):
- **Sem idempotência:** o `CreateInventoryItemUseCase` sempre insere ([create-inventory-item.use-case.ts:57-101](../../gai-backend/src/modules/inventory-items/application/use-cases/create-inventory-item.use-case.ts#L57-L101)).
- **Fotos em 3 etapas** (upload-url, PUT, confirm), no máximo 3 por item e só JPEG, PNG ou WEBP ([inventory-item-image-scope.service.ts:17-22, 89-105](../../gai-backend/src/modules/inventory-item-images/application/services/inventory-item-image-scope.service.ts#L17-L22)).

**(b) Payload de importação com `operation: upsert`:**
- É idempotente por `external_item_id` ([import-sessions.service.ts:885-951](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L885-L951)).
- Não tem chave única nem lock ([migration 1740000000001:12,41](../../gai-backend/src/migrations/1740000000001-create-inventory-items.ts#L12)), então chamadas em paralelo podem duplicar.
- As fotos ficam só em `metadata.import_images` (:990).
- O log de auditoria guarda apenas `row_number` (:937-946).

**Em ambos os caminhos:**
- O perfil de campo não tem as permissões necessárias.
- Não existe `placa_antiga_2`; a entity só tem `old_plate` e `new_plate`.
- Placas são normalizadas para `[A-Z0-9]`, o que remove hífens e espaços ([inventory-item-scope.service.ts:67-80](../../gai-backend/src/modules/inventory-items/application/services/inventory-item-scope.service.ts#L67-L80)).

### 5. update_items: PARCIAL
- A listagem filtra por `status`, placas, `description` e `search`, com `page_size` até 100 e ordem fixa `created_at DESC` ([list-inventory-items-query.dto.ts](../../gai-backend/src/modules/inventory-items/application/dto/list-inventory-items-query.dto.ts); [typeorm-inventory-item.repository.ts:32-65](../../gai-backend/src/modules/inventory-items/infrastructure/persistence/typeorm-inventory-item.repository.ts#L32-L65)).
- **Não há filtro por `external_item_id`** nem consulta em lote.
- O `gai_user` (nome) vira `created_by_id` (número).
- **Não há URL de foto.** Cada foto exige um `POST …/download-url` com TTL de 300 s, e o perfil de campo não tem `inventory-item-images:*`.

### 6. Exclusão: PARCIAL
- O `deactivate` faz exclusão lógica (`status=inactive`, `deleted_at`) e grava auditoria. Porém usa o id interno, e o app só conhece o `external_item_id`.
- O payload com `operation: delete` aceita o `external_item_id` e marca `REMOVED` (:922-927). **Não é idempotente:** reenviar depois de apagado atualiza de novo, e um delete de item inexistente vira erro.
- Um upsert tardio sobre item removido atualiza os campos sem reativar o item; se trouxer `status`, muda o status e mantém `deleted_at` (:988).

### 7. check_duplicate: COM ADAPTAÇÕES
- `GET …/inventory-items?new_plate=X` faz busca exata com a placa normalizada ([typeorm-inventory-item.repository.ts:47-52](../../gai-backend/src/modules/inventory-items/infrastructure/persistence/typeorm-inventory-item.repository.ts#L47-L52)). O perfil de campo tem `inventory-items:read`.
- Não devolve booleano: o app usa `total_items > 0`.
- A listagem inclui itens desativados (`withDeleted`, :32). O app precisa desconsiderá-los, ou o backend precisa de um filtro para isso.

### 8. Pendências: NÃO IMPLEMENTADA
- O `generate` ([inventory-pending-issues.service.ts:222-333](../../gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issues.service.ts#L222-L333)) **grava** issues e devolve `{created, skipped}`. Ele não calcula faixas de placas faltantes.
- Placas repetidas são juntadas num `Set` (:246-247), então nenhuma duplicata é detectada.
- Nenhuma resposta traz os itens envolvidos.

### 9. Financeiro: COM ADAPTAÇÕES
- O corpo é JSON ([payments-expenses-inputs.ts:67-97](../../gai-backend/src/modules/payments-expenses/application/dto/payments-expenses-inputs.ts#L67-L97)):
  - `description`;
  - `reason` (equivale a `motivo`);
  - `expense_date` em `YYYY-MM-DD` estrito;
  - `amount` como string decimal com ponto;
  - `field_agent_id` opcional.
- A nota vai por anexo em 3 etapas.
- O perfil de campo não tem `expenses:create`.
- O `field_agent_id` não é amarrado a quem chama ([payments-expenses.service.ts:675-697](../../gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts#L675-L697)).

### 10 e 11. create/update antigos: COM ADAPTAÇÕES
Mesmas rotas do item 4(a). O contrato antigo era multipart com `extra_fields`; no GAI é JSON com `metadata` e fotos à parte.

### 12 a 19. Importação
Controller em [import-sessions.controller.ts:62-360](../../gai-backend/src/modules/import-sessions/presentation/import-sessions.controller.ts#L62).

**12. Criar sessão:**
- `project_id` vai na URL.
- `type` é obrigatório.
- `source` usa a enum `mobile_app|web_admin|api_client|system|migration`, não `investor_app_android`.
- Não há `unidade`.
- O TTL padrão é **24 h**, não 7 dias ([import-session-scope.service.ts:41-43](../../gai-backend/src/modules/import-sessions/application/services/import-session-scope.service.ts#L41-L43)).
- A resposta não usa o envelope `{data}`.

**13. Presign:**
- Um arquivo por chamada, e é preciso informar `size_bytes`.
- Não devolve `headers`.
- A confirmação é obrigatória e precisa ocorrer antes de `criação + TTL` (300 s na AWS) ([storage-object.policy.ts:20-28](../../gai-backend/src/common/storage/storage-object.policy.ts#L20-L28)); caso contrário volta **410**.

**14. PUT no S3:**
- A URL assina `Content-Type` e `Content-Length` ([s3-storage-adapter.service.ts:183-207](../../gai-backend/src/common/storage/s3-storage-adapter.service.ts#L183-L207)).
- O bucket, o CORS e o versionamento na AWS não foram verificados.

**15. Payloads:**
- `idempotency_key` e `operation` são obrigatórios. Os nomes de campo são em inglês, e os nomes legados geram 400.
- O checksum é opcional e informado pelo cliente: um reenvio com conteúdo diferente e sem checksum devolve o resultado antigo ([import-sessions.service.ts:994-1019](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L994-L1019)).
- Todo payload termina `processed` (:637), e `failedPayloads` nunca é incrementado (só inicializado em :126).

**16. Finish:**
- Não checa se a sessão já está em estado terminal nem se expirou.
- Sempre resulta em `finished`, porque `failedPayloads` é sempre 0 (:288-317).
- Uma sessão cancelada pode ser finalizada.

**17. Status:**
- Existe `by-uuid`, só para leitura (controller :91-104). As mutações exigem o id numérico.
- Status disponíveis: `open|receiving|processing|finished|failed|cancelled|expired`. **Não existem** `ready`, `completed` nem `completed_with_errors`.
- **Não existem** `success_items`, `failed_items`, `pending_payloads` nem `backup_uploaded`. Os equivalentes são `total_failed` e `raw_backup_path`.

**18. Erros:**
- Resposta paginada `{items:[{id,row_number,item_reference,error_code,error_message,created_at}]}`, sem `payload_number`.

**19. Backup:**
- Não aceita multipart. O caminho é presign + PUT + confirm, com `type=raw_backup`.
- Na AWS, `STORAGE_MAX_SIZE_BYTES` é de **50 MB** ([ecs.tf:72](../../infra/terraform/ecs.tf#L72)), contra até 100 MB no app.
- O TTL de 300 s também vale para a confirmação. Um zip grande em rede lenta não confirma a tempo.

### 20. Sync externo: NÃO IMPLEMENTADA
- Não há `updated_since`, `last_id`, cursor nem controller `external` em `src/modules`.
- A única alternativa é a listagem por offset, com `page_size` até 100 e sem filtro de unidade.
