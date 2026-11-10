# Onda 2: sincronização segura de itens e imagens (mobile)

**Data:** 09/11/2026 · **Branch:** `feature/gai-ajustes-homologacao` · **Base:** [auditoria](../auditoria-api-mobile/README.md), [Onda 0](../onda-0-seguranca-api-mobile/README.md), [Onda 1](../onda-1-autenticacao-mobile/README.md)

**Classificação: APTO COM RESSALVAS para homologação.** A funcionalidade está implementada e validada em SQLite. **A integridade sob concorrência real no MySQL NÃO foi validada**, nem a migration contra os dados existentes: o MySQL estava indisponível. S3 e AWS também não foram validados.

Não houve deploy, migration executada, commit nem push, e nenhum registro histórico foi alterado.

## Diagnóstico inicial

- **Duplicidades de `external_item_id`:** **não foi possível verificar.** O MySQL local e o descartável estavam indisponíveis (portas 3306 e 33337 fechadas). Nada foi presumido sobre os dados. Por isso:
  - a migration `1794500000001-mobile-item-sync` **verifica antes de qualquer DDL** e, se houver duplicata, **interrompe com erro explícito sem alterar nada**;
  - o script somente leitura `npm run items:external-duplicates` lista os grupos duplicados e os ids envolvidos, e termina com código 2 quando há duplicatas.
- **Caminhos de gravação de `inventory_items`:** são só dois, os dois via `save()`. Um é o repositório web (criar, editar, desativar, reativar); o outro é o `applyItem` da importação. Nenhum `UPDATE` em massa foi encontrado. Fotos são gravadas pelo repositório de imagens, também via `save()`.

## Endpoints (`/api/v1/mobile/projects/{projectId}/items`, Bearer da Onda 1)

Requisitos para todas as rotas:
- Inventariante ativo, com vínculo vigente ao projeto e na organização da sessão (`MobileAccessService`, que reaproveita `resolveFieldAccess`).
- Permissões da Onda 0.
- O guard confina também `/mobile/projects/{id}`.

| Método | Rota | Permissão | Respostas |
|---|---|---|---|
| GET | `` (lista: `page`, `page_size` ≤100, `new_plate`, `old_plate`, `search`, `include_deleted`) | `inventory-items:read` | 200 |
| GET | `/sync?cursor=&limit=` (≤500, padrão 200) | `inventory-items:read` | 200 · 400 `INVALID_CURSOR` |
| GET | `/{externalId}` | `inventory-items:read` | 200 · 404 `ITEM_NOT_FOUND` |
| PUT | `/{externalId}` | `inventory-items:create` + `:update` | 201 `created` · 200 `updated`/`unchanged` · 400 · 404 · 409 `VERSION_CONFLICT`/`ITEM_DELETED`/`PROJECT_STATUS_BLOCKS_OPERATION` |
| DELETE | `/{externalId}?base_version=` | `inventory-items:deactivate` | 200 `deleted`/`already_deleted` · 404 · 409 `VERSION_CONFLICT` |
| GET | `/{externalId}/images?with_urls=` | `inventory-item-images:read` + `:download` | 200 |
| POST | `/{externalId}/images/upload-url` | `inventory-item-images:create` | 201 · 400 · 409 (limite) |
| POST | `/{externalId}/images/{imageId}/confirm-upload` | `inventory-item-images:update` | 200 `confirmed`/`already_confirmed` · 404 · 409 · 410 |
| DELETE | `/{externalId}/images/{imageId}` | `inventory-item-images:remove` | 200 `removed`/`already_removed` |

Erros comuns a todas as rotas:
- 401: sessão inválida.
- 403: `MOBILE_ACCESS_DENIED`, `PROJECT_NOT_AUTHORIZED`, ou recusa do guard para projeto não vinculado ou inventariante bloqueado.

### Exemplos (valores ilustrativos)

```http
PUT /api/v1/mobile/projects/97/items/1730736000123456
{ "new_plate": "251", "old_plate": "12345", "old_plate_2": null, "unit_text": "SEDE",
  "address_text": "Rua X, 100", "location_text": "RECEPÇÃO", "description": "CADEIRA GIRATÓRIA",
  "brand": null, "model": null, "serial_number": null, "capacity": null, "year": 2019,
  "notes": null, "used_value": "150.00", "new_value": null,
  "extra_fields": { "Patrimônio": "123", "Setor": "TI" } }

201
{ "result": "created",
  "item": { "id": 5012, "external_item_id": "1730736000123456", "version": 41,
            "sequence": null, "old_plate": "12345", "old_plate_2": null, "new_plate": "251",
            "unit_text": "SEDE", "address_text": "Rua X, 100", "location_text": "RECEPÇÃO",
            "description": "CADEIRA GIRATÓRIA", "brand": null, "model": null,
            "serial_number": null, "capacity": null, "year": 2019, "notes": null,
            "source": "mobile_app", "used_value": "150.00", "new_value": null,
            "extra_fields": { "Patrimônio": "123", "Setor": "TI" }, "status": "pending",
            "deleted": false, "created_by_id": 29, "updated_by_id": 29,
            "created_at": "...", "updated_at": "...", "deleted_at": null, "images": [] } }
```

```http
PUT …/items/1730736000123456   { "description": "CADEIRA PRETA", "base_version": 41 }   → 200 updated (version 57)
PUT …/items/1730736000123456   { "description": "OUTRA", "base_version": 41 }
409 { "code": "VERSION_CONFLICT", "message": "...", "details": { "item": { ...versão atual... } } }
```

```http
GET …/items/sync?limit=200
200 { "items": [ { ...item..., "images": [ { "id": 77, "status": "uploaded", "mime_type": "image/jpeg",
                    "size_bytes": 183244, "checksum": "…", "original_name": "foto.jpg", "created_at": "…" } ] } ],
      "next_cursor": "eyJ2IjoxLCJwIjo5Nywicy…", "has_more": true, "server_time": "…" }
```

```http
POST …/items/1730736000123456/images/upload-url
{ "original_name": "foto_1.jpg", "mime_type": "image/jpeg", "size_bytes": 183244 }
201 { "image": { "id": 77, "status": "pending_upload", ... }, "upload_url": "https://…X-Amz-Signature…",
      "upload_headers": { "Content-Type": "image/jpeg", "Content-Length": "183244" }, "expires_in_seconds": 300 }
PUT <upload_url> (com upload_headers)
POST …/images/77/confirm-upload {}  → 200 { "result": "confirmed", "image": {...}, "item_version": 58 }
GET  …/images                        → 200 { "item_version": 58, "items": [ { ..., "download_url": "https://…", "expires_in_seconds": 300 } ] }
```

## Idempotência, concorrência e conflitos

- **Identidade.** `external_item_id` vem só da URL, como **string** de até 100 caracteres `[A-Za-z0-9._:-]`. Zeros à esquerda e os 16 dígitos são preservados. O índice único `(project_id, external_item_id)` não restringe `NULL`, então itens legados ou web sem identificador não são afetados.
- **Versão.** `version` é a `sync_seq` do item: um contador por projeto, atribuído pelo `InventoryItemSyncSubscriber` dentro da transação de **qualquer** gravação (web, importação, mobile e fotos).
- **Upsert.**
  1. Bloqueia a linha do contador do projeto. No MySQL usa `INSERT … ON DUPLICATE KEY` e depois `SELECT … FOR UPDATE`; no SQLite a transação já é serializada. Isso serializa as gravações do projeto.
  2. Lê o item pelo `external_item_id`.
  3. Se o item não existe, cria (201).
  4. Se existe e o corpo não muda nada, responde 200 `unchanged`, sem gravar. Isso cobre reenvio após timeout e duplicatas concorrentes.
  5. Se há mudança, exige `base_version` igual a `version`; caso contrário responde 409 `VERSION_CONFLICT` com o item atual para reconciliação no aparelho. **Nunca há sobrescrita silenciosa.**
  6. Como última defesa, o índice único converte qualquer corrida remanescente em erro, e o servidor faz até 2 novas tentativas, depois das quais a requisição cai no caminho de "existente". Deadlock e lock timeout também geram nova tentativa.
- **Campos.** Campo ausente mantém o valor do servidor; `null` limpa. Status, organização, projeto e autoria nunca vêm do app: um campo desconhecido gera 400. Valores monetários são normalizados para 2 casas.
- **Histórico.**
  - `inventory_item_audit_logs` registra `create`, `update` e `deactivate`, com o diff real dos campos, `performedBy` (o usuário) e `_context` com `channel: mobile`, `field_agent_id` e a versão.
  - `created_by_id` e `updated_by_id` vêm da sessão.

## Exclusão e sincronização

- **DELETE** faz exclusão lógica, igual à desativação web (`status=inactive`, `deleted_at`). É idempotente (`already_deleted`) e aceita `base_version` opcional.
- **Exclusão não é revertida por reenvios antigos.** Um PUT sobre item excluído responde 409 `ITEM_DELETED`. O app não reativa itens: `status` não é aceito no corpo, e `inventory-items:reactivate` não faz parte do perfil de campo. Só a web reativa.
- **Item nunca sincronizado.** DELETE de item inexistente responde 404 `ITEM_NOT_FOUND`. O app deve tratar isso como exclusão concluída.
- **Sincronização incremental:**
  - Ordem por `(version, id)`, com cursor opaco ligado ao projeto (base64url de `{v,p,s,i}`). Um cursor de outro projeto ou inválido gera 400.
  - **Sem perda em paginação concorrente.** A sequência é atribuída sob o lock do contador do projeto, que fica preso até o commit. Assim nenhuma versão N+1 fica visível enquanto a N está pendente, e uma alteração durante a paginação reaparece depois, com a nova versão.
  - A resposta traz excluídos como tombstone (`deleted: true`), `extra_fields`, `old_plate_2` e as fotos (metadados).
  - O `next_cursor` deve ser guardado depois de cada página: retomar com ele após uma falha não perde nem duplica nada.
  - Sem cursor, a sincronização começa do início e inclui os itens legados, que ficam com versão 0 (não foram reescritos).
- **Itens sem `external_item_id`** (web ou legado) aparecem na sincronização com `external_item_id: null` e `id` do servidor. São **somente leitura** no app, porque não podem ser endereçados por PUT ou DELETE.
- **Alterações feitas na web** (edição, desativação, reativação, fotos) e pela importação ganham versão nova e entram na sincronização. Uma edição no app com versão antiga responde 409.

## Imagens

- Reaproveitam os use cases existentes, com as mesmas regras:
  - URL pré-assinada; MIME JPEG, PNG ou WEBP; tamanho máximo; HEAD, SHA-256 e magic bytes na confirmação;
  - checagem cruzada imagem ↔ item ↔ projeto ↔ organização;
  - URL de download assinada e temporária, com auditoria. Nenhum bucket ou credencial é exposto.
- **Confirmação idempotente.** Confirmar uma imagem já confirmada responde 200 `already_confirmed`. Remover duas vezes responde 200 `already_removed`.
- **Versão do item.** Toda mudança de foto incrementa a versão do item, e as respostas trazem `item_version` para o app atualizar sua `base_version`.
- **Correção compartilhada (web também).** Uploads pendentes com o prazo de confirmação vencido não contam mais no limite de fotos por item (`INVENTORY_ITEM_IMAGE_MAX_PER_ITEM`, que é 3 na AWS).
- **URLs só sob demanda.** A sincronização entrega apenas metadados das fotos. As URLs saem em `GET …/images`, para evitar milhares de assinaturas e linhas de auditoria por página.

## Compatibilidade com o legado

| Legado (`sync_items`) | GAI mobile |
|---|---|
| `id` (no corpo) | `{externalId}` na URL (string) |
| `placa_antiga`, `placa_antiga_2`, `placa_nova` | `old_plate`, `old_plate_2` (guardada em `metadata.old_plate_2`), `new_plate`. Maiúsculas, só `[A-Z0-9]` |
| `unidade`, `endereco`, `localizacao`, `descricao` | `unit_text`, `address_text`, `location_text`, `description` |
| `marca`, `modelo`, `num_serie`, `capacidade`, `ano`, `obs` | `brand`, `model`, `serial_number`, `capacity`, `year` (inteiro), `notes` |
| `extra_fields` (não ia no `sync_items`) | `extra_fields` (objeto de texto, até 100 campos) |
| `gai_user` (nome) | derivado da sessão (`created_by_id`/`updated_by_id`, mais `field_agent_id` na auditoria) |
| multipart com `image_1..n` | fotos em 3 passos por foto (upload-url, PUT, confirm) |
| `POST /gai/item/delete` sem fila | `DELETE …/{externalId}` idempotente; o app deve enfileirar |
| `update_items` (lotes de ids) | `GET …/sync` incremental (ou `GET …/{externalId}`) |
| HTTP 200 = sucesso; nada mais | 201/200 = sucesso; 409 exige reconciliação; 404 em DELETE = concluído; 4xx não deve ser repetido indefinidamente |

## Arquivos

**Novos:**
- `src/modules/mobile/mobile-items.service.ts`, `mobile-images.service.ts`, `mobile-access.service.ts`, `mobile-items.controller.ts`, `dto/mobile-items.dto.ts`
- `src/modules/inventory-items/infrastructure/persistence/inventory-item-sync.ts` (subscriber, sequência, detecção de conflito) e `inventory-item-sync-counter.entity.ts`
- `src/migrations/1794500000001-mobile-item-sync.ts`
- `src/scripts/seed/report-external-item-duplicates.ts`
- `test/integration/mobile/mobile-items.e2e-spec.ts`

**Alterados:**
- `inventory-item.entity.ts` (`sync_seq`, índice único, índice de sync)
- `typeorm-inventory-item.repository.ts` (409 `EXTERNAL_ITEM_ID_CONFLICT` em vez de 500)
- `inventory-items.module.ts`
- `inventory-item-inputs.ts` (`MONEY_PATTERN` exportado)
- `inventory-item-images.module.ts` (exports)
- `typeorm-inventory-item-image.repository.ts`, a porta e `create-inventory-item-image-upload-url.use-case.ts` (contagem de pendentes)
- `session-auth.guard.ts` (confinamento de `/mobile/projects/{id}`)
- `mobile.module.ts`, `src/app.module.ts`, `test/integration/test-app.helper.ts`, `package.json`

## Testes executados

| Validação | Resultado |
|---|---|
| `tsc --noEmit`, ESLint/Prettier (arquivos das Ondas 0–2) | OK |
| Unitários (completo) | 66 suítes, 484 OK |
| Integração SQLite + contrato (completo) | 63 suítes, 408 OK, 4 pulados (já pulados antes; dependem de MySQL) |
| Novos (`mobile-items.e2e-spec.ts`, SQLite) | 8/8 OK |
| Mobile Onda 1 + 2 | 18/18 OK |
| Regressão de itens, imagens, importação, operações, segurança e contrato | OK (incluídos no completo) |

Os testes novos cobrem:
- criação com id de 16 dígitos e zeros à esquerda;
- reenvio idempotente;
- atualização com versão;
- auditoria;
- conflito entre técnicos, com convergência quando o conteúdo é igual;
- ids longos ou inválidos;
- campos proibidos;
- 5 PUTs simultâneos que resultam em 1 linha;
- criação disputada (201 e 409);
- exclusão idempotente, exclusão com versão antiga, PUT offline depois da exclusão (`ITEM_DELETED`) e reativação recusada;
- paginação com alteração e exclusão no meio, retomada pelo cursor, item legado com versão 0, edição web sincronizada e cursor de outro projeto ou inválido;
- duas fotos, confirmação idempotente, URLs assinadas, fotos na sincronização, foto de outro item, remoção idempotente e limite com pendentes abandonados;
- inventariante bloqueado, projeto sem vínculo e outra organização;
- duplicata pela web (409) e regressão da web.

**Não executados:**
- Testes em MySQL descartável, incluindo a **concorrência real** (lock do contador, `ON DUPLICATE KEY`, deadlock e nova tentativa). No SQLite as transações são serializadas, então a concorrência validada aqui é lógica, não a do InnoDB.
- Migration `1794500000001` (`up`/`down`) e a verificação prévia contra dados reais.
- S3 real (`test:integration:s3`) e AWS.

## Saneamento de duplicidades (se a migration acusar)

1. Rodar `npm run items:external-duplicates` com usuário **somente leitura** no ambiente alvo e guardar o JSON (projeto, `external_item_id`, ids, quantidade excluída).
2. Para cada grupo, o responsável pelo projeto decide qual linha é a canônica. Em geral é a com mais fotos, observações e conciliações, ou a mais recente não excluída.
3. Nas demais linhas, aplicar uma das opções **manualmente, com aprovação registrada**:
   - **(a) Distinguir identificadores.** Gravar o identificador anterior em `metadata` (por exemplo `legacy_external_item_id`) e só então alterar `external_item_id`, por exemplo para `<id>-dup-<itemId>`. Nada é apagado e o histórico continua consultável.
   - **(b)** Se a duplicata for um item lixo comprovado, desativá-la pela web e depois aplicar a opção (a).
4. Rodar o relatório de novo até `duplicated_groups: 0`, e só então aplicar a migration.

Nenhuma consolidação é automática.

## Pendências e riscos

1. **MySQL:** rodar `npm run test:integration:mysql` com os specs mobile e um teste de carga concorrente (N aparelhos × PUT no mesmo projeto), e validar a migration `up`/`down` em cópia de homolog.
2. **Contenção:** gravações no mesmo projeto são serializadas pelo lock do contador. Uma importação grande, que roda num único `save` transacional, segura o lock do projeto até terminar, e os aparelhos esperam. Medir em homologação e, se for o caso, dividir as importações.
3. **Colação:** `utf8mb4_unicode_ci` trata maiúsculas e minúsculas e espaços finais como iguais no índice único e na busca. Ids numéricos não são afetados, mas `ABC` e `abc` contam como o mesmo id.
4. **Gravações fora de `save()`:** qualquer `UPDATE` em massa futuro sobre `inventory_items` ou imagens precisa chamar `nextProjectSyncSeq`, ou a mudança não será sincronizada. Isso está documentado no subscriber.
5. **Versão e fotos:** mudanças de foto alteram a versão do item. Um aparelho que editar campos sem atualizar a `base_version` com o `item_version` da foto recebe 409 e precisa reaplicar.
6. **`old_plate_2`:** fica em `metadata` (sem coluna própria, sem índice nem busca). Decidir se vira coluna.
7. **Importação:** os problemas de integridade da reconciliação em lote (L8) continuam e ficam para a onda de reconciliação. A importação já participa da sequência e do índice único: um `create` duplicado vira erro de linha.
8. **AWS:** depende da aplicação da Onda 0 (CloudFront e `trust proxy`) e da Onda 1 (migration de sessões). O CORS do bucket não é necessário para o app nativo.
