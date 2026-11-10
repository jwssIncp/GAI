# Matriz legado (Laravel `investorcp.com/si/api`) → GAI (`/api/v1`)

Só há rotas **implementadas** na coluna "GAI". As rotas legadas ficam no Laravel e não são replicadas: cada versão do app aponta para uma base só.

## Rotas

| Legado | GAI | Diferenças principais |
|---|---|---|
| `POST /auth/login {email, password}` | `POST /mobile/auth/login {identifier, password, device_label?}` | O token é opaco (não JWT), com access de 15 min e refresh rotativo. Contas sem inventariante ativo recebem 403. Os projetos vêm do `/mobile/me`, não do login. |
| `POST /auth/refresh` (Bearer vencido) | `POST /mobile/auth/refresh {refresh_token}` | O access token vencido **não** renova. O refresh é de uso único, com sessão absoluta de 30 dias e detecção de reuso. |
| — | `POST /mobile/auth/logout`, `GET /mobile/me`, `POST /auth/password/change` | Rotas novas. |
| `GET /gai/projects` (sem token, filtro no app) | `GET /mobile/me` → `projects[]` | O filtro é feito no servidor (vínculo ativo e vigente). Não existe `extra_fields` por projeto. |
| `POST /gai/sync_items` (multipart, sem token) | `PUT /mobile/projects/{p}/items/{externalId}` + fotos em 3 passos | É JSON. O id vai na URL. Idempotente, com `base_version`. 201/200/409 no lugar de "só 200". |
| `POST /gai/item/create`, `/gai/item/update` | Mesmo `PUT` acima | As rotas antigas não são necessárias. |
| `POST /gai/update_items` (lotes de ids) | `GET /mobile/projects/{p}/items/sync?cursor=` (ou `GET …/items/{externalId}`) | É incremental, por cursor, e inclui excluídos e alterações da web. |
| `POST /gai/item/delete {id}` (sem fila) | `DELETE /mobile/projects/{p}/items/{externalId}` | Exclusão lógica, idempotente, que deve ser enfileirada. 404 = nunca sincronizado. |
| `POST /gai/projects/{p}/check_duplicate {search}` | `GET /mobile/projects/{p}/plates/check?plate=&kind=` | Devolve `exists` mais os itens. Cobre placa antiga 2. |
| `POST /gai/projects/pendencias {project_id, itens: []}` | `GET /mobile/projects/{p}/plates/report` | Somente leitura (o legado gravava). Faixas de placas faltantes; duplicadas novas e antigas com técnico, unidade e localização. |
| `POST /gai/projects/financeiro` (multipart) | `POST /mobile/projects/{p}/expenses` + anexo em 3 passos | Exige permissão financeira. Data `YYYY-MM-DD` e valor `"120.50"`. Idempotente por `client_expense_id`. O inventariante vem da sessão. |
| `POST /gai/items/import-sessions` | `POST /mobile/projects/{p}/import-sessions` | `project_id` vai na URL. A resposta não usa o envelope `{data}`. |
| `POST …/{uuid}/images/presign` (até 100 arquivos) | `POST …/import-sessions/{uuid}/files/upload-url` (um arquivo por chamada) + `confirm-upload` | A confirmação é obrigatória e verifica o arquivo. |
| `PUT {upload_url}` | `PUT {upload_url}` com `upload_headers` | Igual: o S3 aceita sem token. |
| `POST …/{uuid}/payloads` | `POST …/import-sessions/{uuid}/payloads` | `idempotency_key` é obrigatória. As fotos usam `file_id` (não `path`). `gai_user` vem da sessão. Os status são `processed`, `partially_processed` e `failed`. |
| `POST …/{uuid}/finish` | `POST …/import-sessions/{uuid}/finish` | O resultado é `finished`, `finished_with_errors` ou `failed` (o legado usava `completed` e `completed_with_errors`). |
| `GET …/{uuid}` | `GET …/import-sessions/{uuid}` | Mesmos contadores, renomeados (ver abaixo). |
| `GET …/{uuid}/errors` | `GET …/import-sessions/{uuid}/errors` | É paginado. Traz `payload_number`, `item_id` e `error_message`. |
| `POST /gai/import-sessions/{uuid}/backup` (multipart zip) | `files/upload-url {type: raw_backup}` + `PUT` + `confirm-upload` | Até 100 MiB, com janela de 30 min. |
| `GET /external/projects/{p}/items/sync` (500 no legado) | `GET /mobile/projects/{p}/items/sync` | Funciona. Cursor opaco (não `last_id`/`next_last_id`). Inclui fotos e excluídos. |

## Campos do item

| Legado | GAI |
|---|---|
| `id` | `external_item_id` (URL), sempre string |
| `gai_user` (nome ou id) | derivado da sessão (`created_by_id`/`updated_by_id`, mais o inventariante na auditoria) |
| `project_id` | URL |
| `placa_antiga`, `placa_antiga_2`, `placa_nova` | `old_plate`, `old_plate_2`, `new_plate` |
| `unidade`, `endereco`, `localizacao`, `descricao` | `unit_text`, `address_text`, `location_text`, `description` |
| `marca`, `modelo`, `num_serie`, `capacidade` | `brand`, `model`, `serial_number`, `capacity` |
| `ano` (texto) | `year` (inteiro 1900–2100) |
| `obs` | `notes` |
| `valor_usado`, `valor_novo` | `used_value`, `new_value` (string `"150.00"`) |
| `fonte` | `source` (definido pelo servidor como `mobile_app`) |
| `extra_fields` | `extra_fields` (objeto texto → texto, até 100 campos) |
| `image_1..n` (multipart) | fotos em 3 passos (`upload-url`, `PUT`, `confirm-upload`) |
| — | `version` (controle de conflito) e `deleted` |

## Status e contadores da reconciliação

| Legado | GAI |
|---|---|
| `ready`, `completed`, `completed_with_errors` | `receiving`, `finished`, `finished_with_errors` |
| `success_items`, `failed_items`, `pending_payloads`, `backup_uploaded` | os mesmos nomes no `GET …/import-sessions/{uuid}` |
| `{data: {...}}` | sem envelope |

## Códigos HTTP

| Situação | Legado | GAI |
|---|---|---|
| Sucesso | só 200 | 200, 201 ou 204 |
| Sem token ou token vencido | rotas sem token | 401, depois refresh |
| Sem permissão ou vínculo | — | 403 |
| Conflito de versão, item excluído, chave reutilizada | — | 409 (não repetir sem reconciliar) |
| Upload fora da janela | — | 410 |
| Limite de requisições | — | 429 (`TOO_MANY_REQUESTS`) |
| Erro 4xx atrás do CloudFront | — | JSON com o status real. A reescrita para 200 + HTML foi removida na Onda 0; **confirmar na AWS** |
