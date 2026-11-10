# Auditoria de segurança: rotas relevantes para o app

**Escopo:** autenticação, autorização, isolamento entre organizações, uploads e sincronização nas rotas que o app usaria, além da infraestrutura AWS que fica no caminho delas.

**Método:** leitura de código e de Terraform. **Nada foi testado por HTTP.** Os itens de infraestrutura precisam ser confirmados em homologação.

## Pontos positivos comprovados

- **Nenhuma rota sem token.**
  - Todas as rotas equivalentes exigem `Bearer` pelo `SessionAuthGuard`.
  - As únicas rotas públicas são `GET /health`, `POST /auth/login`, `activation/confirm` e `password-reset/*`, além do Swagger em `/api/docs`.
  - O problema do legado (rotas `/gai/*` sem autenticação) não existe no GAI.
- **Sessão verificada a cada requisição.** O guard confere, em toda chamada:
  - se a sessão está ativa e não revogada;
  - se `auth_version` bate (troca de senha invalida as sessões);
  - o status do usuário e o bloqueio;
  - se a organização está ativa;
  - se a senha temporária venceu.
  - Evidência: [session-auth.guard.ts:73-153](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts#L73-L153).
- **Tenant definido no servidor.** `organization_id` e `project_id` vêm da sessão e da URL, nunca do corpo. Os use cases cruzam item com projeto (404 se não bate) e projeto com organização (403).
  - Não encontrei IDOR entre organizações nas rotas de itens, imagens, importação e despesas.
- **Mass assignment barrado.** O `forbidNonWhitelisted` recusa campos fora do DTO, e `created_by_id`/`updated_by_id` vêm sempre do usuário autenticado.
- **PLATFORM_ADMIN fora da gestão de inventariantes.**
  - Ele recebe `false` em `field-agents:*` e `project-field-agents:*` ([permission-access.ts:17-25](../../gai-backend/src/modules/auth/application/services/permission-access.ts)).
  - `assertOperationalActor` também barra PLATFORM_ADMIN.
- **Uploads verificados.** Antes de aceitar o arquivo, o servidor confere tamanho, MIME, SHA-256 e magic bytes, exige bucket versionado e restringe a chave a `organizations/{org}/` ([s3-storage-adapter.service.ts:146-334](../../gai-backend/src/common/storage/s3-storage-adapter.service.ts#L146-L334)).
- **Logs e senhas protegidos.** O Pino oculta campos sensíveis, as senhas usam argon2 e o login tem bloqueio após falhas.

## Riscos

| ID | Severidade | Risco | Rotas afetadas |
|---|---|---|---|
| S1 | **Alta** | O CloudFront transforma 403/404 da API em 200 + HTML | Todas sob `/api/*` |
| S2 | **Alta** | O rate limit é compartilhado por todos os clientes atrás do ALB | Todas, principalmente o login |
| S3 | **Alta** | O isolamento por projeto depende do nome do perfil | Todas sob `/projects/:id/*` |
| S4 | Média | Tráfego HTTP sem TLS entre CloudFront e ALB | Todas |
| S5 | Média | Sessão sem expiração absoluta e token guardado em claro | Todas |
| S6 | Média | Inventariante inativo ou bloqueado continua operando por outros caminhos | Itens, importação, despesas |
| S7 | Média | `field_agent_id` da despesa não é amarrado a quem chama | Despesas |
| S8 | Média | Caminhos de imagem do payload não são validados | Payloads de importação |
| S9 | Média | Integridade da sincronização: corrida, replay silencioso e auditoria pobre | Payloads de importação, item create |
| S10 | Baixa | IP do audit vem do `X-Forwarded-For` informado pelo cliente | Login, logout, reset |
| S11 | Baixa | Oráculos de existência e de status do projeto | Imagens e itens |
| S12 | Baixa | Erros de domínio respondem 500 e 429 sai com o código errado | Despesas, todas |
| S13 | Baixa | Swagger público | `/api/docs` |

### S1. O CloudFront reescreve erros da API (Alta)

- **Evidência:** [cloudfront.tf:102-114](../../infra/terraform/cloudfront.tf#L102-L114) declara `custom_error_response` 403 → 200 `/index.html` e 404 → 200 `/index.html`.
- **Por que acontece:** essa configuração vale para a distribuição inteira, inclusive o comportamento `/api/*` (:91-99).
- **Impacto:**
  - Uma resposta 403 (sem permissão, fora do projeto) ou 404 (item ou sessão inexistente) chega ao cliente como **HTTP 200 com HTML**.
  - A fila do app considera 200 como enviado, e o item se perde em silêncio.
  - Também mascara recusas de autorização nos logs do cliente.
- **Correção:** remover o `custom_error_response` e resolver o fallback da SPA de outro jeito, por exemplo com uma CloudFront Function no comportamento padrão que reescreva para `/index.html` as rotas sem extensão. Depois, testar que `/api/v1/projects/999999` devolve 404 JSON.
- *Status: comprovado na configuração; não testado contra a AWS.*

### S2. Rate limit compartilhado (Alta, disponibilidade)

- **Evidência:**
  - `ThrottlerGuard` global com 100/60 s ([app.module.ts:118-123, 239](../../gai-backend/src/app.module.ts#L118-L123)).
  - Não há `trust proxy` nem `getTracker` em `main.ts` nem no módulo.
  - O tráfego chega por CloudFront → ALB → ECS.
- **Por que acontece:** o Express usa o IP do socket, que é o nó do ALB. Todos os usuários caem no mesmo contador, ou em poucos.
- **Impacto:**
  - O login fica limitado a 10/min **no total**.
  - Uma equipe de técnicos sincronizando a cada minuto, com 2 envios paralelos e 3 uploads, recebe 429 e trava também o painel web.
  - O 429 ainda sai com `code: "INTERNAL_ERROR"`.
- **Correção:**
  - `app.set('trust proxy', <número de saltos>)`, confiando só na cadeia CloudFront/ALB.
  - Tracker por usuário autenticado (id da sessão) nas rotas privadas e por IP real no login.
  - Limites próprios para as rotas mobile.

### S3. Isolamento por projeto depende do nome do perfil (Alta)

- **Evidência:** a restrição por vínculo ativo e vigente só se aplica a quem tem um perfil cuja chave começa com `FIELD_AGENT_ORG_` e não é ORG_ADMIN nem PLATFORM_ADMIN ([session-auth.guard.ts:159-209](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts#L159-L209)).
- **Por que é um problema:**
  - Esse perfil não tem as permissões de coleta (L1), e alterá-lo quebra os convites ([field-agent-management.service.ts:381-390](../../gai-backend/src/modules/field-agents/application/services/field-agent-management.service.ts#L381-L390)).
  - O caminho prático para o app funcionar é dar ao técnico um **perfil personalizado**. Com ele, o técnico enxerga e altera **todos os projetos da organização**.
  - Os use cases de itens, importação e despesas não checam o vínculo com o projeto.
- **Impacto:** quebra a regra "o app lista e altera só projetos autorizados" e expõe dados de outros clientes da mesma organização.
- **Correção:**
  - Aplicar o filtro de vínculo a todo usuário que tenha `field_agent` vinculado.
  - Ou criar uma permissão explícita `scope=PROJECT` para as rotas mobile e checá-la no serviço, não pelo regex de URL.
  - Testar perfil de campo, perfil personalizado e ORG_ADMIN.
- **Lembrete:** o nome do perfil, isoladamente, não garante acesso operacional.

### S4. CloudFront → ALB em HTTP (Média)

- **Evidência:** `origin_protocol_policy = "http-only"` ([cloudfront.tf:67](../../infra/terraform/cloudfront.tf#L67)) e listener do ALB só na porta 80 ([alb.tf:40-50](../../infra/terraform/alb.tf#L40-L50)).
- **Mitigação existente:** o security group do ALB só aceita a prefix list do CloudFront ([security_groups.tf:11-17](../../infra/terraform/security_groups.tf#L11-L17)).
- **Risco residual:** o Bearer, as credenciais de login e os dados dos itens trafegam sem TLS entre a borda do CloudFront e a região AWS.
- **Correção:** certificado ACM no ALB, listener 443 e origem `https-only`.

### S5. Sessão sem limite absoluto e token em claro (Média)

- **Evidência:**
  - O `touch` renova a expiração a cada requisição, sem teto ([session-auth.guard.ts:146-153](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts#L146-L153)).
  - A sessão é guardada como `sessions.id` VARCHAR(36), o próprio token ([session.entity.ts:15](../../gai-backend/src/modules/auth/infrastructure/persistence/session.entity.ts#L15)).
- **Impacto:**
  - Um token vazado e usado de forma contínua não expira nunca.
  - Quem ler a tabela `sessions` (backup, bastion, réplica) pode assumir qualquer sessão ativa.
  - Para o app, que guarda o token por dias, o risco é maior.
- **Correção:**
  - Guardar o hash do token.
  - Vida máxima absoluta.
  - Refresh rotativo com detecção de reuso (L2).
  - No app, armazenar em Android Keystore/EncryptedSharedPreferences. Isso não foi verificado, porque não há código do app neste repositório.

### S6. Inventariante desativado continua operando por outros caminhos (Média)

- **O que já funciona:** para o perfil de campo, o guard exige inventariante e vínculo ativos (:171-193), e um inventariante inativo fica sem projetos.
- **Lacunas:**
  - O status do inventariante não é checado em `inventory-items`, nos payloads da importação (que exigem só vínculo ativo, [import-sessions.service.ts:757-776](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L757-L776)) nem em despesas ([payments-expenses.service.ts:675-697](../../gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts#L675-L697)).
  - Desativar o inventariante não encerra os vínculos nem revoga as sessões do usuário ligado a ele.
- **Impacto:** com perfil personalizado (S3), um inventariante bloqueado continua lançando dados. Despesas e observações podem ser atribuídas a um inventariante inativo que ainda tem vínculo.
- **Correção:**
  - Usar `requireOperationalAgent`/`requireOperationalAssignment` em todas as mutações operacionais.
  - Revogar as sessões quando o inventariante passar a inativo ou bloqueado.
  - Manter o histórico. A exclusão continua lógica.

### S7. Despesa atribuível a qualquer inventariante (Média)

- **Evidência:** o `field_agent_id` vem do corpo, e `assertFieldAgent` checa só a organização e o vínculo (:675-697). Não há a regra de conta própria que existe em `requireOperationalAssignment` ([operational-eligibility.ts:101-113](../../gai-backend/src/modules/field-agents/application/services/operational-eligibility.ts#L101-L113)).
- **Impacto:** um técnico com `expenses:create` pode lançar despesas em nome de outro técnico do projeto, com consequência financeira (reembolso).
- **Correção:** para contas vinculadas a um inventariante, derivar `field_agent_id` do usuário e recusar um valor diferente. Gestores continuam podendo informar o campo.

### S8. Referências de imagem não validadas no payload (Média)

- **Evidência:** `item.images[].path` (até 500 caracteres, livre) é copiado para `metadata.import_images` sem conferir se pertence a um `import_file` confirmado da sessão ([import-sessions.service.ts:990](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L990)).
- **Impacto hoje:** baixo, porque nenhum código gera URL a partir desse metadata.
- **Impacto futuro:** se a vinculação das fotos (L3) usar esses caminhos sem validar, um usuário poderá apontar para objetos de outra organização ou para arquivos nunca verificados.
- **Correção:** aceitar só ids de `import_files` (ou de `inventory_item_images`) confirmados da mesma sessão e organização.

### S9. Integridade da sincronização (Média)

- **Corrida:**
  - O upsert procura e depois insere, sem chave única `(project_id, external_item_id)` e sem lock ([import-sessions.service.ts:894-930](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L894-L930); [migration 1740000000001:41](../../gai-backend/src/migrations/1740000000001-create-inventory-items.ts#L41)).
  - Como o app envia em paralelo, há risco de duplicata.
- **Replay silencioso:** com a mesma chave e sem checksum, um conteúdo diferente devolve o resultado antigo (:994-1019). O cliente acredita que gravou.
- **Auditoria:** o audit do upsert grava só `row_number`, e não o antes e depois dos campos (:937-946). Não dá para reconstruir quem mudou o quê pela importação.
- **Status:** o PATCH aceita `status: inactive|removed` sem `deleted_at`, e o create aceita item já `removed`.
- **Correção:**
  - Chave única.
  - Checksum calculado pelo servidor.
  - Diff no audit.
  - Restringir as transições de status às rotas próprias.

### S10. IP do audit forjável (Baixa)

- **Evidência:** `extractIp` usa o primeiro valor de `X-Forwarded-For` ([auth.controller.ts:171-177](../../gai-backend/src/modules/auth/presentation/auth.controller.ts#L171-L177)). Esse valor é fornecido pelo cliente, porque o CloudFront só acrescenta ao final.
- **Impacto:** o IP registrado em `auth_audit_logs` (login, falha, bloqueio) não é confiável.
- **Correção:** usar `req.ip` com `trust proxy` configurado (S2).

### S11. Oráculos de existência (Baixa)

- Uma imagem cujo item pertence a outro projeto responde 403, não 404.
- O `confirm-upload` e o `remove` de imagem checam o status do projeto antes da autorização. Um projeto inexistente ou finalizado de outra organização devolve 409.
- **Correção:** autorizar primeiro e devolver 404 uniforme.

### S12. Erros inconsistentes (Baixa)

- O domínio de despesas lança `Error` comum, e o filtro devolve 500 `INTERNAL_ERROR` ([http-exception.filter.ts](../../gai-backend/src/common/filters/http-exception.filter.ts)).
- O 429 sai com `code: INTERNAL_ERROR`.
- Para o app, 500 significa "tentar de novo para sempre", o que gera um loop de reenvio de operação inválida.
- **Correção:** mapear os erros de domínio para 409 e acrescentar `429: TOO_MANY_REQUESTS` ao filtro.

### S13. Swagger exposto (Baixa)

`SwaggerModule.setup('api/docs')` não tem condição de ambiente ([main.ts:38](../../gai-backend/src/main.ts#L38)). É preciso confirmar se `/api/docs` está acessível na AWS. Se estiver, restringir.

## Inventariantes e perfis

| Perfil | Comportamento comprovado |
|---|---|
| PLATFORM_ADMIN | Atravessa toda permissão que esteja no catálogo, menos `field-agents:*` e `project-field-agents:*`. Pode ver e alterar itens, importações e despesas de qualquer organização. Não deve ser usado no app |
| ORG_ADMIN | Atravessa as permissões de escopo ORGANIZATION. Vê todos os projetos da organização e não tem filtro de vínculo |
| Perfil de campo (`FIELD_AGENT_ORG_*`) | Só os projetos com vínculo ativo e vigente e inventariante ativo. **Só leitura** (L1) |
| Perfil personalizado | Apenas as permissões concedidas, mas sem filtro de projeto (S3) |
| Inventariante sem acesso | Existe como cadastro (`user_id` opcional). Não opera o app. É elegível em despesas e observações registradas por terceiros |

## Antes de liberar o app

1. Corrigir S1, S2 e S3.
2. Fazer L1 (permissões) junto com S3.
3. Corrigir S5 e L2 (refresh) e S6.
4. Corrigir S7, S8 e S9 junto com L3, L4 e L5.
5. Corrigir S4, S10, S11, S12 e S13 em paralelo.
