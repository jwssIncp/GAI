# Onda 0: segurança, infraestrutura e permissões (API mobile)

**Data:** 09/11/2026 · **Branch:** `feature/gai-ajustes-homologacao` · **Base:** [auditoria-api-mobile](../auditoria-api-mobile/README.md)

**Classificação: APTO COM RESSALVAS para homologação.** O código foi corrigido e validado localmente. A infraestrutura depende de `terraform plan`/`apply` e de testes na AWS, que não foram executados (ver Pendências AWS).

Não houve deploy, `terraform apply`, migration, commit nem push. As alterações locais preexistentes em `scripts/local-*.ps1` foram mantidas intactas.

## Problemas corrigidos

| Ref. auditoria | Correção |
|---|---|
| S1 | O CloudFront deixou de reescrever 403/404 da API para 200 + HTML. Os `custom_error_response` foram removidos, e o fallback da SPA passou a ser feito pela CloudFront Function `spa-rewrite` (viewer-request), só no comportamento padrão (S3). `/api/*` agora devolve o status original |
| S4 | HTTPS entre CloudFront e ALB **preparado e opcional**. Com a variável `api_origin_domain_name` preenchida, o Terraform cria um certificado ACM regional, o alias Route53, o listener 443 (`ELBSecurityPolicy-TLS13-1-2-2021-06`) e a regra de SG 443 restrita à prefix list do CloudFront, e muda a origem para `https-only`. A porta 80 é fechada num segundo apply com `alb_http_origin_enabled = false`. Um bloco `moved` evita recriar a regra de SG existente |
| S2 | **Rate limit individual.** `TRUST_PROXY_HOPS` (2 na AWS) configura o `trust proxy` do Express com um número de saltos, nunca `true`. Assim, `req.ip` passa a ser o IP real do visitante e entradas falsas no início do `X-Forwarded-For` são ignoradas. O throttler continua usando `req.ip`. Limites globais configuráveis (`THROTTLE_LIMIT`, `THROTTLE_TTL_MS`), com os mesmos padrões de antes (100/60 s) e o login mantido em 10/min por IP, mais o bloqueio de conta |
| S10 | O IP gravado no audit de autenticação usa `req.ip` em vez do `X-Forwarded-For` informado pelo cliente |
| S12 | 429 devolve `code: TOO_MANY_REQUESTS` (antes `INTERNAL_ERROR`). Transições inválidas de despesa devolvem 409 `EXPENSE_STATE_CONFLICT` (antes 500) |
| L1 | Perfil de campo com permissões mínimas de coleta, centralizadas em `field-access-permissions.ts`. Ficam **fora**: permissões financeiras, administrativas, de reativação, de importação em lote e de gestão de inventariantes |
| L1 | Convites: perfis de campo antigos (4 permissões) continuam válidos. Qualquer permissão fora do conjunto mínimo bloqueia o convite (409). **Não existe atualização automática.** O script `npm run field-roles:upgrade` roda em simulação por padrão e só grava com `-- --apply`; ele audita a mudança e não toca perfis personalizados |
| S3 | Confinamento por projeto vale para **toda conta vinculada a um inventariante**, mesmo com perfil personalizado e mesmo com o inventariante inativo, bloqueado ou excluído. Sem vínculo ativo e vigente, a conta fica sem projetos (política de negar por padrão). ORG_ADMIN e PLATFORM_ADMIN continuam como antes |
| S6 | Inventariante inativo ou bloqueado: a conta perde acesso na requisição seguinte. Despesas exigem inventariante ativo (409 `FIELD_AGENT_INELIGIBLE`), assim como a importação de observações físicas (erro por linha). O histórico é preservado |
| S7 | Despesa: uma conta vinculada só registra despesas para o próprio inventariante (403 para outro). Se `field_agent_id` vier vazio, é derivado da sessão. ORG_ADMIN e gestores sem vínculo continuam podendo informar o campo |

Verificação de IDOR e acesso entre organizações: as checagens de projeto e organização dos serviços existentes já estavam corretas (auditoria) e continuam valendo. Os testes novos cobrem projeto não vinculado, perfil personalizado e outro inventariante.

## Arquivos modificados

**Backend** (`gai-backend/`):
- `src/main.ts`, `src/app.module.ts`, `src/common/http/trust-proxy.ts` (novo), `src/common/filters/http-exception.filter.ts`
- `src/modules/auth/presentation/auth.controller.ts`, `src/modules/auth/presentation/guards/session-auth.guard.ts`
- `src/modules/field-agents/domain/field-access-permissions.ts` (novo), `application/services/field-agent-management.service.ts`, `domain/ports/field-agent.repository.port.ts`, `infrastructure/persistence/typeorm-field-agent.repository.ts`
- `src/modules/payments-expenses/application/services/payments-expenses.service.ts`
- `src/modules/import-sessions/application/services/import-sessions.service.ts`
- `src/scripts/seed/field-agent-roles-upgrade.ts` e `upgrade-field-agent-roles.ts` (novos), `package.json` (script `field-roles:upgrade`), `.env.example`

**Infraestrutura** (`infra/terraform/`):
- `cloudfront.tf`, `functions/spa-rewrite.js` (novo), `alb_https.tf` (novo)
- `security_groups.tf`, `variables.tf`, `locals.tf`
- `ecs.tf` (`TRUST_PROXY_HOPS=2`)

**Testes:**
- `test/integration/security/onda0-field-access.e2e-spec.ts`
- `test/unit/common/trust-proxy-throttling.spec.ts`
- `test/unit/infra/cloudfront-spa-rewrite.spec.ts`

## Testes executados

| Validação | Resultado |
|---|---|
| `tsc --noEmit` (src + testes) | OK |
| ESLint/Prettier nos arquivos alterados | OK |
| Unitários (`test:unit`, completo) | 66 suítes, 484 testes OK (inclui os 5 novos) |
| Integração SQLite + contrato (`test:integration:sqlite`, completo) | 61 suítes, 390 OK, 4 pulados (já pulados antes; dependem de MySQL) |
| Novos: perfil de campo e projetos, perfil antigo/estranho no convite e script de atualização, perfil personalizado confinado e bloqueado, despesa vinculada, IP do audit | 5/5 OK |
| Novos: `trust proxy` (2 saltos, sem saltos, valores inválidos), throttling por visitante, 429 com código correto | 3/3 OK |
| Novos: função SPA (rotas, assets, `/api`) e ausência de `custom_error_response` e de função no `/api/*` | 2/2 OK |
| Linha de base antes das mudanças (field-agents + auth) | 76/76 OK |
| MySQL e S3 descartáveis | Não executados (MySQL/Docker indisponíveis) |
| `terraform fmt`/`validate` | **Não executados.** Não há binário local, e o download foi bloqueado pela política do ambiente. Formatação revisada manualmente. O workflow `infra.yml` executa ambos |

## Pendências de validação AWS

1. Rodar o workflow **Infra (Terraform)** em homolog: `fmt -check`, `validate` e `plan`. O plano deve mostrar a criação da `aws_cloudfront_function`, a mudança no default behavior, a remoção dos `custom_error_response` e o `moved` da regra de SG, **sem destruir nada**.
2. Depois do apply em homolog:
   - `GET /api/v1/projects/999999` deve devolver 404 JSON.
   - Uma rota da SPA aberta direto (por exemplo `/app/projects`) deve carregar o `index.html`.
   - Um asset inexistente deve devolver erro.
3. HTTPS de origem: escolher o hostname (por exemplo `api-origin.<domínio>`) e a zona Route53, aplicar a etapa 1, validar e depois aplicar a etapa 2 (`alb_http_origin_enabled = false`). Hoje `domain_name` e `hosted_zone_id` estão vazios nos tfvars, então a etapa depende dessa definição.
4. Confirmar na AWS que `req.ip` é o IP do visitante: os logs do Pino e o audit de login devem mostrar o IP público, não o do ALB. Confirmar também que 2 aparelhos não compartilham o limite.
5. Rodar `npm run field-roles:upgrade` (simulação) contra homolog e, se aprovado, `-- --apply`. Até lá, os inventariantes já convidados continuam só com leitura.

## Riscos remanescentes

- **Sessão** (S5): sem vida máxima absoluta e com o token guardado em claro. Fica para a onda de refresh token, conforme o escopo.
- **Importação** (L8, S8, S9): integridade dos payloads, corrida no upsert, checksum e caminhos de imagem. Por isso as permissões `import-*` **não** foram dadas ao perfil de campo.
- **Bypass do CloudFront**: a prefix list do CloudFront aceita distribuições de qualquer conta AWS. Uma distribuição de terceiros consegue alcançar o ALB, mas não forjar o IP do visitante. A mitigação recomendada é um header secreto de origem; ficou fora por exigir um novo segredo.
- **CGNAT / Wi-Fi compartilhado**: o limite é por IP. Vários técnicos atrás do mesmo IP dividem 100 req/min. Ajustável por `THROTTLE_LIMIT`; definir limites mobile na próxima onda.
- **Contas vinculadas a inventariante**: agora ficam restritas a `/projects/{id}/*`, `GET /projects` e `/auth/*`. Um coordenador que também seja inventariante (sem ORG_ADMIN) perde as telas globais. É intencional; verificar em homologação se há esse caso.
- **Swagger público** (S13), oráculos de existência (S11) e CloudFront → ALB em HTTP até a etapa de HTTPS ser aplicada.
