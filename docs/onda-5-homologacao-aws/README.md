# Onda 5: preparação e homologação AWS

**Data:** 09/11/2026 · **Branch:** `feature/gai-ajustes-homologacao`

**Classificação: preparação concluída; homologação AWS NÃO executada.** Nesta máquina não há Terraform, AWS CLI, credenciais AWS nem imagem Docker com essas ferramentas, e o download do Terraform foi bloqueado pela política do ambiente (Onda 0). **Nada foi validado contra a AWS.** O que segue é revisão estática, correções locais testadas e o roteiro para executar em homologação.

Não houve deploy, `terraform apply`, migration remota, script com `--apply`, commit nem push. Produção não foi tocada.

## 1. Infraestrutura verificada (revisão estática)

| Item | Situação | Evidência |
|---|---|---|
| Erros da API → 200 HTML | Corrigido na Onda 0 (sem `custom_error_response`; CloudFront Function de SPA só no comportamento padrão). Há teste estático. **Falta o smoke test real.** | `cloudfront.tf`, `functions/spa-rewrite.js`, `test/unit/infra/cloudfront-spa-rewrite.spec.ts` |
| ALB | O SG aceita só a prefix list do CloudFront. As tarefas ECS só aceitam o ALB. **Risco:** qualquer distribuição CloudFront (de outra conta) alcança o ALB; falta header secreto de origem. | `security_groups.tf` |
| HTTPS CloudFront → ALB | Preparado e opcional (`api_origin_domain_name`), com `moved` para não recriar a regra de SG. **Desligado:** `domain_name` e `hosted_zone_id` estão vazios nos tfvars, então hoje o tráfego é HTTP entre a borda e o ALB. | `alb_https.tf`, `variables.tf` |
| Certificados e DNS | O ACM do CloudFront só é criado com `domain_name`. Hoje usa o domínio padrão do CloudFront. | `cloudfront.tf` |
| Rate limiting e IP real | `TRUST_PROXY_HOPS=2` no `ecs.tf` e agora **também** no script de release (ver correção 1). Throttler por IP real. Sem WAF. | `trust-proxy.ts`, `prepare-document-task.cjs` |
| CORS da API | `CORS_ORIGINS` igual ao domínio do CloudFront (só para web; o app nativo não usa CORS). | `ecs.tf` |
| CORS do bucket `assets` | `GET/PUT/HEAD`; origem `*` enquanto não houver domínio próprio. Só funciona com URL assinada; risco baixo. | `s3.tf` |
| Swagger | Estava público em todos os ambientes. **Corrigido:** desligado em produção (`SWAGGER_ENABLED=false`) e mantido em homolog. | `main.ts`, `ecs.tf`, `prepare-document-task.cjs` |
| S3 `assets` | Versionado (exigido pela verificação de upload), criptografado, sem acesso público. Não tem lifecycle de versões antigas (manter assim: expirar versões não atuais pode quebrar imagens confirmadas). | `s3.tf` |
| RDS homolog | `db.t3.micro`; **backup de 1 dia**; `skip_final_snapshot`; **acessível publicamente** para 2 IPs (paliativo documentado no tfvars). | `rds.tf`, `env/homolog.tfvars` |
| ECS | O release força no mínimo 1 vCPU e 2 GB, o que é suficiente para backup de 100 MiB (verificação em streaming) e para o relatório de placas. | `prepare-document-task.cjs` |
| Observabilidade | Logs no CloudWatch (14 dias em homolog, 30 em produção). **Sem alarmes, sem SNS e sem WAF.** A variável `alert_email` existe, mas não está ligada a nada. | `ecs.tf`, `variables.tf` |
| Drift | **Não verificável sem `terraform plan` com o estado remoto.** | — |

## 2. Correções feitas nesta onda (testadas localmente)

1. **Defeito real de implantação.** O `register-task-definitions.sh` aplica o `prepare-document-task.cjs` em todo deploy, e ele **forçava `STORAGE_MAX_SIZE_BYTES=52428800`**, sem o teto de TTL. Na AWS, o backup mobile falharia (TTL de 1800 s acima do teto de 300 s, gerando 400 `STORAGE_INVALID_EXPIRATION`) e o limite de 100 MiB nunca chegaria ao container.
   - O script agora mantém `STORAGE_MAX_SIZE_BYTES=104857600`, `STORAGE_PRESIGNED_URL_MAX_TTL_SECONDS=1800` e `TRUST_PROXY_HOPS=2`, e define `SWAGGER_ENABLED` por ambiente, preservando um valor explícito.
   - Teste novo no `prepare-document-task.test.cjs`. **15/15 testes de scripts da CI OK.**
2. **Swagger desligável** (`SWAGGER_ENABLED`): `false` em produção, `true` em homolog.
3. **Scripts compilados para a tarefa ECS:** `items:external-duplicates:prod`, `field-roles:upgrade:prod`, `mobile:retention:prod`. Executados localmente no build: o diagnóstico de duplicatas (leitura) e o `field-roles` em simulação funcionaram.
4. **Workflow `Ops - Mobile (homolog)`** (`.github/workflows/ops-mobile.yml`): roda as 5 tarefas como ECS one-off com a task definition `-release`.
   - `external-duplicates`, `field-roles-dry-run` e `retention-dry-run` só leem.
   - `field-roles-apply` e `retention-apply` **exigem digitar `APLICAR`**.
   - Só homolog; produção não está disponível nesse workflow.
   - O YAML foi validado.

Validações locais: `tsc` e ESLint OK; build OK; testes de scripts da CI 15/15. As suítes MySQL e S3 completas foram validadas na Onda 4 (495 e 11 testes).

## 3. Migrations pendentes

| Ordem | Migration | Efeito | Risco |
|---|---|---|---|
| 1 | `1794400000001-create-mobile-sessions` | `sessions.client_type` (padrão `web`), `refresh_family_id` e tabela `mobile_refresh_tokens` | Baixo. Aditiva; nenhuma sessão é invalidada. |
| 2 | `1794500000001-mobile-item-sync` | Verificação prévia de duplicatas; `inventory_items.sync_seq`; tabela de contadores; **índice único `(project_id, external_item_id)`**; índice de sincronização | **Médio.** Falha (sem alterar nada) se houver duplicatas. Criar índices em `inventory_items` grande gera tempo de DDL, feito online pelo InnoDB. |
| 3 | `1794600000001-mobile-reconciliation` | `old_plate_2` com índice, `import_payloads.content_hash`, tabela `mobile_idempotency_keys` | Baixo. Aditiva. |

- **Execução:** automática no deploy, pela tarefa `-release` (`npm run release:prod` → `migration:run:prod`, `permissions:sync`, admin). Se uma migration falhar, o deploy **para antes** de atualizar o serviço.
- **Rollback:** todas têm `down`. O código antigo funciona com o esquema novo (as colunas são aditivas, com padrão), então **não é preciso reverter o esquema para voltar o app**. Reverter só sob decisão, e numa cópia antes.
- **Permissões:** o `permissions:sync` (no release) apenas garante o catálogo. Nenhum perfil existente ganha permissão. O perfil de campo só muda com `field-roles-apply`.

## 4. Ordem segura de implantação em homologação

1. **Snapshot manual do RDS de homolog** (o papel de deploy não tem `rds:CreateDBSnapshot`; usar o console ou um operador):
   `aws rds create-db-snapshot --db-instance-identifier <gai-homolog-db> --db-snapshot-identifier gai-homolog-pre-mobile-20261109`
2. **Diagnóstico antes da migration.** O código novo ainda não está publicado, então rode a consulta somente leitura direto no banco (DBeaver, liberado para os IPs do tfvars):
   ```sql
   SELECT project_id, external_item_id, COUNT(*) total, GROUP_CONCAT(id) ids
     FROM inventory_items WHERE external_item_id IS NOT NULL
    GROUP BY project_id, external_item_id HAVING COUNT(*) > 1;
   ```
   Se houver linhas, siga o saneamento da [Onda 2](../onda-2-sincronizacao-mobile/README.md) **antes** do deploy.
3. **Infra (Terraform).** Abra PR, deixe o `infra.yml` rodar `fmt -check`, `validate` e `plan` (homolog e produção) e revise o plano. **O que se espera:**
   - criar `aws_cloudfront_function.spa_rewrite`;
   - atualizar a distribuição (remove 2 `custom_error_response`, acrescenta `function_association`);
   - `moved` em `aws_vpc_security_group_ingress_rule.alb_http_from_cloudfront` → `[0]`, **sem destroy**;
   - atualizar a task definition (env `TRUST_PROXY_HOPS`, `SWAGGER_ENABLED`, `STORAGE_MAX_SIZE_BYTES`, `STORAGE_PRESIGNED_URL_MAX_TTL_SECONDS`);
   - **nenhum `destroy` ou `replace`** de RDS, bucket, ALB ou distribuição. Se aparecer, pare.
   - Depois, rode `Infra (Terraform)` com apply só em **homolog**, com aprovação.
4. **App:** `Deploy Homolog`. O release aplica as 3 migrations; depois o serviço é atualizado. Acompanhe os logs da tarefa `-release`.
5. **Perfis de campo:** `Ops - Mobile` → `field-roles-dry-run`. Revise o log. Depois `field-roles-apply` com `APLICAR`. Conceda `expenses:*` só a quem o negócio indicar.
6. **Retenção:** `retention-dry-run` agora. O `retention-apply` deve ser agendado (ver seção 6).
7. **Testes pós-deploy** (seção 5).
8. **HTTPS de origem (opcional, recomendado antes de produção):** definir `api_origin_domain_name` e `hosted_zone_id`, aplicar a etapa 1 e, depois de validar, `alb_http_origin_enabled=false`.

## Rollback

| Situação | Ação |
|---|---|
| A migration falha no release | O deploy para sozinho, e o serviço segue com a versão anterior. Corrija a causa (por exemplo, duplicatas) e rode de novo. |
| Problema no app depois do deploy | Rode de novo o `Deploy Homolog` a partir do commit anterior (imagem anterior). O esquema novo é compatível. |
| Problema de esquema comprovado | Restaure o **snapshot** do passo 1 numa instância nova, ou rode `migration:revert` três vezes, na ordem inversa, depois de testar numa cópia. |
| Problema no CloudFront | `terraform apply` do commit anterior: volta o `custom_error_response` e remove a function. |
| `field-roles-apply` indesejado | Remova as permissões acrescentadas no perfil `FIELD_AGENT_ORG_*` pela tela de perfis. A auditoria fica em `role_audit_logs`. |

## 5. Checklist de testes pós-deploy (homolog)

Use dados **sintéticos** num projeto de teste próprio. Base: `https://<cloudfront-homolog>/api/v1`.

- [ ] `GET /health` → 200. `GET /api/docs` → 200 em homolog (e, depois, 404 em produção).
- [ ] `GET /api/v1/rota-inexistente` → **404 JSON** (não HTML). Sem token: `GET /api/v1/mobile/me` → **401 JSON**. Projeto sem vínculo → **403 JSON**.
- [ ] Rota da SPA aberta direto (`/app/projects`) → página carrega. Asset inexistente → erro (não `index.html`).
- [ ] Login mobile com inventariante de teste; `/mobile/me` com projetos corretos; refresh, refresh duplicado (409), reuso após 30 s (401), logout.
- [ ] Login com senha errada: `auth_audit_logs.ip_address` traz o **IP público** do testador (não o do ALB nem um IP forjado por `X-Forwarded-For`).
- [ ] Dois testadores em redes diferentes: 11 logins errados de um não bloqueiam o outro (429 individual).
- [ ] Inventariante bloqueado durante o teste → 403 e refresh 403.
- [ ] PUT, reenvio, conflito entre dois aparelhos, DELETE, sincronização com cursor.
- [ ] Foto: upload-url, PUT no S3 com `upload_headers`, confirm, `download_url` abre a imagem.
- [ ] Reconciliação: sessão, foto, lote com um item falho (`partially_processed`), backup zip de cerca de 100 MiB **em rede móvel** (confirmar em menos de 30 min), finish (`finished_with_errors`).
- [ ] Despesa com nota (perfil com `expenses:*`); nota acima de 20 MiB → 400.
- [ ] Regressão web: login, projetos, itens, importações (status novos visíveis), despesas, painel.
- [ ] Logs do CloudWatch sem tokens ou senhas (redação do Pino).

## 6. Operação

- **`mobile:retention`:** agendar uma vez por dia (EventBridge Scheduler → ECS RunTask da task `-release` com o comando `["npm","run","mobile:retention:prod","--","--apply"]`). Ainda não está no Terraform porque exige IAM novo para o scheduler. Até lá, use o `Ops - Mobile` → `retention-apply` periodicamente.
- **Alarmes recomendados antes de produção** (não implementados; exigem SNS e `alert_email`):
  - ALB `HTTPCode_Target_5XX_Count` e `TargetResponseTime` p95;
  - ECS `CPUUtilization` e `MemoryUtilization`, e tarefas reiniciando;
  - RDS `CPUUtilization`, `FreeStorageSpace` e `DatabaseConnections`;
  - CloudFront `5xxErrorRate`;
  - filtro de log para `MobileItemSync preflight failed`, `REFRESH_TOKEN_REUSED` e `STORAGE_UNAVAILABLE`.

## 7. Pendências e riscos para produção

1. **Executar tudo acima em homolog com evidências reais.** Nada foi validado na AWS.
2. **`terraform plan` de produção revisado.** A distribuição de produção também perde o `custom_error_response`; validar o SPA lá.
3. **HTTPS CloudFront → ALB** e **header secreto de origem**, para impedir que outras distribuições CloudFront alcancem o ALB.
4. **Alarmes e SNS**, e o **agendamento do `mobile:retention`**.
5. **RDS de produção:** backup acima de 1 dia (verificar o tfvars de produção); snapshot manual antes do release; **nunca** `db_publicly_accessible` em produção.
6. **RDS homolog público** (paliativo): retirar assim que houver bastion.
7. **Sem WAF:** o rate limit fica só na aplicação, por IP. Avaliar uma regra de rate do AWS WAF no CloudFront para o login.
8. **Riscos das Ondas 0 a 4** que continuam: token de sessão guardado em claro, colação de `external_item_id`, importação parcialmente aplicada após queda do servidor, CGNAT no limite por IP.
