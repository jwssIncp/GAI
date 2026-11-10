# Onda 4: homologação integrada e contrato final da API mobile

**Data:** 09/11/2026 · **Branch:** `feature/gai-ajustes-homologacao` · **Base:** auditoria e Ondas 0 a 3

**Classificação: APTO COM RESSALVAS.** O backend está validado de ponta a ponta localmente, com **MySQL 8.0.46 real** e **S3 real (MinIO)**. A **infraestrutura AWS não foi validada**: não há Terraform nem credenciais, e o download do binário foi bloqueado pela política do ambiente. Por isso a homologação **não** está concluída. A homologação final depende das pendências AWS abaixo.

Não houve deploy, `terraform apply`, migration em homolog ou produção, commit nem push. O Laravel não foi tocado.

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [openapi.yaml](openapi.yaml) | Contrato OpenAPI 3.1 das rotas mobile implementadas, conferido por teste contra o roteador real |
| [guia-integracao-app.md](guia-integracao-app.md) | Instruções para a equipe Android: sessão, fila offline, conflitos, fotos, sincronização |
| [matriz-legado-novo.md](matriz-legado-novo.md) | Rotas, campos, status e códigos do Laravel para o GAI |

## Ambiente utilizado

| Recurso | Situação |
|---|---|
| Docker Desktop | Estava parado; foi **iniciado** (daemon 29.5.3). O MySQL `gai-mysql` e o MinIO `gai-local-storage` de desenvolvimento subiram sozinhos e foram usados **só para leitura**. |
| MySQL descartável | Container novo `mysql:8.0.46` na porta 33337, com `tmpfs` e flush relaxado (só nesse container). Removido no final. |
| S3 descartável | Container novo com a imagem local `minio/minio` na porta 33318 (bucket versionado e credenciais sintéticas). Removido no final. |
| Terraform | **Indisponível.** Não instalado; o download foi bloqueado na Onda 0. `fmt`, `validate` e `plan` continuam pendentes, e a CI (`infra.yml`) os executa. |
| AWS | Sem credenciais nem acesso. Nada foi aplicado. |

## Validações executadas

| Validação | Resultado |
|---|---|
| `npm run items:external-duplicates` (banco **local** de desenvolvimento, só leitura) | `duplicated_groups: 0`. **Não vale para homolog nem produção**: rodar lá antes de migrar. |
| Migrations Ondas 1 a 3 no MySQL descartável: `run` → `revert` ×3 → `run` | OK, nos dois sentidos |
| Verificação prévia de `1794500000001` com duplicata sintética | Recusou com erro explícito, **sem alterar** esquema nem dados; depois de remover as linhas, aplicou normalmente |
| **Suíte completa de integração no MySQL real** (`test:integration:mysql`) | **59 suítes, 495 testes OK** (26 min) |
| Suítes mobile e de segurança no MySQL, verbose | 6 suítes, 34 testes OK, incluindo concorrência real entre aparelhos |
| Integração S3 existente no MinIO (`test:integration:s3`) | 9/9 OK |
| **Novo: fluxos mobile no S3 real** (`test/integration/storage/mobile-s3.e2e-spec.ts`) | 2/2 OK. A foto foi enviada, verificada e servida byte a byte; um arquivo PNG declarado como JPEG foi recusado (409 `STORAGE_CONTENT_MISMATCH`); a foto importada foi vinculada e servida; a nota de despesa foi confirmada; um **backup de 100 MiB** foi confirmado em cerca de 1,9 s localmente, com janela de 1800 s |
| Novo: contrato OpenAPI × roteador (`openapi-contract.e2e-spec.ts`) | OK nos dois sentidos: não há rota documentada inexistente nem rota `/mobile` sem documentação |
| Novo: homologação (`mobile-homologation.e2e-spec.ts`), SQLite e MySQL | 6/6 OK nos dois |
| Backend `tsc --noEmit`, ESLint/Prettier | OK |
| Unitários e integração SQLite | Executados nas Ondas 0 a 3 (484 e 412 OK); nesta onda, a suíte completa foi rodada no MySQL |

O que a homologação cobre, com evidência em teste:
- **Sessão:** login, refresh, rotação, reuso, concorrência, expiração, logout. Inventariante ativo, bloqueado e sem projeto. Isolamento entre organizações. Perfil personalizado.
- **Itens:** criar, editar, excluir, sincronizar, reenviar; conflitos e concorrência entre aparelhos; fotos; placas duplicadas e faltantes.
- **Despesas e reconciliação:** despesas e anexos; reconciliação, backup e falhas parciais.
- **Web:** regressão das funcionalidades web, pela suíte completa.

**Concorrência real no MySQL**, coberta pelo spec de homologação:
- 24 itens criados em paralelo por 4 aparelhos, mais 8 envios do mesmo item: 25 linhas criadas e nenhum erro.
- O mesmo `base_version` enviado por 4 aparelhos: exatamente um 200 e três 409.
- As versões ficam únicas e positivas.
- Paginação com escrita simultânea: todo item chega uma vez por passagem, e cada alteração chega de novo com versão maior. A versão final é igual à do banco.
- 3 payloads de importação concorrentes mantêm os contadores consistentes (Onda 3).

## Correções e ajustes desta onda

| Risco revisado | Ação |
|---|---|
| Anexo de despesa herdava o limite de 100 MiB dos backups | Limite próprio `EXPENSE_ATTACHMENT_MAX_SIZE_BYTES`, padrão 20 MiB, com o mesmo código `STORAGE_INVALID_SIZE`. Testado. |
| Retenção de refresh tokens e chaves de idempotência | `npm run mobile:retention` (simulação por padrão, grava só com `-- --apply`). Remove refresh tokens de famílias vencidas ou revogadas há mais de 30 dias, chaves de mais de 90 dias e reservas abandonadas há mais de 1 dia. Nunca toca auditoria, itens ou despesas. Testado. **Agendar** no ambiente (por exemplo, uma tarefa diária). |
| Desempenho do relatório de placas | Medido: **100.000 itens em cerca de 3,1 s** no MySQL e 20.000 em menos de 1 s no SQLite. Nenhuma mudança foi necessária. |
| Recuperação de importação interrompida | Testado: payload preso em `processing` há mais de 15 min. O `finish` é recusado (409); o reprocessamento (web) conclui; os contadores ficam corretos. **O app não tem rota de reprocessamento.** Um gestor reprocessa pela web, e o app reenvia o lote, que é idempotente. |
| Campos vazios: importação × PUT | Nas sessões de reconciliação mobile, `null` agora **limpa** o campo, igual ao PUT (inclusive `extra_fields`). A importação web mantém a regra histórica, em que `null` não limpa. Testado nos dois casos. Os `extra_fields` dos lotes mobile passaram a ser validados como no PUT. |
| Códigos HTTP atrás do CloudFront | A correção da Onda 0 (sem `custom_error_response`, função de SPA só no comportamento padrão) tem teste estático. **A AWS real não foi verificada.** |
| Integridade de versão e cursor | Validada sob concorrência real no MySQL (acima). |
| Evidência versionada regenerada por teste | O teste `payment-integrity.mysql` reescreve `docs/correcoes-onda-1-…/evidencias/concurrency-after.json`. O arquivo foi **restaurado** depois da execução. |

## Arquivos desta onda

**Backend:**
- `payments-expenses-scope.service.ts`, `payments-expenses.service.ts` (limite de anexo)
- `import-sessions.service.ts` (`null` na reconciliação mobile)
- `mobile-import.service.ts`, `mobile-items.service.ts` (validação de `extra_fields`)
- `scripts/seed/mobile-retention.ts`, `run-mobile-retention.ts`
- `package.json` (`mobile:retention`)

**Testes:**
- `test/integration/mobile/mobile-homologation.e2e-spec.ts`
- `test/integration/mobile/openapi-contract.e2e-spec.ts`
- `test/integration/storage/mobile-s3.e2e-spec.ts`

**Documentação:** esta pasta.

## Pendências para concluir a homologação (AWS)

1. **Terraform:** rodar `fmt -check`, `validate` e `plan` pelo workflow `infra.yml` (Ondas 0 e 3: CloudFront Function, `moved` do SG, `TRUST_PROXY_HOPS`, limites de storage). Revisar se o plano **não destrói** nada. Aplicar só em homolog, com aprovação.
2. **Homolog, antes das migrations:** rodar `npm run items:external-duplicates`. Se aparecer algo, seguir o saneamento da Onda 2. Depois aplicar `1794400000001`, `1794500000001` e `1794600000001`.
3. **Rodar `field-roles:upgrade`** (simulação e depois `--apply`). Conceder `expenses:*` por perfil a quem for usar despesas.
4. **Smoke test no CloudFront:**
   - `GET /api/v1/mobile/projects/999999/items/sync` com token válido deve devolver 403 JSON;
   - uma rota inexistente da API deve devolver 404 JSON;
   - uma rota da SPA aberta direto deve carregar a página;
   - o IP real deve aparecer no audit de login;
   - dois aparelhos não devem dividir o limite de requisições.
5. **S3 da AWS:** confirmar o versionamento do bucket `assets` (exigido pela verificação de upload) e repetir o fluxo do `mobile-s3` contra homolog, com um backup de 100 MiB numa rede móvel real (tempo dentro de 30 min).
6. **HTTPS CloudFront → ALB:** definir o hostname e a zona Route53 (`api_origin_domain_name`) e aplicar em duas etapas.
7. **Agendar** o `mobile:retention -- --apply`.
8. **App:** executar o checklist do [guia](guia-integracao-app.md#8-checklist-de-homologação-do-app) contra homolog.

## Riscos remanescentes

- **Validação local apenas.** O desempenho e a latência medidos são do Docker local. Na AWS (RDS e S3 remotos), medir de novo o relatório de placas e a confirmação de backups grandes.
- **Importação parcialmente aplicada.** Uma queda do servidor no meio de um payload grande deixa o payload parcialmente aplicado em `processing` até o reprocessamento manual (mais de 15 min).
- **Limite por IP.** Aparelhos atrás do mesmo IP (CGNAT ou Wi-Fi) dividem o limite. Ajustar `THROTTLE_LIMIT` com os dados da homologação.
- **Token de sessão em claro.** O access token (sessão) continua guardado em claro em `sessions.id`, como na web. A exposição se limita a 15 min no app.
- **Bypass do CloudFront.** O ALB aceita qualquer distribuição CloudFront. Falta um header secreto de origem (exige um segredo novo).
- **Colação do MySQL.** `utf8mb4_unicode_ci` trata `external_item_id` sem diferenciar maiúsculas e minúsculas. Os ids numéricos do app não são afetados.
- **Swagger exposto.** `/api/docs` continua público (Onda 0, S13). Avaliar restringir em produção.
