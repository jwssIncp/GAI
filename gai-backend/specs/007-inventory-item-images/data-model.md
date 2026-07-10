# Data Model: Inventory Item Images

## inventory_item_images

| Campo | Tipo | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | Sim | PK auto-incremento |
| organization_id | BIGINT UNSIGNED | Sim | FK para organizations |
| inventory_item_id | BIGINT UNSIGNED | Sim | FK para inventory_items |
| storage_provider | VARCHAR(30) | Sim | `s3` por padrao |
| bucket | VARCHAR(255) | Sim | Bucket interno, nao exposto publicamente |
| path | VARCHAR(1024) | Sim | Path gerado pelo backend |
| original_name | VARCHAR(255) | Sim | Nome original informado pelo cliente |
| mime_type | VARCHAR(100) | Sim | Apenas imagens aceitas |
| size_bytes | BIGINT UNSIGNED | Sim | Validado contra configuracao |
| checksum | VARCHAR(128) | Nao | Checksum opcional |
| status | VARCHAR(30) | Sim | `pending_upload`, `uploaded`, `failed`, `removed` |
| uploaded_by_id | BIGINT UNSIGNED | Nao | Usuario que solicitou/confirmou upload |
| created_at | DATETIME(3) | Sim | Timestamp de criacao |
| updated_at | DATETIME(3) | Sim | Timestamp de atualizacao |
| deleted_at | DATETIME(3) | Nao | Remocao logica |

### Indices

- `idx_inventory_item_images_item_status (inventory_item_id, status)`
- `idx_inventory_item_images_organization_item (organization_id, inventory_item_id)`
- `idx_inventory_item_images_uploaded_by_id (uploaded_by_id)`

## inventory_item_image_audit_logs

| Campo | Tipo | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | Sim | PK auto-incremento |
| inventory_item_image_id | BIGINT UNSIGNED | Sim | FK para inventory_item_images |
| organization_id | BIGINT UNSIGNED | Sim | FK para organizations |
| inventory_item_id | BIGINT UNSIGNED | Sim | FK para inventory_items |
| operation | VARCHAR(50) | Sim | Operacao auditada |
| performed_by | BIGINT UNSIGNED | Nao | Usuario executor |
| changes | JSON | Sim | Before/after ou metadados do evento |
| created_at | DATETIME(3) | Sim | Timestamp da auditoria |

## Status

- `pending_upload`: registro criado e aguardando envio do arquivo.
- `uploaded`: upload confirmado e imagem disponivel para download.
- `failed`: reservado para falhas futuras de processamento/upload.
- `removed`: removida logicamente.

## Storage

- Provider inicial: `s3`.
- O backend gera paths no formato:
  `organizations/{organization_id}/inventory-items/{inventory_item_id}/images/{generated_key}-{safe_name}`.
- URLs pre-assinadas usam expiracao configuravel por ambiente.
- Respostas publicas expõem somente metadados e URLs temporarias quando solicitadas.
