# Contratos reais do GAI usados na comparação

Este documento descreve o que o código faz hoje. Não é a proposta de contrato mobile, que só sai na Fase 6 do [plano](plano-integracao-mobile.md).

Fontes: os DTOs, mappers e use cases citados em cada seção. Os caminhos de código são relativos a `gai-backend/src/`. **Os valores dos exemplos são ilustrativos**; os nomes de campos, tipos e estruturas são os da implementação. Nenhum exemplo veio de uma chamada HTTP real.

## Convenções globais

| Item | Valor real | Evidência |
|---|---|---|
| Base | `https://<domínio CloudFront ou domain_name>/api/v1`. CloudFront encaminha `/api/*` ao ALB. O domínio de produção não está no repositório (variável `domain_name`, vazia por padrão) | [main.ts:13](../../gai-backend/src/main.ts#L13); [cloudfront.tf:91-99](../../infra/terraform/cloudfront.tf#L91-L99); [variables.tf:164-168](../../infra/terraform/variables.tf#L164-L168) |
| Autenticação | `Authorization: Bearer <access_token>`, um UUID de sessão opaco (**não JWT**) | [session-auth.guard.ts:225-231](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts#L225-L231) |
| Sessão | Deslizante: cada requisição empurra a expiração para agora + 8 h. Sem refresh | guard :146-153; [auth.config.ts:10](../../gai-backend/src/common/config/auth.config.ts#L10) |
| Validação | `whitelist`, `transform`, `forbidNonWhitelisted`. **Campo desconhecido gera 400** | [main.ts:21-27](../../gai-backend/src/main.ts#L21-L27) |
| Formato de erro | `{ "code": "VALIDATION_ERROR", "message": "...", "details"?: ... }`. Exceções não-HTTP viram `500 {code:"INTERNAL_ERROR"}`. 429 sai com `code: "INTERNAL_ERROR"` porque o mapa de códigos não cobre 429 | [http-exception.filter.ts](../../gai-backend/src/common/filters/http-exception.filter.ts) |
| Paginação | Offset: `?page=1&page_size=20` (máx. 100). Resposta `{items, page, page_size, total_items, total_pages}` | DTOs de query de cada módulo |
| Datas | ISO 8601 UTC (`toISOString()`). Datas civis em `YYYY-MM-DD`. `captured_at` exige offset explícito | DTOs; `common/validation/civil-date` |
| Dinheiro | String decimal com ponto, `^\d{1,13}(\.\d{1,2})?$`. Um número JSON é recusado | [inventory-item-inputs.ts:17](../../gai-backend/src/modules/inventory-items/application/dto/inventory-item-inputs.ts#L17) |
| Ids | Ids internos BIGINT expostos como número. O id gerado pelo app vai em `external_item_id` como **string** (VARCHAR 100) | migration `1740000000001` |
| Limite de taxa | Global 100 req/60 s por IP. Login 10/60 s. activation e password-reset 5/60 s | [app.module.ts:118-123](../../gai-backend/src/app.module.ts#L118-L123); auth.controller |
| Upload | Sempre em 3 passos: `upload-url` → `PUT` no S3 → `confirm-upload`. Não há multipart, exceto na importação XLSX | `common/storage/*` |

## 1. Autenticação

### POST /api/v1/auth/login (pública)

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "identifier": "tecnico@empresa.com", "password": "********" }
```
`identifier` aceita e-mail ou login. `password` exige no mínimo 8 caracteres ([login.dto.ts](../../gai-backend/src/modules/auth/application/dto/login.dto.ts)).

Resposta 200 ([login-response.dto.ts:15-73](../../gai-backend/src/modules/auth/application/dto/login-response.dto.ts#L15-L73)):
```json
{
  "access_token": "3f0d5c1e-8a7b-4c39-9d0e-2b6a1f4e7c55",
  "expires_at": "2026-11-09T21:00:00.000Z",
  "user": {
    "id": 29, "full_name": "João Pedro", "must_change_password": false,
    "login": "joao.pedro", "email": "tecnico@empresa.com", "status": "active",
    "organization_id": 3,
    "role_assignments": [ { "...": "RoleAssignmentResponseDto" } ],
    "permissions": [ { "key": "projects:read", "scope": "ORGANIZATION" } ]
  }
}
```

Erros:
- `400 VALIDATION_ERROR`, inclusive quando o corpo traz `email` em vez de `identifier`.
- `401 UNAUTHORIZED`: credenciais erradas, usuário inativo ou senha temporária vencida.
- `423 ACCOUNT_LOCKED`.
- `429`.

Observações:
- Com `must_change_password = true`, `permissions` vem vazio ([login.use-case.ts:38-40](../../gai-backend/src/modules/auth/application/use-cases/login.use-case.ts#L38-L40)). Toda rota fora de `/auth/me`, `/auth/logout` e `/auth/password/change` responde `403 PASSWORD_CHANGE_REQUIRED` (guard :132-145). O app precisa ter uma tela de troca de senha.
- A resposta **não** traz projetos autorizados nem o `field_agent_id`.

### GET /api/v1/auth/me (Bearer)
Devolve o mesmo `CurrentUserDto` do login. **Grava no banco** (renova a sessão), como qualquer rota autenticada.

### POST /api/v1/auth/logout (Bearer)
Responde 204 e revoga a sessão.

### POST /api/v1/auth/password/change (Bearer)
Corpo `{current_password, new_password}` ([credential-actions.dto.ts](../../gai-backend/src/modules/auth/application/dto/credential-actions.dto.ts)). Limite de 5/min.

### Refresh
**Não existe.**

## 2. Projetos

### GET /api/v1/projects (Bearer, `projects:read`)
Query: `page`, `page_size` (≤100), `organization_id` (só PLATFORM_ADMIN pode trocar), `company_id`, `status`, `project_type`, `search`, `sort_by`, `sort_order` ([list-projects-query.dto.ts](../../gai-backend/src/modules/projects/application/dto/list-projects-query.dto.ts)).

Resposta 200 ([project-response.dto.ts:25-155](../../gai-backend/src/modules/projects/application/dto/project-response.dto.ts)):
```json
{
  "status_counts": { "active": 2 },
  "items": [
    { "id": 97, "organization_id": 3, "company_id": 5, "name": "TESTE 3 - 2026", "code": null,
      "project_type": null, "description": null, "status": "active",
      "start_date": "2026-10-01", "end_date": null, "settings": null, "metadata": null,
      "created_at": "...", "updated_at": "...", "deleted_at": null,
      "available_actions": [] }
  ],
  "page": 1, "page_size": 20, "total_items": 1, "total_pages": 1
}
```
Para o perfil de campo, a lista se limita aos projetos com vínculo ativo e vigente. Sem vínculo, a lista vem vazia. Não existe `extra_fields`.

## 3. Itens

### POST /api/v1/projects/{projectId}/inventory-items (`inventory-items:create`)
```json
{
  "external_item_id": "1730736000123456",
  "old_plate": "12345", "new_plate": "251",
  "unit_text": "SEDE", "address_text": "Rua X, 100", "location_text": "RECEPÇÃO",
  "description": "CADEIRA GIRATÓRIA", "brand": null, "model": null, "serial_number": null,
  "capacity": null, "year": 2019, "notes": null, "source": "investor_app",
  "used_value": "150.00", "new_value": "900.00",
  "metadata": { "Patrimônio": "123" }
}
```
- Todos os campos são opcionais. Um `{}` cria um item.
- Limites: `external_item_id` ≤100, `sequence` ≤50, placas ≤100, `unit_text` ≤255, `brand`/`model`/`serial_number`/`capacity` ≤100, `year` inteiro entre 1900 e 2100, `source` ≤50.
- `status` aceita `pending|evaluated|divergent|not_found|duplicated|removed|inactive` ([inventory-item-inputs.ts:19-137](../../gai-backend/src/modules/inventory-items/application/dto/inventory-item-inputs.ts#L19-L137)).
- Placas são gravadas em maiúsculas, só com `[A-Z0-9]`.

Resposta 201 (`InventoryItemResponseDto`):
```json
{ "id": 5012, "organization_id": 3, "project_id": 97, "external_item_id": "1730736000123456",
  "sequence": null, "old_plate": "12345", "new_plate": "251", "unit_text": "SEDE",
  "address_text": "Rua X, 100", "location_text": "RECEPÇÃO", "description": "CADEIRA GIRATÓRIA",
  "brand": null, "model": null, "serial_number": null, "capacity": null, "year": 2019,
  "notes": null, "source": "investor_app", "used_value": "150.00", "new_value": "900.00",
  "status": "pending", "metadata": { "Patrimônio": "123" },
  "created_by_id": 29, "updated_by_id": 29,
  "created_at": "2026-11-09T13:00:00.000Z", "updated_at": "2026-11-09T13:00:00.000Z", "deleted_at": null }
```

Erros:
- 400: validação.
- 403: outra organização.
- 404: projeto inexistente.
- 409: o status do projeto bloqueia a operação (só `DRAFT`, `ACTIVE` e `PAUSED` aceitam).

**Repetir a chamada cria um segundo item.**

### PATCH /api/v1/projects/{projectId}/inventory-items/{id} (`inventory-items:update`)
- Mesmos campos do POST.
- `{id}` é o id interno, não o `external_item_id`.
- Responde 404 se o item não pertence ao projeto da URL.

### GET /api/v1/projects/{projectId}/inventory-items (`inventory-items:read`)
- Query: `page`, `page_size` (≤100), `status`, `old_plate`, `new_plate` (exatos, normalizados), `description` (LIKE), `search` (LIKE em descrição, placas, marca, modelo e série).
- Inclui itens desativados.
- Ordem fixa: `created_at DESC`.

### POST …/inventory-items/{id}/deactivate e …/reactivate
- `deactivate`: `status=inactive` e `deleted_at=now`. `reactivate`: `status=pending` e `deleted_at=null`.
- Ambos respondem 409 quando o item já está no estado pedido.

### Fotos do item ([inventory-item-images.controller.ts](../../gai-backend/src/modules/inventory-item-images/presentation/inventory-item-images.controller.ts))

```http
POST /api/v1/projects/97/inventory-items/5012/images/upload-url      (inventory-item-images:create)
{ "original_name": "foto_1.jpg", "mime_type": "image/jpeg", "size_bytes": 183244,
  "checksum": "<sha256 hex, opcional>" }
→ 201 { "image": { "id": 77, "status": "pending_upload", ... },
        "upload_url": "https://<bucket>.s3.amazonaws.com/organizations/3/...?...",
        "expires_in_seconds": 300 }

PUT <upload_url>   Content-Type: image/jpeg   Content-Length: 183244   <bytes>

POST /api/v1/projects/97/inventory-items/5012/images/77/confirm-upload   (inventory-item-images:update)
{ "size_bytes": 183244 }
→ 200 { "id": 77, "status": "uploaded", "checksum": "...", ... }
```
- No confirm, o servidor faz HEAD no objeto, confere tamanho e MIME, exige versionamento do bucket, calcula o SHA-256 e checa os magic bytes.
- **Limites:** até 3 imagens por item (contando as `pending_upload` abandonadas), 10 MB cada, JPEG, PNG ou WEBP.
- **Erros:** 410 `STORAGE_UPLOAD_EXPIRED` quando o confirm chega depois do TTL. 409 para `SIZE_MISMATCH`, `MIME_MISMATCH`, `CHECKSUM_MISMATCH`, `CONTENT_MISMATCH` e `VERSIONING_REQUIRED`. 404 para `STORAGE_OBJECT_NOT_FOUND`. 503 para `STORAGE_UNAVAILABLE`.
- **Download:** `POST …/images/{imageId}/download-url` devolve `{image, download_url, expires_in_seconds}`. A URL é assinada, temporária e servida como `attachment`. Não existe URL permanente.

## 4. Pendências (módulo existente, outra funcionalidade)

`/api/v1/projects/{projectId}/pending-issues`:
- `GET` (lista de issues já gravadas);
- `POST /generate` (grava e devolve `{created, skipped}`);
- `POST` (criação manual);
- `PATCH /{id}`, `POST /{id}/resolve`, `/ignore` e `/cancel`.

Tipos gerados: `MISSING_PLATE` (item sem placa nenhuma), `PHYSICAL_ITEM_WITHOUT_ACCOUNTING_MATCH`, `DESCRIPTION_DIVERGENCE`, `LOCATION_DIVERGENCE` e `ACCOUNTING_ITEM_NOT_FOUND`.

Não existe nada equivalente a `placas_faltantes`, `novas_duplicadas` ou `antigas_duplicadas`.

## 5. Despesas

```http
POST /api/v1/projects/97/expenses                   (expenses:create)
{ "description": "Combustível", "reason": "Deslocamento",
  "expense_date": "2026-11-08", "amount": "120.50", "field_agent_id": 14 }
→ 201 ExpenseResponseDto (status "pending", created_by_id = usuário autenticado)

POST /api/v1/projects/97/expenses/{id}/attachments/upload-url                 (expenses:upload-attachment)
{ "original_name": "nota.jpg", "mime_type": "image/jpeg", "size_bytes": 201000 }
→ 201 { "attachment": {...}, "upload_url": "...", "expires_in_seconds": 300 }
PUT <upload_url>
POST /api/v1/projects/97/expenses/{id}/attachments/{attachmentId}/confirm-upload
```
- `expense_date` aceita só `YYYY-MM-DD`.
- `amount` exige ponto decimal: `"12,50"` e `"R$ 10"` geram 400.
- Transições inválidas (aprovar uma despesa já paga, por exemplo) geram **500**, porque o domínio lança `Error` comum ([expense.ts](../../gai-backend/src/modules/payments-expenses/domain/entities/expense.ts)).

## 6. Sessões de importação

Base: `/api/v1/projects/{projectId}/import-sessions`. Os DTOs estão em [import-sessions-inputs.ts](../../gai-backend/src/modules/import-sessions/application/dto/import-sessions-inputs.ts) e [import-sessions-response.dto.ts](../../gai-backend/src/modules/import-sessions/application/dto/import-sessions-response.dto.ts).

```http
POST /import-sessions                                         (import-sessions:create)
{ "type": "mobile_sync", "source": "mobile_app", "expected_payloads": 3,
  "metadata": { "unidade": "SEDE" } }
→ 201 { "id": 41, "organization_id": 3, "project_id": 97, "type": "mobile_sync",
        "source": "mobile_app", "status": "open", "session_uuid": "8f1c...",
        "expected_payloads": 3, "received_payloads": 0, "processed_payloads": 0,
        "failed_payloads": 0, "total_items": 0, "total_images": 0, "total_created": 0,
        "total_updated": 0, "total_deleted": 0, "total_failed": 0,
        "raw_backup_path": null, "error_message": null, "metadata": {...},
        "created_at": "...", "updated_at": "..." }
```
- `type`: `mobile_sync|inventory_items_import|accounting_items_import|images_import|raw_backup_import|incremental_sync|physical_observations_import`.
- Quando informado, `expected_payloads` vai de 1 a 100000.
- A sessão expira em 24 h por padrão (`IMPORT_SESSION_TTL_HOURS`).

```http
POST /import-sessions/41/files/upload-url                     (import-files:create)
{ "type": "image", "original_name": "foto_1.jpg", "mime_type": "image/jpeg", "size_bytes": 183244 }
→ 201 { "file": { "id": 900, "path": "organizations/3/imports/41/<uuid>-foto_1.jpg",
                  "status": "pending_upload", ... },
        "upload_url": "...", "expires_in_seconds": 300 }
PUT <upload_url>
POST /import-sessions/41/files/900/confirm-upload   { "size_bytes": 183244 }   → 200 file "uploaded"
```
`type` aceita `raw_payload|raw_backup|image|other`. O confirm de um arquivo `raw_backup` preenche `session.raw_backup_path`.

```http
POST /import-sessions/41/payloads                             (import-payloads:create)
{ "payload_number": 1, "idempotency_key": "41-1-<hash>", "checksum": "<opcional>",
  "items": [
    { "operation": "upsert", "external_item_id": "1730736000123456", "sequence": "12",
      "old_plate": "12345", "new_plate": "251", "unit_text": "SEDE", "address_text": "...",
      "location_text": "RECEPÇÃO", "description": "CADEIRA", "brand": null, "model": null,
      "serial_number": null, "capacity": null, "year": 2019, "notes": null, "source": "app",
      "used_value": "150.00", "new_value": "900.00", "metadata": { "Patrimônio": "123" },
      "images": [ { "path": "organizations/3/imports/41/<uuid>-foto_1.jpg" } ] }
  ] }
→ 201 { "id": 300, "payload_number": 1, "idempotency_key": "...", "status": "processed",
        "items_count": 1, "images_count": 1, "created_count": 1, "updated_count": 0,
        "deleted_count": 0, "failed_count": 0, ... }
```
- `operation` aceita `create|update|upsert|delete|remove`.
- Até 10000 itens por payload e 50 imagens por item.
- O processamento é **síncrono**, dentro da requisição.
- Um erro por item gera uma linha em `import_payload_errors`, mas o payload termina `processed` mesmo assim.
- Reenviar com o mesmo `payload_number`, a mesma `idempotency_key` e o mesmo checksum devolve o resultado gravado. Qualquer divergência entre eles gera `409`.

Demais rotas:
- **`POST /import-sessions/41/finish`:** devolve 409 se `received_payloads < expected_payloads`; caso contrário a sessão vira `finished`.
- **`GET /import-sessions/by-uuid/{uuid}` e `GET /import-sessions/41`:** devolvem a sessão.
- **`GET /import-sessions/41/errors`:** `{items:[{id,row_number,item_reference,error_code,error_message,created_at}], page, ...}`.
- **Também existem:** `cancel`, `retry`, `payloads/{id}/reprocess`, `files`, `files/{id}/download-url` e `physical-observations/import` (multipart XLSX).

## 7. Endpoints do app sem equivalente

`POST /auth/refresh`, `POST /gai/projects/pendencias` (no formato e na semântica do legado) e `GET /external/projects/{id}/items/sync`.
