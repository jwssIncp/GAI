# Matriz de migração: app Investor (Laravel → GAI)

**Origem:** contrato do app Investor 1.4.6+1.12 (levantado do código do app em 04/11/2026). **Destino:** API mobile do GAI, contrato `1.0.0-rc.2` (conferido no código em 10/11/2026; revisão 2 em 10/11/2026: URL oficial na AWS).

- Base legada: `…/si/api`. Base GAI, produção (AWS/CloudFront): `https://d1kanjou9wgm7q.cloudfront.net/api/v1` (omitida abaixo). Desenvolvimento local: `http://localhost:3000/api/v1`.
- Todas as rotas GAI exigem `Authorization: Bearer <access_token>`, exceto login, refresh e logout.
- Detalhes de cada rota: [RELATORIO-API-INVESTOR.md](RELATORIO-API-INVESTOR.md). Implementação no app: [GUIA-MIGRACAO-ANDROID.md](GUIA-MIGRACAO-ANDROID.md).
- **Situação:** todas as rotas GAI listadas estão implementadas e testadas localmente. Em 10/11/2026, as rotas `/mobile/*` ainda **não respondiam** na URL da AWS: devolvem 200 `text/html` do fallback da SPA porque o módulo mobile ainda não foi implantado. A homologação na AWS ainda não foi feita. Ver as observações sobre o ambiente em [RELATORIO-API-INVESTOR.md](RELATORIO-API-INVESTOR.md#ambientes).

## 1. Rotas do documento original

Legenda da coluna Situação: **Preservada** (mesma função, contrato novo) · **Substituída** (novo fluxo) · **Descontinuada** (sem uso; não migrar).

| # | Funcionalidade | Rota antiga | Rota nova | Situação | Mudança necessária no app |
|---|---|---|---|---|---|
| 1 | Login | `POST /auth/login` `{email, password}` | `POST /mobile/auth/login` `{identifier, password, device_label?}` | Preservada | Novo corpo; guardar access + refresh token em armazenamento seguro; token opaco (não decodificar); tratar 401/403/423/429; abrir troca de senha se `must_change_password`. |
| 2 | Renovar sessão | `POST /auth/refresh` (Bearer vencido, sem corpo) | `POST /mobile/auth/refresh` `{refresh_token}` | Preservada | Enviar o refresh token no corpo; um refresh por vez (mutex); trocar os dois tokens; 409 `REFRESH_TOKEN_ALREADY_ROTATED`; 401 → login. |
| 3 | Lista de projetos | `GET /gai/projects` (sem token; filtro por `user.projects` no app) | `GET /mobile/me` → `projects[]` | Substituída | Remover filtro local; projetos vêm filtrados pelo servidor; `nome` → `name`. Não há `extra_fields` por projeto. |
| 4 | Criar/editar item (fila) | `POST /gai/sync_items` (multipart, sem token) | `PUT /mobile/projects/{projectId}/items/{externalId}` (JSON) | Substituída | JSON com nomes novos; id na URL; sem `gai_user`; `base_version` na edição; 201/200 sucesso; 409 conflito; fotos em fluxo separado. |
| 5 | Fotos do item | `image_1…n` no multipart do `sync_items` | `POST …/items/{externalId}/images/upload-url` → `PUT {upload_url}` → `POST …/images/{imageId}/confirm-upload` | Substituída | Upload direto ao storage em 3 passos, depois do item existir; até 3 fotos de até 10 MiB; janela de 300 s. |
| 6 | Atualizar itens enviados | `POST /gai/update_items` (lotes de 200 ids) | `GET /mobile/projects/{projectId}/items/sync?cursor=&limit=` | Substituída | Sincronização incremental por cursor por projeto; inclui excluídos, itens da web e de outros técnicos. |
| 7 | Excluir item | `POST /gai/item/delete` (form, só online, sem nova tentativa) | `DELETE /mobile/projects/{projectId}/items/{externalId}[?base_version=]` | Preservada | Enfileirar também offline; 200 e 404 são sucesso; exclusão lógica. |
| 8 | Duplicidade de placa no cadastro | `POST /gai/projects/{id}/check_duplicate` (multipart `search`) | `GET /mobile/projects/{projectId}/plates/check?plate=&kind=&exclude_external_id=` | Substituída | Ler o booleano JSON `exists` (corrige o defeito do aviso que nunca aparecia); `kind=old` cobre `placa_antiga_2`. |
| 9 | Pendências (faltantes e duplicadas) | `POST /gai/projects/pendencias` `{project_id, itens: []}` | `GET /mobile/projects/{projectId}/plates/report[?from=&to=]` | Substituída | `GET` somente leitura (não grava itens); renomear campos da resposta (tabela 3). |
| 10 | Despesa (nota fiscal) | `POST /gai/projects/financeiro` (multipart) | `POST /mobile/projects/{projectId}/expenses` + `POST …/expenses/{id}/attachments/upload-url` → `PUT` → `POST …/attachments/{attachmentId}/confirm-upload` | Substituída | Exige permissão financeira; data `YYYY-MM-DD`; valor `"120.50"`; `client_expense_id` idempotente; comprovante até 20 MiB em 3 passos. |
| 11 | Criar item (antigo) | `POST /gai/item/create` | — (usar o `PUT` da linha 4) | Descontinuada | Nenhuma: o app não chama desde a 1.4.6. Remover o código morto. |
| 12 | Editar item (antigo) | `POST /gai/item/update` | — (usar o `PUT` da linha 4) | Descontinuada | Idem. |
| 13 | Reconciliação: abrir sessão | `POST /gai/items/import-sessions` `{project_id, unidade, source?, expected_payloads?}` | `POST /mobile/projects/{projectId}/import-sessions` `{unidade?, expected_payloads?, device_label?}` | Preservada | `project_id` na URL; não enviar `source`; resposta sem envelope `data`. |
| 14 | Reconciliação: URLs de fotos | `POST /gai/items/import-sessions/{uuid}/images/presign` (até 100 arquivos) | `POST …/import-sessions/{uuid}/files/upload-url` `{type: "image", …}` (1 arquivo por chamada) | Substituída | Uma chamada por arquivo; guardar `file_id`; não há `client_file_id` nem `path`. |
| 15 | Reconciliação: envio ao storage | `PUT {upload_url}` | `PUT {upload_url}` com `upload_headers` | Preservada | Enviar exatamente `Content-Type` e `Content-Length` devolvidos; sem token. |
| 16 | Reconciliação: confirmar arquivo | — (não existia) | `POST …/import-sessions/{uuid}/files/{fileId}/confirm-upload` | **Nova, obrigatória** | Confirmar cada foto/backup antes de referenciá-lo no lote. |
| 17 | Reconciliação: lote de itens | `POST /gai/items/import-sessions/{uuid}/payloads` | `POST …/import-sessions/{uuid}/payloads` | Preservada | `idempotency_key` obrigatória; `operation` + `external_item_id`; campos com nomes do `PUT`; `sequence` texto; sem `gai_user`; fotos por `file_id`. |
| 18 | Reconciliação: encerrar | `POST /gai/items/import-sessions/{uuid}/finish` | `POST …/import-sessions/{uuid}/finish` | Preservada | Novos status finais (`finished`, `finished_with_errors`, `failed`); tratar 409. |
| 19 | Reconciliação: status | `GET /gai/items/import-sessions/{uuid}` | `GET …/import-sessions/{uuid}` | Preservada | Sem envelope `data`; status renomeados (tabela 4). |
| 20 | Reconciliação: erros | `GET /gai/items/import-sessions/{uuid}/errors` | `GET …/import-sessions/{uuid}/errors?page=&page_size=` | Preservada | Resposta paginada `{items, page, …}`; novos campos `row_number`, `error_code`. |
| 21 | Reconciliação: backup | `POST /gai/import-sessions/{uuid}/backup` (multipart `backup_file`, até 100 MB) | `files/upload-url` `{type: "raw_backup", mime_type: "application/zip"}` → `PUT` → `confirm-upload` | Substituída | 3 passos; até 100 MiB; janela de 1800 s. |
| 22 | Reconciliação: baixar itens | `GET /external/projects/{id}/items/sync?unidade=&limit=&last_id=&updated_since=` (respondia 500) | `GET /mobile/projects/{projectId}/items/sync?cursor=&limit=` | Substituída | Cursor opaco no lugar de `last_id`/`next_last_id`; filtrar unidade localmente; `image` (URLs) → `images` (metadados) + `GET …/images` para URLs. |

Todas as 22 rotas/fluxos do documento original têm correspondência ou justificativa.

## 2. Rotas novas sem equivalente no legado

| Rota GAI | Finalidade |
|---|---|
| `POST /mobile/auth/logout` | Encerrar a sessão do aparelho |
| `GET /mobile/me` | Identidade, inventariante, projetos e permissões |
| `POST /auth/password/change` | Troca obrigatória de senha temporária |
| `GET /mobile/projects/{projectId}/items` | Listagem paginada com filtros (busca on-line) |
| `GET /mobile/projects/{projectId}/items/{externalId}` | Consultar um item (inclusive excluído) |
| `GET /mobile/projects/{projectId}/items/{externalId}/images` | Fotos com URL temporária de visualização |
| `DELETE /mobile/projects/{projectId}/items/{externalId}/images/{imageId}` | Remover foto |
| `GET /mobile/projects/{projectId}/expenses` | Listar as próprias despesas (`expenses:read`) |

Total da API mobile: 27 operações (todas no [openapi.yaml](openapi.yaml)).

## 3. Campos

### 3.1 Item

| Legado | GAI | Observação |
|---|---|---|
| `id` | `externalId` (URL) / `external_item_id` | Sempre texto |
| `gai_user` | — | Vem da sessão; enviar gera 400 |
| `project_id` | URL | — |
| `sequence` (int na reconciliação) | `sequence` | **Texto** até 50 |
| `placa_antiga` / `placa_antiga_2` / `placa_nova` | `old_plate` / `old_plate_2` / `new_plate` | Normalizadas (maiúsculas, `[A-Z0-9]`) |
| `unidade` / `endereco` / `localizacao` / `descricao` | `unit_text` / `address_text` / `location_text` / `description` | — |
| `marca` / `modelo` / `num_serie` / `capacidade` | `brand` / `model` / `serial_number` / `capacity` | — |
| `ano` (texto) | `year` | Inteiro 1900–2100 ou `null` |
| `obs` | `notes` | — |
| `valor_usado` / `valor_novo` | `used_value` / `new_value` | `"150.00"` ou `null` |
| `fonte` | `source` (só leitura) | `mobile_app` |
| `extra_fields` | `extra_fields` | Objeto texto → texto (≤ 100 campos) |
| `image_1..n` / `image` (URLs) | `images` (metadados) | Upload em 3 passos; URL via `GET …/images` |
| — | `version`, `deleted`, `deleted_at`, `status` | Controle de versão e exclusão lógica |

Valores: campo ausente mantém; `null` limpa; `""` limpa textos e placas, mas gera 400 em `year` e valores.

### 3.2 Pendências

| Legado | GAI |
|---|---|
| `placas_faltantes` | `missing_new_plates.ranges` (+ `from`, `to`, `count`) |
| `novas_duplicadas` | `duplicated_new_plates` |
| `antigas_duplicadas` | `duplicated_old_plates` (inclui `old_plate_2`) |
| `itens[].item_id` | `items[].external_item_id` |
| `itens[].gai_user` | `items[].technician.name` |
| `itens[].unidade` / `localizacao` / `descricao` | `unit_text` / `location_text` / `description` |

### 3.3 Despesa

| Legado | GAI |
|---|---|
| `project_id` | URL |
| `gai_user` | — (sessão) |
| `descricao` | `description` |
| `motivo` | `reason` |
| `data` (texto livre) | `expense_date` (`YYYY-MM-DD`) |
| `valor` (texto livre) | `amount` (`"120.50"`) |
| `image` (multipart) | anexo em 3 passos |
| — | `client_expense_id` (obrigatório, idempotência) |

### 3.4 Sessão de reconciliação

| Legado | GAI |
|---|---|
| `{ "data": { ... } }` | sem envelope |
| `ready` | `receiving` |
| `completed` / `completed_with_errors` | `finished` / `finished_with_errors` |
| — | `cancelled`, `expired` |
| `images[{disk, path, sort_order}]` | `images[{file_id}]` |
| `client_file_id` | — |

## 4. Códigos HTTP

| Situação | Legado | GAI |
|---|---|---|
| Sucesso | Só 200 contava | 200, 201, 204 |
| Sem token / vencido | Rotas `/gai` sem token | 401 → refresh |
| Sem permissão / vínculo / acesso | — | 403 (`FORBIDDEN`, `MOBILE_ACCESS_DENIED`, `PASSWORD_CHANGE_REQUIRED`) |
| Conflito de versão, excluído, chave reutilizada | — | 409 (não repetir sem resolver) |
| Upload fora da janela | — | 410 |
| Conta bloqueada | — | 423 |
| Limite de requisições | — | 429 |

## 5. Resumo

| Categoria | Itens |
|---|---|
| **Preservadas** (mesma função, contrato novo) | Login, refresh, exclusão de item, abrir sessão, PUT no storage, lote, encerrar, status e erros da reconciliação |
| **Substituídas por novos fluxos** | Projetos (`/mobile/me`), `sync_items` (PUT), fotos (3 passos), `update_items` e `external/sync` (cursor), `check_duplicate` (`plates/check`), `pendencias` (`plates/report`), `financeiro` (expenses + anexo), `presign` (`files/upload-url`), backup (`raw_backup`) |
| **Descontinuadas** | `item/create`, `item/update` |
| **Novas** | Logout, `/mobile/me`, troca de senha, confirmação de upload, consulta e listagem de itens, fotos com URL, remoção de foto, listagem de despesas |
| **Mudanças obrigatórias no app** | Bearer em todas as rotas; tokens opacos com refresh rotativo; JSON no lugar de multipart; nomes de campos novos; `base_version` e tratamento de 409; fila com exclusão offline; sincronização por cursor; uploads em 3 passos; permissões financeiras; tratamento de 401/403/410/429 |
| **Ainda não implementado no GAI** | Nomes de `extra_fields` por projeto; renomear unidade/localização em lote; upload de logs; reprocessamento de lote pelo app; edição de itens sem `external_item_id` |
