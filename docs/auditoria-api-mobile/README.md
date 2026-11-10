# Auditoria de compatibilidade: app Investor → novo GAI

**Data:** 09/11/2026 · **Branch analisada:** `feature/gai-ajustes-homologacao` (commit `5be342ea`) · **Referência do app:** `api-app-investor.html`, app 1.4.6+1.12, levantamento de 04/11/2026.

**Modo:** só leitura. Não houve alteração de código, banco, configuração ou infraestrutura. Os únicos arquivos criados são os desta pasta. Também não houve commit, push ou deploy.

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [matriz-compatibilidade.md](matriz-compatibilidade.md) | As 20 operações do app, a rota equivalente no GAI, o status e a ação recomendada, com evidências |
| [contratos-api.md](contratos-api.md) | Contrato real de cada endpoint do GAI usado na comparação (headers, payloads, respostas, erros) |
| [lacunas-funcionais.md](lacunas-funcionais.md) | Funcionalidades ausentes ou incompletas, com impacto, alternativa, complexidade e prioridade |
| [auditoria-seguranca.md](auditoria-seguranca.md) | Riscos por severidade, cada um com evidência |
| [plano-integracao-mobile.md](plano-integracao-mobile.md) | Plano em 6 fases até a entrega do contrato homologado à equipe mobile |

Também estão nesta pasta arquivos de uma execução automatizada anterior, do mesmo dia: `catalogo-rotas.md`, `inventario-rotas.json`, `mapa-entidades.md`, `entidades-schema-codigo.json`, `referencias-codigo.*`, `arquitetura-e-dados.md`, `verificacao-inicial.json`, `verificacoes-memoria.json`, `mysql-leitura.json` e `fontes-auditoria.json`.
- Eles foram mantidos como anexos.
- O catálogo de 333 rotas e o mapa de entidades **não foram revisados linha a linha** nesta auditoria.
- As conclusões abaixo vêm da leitura direta do código descrita em cada documento.
- A `matriz-compatibilidade.md` daquela execução foi **substituída** por esta versão.

## Resumo quantitativo

São 20 operações do app: as 19 seções do HTML, com `item/create` e `item/update` contadas separadamente.

| Status | Qtde | Operações |
|---|---|---|
| IMPLEMENTADA E COMPATÍVEL | **0** | — |
| IMPLEMENTADA COM ADAPTAÇÕES | **11** | login, projetos, check_duplicate, financeiro, item/create, item/update, criar sessão, presign, status da sessão, erros, backup |
| PARCIALMENTE IMPLEMENTADA | **5** | sync_items, update_items, item/delete, payloads, finish |
| NÃO IMPLEMENTADA | **3** | auth/refresh, pendências, `GET /external/projects/{id}/items/sync` |
| BLOQUEADA POR SEGURANÇA | **0** | — |
| NÃO VERIFICADA | **1** | `PUT {upload_url}` no S3 (depende do ambiente AWS) |

- **Com equivalente implementado (total ou parcial):** 16 de 20.
- **Com incompatibilidade de contrato:** 17 de 20. Isso inclui todas as 16 com equivalente, mais o PUT no S3, cujos headers e TTL mudam.
- **Inacessíveis ao perfil de campo padrão:** 8 das 16 com equivalente. Ver risco 1.
- **Achados de segurança:** nenhuma rota precisou ser classificada como BLOQUEADA. Todas exigem sessão Bearer e checam organização e projeto. Mesmo assim, há **3 achados altos transversais** (infraestrutura e sessão) e **4 rotas com achados específicos** (financeiro, payloads, login, item/delete). Ver [auditoria-seguranca.md](auditoria-seguranca.md).

O que esta auditoria comprovou e o que ficou de fora:
- **Comprovado por leitura de código e Terraform.** Nenhuma rota foi chamada por HTTP. O `SessionAuthGuard` grava no banco a cada requisição (*touch* da sessão), e até um GET seria escrita.
- **MySQL local:** indisponível (porta 3306 fechada, Docker parado). O esquema foi lido de migrations e entities.
- **AWS:** sem acesso. As conclusões sobre o ambiente AWS vêm do Terraform em `infra/terraform` e precisam ser confirmadas em homologação.

## Principais riscos

1. **O inventariante com acesso ao sistema não consegue operar o app.**
   - O perfil `FIELD_AGENT_ORG_*` recebe só 4 permissões: `projects:read`, `inventory-items:read`, `inventory-sessions:read` e `inventory-observations:create` ([field-agent-management.service.ts:40-45](../../gai-backend/src/modules/field-agents/application/services/field-agent-management.service.ts#L40-L45)).
   - Faltam criar e editar item, imagens, sessões de importação, despesas e pendências.
   - Acrescentar permissões ao perfil faz os novos convites falharem, porque o código exige exatamente esse conjunto (mesmo arquivo, :381-390).
   - Um perfil personalizado com essas permissões, por outro lado, não recebe o filtro de projetos vinculados, que só vale para `FIELD_AGENT_ORG_*` ([session-auth.guard.ts:159-209](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts#L159-L209)) e é a garantia de isolamento por projeto.
2. **Não há renovação de sessão adequada a operação offline.**
   - O token é uma sessão opaca (UUID), não um JWT.
   - A sessão expira após 8 h sem uso e não há refresh token.
   - Um técnico que passa a noite offline perde a sessão e a fila de envio para de andar até ele fazer login de novo.
3. **Não existe envio idempotente de item com fotos.**
   - `POST /inventory-items` não deduplica: o mesmo item reenviado vira duas linhas.
   - O upsert existe só na importação. Lá ele não tem chave única nem lock, e duas chamadas em paralelo podem duplicar o item.
   - As fotos da importação ficam só em `metadata`; não viram `inventory_item_images`.
4. **Pendências e o download incremental não existem.**
   - Não há cálculo de faixas de placas faltantes nem de duplicadas novas e antigas.
   - Não há endpoint de sincronização com cursor ou `updated_since`.
5. **O CloudFront reescreve respostas 403 e 404 da API para HTTP 200 com o `index.html`.**
   - Isso vem do `custom_error_response`, que vale para a distribuição toda ([cloudfront.tf:102-114](../../infra/terraform/cloudfront.tf#L102-L114)).
   - Como a fila do app trata 200 como sucesso, um envio recusado pode ser marcado como enviado.
   - *Comprovado pela configuração; ainda não testado em homologação.*
6. **O limite de requisições é compartilhado entre todos os usuários na AWS.**
   - O throttler usa `req.ip`, e não há `trust proxy` configurado. Atrás de CloudFront e ALB, todos os clientes aparecem com o IP do ALB.
   - O limite fica em 100 req/min no total e o login em 10/min no total.
   - Uma frota de celulares sincronizando a cada minuto recebe 429.

## Recomendação

Não apontar o app para o GAI agora. Seguir esta ordem (detalhes em [plano-integracao-mobile.md](plano-integracao-mobile.md)):

1. **Infraestrutura:** corrigir o `custom_error_response` para não valer em `/api/*`, configurar `trust proxy` e a chave do throttler, e usar HTTPS entre CloudFront e ALB.
2. **Identidade de campo:**
   - Definir um conjunto mínimo de permissões operacionais para o perfil de campo.
   - Exigir vínculo ativo em todas as mutações.
   - Amarrar `field_agent_id` ao usuário autenticado.
   - Bloquear inventariante inativo em itens, importação e despesas.
3. **Sessão mobile:** refresh token rotativo com vida máxima absoluta e revogação.
4. **Sincronização:**
   - Chave única `(project_id, external_item_id)` e um endpoint de upsert idempotente reaproveitando a lógica de `applyItem`.
   - Vincular as fotos a `inventory_item_images`.
   - Download incremental com cursor.
   - Exclusão sincronizável.
5. **Pendências:** cálculo somente leitura, sem efeitos colaterais.
6. **Reconciliação:** corrigir o status de falha, o checksum calculado no servidor e as transições de estado, e alinhar os limites de backup.
7. **Homologação, e só depois** o contrato definitivo para a equipe mobile.

A forma recomendada é uma **camada mobile fina** (`/api/v1/mobile/...`) que reaproveite os serviços existentes. Ela não deve replicar os caminhos do Laravel. Toda troca de base URL já exige uma nova versão do app, então manter os caminhos legados não traz compatibilidade com versões antigas.
