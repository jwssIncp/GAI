# Lacunas funcionais

Cada lacuna abaixo foi comprovada por leitura de código. As evidências estão na [matriz](matriz-compatibilidade.md).

**Complexidade:**
- **P:** até 2 dias.
- **M:** 3 a 7 dias.
- **G:** mais de 1 semana.

**Prioridade:**
- **P0:** bloqueia a migração.
- **P1:** necessária antes da homologação.
- **P2:** melhoria.

## L1. Perfil operacional sem permissões para coletar (P0, M)

- **Esperado pelo app:** o técnico logado cria, edita e apaga itens, sobe fotos, abre sessões de reconciliação e registra despesas.
- **Comportamento atual:**
  - O perfil `FIELD_AGENT_ORG_*` tem só `projects:read`, `inventory-items:read`, `inventory-sessions:read` e `inventory-observations:create` ([field-agent-management.service.ts:40-45](../../gai-backend/src/modules/field-agents/application/services/field-agent-management.service.ts#L40-L45)).
  - O provisionamento exige exatamente esse conjunto: alterar o perfil quebra os novos convites (:354, :381-390).
  - O filtro de projetos vinculados só vale para esse perfil ([session-auth.guard.ts:159-209](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts#L159-L209)).
- **Impacto:** nenhuma das rotas de escrita do app é utilizável pelo inventariante. A única saída hoje é dar um perfil personalizado, e com ele o usuário passa a ver todos os projetos da organização.
- **Alternativa disponível:** nenhuma que seja segura.
- **Implementação recomendada:**
  - Definir um conjunto operacional mínimo para o campo, por exemplo `inventory-items:create/update`, `inventory-item-images:create/update/read/download`, `import-sessions:create/read/finish`, `import-files:create`, `import-payloads:create`, `import-errors:read`, `expenses:create`, `expenses:upload-attachment` e um novo `inventory-items:sync`.
  - Tratar esse conjunto como uma versão do perfil, com migração dos perfis já existentes.
  - Aplicar o filtro de projetos por vínculo também a qualquer usuário que tenha um `field_agent` vinculado, não só pelo prefixo do perfil.
- **Componentes:** `field-agents` (provisionamento), `session-auth.guard`, seed de permissões, frontend de perfis.

## L2. Renovação de sessão para uso offline (P0, M)

- **Esperado pelo app:** a sessão sobrevive a dias offline, é renovada sem pedir a senha e o app não pede login ao abrir.
- **Comportamento atual:** a sessão opaca expira após 8 h sem uso. Não há refresh ([auth.controller.ts](../../gai-backend/src/modules/auth/presentation/auth.controller.ts)), e a sessão vencida é recusada.
- **Impacto:** a fila para depois de uma noite offline. Os itens ficam no aparelho até um novo login.
- **Alternativa disponível:** aumentar `SESSION_TTL_HOURS`. Não é recomendado: vale para o painel web também e a sessão continua sem limite absoluto.
- **Implementação recomendada:**
  - Criar `POST /auth/mobile/refresh` com refresh token opaco, guardado como hash, rotativo, com detecção de reuso, vida máxima absoluta (por exemplo 30 dias) e vínculo com o dispositivo.
  - O access token continua sendo a sessão atual, com TTL curto.
  - Revogar tudo quando o usuário for desativado ou o inventariante for inativado ou bloqueado.
  - Não aceitar access tokens vencidos.
- **Componentes:** `auth` (entity nova `refresh_tokens`, use case, rota), `users` e `field-agents` (revogação).

## L3. Envio idempotente de item com fotos (P0, G)

- **Esperado pelo app:** uma chamada por item, reenviável sem duplicar, que cria ou atualiza pelo id gerado no aparelho, com fotos.
- **Comportamento atual:**
  - O `POST /inventory-items` sempre insere.
  - O upsert existe só no payload de importação. Ali `external_item_id` **não é único** e o fluxo é procurar e depois inserir, sem lock.
  - As fotos da importação ficam só em `metadata.import_images` e não viram `inventory_item_images`, então nunca são verificadas.
  - O audit grava só `row_number`.
  - O máximo é de 3 fotos por item.
- **Impacto:** itens duplicados a cada reenvio ou corrida, fotos que não aparecem no GAI e trilha de auditoria pobre.
- **Alternativa disponível:** sessão de importação com `operation: upsert`, enviando item por item. Ainda sobram a corrida e o problema das fotos.
- **Implementação recomendada:**
  - **Banco:** chave única `(project_id, external_item_id)`, em migration nova. Antes, verificar se já existem duplicados.
  - **Rota:** um endpoint mobile de upsert por `external_item_id` que reaproveite a lógica de `applyItem`, com `If-Match`/`updated_at` para conflito de edição concorrente.
  - **Fotos:** vincular ao item pelo fluxo `inventory-item-images` (upload-url, PUT, confirm), usando um `client_image_id` idempotente.
  - **Auditoria:** registrar no audit o diff real dos campos.
  - **Limite de fotos:** decidir o máximo por item com o negócio.
  - **Placa antiga 2:** o legado tem `placa_antiga_2` e o GAI não. Decidir entre coluna nova e `metadata`.
- **Componentes:** `inventory-items`, `inventory-item-images`, `import-sessions` (extrair `applyItem` para um serviço compartilhado), migrations.

## L4. Download incremental de itens (P0, M)

- **Esperado pelo app:** substitui o `update_items` e o `/external/.../items/sync`. Baixa os itens do projeto (opcionalmente por unidade) desde um cursor, inclusive os removidos, e retoma de onde parou.
- **Comportamento atual:** só a listagem por offset, até 100 por página, em ordem `created_at DESC`, sem `updated_since` nem filtro por unidade ou por `external_item_id`. As URLs das fotos exigem uma chamada por imagem.
- **Impacto:** a paginação por offset numa lista que muda pode pular ou repetir itens. Não há como saber o que mudou nem o que foi excluído.
- **Alternativa disponível:** baixar tudo a cada sincronização. Não escala para projetos com milhares de itens.
- **Implementação recomendada:**
  - Criar `GET /mobile/projects/{id}/items/changes?cursor=&limit=` com cursor opaco baseado em `(updated_at, id)`, devolvendo também tombstones (itens removidos ou inativos) e `next_cursor`/`has_more`.
  - Criar um índice `(project_id, updated_at, id)`.
  - Incluir as imagens com URL assinada sob demanda, ou um endpoint de lote de URLs.
- **Componentes:** `inventory-items` (repositório, índice), `inventory-item-images`.

## L5. Exclusão sincronizável (P1, P)

- **Esperado pelo app:** a exclusão entra na fila (também offline), é idempotente e o item não reaparece.
- **Comportamento atual:**
  - O `deactivate` usa o id interno.
  - O delete via payload não é idempotente: um item ausente gera erro.
  - Um upsert tardio sobre item removido atualiza os campos e pode mudar `status` sem limpar `deleted_at` ([import-sessions.service.ts:988](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L988)).
  - O PATCH aceita `status` livre, inclusive `inactive` sem `deleted_at`.
- **Impacto:** estados inconsistentes. Um item apagado num aparelho pode ser editado por outro e voltar.
- **Implementação recomendada:**
  - Delete por `external_item_id`, idempotente: se já estiver removido, responder 200.
  - Recusar upsert sobre item removido com `409 ITEM_REMOVED`, a menos que haja uma reativação explícita.
  - Retirar `inactive` e `removed` do `status` aceito em create e PATCH.
  - Expor os tombstones no download incremental (L4).
- **Componentes:** `inventory-items`, `import-sessions`.

## L6. Pendências de placas (P1, M)

- **Esperado pelo app:** `placas_faltantes` (faixas como `"11-27"`), `novas_duplicadas` e `antigas_duplicadas`, com os itens envolvidos (técnico, unidade, localização, descrição), sem gravar nada.
- **Comportamento atual:** `pending-issues/generate` grava issues de conciliação contábil, não calcula lacunas e não detecta duplicadas (o `Set` junta as repetições).
- **Impacto:** a tela Pendências fica só com o cálculo local do aparelho, sem ver os itens dos outros técnicos.
- **Implementação recomendada:**
  - Criar `GET /mobile/projects/{id}/plate-report`, somente leitura, com consulta agregada `GROUP BY new_plate HAVING COUNT>1` (e o mesmo para `old_plate`).
  - Calcular as lacunas só sobre placas numéricas e definir a regra para as alfanuméricas.
  - Excluir os itens removidos.
  - Identificar o técnico por `created_by_id` → nome, ou pelo `field_agent` (ver L9).
  - Atenção: a normalização remove hífens, então `"11-27"` e `"1127"` colidem. Rever a regra de normalização com o negócio.
- **Componentes:** `inventory-items` (consulta de leitura).

## L7. Despesa feita pelo próprio técnico (P1, P)

- **Esperado pelo app:** o técnico registra a despesa e a foto da nota em seu nome.
- **Comportamento atual:**
  - A funcionalidade existe, mas o perfil de campo não tem permissão.
  - O `field_agent_id` vem do corpo e não é amarrado a quem chama.
  - O status do inventariante não é checado.
  - Data e valor exigem formatos estritos.
  - Transições inválidas geram 500.
- **Implementação recomendada:**
  - Para usuários vinculados a um inventariante, derivar `field_agent_id` do usuário (o mesmo padrão de `requireOperationalAssignment`) e exigir inventariante ativo.
  - Converter os erros de domínio em 409.
  - No app, enviar data ISO e valor decimal com ponto.
- **Componentes:** `payments-expenses`.

## L8. Reconciliação: correções de fluxo (P1, M)

| Problema | Evidência | Correção |
|---|---|---|
| `failedPayloads` nunca é incrementado e o payload sempre termina `processed`. O `finish` sempre resulta em `finished`, e `retry` e `reprocess` não têm o que reprocessar | [import-sessions.service.ts:126, 304, 637](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L637) | Marcar o payload como `failed` ou `processed_with_errors` e propagar isso para a sessão |
| `finish` e `cancel` não validam o estado atual nem a expiração | :288-336 | Política de transição explícita |
| Checksum opcional e informado pelo cliente | :994-1019 | Calcular o hash do corpo no servidor |
| TTL de 24 h; o legado usa 7 dias | [import-session-scope.service.ts:41-43](../../gai-backend/src/modules/import-sessions/application/services/import-session-scope.service.ts#L41-L43) | Configurar `IMPORT_SESSION_TTL_HOURS` para o fluxo mobile |
| Sessão sem `unidade` | entity | Campo próprio ou `metadata.unidade` com validação |
| As mutações exigem o id numérico; só a leitura aceita uuid | controller :91-104 | Aceitar `session_uuid` nas rotas mobile |
| Backup: 50 MB na AWS ([ecs.tf:72](../../infra/terraform/ecs.tf#L72)); o app manda até 100 MB. Confirmação em até 300 s após o presign | ecs.tf; [storage-object.policy.ts:20-28](../../gai-backend/src/common/storage/storage-object.policy.ts#L20-L28) | Definir o limite e usar multipart upload no S3 ou TTL maior para backup |
| Erros sem `payload_number` | response DTO | Incluir o campo |
| Caminhos de imagem no payload não são validados contra arquivos confirmados da sessão | :990 | Aceitar só `import_files` confirmados da mesma sessão |

## L9. Identidade do inventariante no app (P1, P)

- **Esperado pelo app:** saber quem é o técnico (o nome no `gai_user`) e associar os itens a ele.
- **Comportamento atual:**
  - Os itens guardam `created_by_id` (usuário). Não existe coluna de inventariante em `inventory_items`.
  - Não há rota que devolva ao perfil de campo o seu próprio `field_agent_id`.
  - Inventariante sem acesso ao sistema não aparece como autor.
- **Implementação recomendada:**
  - Criar `GET /mobile/me`, que devolva o usuário, o inventariante vinculado e os projetos com vínculo vigente.
  - Avaliar uma coluna `field_agent_id` em `inventory_items` para preservar o histórico mesmo quando o usuário for desativado.

## L10. Rename em lote de unidade e localização (P2, M)

- **Comportamento atual:** não existe. `unit_text` e `location_text` são texto livre em cada item.
- **Implementação recomendada:**
  - Criar `POST /projects/{id}/inventory-items/rename-location`, com `{field: unit|location, from, to}`, restrito ao projeto e com permissão própria.
  - Executar em transação, com uma linha de auditoria por item ou uma operação em lote auditada.
  - Alternativa a avaliar: relacionar com `project_units` (já existe `ProjectUnitEntity` em `companies`).

## L11. Recebimento de logs do app (P2, P)

Opcional no legado, e não existe no GAI. Se for implementado:
- Upload por presign com `type: other`, com limite de tamanho.
- Retenção definida.
- Remoção de dados pessoais antes do envio.
