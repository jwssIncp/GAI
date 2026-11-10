# Guia de integração: app Investor (Android) → API GAI

Contrato formal: [openapi.yaml](openapi.yaml), com OpenAPI 3.1 verificado contra o código por teste. Este guia traz as regras de uso que o contrato sozinho não explica.

**Estado:** release candidate. As rotas estão implementadas e testadas, mas a homologação na AWS **ainda não foi feita** (ver [README](README.md)). O domínio definitivo será informado na entrega. Até lá, use o ambiente de homologação que receberem.

## 1. Base e convenções

- **Base:** `https://<domínio>/api/v1`. Todas as rotas do app ficam em `/mobile/...`, exceto `POST /auth/password/change`.
- **Formato:** JSON UTF-8. Campos são `snake_case`. Campo desconhecido no corpo ou na query gera **400**.
- **Datas:** ISO 8601 em UTC (`2026-11-09T13:00:00.000Z`). Datas civis em `YYYY-MM-DD`.
- **Dinheiro:** string com ponto e até 2 casas, como `"120.50"`. `"12,50"` gera 400.
- **IDs de item:** o id gerado no aparelho (`microsecondsSinceEpoch`) é **string** (`"1730736000123456"`). Nunca o converta para número.
- **Erros:** `{ "code": "...", "message": "...", "details": ... }`. Decida pelo **HTTP status mais o `code`**, nunca pela mensagem.

## 2. Sessão

1. **Login:** `POST /mobile/auth/login {identifier, password, device_label}`. Guarde `access_token`, `refresh_token`, `access_token_expires_at` e `session_expires_at` **no Android Keystore** (EncryptedSharedPreferences).
2. **Uso:** envie `Authorization: Bearer <access_token>`. O token **não** é JWT; não tente decodificar. Ele expira em cerca de 15 min e **não** é renovado pelo uso.
3. **Renovação:** um pouco antes de `access_token_expires_at`, ou ao receber **401**, chame `POST /mobile/auth/refresh {refresh_token}` e substitua **os dois** tokens.
   - **Um refresh por vez.** Serialize com um mutex e reaproveite o resultado entre as requisições que esperavam.
   - **409 `REFRESH_TOKEN_ALREADY_ROTATED`:** outra requisição já renovou. Use o par dela. Se não houver, faça login.
   - **401:** qualquer code (`REFRESH_TOKEN_REUSED`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `INVALID_REFRESH_TOKEN`) significa apagar os tokens e pedir login. **Não apague a fila offline.**
   - **403 `MOBILE_ACCESS_DENIED`:** inventariante bloqueado. Mostre "acesso suspenso".
4. **Limite absoluto:** `session_expires_at` (30 dias). Depois dele, só com novo login.
5. **Troca de senha:** se `user.must_change_password` for true, mostre a tela de troca (`POST /auth/password/change`). A troca derruba a sessão, e é preciso novo login.
6. **Logout:** `POST /mobile/auth/logout {refresh_token}` (sempre 204).
7. **Identidade e projetos:** `GET /mobile/me`. Mostre só `projects[]`. O `organization` e o `field_agent` vêm do servidor. Use `permissions[]` para esconder funções; por exemplo, despesas só aparecem com `expenses:create`.

## 3. Itens (substitui `sync_items`, `item/create`, `item/update`, `item/delete` e `update_items`)

- **Criar ou editar:** `PUT /mobile/projects/{projectId}/items/{externalId}` com os campos (tabela em [matriz-legado-novo.md](matriz-legado-novo.md)).
  - **Criação:** sem `base_version` → **201**.
  - **Edição:** envie `base_version` = `version` que o aparelho conhece → **200** `updated`.
  - **Reenvio após timeout:** o mesmo corpo responde **200** `unchanged`. É seguro repetir.
  - **409 `VERSION_CONFLICT`:** o item mudou no servidor. Use `details.item`: mostre ao técnico, ou reaplique só os campos que ele alterou sobre a versão nova e reenvie com o novo `base_version`. **Nunca force.**
  - **409 `ITEM_DELETED`:** o item foi excluído. Descarte a edição local e mostre o item como excluído.
  - **Campos:** ausente mantém; `null` limpa.
- **Excluir:** `DELETE /mobile/projects/{projectId}/items/{externalId}`, enfileirado como qualquer escrita, inclusive offline. **200**, ou **404** se o item nunca chegou ao servidor: trate os dois como concluídos.
- **Atualizar a lista local:** `GET .../items/sync?cursor=<salvo>&limit=200`.
  - Processe a página e **só então** salve `next_cursor`. Repita enquanto `has_more` for true.
  - `deleted: true` significa remover localmente.
  - Itens com `external_item_id: null` vêm da web ou do legado: são somente leitura.
  - Rode periodicamente e depois de esvaziar a fila.
- **Fila offline, sugestão:**
  - uma operação por item, em ordem;
  - 2xx sai da fila;
  - 409 vai para a tela de pendências de conflito;
  - outros 4xx vão para "erro definitivo", visível ao técnico, **sem repetir**;
  - 401 renova e repete;
  - 429, 5xx ou sem rede: backoff exponencial (5 s a 5 min).

## 4. Fotos (3 passos por foto)

1. `POST .../items/{externalId}/images/upload-url {original_name, mime_type, size_bytes}`. Aceita JPEG, PNG ou WEBP até 10 MB, com até 3 fotos por item.
2. `PUT upload_url` com o arquivo e **exatamente** os headers de `upload_headers` (`Content-Type` e `Content-Length`). **Sem** `Authorization`. Espere HTTP 200 do S3.
3. `POST .../images/{imageId}/confirm-upload {}` dentro de `expires_in_seconds` (300 s).
   - **410:** a janela expirou; volte ao passo 1.
   - **409 `STORAGE_*_MISMATCH`:** o arquivo não bate com o declarado.
   - Confirmar de novo responde 200 `already_confirmed`.
   - Atualize `base_version` com o `item_version` da resposta.

- **Visualizar:** `GET .../images` traz `download_url` temporário (300 s). Não guarde a URL; peça de novo quando precisar.
- **Remover:** `DELETE .../images/{imageId}` (idempotente).
- **Item primeiro:** o item precisa existir no servidor (PUT) antes de enviar as fotos.

## 5. Placas (tela Pendências e aviso de duplicidade)

- **Duplicidade no cadastro (com rede):** `GET .../plates/check?plate=251&kind=new&exclude_external_id=<id em edição>` → `exists`, mais os itens encontrados. `kind=old` cobre placa antiga e placa antiga 2.
- **Pendências:** `GET .../plates/report`, ou `?from=1&to=500`.
  - `missing_new_plates.ranges` (por exemplo `["4","6-8"]`).
  - `duplicated_new_plates` e `duplicated_old_plates`, com técnico, unidade e localização.
  - Somente leitura. **Não** envie itens por essa rota.
- **Normalização:** as placas são guardadas em maiúsculas, só `[A-Z0-9]`. `"11-27"` vira `"1127"`.

## 6. Despesas (só com permissão financeira concedida)

1. `POST /mobile/projects/{projectId}/expenses` com `{client_expense_id, description, reason, expense_date: "YYYY-MM-DD", amount: "120.50"}`.
   - `client_expense_id` é gerado no aparelho, com 8 a 100 caracteres. Reenviar responde 200 `existing`.
   - **Não** envie `field_agent_id`; ele vem da sessão.
2. Foto da nota: `.../expenses/{id}/attachments/upload-url` (até 20 MB), depois `PUT`, depois `.../confirm-upload`. O fluxo é igual ao das fotos de item.
3. Listar as próprias despesas: `GET .../expenses`.

## 7. Reconciliação

1. `POST .../import-sessions {unidade, expected_payloads}` → `session_uuid`. A sessão expira em 7 dias.
2. **Fotos:** `POST .../import-sessions/{uuid}/files/upload-url {type: "image", ...}`, depois `PUT`, depois `.../files/{file_id}/confirm-upload`.
3. **Lotes:** `POST .../import-sessions/{uuid}/payloads {payload_number, idempotency_key, items}`.
   - Até 1000 itens por lote. Cada item leva `operation` (`upsert` ou `delete`), `external_item_id`, os mesmos campos do PUT e `images: [{file_id}]` das fotos **confirmadas nesta sessão**.
   - **Reenviar o mesmo lote é seguro.** Não reutilize o número com conteúdo diferente: isso gera 409.
   - O resultado traz `status` (`processed`, `partially_processed` ou `failed`) e as contagens.
4. **Backup (opcional):** `files/upload-url {type: "raw_backup", mime_type: "application/zip"}`, até 100 MiB, com janela de 30 min. Depois `PUT` e `confirm-upload`.
5. `POST .../import-sessions/{uuid}/finish` → `finished`, `finished_with_errors` ou `failed`.
6. `GET .../import-sessions/{uuid}` e `GET .../errors` (com `payload_number`, `item_id` e `error_message`).
7. **Baixar itens:** use a sincronização da seção 3, que já inclui os importados e as fotos.

## 8. Checklist de homologação do app

- [ ] Login, refresh, token vencido, refresh duplicado, logout, troca obrigatória de senha.
- [ ] Inventariante bloqueado durante o uso: 403 e tela de acesso suspenso.
- [ ] Cadastro offline de 50 itens, com fotos, e sincronização ao voltar a rede, sem duplicatas.
- [ ] Mesmo item editado em dois aparelhos: 409 e reconciliação.
- [ ] Exclusão offline e reenvio de edição antiga (`ITEM_DELETED`).
- [ ] Sincronização com cursor interrompida no meio e retomada.
- [ ] Pendências comparadas com o resultado do Laravel para o mesmo projeto.
- [ ] Reconciliação com backup e lote com erro parcial.
- [ ] Despesa com nota, reenviada duas vezes.
