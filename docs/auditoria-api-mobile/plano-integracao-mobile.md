# Plano de integração do app Investor ao GAI

Os endpoints marcados como **(proposto)** **não existem hoje**. Eles são a recomendação desta auditoria e só entram no contrato entregue à equipe mobile depois de implementados e homologados. As lacunas (L*) e os riscos (S*) citados estão em [lacunas-funcionais.md](lacunas-funcionais.md) e [auditoria-seguranca.md](auditoria-seguranca.md).

## Decisão de arquitetura

Criar uma **camada mobile fina**, com prefixo `/api/v1/mobile/...`, sobre os serviços existentes. As razões:

- **Os contratos atuais são de painel web.** A paginação é por offset, os uploads são em três etapas por arquivo e as sessões usam id numérico. O app precisa de upsert idempotente, cursor e identificação por `external_item_id`/`session_uuid`.
- **As regras de negócio não podem ser duplicadas.** A camada só traduz contrato e delega aos serviços: `applyItem` da importação, extraído para um serviço de domínio; o fluxo de imagens; as despesas; e `requireOperationalAssignment`.
- **Os caminhos do Laravel não devem ser replicados.** A troca de base URL já exige uma nova versão do app, e as versões antigas continuam no Laravel até serem atualizadas. `item/create` e `item/update` **não serão migrados**.
- **Rotas sem autenticação estão fora de cogitação**, inclusive como medida de compatibilidade.

Reaproveitamento direto, com o app se adaptando:
- `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/password/change`;
- `GET /projects`;
- `GET /projects/:id/inventory-items?new_plate=` (checagem de duplicidade);
- o fluxo de imagens;
- despesas e anexos;
- as rotas de importação, depois das correções de L8.

## Fase 1: autenticação e autorização (bloqueante)

| Entrega | Resolve | Componentes |
|---|---|---|
| Tirar o `custom_error_response` do comportamento `/api/*` (CloudFront Function para o fallback da SPA) | S1 | `infra/terraform/cloudfront.tf` |
| `trust proxy`, throttler por usuário/sessão, limites mobile, 429 com o código correto | S2, S12 | `main.ts`, `app.module.ts`, filtro de exceções |
| TLS entre CloudFront e ALB | S4 | `alb.tf`, `cloudfront.tf` |
| Perfil operacional de campo com as permissões mínimas de coleta, versionado, com migração dos perfis existentes | L1 | `field-agents`, seed de permissões |
| Filtro de projetos por vínculo para **todo** usuário com `field_agent` vinculado, não só pelo prefixo do perfil | S3 | `session-auth.guard` ou permissão de escopo de projeto checada nos serviços |
| `requireOperationalAssignment` em todas as mutações operacionais (itens, importação, despesas); revogar sessões ao inativar ou bloquear o inventariante | S6, S7 | `inventory-items`, `import-sessions`, `payments-expenses`, `field-agents` |
| Refresh token mobile **(proposto: `POST /auth/mobile/refresh`)**: opaco, guardado como hash, rotativo, com detecção de reuso, vida máxima absoluta e revogação. Token de sessão guardado como hash | L2, S5 | `auth` (entity nova, migration) |
| `GET /mobile/me` **(proposto)**: usuário, inventariante vinculado e projetos vigentes | L9 | `auth`/`field-agents` |

**Critério de saída:** testes e2e que provem:
- o perfil de campo só acessa projetos vinculados;
- um perfil personalizado com inventariante vinculado também fica restrito;
- um inventariante inativo recebe 401/403 imediatamente;
- 403 e 404 chegam como JSON pelo CloudFront de homologação;
- o refresh rotaciona o token, e um token reutilizado revoga a família de tokens.

## Fase 2: reutilização das APIs existentes

O app passa a usar, só adaptando o contrato do lado dele:

| Função no app | Rota GAI | Adaptação no app |
|---|---|---|
| Login | `POST /auth/login` | Enviar `identifier`; ler `access_token` e `expires_at`; tratar `must_change_password` |
| Projetos | `GET /projects` | Ler `items[]`, `name` e `description`; paginar |
| Checagem de placa | `GET /projects/:id/inventory-items?new_plate=X` / `?old_plate=X` | `total_items > 0`, desconsiderando itens `inactive` e `removed` |
| Despesa | `POST /projects/:id/expenses` + anexos | Data `YYYY-MM-DD`; valor `"120.50"`; anexo em 3 passos |

Para despesas e checagem de placa, só depois da Fase 1, porque hoje o perfil de campo não tem acesso.

## Fase 3: correção das lacunas

| Entrega | Lacuna |
|---|---|
| Chave única `(project_id, external_item_id)`. **Antes:** consulta somente leitura de duplicados existentes | L3, S9 |
| Extrair `applyItem` para um serviço compartilhado, com diff no audit e transições de status protegidas | L3, L5, S9 |
| **(proposto)** `PUT /mobile/projects/{id}/items/{external_item_id}`: upsert idempotente com controle de conflito (`updated_at`/`If-Match`) | L3 |
| **(proposto)** `DELETE /mobile/projects/{id}/items/{external_item_id}`: exclusão lógica idempotente; upsert sobre item removido devolve `409 ITEM_REMOVED` | L5 |
| **(proposto)** Fotos: upload-url e confirm do item por `external_item_id`, com `client_image_id` idempotente; decidir o limite de fotos por item | L3 |
| **(proposto)** `GET /mobile/projects/{id}/plate-report`: placas faltantes e duplicadas, novas e antigas, somente leitura | L6 |
| Decidir `placa_antiga_2` (coluna nova ou `metadata`) e a regra de normalização de placas (hífens) | L3, L6 |
| Despesa: `field_agent_id` derivado do usuário; erros de domínio como 409 | L7, S12 |

## Fase 4: sincronização e reconciliação

| Entrega | Lacuna |
|---|---|
| **(proposto)** `GET /mobile/projects/{id}/items/changes?cursor=&limit=&unit=`: cursor `(updated_at,id)`, tombstones, `has_more`; índice `(project_id, updated_at, id)` | L4 |
| Importação: payload com falha marca `failed`; sessão `finished_with_errors`; política de transição em `finish`/`cancel`; checksum calculado pelo servidor | L8 |
| Importação: rotas mobile por `session_uuid`; TTL configurável (7 dias); `unidade` na sessão; `payload_number` nos erros | L8 |
| Importação: `images[]` só com ids de arquivos confirmados da sessão, vinculados a `inventory_item_images` | L8, S8 |
| Backup: limite acordado (hoje 50 MB na AWS, 100 MB no app) e multipart upload no S3 ou TTL próprio para arquivos grandes | L8 |
| Regras de fila no app: só 2xx com corpo JSON conta como sucesso; 4xx definitivo vai para uma fila de erro visível; 401 dispara refresh; 409 resolve conflito; 5xx e 429 repetem com backoff | — |

## Fase 5: homologação

Rodar em homologação AWS, com dados sintéticos, sem PROD:

1. **Fluxo completo de coleta:** login, projetos, item novo com 3 fotos, edição, exclusão, download incremental em outro aparelho.
2. **Offline:** 24 h sem rede, 500 itens na fila, retorno da conexão, ordem e idempotência preservadas, sem duplicatas mesmo com envios paralelos.
3. **Token:**
   - access token vencido seguido de refresh;
   - refresh reutilizado, que revoga a família de tokens;
   - senha alterada, que revoga as sessões;
   - `must_change_password`.
4. **Acesso indevido:**
   - projeto sem vínculo;
   - vínculo fora do período;
   - outra organização;
   - item de outro projeto na URL;
   - `field_agent_id` de outro técnico na despesa.
5. **Inventariante desativado ou bloqueado** no meio da sessão: a próxima chamada falha e o histórico continua consultável.
6. **Infraestrutura:**
   - 403 e 404 chegam como JSON;
   - o rate limit é individual (vários aparelhos sem 429 cruzado);
   - o upload com TTL expirado devolve 410 e o app recupera;
   - backup grande em rede lenta.
7. **Reconciliação:** sessão com 3 payloads, um deles com erro de item, status final correto, retomada após o app ser encerrado.
8. **Pendências:** comparação com o resultado do Laravel para o mesmo conjunto de placas.
9. **Carga:** N técnicos × 2 envios paralelos por minuto, medindo latência e 429.

## Fase 6: entrega à equipe mobile

Só depois de concluídas as Fases 1 a 5, publicar a especificação definitiva, a partir do Swagger gerado e revisado:

- **Base:** URL definitiva do ambiente de produção. Hoje `domain_name` não está definido no Terraform; confirmar o domínio.
- **Autenticação:** login, refresh, logout, troca obrigatória de senha, armazenamento seguro no Android Keystore.
- **Permissões:** o que o perfil de campo pode fazer e quais erros recebe (401, 403, 409 `FIELD_AGENT_*`).
- **Endpoints oficiais:** só os implementados e homologados, com payloads e respostas reais, exemplos e códigos de erro (`{code, message}`).
- **Regras de sincronização:** id do item (`external_item_id`, sempre string), idempotência, cursor, tombstones, conflitos, fotos (presign, PUT com headers exatos, confirm dentro do TTL), backoff.
- **Guia de migração:** mapeamento campo a campo do legado para o GAI. Exemplos: `placa_nova` → `new_plate`, `obs` → `notes`, `extra_fields` → `metadata`, `gai_user` → derivado da sessão. Inclui a convivência de versões durante o rollout e o desligamento do Laravel.

## Pendências que dependem de verificação externa

- Ambiente AWS: domínio, Swagger exposto, versionamento e CORS do bucket `assets`, valores reais de `SESSION_TTL_HOURS` e `IMPORT_SESSION_TTL_HOURS` (não definidos no `ecs.tf`, valem os defaults 8 h e 24 h).
- MySQL: duplicados existentes de `external_item_id` por projeto antes de criar a chave única. O banco local estava indisponível nesta auditoria.
- App: armazenamento do token e comportamento da fila diante de 200 com HTML. Não há código do app neste repositório.
