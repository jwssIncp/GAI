# Onda 3: pendências, despesas e reconciliação mobile

**Data:** 09/11/2026 · **Branch:** `feature/gai-ajustes-homologacao` · **Base:** [auditoria](../auditoria-api-mobile/README.md), [Onda 0](../onda-0-seguranca-api-mobile/README.md), [Onda 1](../onda-1-autenticacao-mobile/README.md), [Onda 2](../onda-2-sincronizacao-mobile/README.md)

**Classificação: APTO COM RESSALVAS para homologação.** A funcionalidade está completa e validada em SQLite. **MySQL, S3 real e AWS não foram validados**: MySQL e Docker estavam indisponíveis. A concorrência real do InnoDB (lock da sessão, savepoints, gravação em lotes) segue não comprovada.

Não houve deploy, migration executada, commit nem push. Nenhum registro histórico foi alterado. O Laravel não foi tocado.

## Endpoints novos (`/api/v1/mobile/projects/{projectId}/…`, Bearer da Onda 1)

Requisitos comuns a todos os endpoints:
- inventariante ativo com vínculo vigente ao projeto (`MobileAccessService`);
- guard da Onda 0;
- permissões explícitas.

### Pendências e duplicidade de placa (somente leitura, `inventory-items:read`)

| Rota | Função |
|---|---|
| `GET plates/check?plate=&kind=new\|old\|any&exclude_external_id=` | Verifica se a placa já existe. "Antiga" cobre `old_plate` e `old_plate_2`. Ignora itens excluídos. A resposta traz `matched_fields` e o técnico. |
| `GET plates/report?from=&to=` | Placas novas faltantes, em faixas compactas como `"4"` e `"6-8"`, mais duplicadas novas e antigas, com os itens, o técnico, a unidade e a localização. |

```json
GET plates/report?to=12
{ "project_id": 97, "generated_at": "…",
  "totals": { "items": 10, "with_new_plate": 10, "numeric_new_plates": 8, "non_numeric_new_plates": 1 },
  "missing_new_plates": { "from": 1, "to": 12, "count": 7, "ranges": ["4", "6-8", "10-12"] },
  "duplicated_new_plates": [ { "plate": "251", "items": [
      { "id": 5012, "external_item_id": "1730736000123456", "version": 41, "new_plate": "251",
        "old_plate": null, "old_plate_2": null, "unit_text": "SEDE", "location_text": "RECEPCAO",
        "description": "…", "technician": { "user_id": 29, "name": "João Pedro", "field_agent_id": 14 },
        "created_at": "…" } ] } ],
  "duplicated_old_plates": [ { "plate": "777", "items": [ … ] } ] }
```

Regras do relatório:
- As lacunas consideram só placas novas numéricas, depois da normalização `[A-Z0-9]`.
- A faixa vai do menor ao maior número existente, ou de `from` a `to`, com no máximo 1.000.000 de números.
- Placas alfanuméricas são contadas em `non_numeric_new_plates`.
- Nada é gravado: o contador de sincronização não muda.

### Despesas (`expenses:create`, `expenses:read`, `expenses:upload-attachment`; **nunca concedidas ao perfil de campo**)

| Rota | Função |
|---|---|
| `POST expenses` | `{client_expense_id, description, reason?, expense_date: "YYYY-MM-DD", amount: "120.50", metadata?}` → 201 `created` ou 200 `existing` (reenvio). 409 `IDEMPOTENCY_KEY_REUSED` (mesma chave com outros dados), `REQUEST_IN_PROGRESS` ou `FIELD_AGENT_INELIGIBLE`. |
| `GET expenses?page=&page_size=` | Só as despesas do próprio inventariante. |
| `POST expenses/{id}/attachments/upload-url` | `{original_name, mime_type, size_bytes, checksum?}` → URL pré-assinada mais `upload_headers`. |
| `POST expenses/{id}/attachments/{attachmentId}/confirm-upload` | `confirmed`, ou `already_confirmed` (idempotente). |

Regras:
- Reaproveitam `PaymentsExpensesService`: mesma validação de data, valor e anexo (MIME, tamanho, SHA-256, magic bytes), mesmo fluxo de status e isolamento por organização e projeto.
- O `field_agent_id` vem da sessão. Enviá-lo no corpo gera 400.
- Despesas de outro inventariante respondem 404.

### Reconciliação (`import-sessions:create|read|finish`, `import-files:create`, `import-payloads:create`, `import-errors:read`)

| Rota | Função |
|---|---|
| `POST import-sessions` | `{unidade?, expected_payloads? ≤1000, device_label?}` → sessão `mobile_sync` com **expiração em 7 dias** (`MOBILE_IMPORT_SESSION_TTL_HOURS=168`). |
| `GET import-sessions/{uuid}` | `status`, `received/processed/pending_payloads`, `payloads_with_errors`, `total_items`, `success_items`, `failed_items`, `created/updated/deleted_items`, `backup_uploaded`, `expires_at`. |
| `POST import-sessions/{uuid}/files/upload-url` | `{type: image\|raw_backup, original_name, mime_type, size_bytes}` → `file_id`, `upload_url`, `upload_headers`, `expires_in_seconds`. |
| `POST import-sessions/{uuid}/files/{fileId}/confirm-upload` | Verifica o objeto no S3 (idempotente). |
| `POST import-sessions/{uuid}/payloads` | `{payload_number, idempotency_key, items[≤1000]: {operation: upsert\|delete, external_item_id, …campos da Onda 2, extra_fields, images: [{file_id}]}}` |
| `POST import-sessions/{uuid}/finish` | Fecha a sessão: `finished`, `finished_with_errors` ou `failed`. |
| `GET import-sessions/{uuid}/errors` | `{payload_number, row_number, item_id, error_code, error_message}` |

Detalhes:
- O backup usa `type: raw_backup` (zip; JSON também é aceito pela web), com até 100 MiB e uma janela de 30 min para upload e confirmação (`IMPORT_BACKUP_UPLOAD_TTL_SECONDS`).
- **Download para reconciliação:** reaproveita a sincronização da Onda 2 (`GET items/sync`), que já traz itens importados, fotos vinculadas e excluídos.
- **Status:** status de sessão `finished_with_errors` e status de payload `partially_processed` são novos, e o frontend web passou a exibi-los.

## Correções na importação (valem também para a web)

| Problema da auditoria | Correção |
|---|---|
| Payload com erro marcado `processed`; `failedPayloads` nunca incrementado; sessão sempre `finished` | O payload termina `processed`, `partially_processed` ou `failed`. `failedPayloads` é mantido, inclusive no reprocessamento. O `finish` resulta em `finished`, `finished_with_errors` (sucesso parcial) ou `failed` (nada aplicado). |
| Escrita parcial de item com erro | Cada item roda num **savepoint**. Um item que falha (por exemplo, por foto inválida ou limite de fotos) não deixa nada gravado. |
| Imagens só em `metadata.import_images` | As fotos viram `inventory_item_images` de verdade (`IMPORT_LINK` auditado). Só são aceitas imagens **enviadas e confirmadas na mesma sessão e organização**. A validação acontece antes de gravar o item. Respeita o limite de fotos por item. Reenviar não duplica fotos. O arquivo de importação passa a `processed`. |
| Checksum opcional e informado pelo cliente; reenvio com conteúdo diferente devolvia o resultado antigo | O servidor calcula o `content_hash` (SHA-256) de todo payload. Mesmo número ou chave com conteúdo diferente gera 409 `PAYLOAD_IDEMPOTENCY_CONFLICT`. Uma corrida no índice único responde como replay. |
| Payloads concorrentes perdiam atualizações dos contadores da sessão | Os contadores são atualizados sob lock da linha da sessão (`SELECT … FOR UPDATE` no MySQL). |
| `finish` e `cancel` sem validar estado ou expiração | Ambos respondem 409 para sessão encerrada ou expirada. O `finish` também recusa enquanto houver payload em processamento. Arquivos e reprocessamento também respeitam o estado. |
| Lock prolongado do projeto (Onda 2) em importações grandes | Os itens são aplicados em transações de 100 (`IMPORT_ITEMS_PER_TRANSACTION`), e o lock do contador do projeto é liberado entre os lotes. |
| Upsert tardio reativava ou editava item excluído | Importar sobre item excluído vira erro da linha. A exclusão continua idempotente. |
| Auditoria do item só com `row_number` | Grava o diff real dos campos, mais `_context` (sessão, `payload_number`, linha) e o número de fotos vinculadas. |
| IDOR dentro da organização | Contas de campo, inclusive na API web, só veem e alteram as sessões que **elas** abriram (404 para as demais). Gestores continuam com visão da organização. |
| Payload travado em `processing` após falha do servidor | O reprocessamento é permitido para `failed` ou para `processing` parado há mais de 15 min. |
| Backup de 100 MB | A AWS passa a aceitar 100 MiB (`STORAGE_MAX_SIZE_BYTES`). O teto separado para URLs assinadas (`STORAGE_PRESIGNED_URL_MAX_TTL_SECONDS=1800`) permite janela longa **só** para backup; as demais URLs seguem com 300 s. Há validação de MIME e tamanho por tipo: imagem até 10 MB em JPEG, PNG ou WEBP; backup em zip ou JSON. |

Outras mudanças:
- **`placa_antiga_2`:** passa a ser uma coluna real e indexada (`inventory_items.old_plate_2`). Entra na importação, no PUT, na sincronização, na verificação e no relatório, e a busca por placa antiga cobre as duas colunas.
- **Perfil de campo:** ganha as 6 permissões de reconciliação acima. Não ganha cancelamento, retry, reprocessamento nem permissões financeiras. Perfis existentes continuam como estão até alguém rodar `npm run field-roles:upgrade -- --apply`.

## Arquivos

**Novos:**
- `src/modules/mobile/`: `mobile-plates.service.ts`, `mobile-expenses.service.ts`, `mobile-import.service.ts`, `mobile-operations.controller.ts`, `mobile-idempotency-key.entity.ts`, `dto/mobile-operations.dto.ts`
- `src/migrations/1794600000001-mobile-reconciliation.ts` (`old_plate_2`, `content_hash`, `mobile_idempotency_keys`, todos aditivos)
- `test/integration/mobile/mobile-operations.e2e-spec.ts`

**Alterados no backend:**
- `import-sessions.service.ts`, `import-session-scope.service.ts`, `import-sessions-inputs.ts`, `import-sessions.controller.ts`, `import-sessions.module.ts`, `typeorm-import-sessions.repository.ts`, a porta do repositório e os enums de status
- `import-payload.entity.ts`, `inventory-item.entity.ts`
- `inventory-item-image-audit-operation.enum.ts`
- `mobile-items.service.ts` (`old_plate_2` em coluna), `mobile.module.ts`
- `field-access-permissions.ts`
- `payments-expenses.module.ts`
- `typeorm-project-summary.repository.ts` (`finished_with_errors` conta como finalizada)
- `s3-storage-adapter.service.ts` (teto separado de TTL)
- `app.module.ts`, `test/integration/test-app.helper.ts`

**Infraestrutura:** `infra/terraform/ecs.tf` (`STORAGE_MAX_SIZE_BYTES=104857600`, `STORAGE_PRESIGNED_URL_MAX_TTL_SECONDS=1800`).

**Frontend:** `StatusBadge.tsx`, `importSessionSchemas.ts`, `types/api.ts` (status novos).

**Testes ajustados ao comportamento corrigido:**
- `import-sessions.e2e-spec.ts`: `partially_processed` e `finished_with_errors` em vez de `processed` e `finished` para payload com erro.
- `onda0-field-access.e2e-spec.ts`: o perfil de campo abre sessão de reconciliação, mas não faz retry.

## Testes executados

| Validação | Resultado |
|---|---|
| Backend `tsc --noEmit`, ESLint/Prettier (arquivos das Ondas 0–3) | OK |
| Backend unitários (completo) | 66 suítes, 484 OK |
| Backend integração SQLite + contrato (completo) | 64 suítes, 412 OK, 4 pulados (já pulados antes; dependem de MySQL) |
| Frontend `tsc -b`, ESLint nos arquivos alterados | OK |
| Novos (`mobile-operations.e2e-spec.ts`, SQLite) | 4/4 OK |
| Mobile Ondas 1 a 3 | 22/22 OK |

Os testes novos cobrem:
- **Pendências:** relatório com lacunas, `old_plate_2`, técnicos, unidade e localização; item excluído fora do relatório; relatório somente leitura (contador inalterado); verificação de placa com `exclude_external_id`; faixa inválida; projeto sem vínculo.
- **Despesas:**
  - perfil de campo sem permissão financeira (403);
  - criação, reenvio idempotente, chave reutilizada com outros dados, 3 envios concorrentes (1 criado);
  - data e valor inválidos, `field_agent_id` no corpo;
  - anexo com confirmação idempotente;
  - despesa de outro técnico (404).
- **Reconciliação:**
  - sessão de 7 dias;
  - MIME e tamanho por tipo, janela de 30 min para backup;
  - foto vinculada; item excluído não ressuscita; foto não confirmada falha sem escrita parcial; arquivo de outra sessão recusado;
  - replay idempotente e conflito de conteúdo;
  - processamento em lotes de 2;
  - erros com `payload_number`;
  - isolamento da sessão entre técnicos, com acesso web do gestor;
  - `finished_with_errors`, finish duplo e payload depois do finish recusados;
  - sincronização trazendo itens e fotos importados;
  - payload e sessão totalmente falhos (`failed`);
  - 3 payloads concorrentes com contadores corretos.

**Não executados:**
- MySQL descartável. Em particular, `SELECT … FOR UPDATE` na sessão, savepoints e lotes no InnoDB, corrida no índice único de payloads e deadlocks. No SQLite as transações são serializadas, então a concorrência validada aqui é lógica.
- Migrations `1794400000001`, `1794500000001` e `1794600000001` contra MySQL.
- S3 real: verificação de 100 MiB em streaming dentro da janela de 30 min, e o CORS que o app nativo não exige.
- AWS (`plan`/`apply`).

## Pendências MySQL / S3 / AWS

1. `npm run test:integration:mysql` com os specs mobile; teste de carga com N aparelhos × payloads concorrentes; `up`/`down` das três migrations numa cópia de homolog. Antes, rodar `npm run items:external-duplicates` (Onda 2).
2. `npm run test:integration:s3` com um backup zip próximo de 100 MiB, medindo o tempo de upload e de confirmação. A confirmação lê o objeto inteiro para calcular o SHA-256.
3. Terraform: aplicar as Ondas 0 a 3 em homolog (CloudFront, `trust proxy`, limites de storage) e validar.
4. Rodar `npm run field-roles:upgrade` (simulação e depois `--apply`) em homolog. Até lá, os inventariantes já convidados não têm as permissões de reconciliação.
5. Conceder `expenses:*` por perfil personalizado a quem usará despesas no app. Isso é decisão do negócio e nunca é automático.

## Riscos remanescentes

- **Importação não atômica por payload.** Com lotes de 100, um payload pode ficar aplicado pela metade se o servidor cair no meio. Ele fica em `processing` e pode ser reprocessado depois de 15 min. Os itens já aplicados são reaplicados como upsert e mudam de versão.
- **Semântica de `null` diferente entre rotas.** Na importação, `null` em campo **não** limpa o valor (comportamento herdado da importação web). No PUT da Onda 2, `null` limpa. O app deve usar o PUT quando precisar limpar campos.
- **Retenção de chaves.** `mobile_idempotency_keys` cresce indefinidamente. Definir retenção (por exemplo, 90 dias).
- **Relatório de placas em projetos grandes.** O relatório carrega todos os itens vivos do projeto, só as colunas necessárias. Medir em projetos com mais de 100 mil itens.
- **Limite global de armazenamento.** `STORAGE_MAX_SIZE_BYTES=100 MiB` é global. Anexos de despesa, que não têm limite próprio, também passam de 50 para 100 MiB. Fotos de item continuam limitadas a 10 MB pelo módulo de imagens. Se for indesejado, criar um limite próprio para despesas.
- **Colação.** `utf8mb4_unicode_ci` trata maiúsculas e minúsculas como iguais em `external_item_id` (Onda 2).
- **Dependências das ondas anteriores.** Os riscos da Onda 2 (gravações fora de `save()` precisam chamar `nextProjectSyncSeq`) e das Ondas 0 e 1 (aplicação na AWS) continuam valendo.
