# Onda 5.1 e 5.2: segurança do deploy AWS

## Onda 5.2: ajustes finais (09/11/2026)

**Classificação: APTO COM RESSALVAS para homologação.** Tudo o que é possível validar localmente foi feito. Terraform e AWS seguem indisponíveis, então `fmt`, `validate`, `plan` e qualquer verificação real dependem da CI e do ambiente. Nada foi executado na AWS; não houve commit nem push.

### Correções

| Tema | Correção |
|---|---|
| **Exclusão mútua real** (release × `mobile:retention`, inclusive agendada) | `gai-backend/scripts/with-db-lock.cjs`: lock nomeado do MySQL (`GET_LOCK('gai_release')`) numa conexão dedicada, enquanto o comando roda. `release:prod` e `mobile:retention:prod` passam por ele, e esperam até 30 min se o lock estiver ocupado; se não conseguirem, saem com código 75 **sem executar nada**. **Sem bloqueio permanente:** o lock pertence à conexão, então se o processo ou a tarefa ECS morrer, o MySQL o libera. O `Dockerfile` copia o script para a imagem de produção, que antes só levava arquivos específicos. A limpeza diária continua: uma execução que encontra o lock ocupado espera, e se mesmo assim não conseguir, fica para o dia seguinte. |
| Barreira no ECS | `ecs-run-migrations.sh` também recusa iniciar se houver tarefa da família `<family>-release` rodando. Isso cobre o EventBridge, que não marca `started-by`. A barreira do GitHub (fila `gai-release-<env>`) foi mantida. |
| **Retenção de snapshots** | `rds-snapshot-retention.cjs` + workflow `Ops - RDS pre-release snapshots (homolog)`. Detalhes abaixo. |
| Rotação do segredo de origem **sem indisponibilidade** | Dois slots (`random_password.origin_verify_a/_b`, com `moved` do recurso anterior). O ALB aceita **os dois**; o CloudFront envia o ativo (`origin_verify_active_slot`). Rotação: (1) `apply -replace=random_password.origin_verify_<inativo>`, (2) trocar o slot ativo e aplicar. Em nenhum momento o ALB recusa o valor em trânsito. |
| Estado do Terraform | Já era versionado, com SSE-AES256, sem acesso público, `prevent_destroy` e lock no DynamoDB. As senhas do banco usam argumentos *write-only* (fora do estado). **Acrescentado** no `infra/bootstrap`: política `DenyInsecureTransport` (nega acesso sem TLS), a aplicar na próxima execução do bootstrap. |
| Segredos em logs e CI | O plan mostra `(sensitive value)` (deriva de `random_password`). O segredo **não** está em outputs, SSM nem tfvars, e um teste garante que nenhum outro `.tf` referencia os slots. O header `X-Origin-Verify` é redigido no Pino (5.1). `load-deploy-config.sh` imprime só ids (sem segredos). |

**Regras da retenção de snapshots.** Um snapshot só é excluído se **todas** as condições valerem:
- snapshot manual da instância, com status `available`;
- nome exato `<db>-pre-release-<run>-<attempt>`;
- tags `Purpose=pre-release` e `Environment=<env>`;
- mais antigo que `retention_days` (padrão 30, mínimo 7);
- fora dos **3 mais recentes**.

Proteções:
- **Produção é recusada** pelo script (ambiente ou nome com "prod") e pelo workflow, que só oferece homolog.
- Snapshots automáticos, sem tag ou com outro nome são ignorados.
- Roda em simulação por padrão; só exclui com `APLICAR`.
- Gera relatório JSON no log e no resumo do job, e o CloudTrail registra cada `DeleteDBSnapshot`.

**Permissão de exclusão:** fica numa política separada (`count = 0` em produção), apenas para `rds:DeleteDBSnapshot` em `<db>-pre-release-*` com a condição `aws:ResourceTag/Purpose = pre-release`.

### Testes (5.2)

| Teste | Resultado |
|---|---|
| `with-db-lock.test.cjs` contra **MySQL 8.0.46 real** (container descartável) | OK. Uma execução concorrente sai com 75 sem rodar o comando; o código de saída do filho é propagado; o lock é liberado depois de `SIGKILL` no detentor. |
| Migrations reais sob o lock (`with-db-lock -- npm run migration:run:prod`) e `mobile:retention:prod` (simulação) | OK. O lock é obtido e liberado, e as 3 migrations foram aplicadas no banco descartável. |
| `deploy-safety.test.cjs` | 7/7 OK. Inclui a recusa diante de uma tarefa agendada da família `-release`, a seleção de snapshots (só o antigo, com tag e `available` é excluído; os 3 mais recentes, os não `available`, os sem tag, os de outro ambiente, os automáticos e os de outro nome são mantidos), a CLI (simulação sem exclusão, `APPLY=1` exclui exatamente 1, produção e retenção < 7 são recusadas) e o workflow. |
| Todos os testes de scripts da CI | **27/27 OK** |
| `terraform-static.spec.ts` | 6/6 OK. Inclui os dois slots aceitos pelo ALB, o slot ativo no CloudFront, o segredo fora de outros arquivos e a exclusão de snapshots só fora de produção. |
| CI | `deploy-safety` no job de qualidade; teste do lock no job com MySQL descartável. |
| `terraform fmt`, `validate` e `plan` | **Não executados** (sem binário). Formatação revisada à mão. |

### Riscos remanescentes

- **AWS não validada.** Falta conferir:
  - o `plan` e o `apply`;
  - se o EventBridge aceita o ARN da família sem revisão;
  - se `DescribeDBSnapshots` filtrado por instância funciona com a política por recurso;
  - os tempos reais de snapshot.
- Quem tem acesso de leitura ao estado do Terraform (o papel de `plan` da CI) consegue ler o segredo de origem. Isso é inerente a headers de origem do CloudFront. Mitigações: TLS obrigatório no bucket, acesso restrito ao papel e rotação em dois slots.
- Uma `mobile:retention` que encontre a release segurando o lock por mais de 30 min sai com 75. A tarefa agendada aparece como falha naquele dia, e a próxima execução diária recupera.
- A política TLS do bucket de estado exige rodar o **bootstrap** de novo, o que é manual e fora do workflow de infra.

### Checklist do primeiro deploy em homologação

1. [ ] Rodar o `infra/bootstrap` (política TLS do estado) com uma credencial de administrador.
2. [ ] PR → `infra.yml` passa `fmt`, `validate` e `plan`. Revisar: **nenhum `destroy` ou `replace`** de RDS, ALB, listeners, CloudFront ou buckets; `moved` sem recriar; segredos como `(sensitive value)`.
3. [ ] `Infra (Terraform)` → apply em **homolog** com `alb_enforce_origin_header=false`, `mobile_retention_schedule_enabled=false` e `origin_verify_active_slot=a`.
4. [ ] GitHub: *required reviewers* nos environments `homolog` e `production`; `alert_email` definido e assinatura do SNS confirmada.
5. [ ] Consulta de duplicatas somente leitura no banco de homolog (Onda 5, passo 2).
6. [ ] `Deploy Homolog` com `confirm=APLICAR` → aprovação → **snapshot verificado** → migrations sob lock → update ECS. Anotar o `snapshot_id`.
7. [ ] `Ops - Mobile` → `field-roles-dry-run` → revisar → `field-roles-apply` (`APLICAR`).
8. [ ] Checklist funcional pós-deploy (Onda 5, seção 5).
9. [ ] `alb_enforce_origin_header=true` → apply → acesso direto ao ALB retorna `403`, e pelo CloudFront retorna `200`.
10. [ ] `mobile_retention_schedule_enabled=true` → apply → conferir a primeira execução (logs com `[db-lock] ... released`).
11. [ ] `Ops - RDS pre-release snapshots` em simulação (deve listar o snapshot do passo 6 como `keep`).

---

# Onda 5.1: segurança do deploy AWS

**Data:** 09/11/2026 · **Base:** [Onda 5](../onda-5-homologacao-aws/README.md)

**Classificação: APTO COM RESSALVAS.** Os riscos críticos do processo de deploy foram corrigidos e testados localmente. **Nada foi executado na AWS.** Terraform, AWS CLI e credenciais seguem indisponíveis, e `fmt`, `validate` e `plan` dependem do workflow `infra.yml`. Antes do primeiro deploy é preciso fazer um `terraform apply` em homolog (seção 4).

Não houve deploy, `apply`, migration remota, commit nem push. Produção não foi tocada; os workflows compartilhados ficaram mais restritivos.

## 1. Problemas corrigidos

| # | Problema | Correção |
|---|---|---|
| 1 | Migrations rodavam a cada deploy **sem backup** | Novo passo **"Verified RDS snapshot before migrations"** (`rds-pre-release-snapshot.sh`). Exige a instância `available`, cria `<db>-pre-release-<run>-<attempt>` com tags, e espera `available` com prazo (padrão de 60 min). Qualquer outro status, timeout ou erro **interrompe** o deploy antes da release. O id do snapshot vai para o resumo do job. |
| 2 | Migrations **sem aprovação explícita** | `Deploy Homolog` e `Deploy Production` exigem o input `confirm = APLICAR`. O `deploy-app.yml` falha no **primeiro passo** sem ele. Recomenda-se também ativar *required reviewers* nos environments do GitHub (seção 4). |
| 3 | Ordem e falhas | Ordem garantida e testada: aprovação → build → registro → **snapshot** → **release (migrations)** → **update ECS** → frontend. Nenhum passo antes do update tem `continue-on-error`. |
| 4 | `aws ecs wait tasks-stopped` desiste em cerca de 10 min **com a tarefa ainda migrando** | Espera própria com prazo (`RELEASE_TIMEOUT_SECONDS`, padrão de 60 min). Sem `STOPPED` mais exit code 0, **não** atualiza o serviço e orienta a inspecionar a tarefa antes de tentar de novo. |
| 5 | Deploys e tarefas operacionais concorrentes | Fila única do GitHub por ambiente (`gai-release-<env>`) para `deploy-app`, `Ops - Mobile` e `Ops - Reset admin`. Barreira no ECS: as tarefas sobem com `--started-by gai-release`, e o script **recusa** iniciar se houver outra rodando, inclusive uma deixada por um job cancelado. |
| 6 | Header secreto de origem (qualquer CloudFront alcançava o ALB) | `origin_protection.tf`: segredo gerado pelo Terraform (`random_password`, nunca em código ou tfvars), enviado pelo CloudFront em `X-Origin-Verify`. Com `alb_enforce_origin_header=true`, o ALB responde **403 JSON** a requisições sem o header (listener HTTP e HTTPS) e só a regra com o header encaminha. A ativação é em **2 applies**, sem janela de erro. O header é **redigido nos logs** (Pino). |
| 7 | Retenção de backup do RDS | Homolog passou de **1 para 7 dias** (alteração in-place, sem reinício). Validação: produção ≥ 7 e qualquer ambiente ≥ 1 (backup automático obrigatório). |
| 8 | Sem alarmes | `alarms.tf`: ALB 5xx (alvo e ALB), hosts sem saúde, latência p95; ECS CPU e memória; RDS CPU, armazenamento livre e conexões; métrica de **5xx da API** extraída dos logs do Pino; CloudFront 5xx. Notificação por SNS + e-mail quando `alert_email` estiver definido. |
| 9 | `mobile:retention` sem agendamento | `scheduler.tf`: EventBridge Scheduler diário (03:00 BRT), ECS RunTask da task `-release`, com IAM mínimo (só `ecs:RunTask` dessa família no cluster, mais `PassRole` dos dois papéis). **Desligado** por padrão (`mobile_retention_schedule_enabled`). |
| 10 | Snapshot sem permissão | O papel de deploy recebe só `CreateDBSnapshot`, `AddTagsToResource` e `Describe*`, limitados à instância e a snapshots `<db>-pre-release-*`. Não pode apagar nem restaurar. Novo parâmetro `deploy/rds-instance-id`. |
| 11 | HTTPS CloudFront → ALB e Swagger | Já preparados na Onda 0 e na Onda 5 (HTTPS opcional por domínio; Swagger desligado em produção). Sem mudança; o HTTPS **continua dependendo** de um domínio e de uma zona Route53, que não foram inventados. |
| 12 | RDS de homolog público (2 IPs) | **Mantido** (fluxo atual da equipe; o tfvars documenta o paliativo). A validação já impede isso em produção. Retirar quando houver bastion. |

## 2. Arquivos alterados

**Workflows e scripts:**
- `.github/workflows/deploy-app.yml`, `deploy-homolog.yml`, `deploy-production.yml`, `ops-mobile.yml`, `ops-reset-admin.yml`, `ci.yml`
- `.github/scripts/ecs-run-migrations.sh`
- `.github/scripts/rds-pre-release-snapshot.sh` (novo)
- `.github/scripts/deploy-safety.test.cjs` (novo)

**Terraform** (`infra/terraform/`):
- novos: `origin_protection.tf`, `alarms.tf`, `scheduler.tf`
- alterados: `alb.tf`, `alb_https.tf`, `cloudfront.tf`, `iam_github_oidc.tf`, `parameters.tf`, `variables.tf`, `env/homolog.tfvars`

**Backend:**
- `src/common/logging/sensitive-log-redaction.ts`
- `test/unit/common/logger-redaction.spec.ts`
- `test/unit/infra/terraform-static.spec.ts` (novo)

## 3. Testes realizados

| Teste | Resultado |
|---|---|
| `deploy-safety.test.cjs`: estrutura dos workflows | OK. Aprovação no primeiro passo; snapshot antes da release antes do update; fila compartilhada; inputs obrigatórios; `Ops - Mobile` só em homolog. |
| `deploy-safety.test.cjs`: scripts reais com `aws` e `jq` falsos | OK. Release com exit 0 passa; exit 1 ou `None` falha; tarefa concorrente é recusada sem `run-task`; timeout não segue. Snapshot: sucesso grava `snapshot_id`; instância `modifying`, criação com erro, snapshot `failed` e timeout falham sem `snapshot_id`; sem `RDS_INSTANCE_ID` falha. |
| Todos os testes de scripts da CI | **22/22 OK** |
| `terraform-static.spec.ts` | OK. Chaves balanceadas; 31 variáveis e 50 referências a recursos, todas declaradas; `local.*` definidas; chaves de risco desligadas; retenção ≥ 7; header de origem presente. |
| Redação do `X-Origin-Verify` nos logs | OK |
| Backend: `tsc`, ESLint, unitários completos | OK, **67 suítes e 488 testes** |
| `terraform fmt`, `validate` e `plan` | **Não executados** (sem binário nem credenciais). Formatação revisada à mão. **Pendente na CI.** |

## 4. Dependências de AWS e GitHub

1. **Rodar `Infra (Terraform)` em homolog antes do primeiro deploy.** Sem isso, o deploy **falha (de forma segura)** no passo de snapshot: falta `deploy/rds-instance-id` e a permissão RDS.
2. **Revisar o `plan`.** Deve ter só criações e atualizações in-place:
   - `random_password`, SNS e alarmes, metric filter;
   - parâmetro SSM;
   - política IAM;
   - `custom_header` na distribuição;
   - retenção do RDS (1 → 7);
   - os itens da Onda 0 e da Onda 5.

   **Pare se aparecer `destroy` ou `replace`** de RDS, ALB, listener, distribuição ou bucket.
3. **GitHub:** em *Settings → Environments*, definir *required reviewers* em `homolog` e `production`, além do `confirm=APLICAR`.
4. `alert_email` em `env/homolog.tfvars` (ou via `TF_VAR`) e confirmar a assinatura do SNS por e-mail.
5. **Verificar no `plan`/`apply`** que o EventBridge Scheduler aceita o ARN da família sem revisão (usa a revisão ACTIVE mais recente). Se não aceitar, apontar para a revisão registrada pelo deploy.

## 5. Procedimento seguro de implantação (homolog)

1. PR → `infra.yml` faz `fmt`, `validate` e `plan`. Revisão humana do plano.
2. `Infra (Terraform)` → apply em **homolog** (com `alb_enforce_origin_header=false` e `mobile_retention_schedule_enabled=false`).
3. Consulta de duplicatas somente leitura (Onda 5, passo 2).
4. `Deploy Homolog` com `confirm=APLICAR` → aprovação → snapshot verificado → migrations → update ECS. Guardar o `snapshot_id` do resumo.
5. Checklist pós-deploy da [Onda 5](../onda-5-homologacao-aws/README.md#5-checklist-de-testes-pós-deploy-homolog).
6. **Proteção de origem, etapa 2:** depois de confirmar que a API responde pelo CloudFront, aplicar `alb_enforce_origin_header=true`. Teste: `curl http://<alb-dns>/api/v1/health` → **403**; via CloudFront → 200.
7. Ligar `mobile_retention_schedule_enabled=true` e verificar a primeira execução nos logs.
8. HTTPS de origem quando houver domínio (Onda 0, duas etapas).

## Recuperação e rollback (reverter o código **não** reverte o banco)

| Situação | Ação |
|---|---|
| Falha antes ou durante o snapshot | Nada foi alterado. Corrija e rode de novo. |
| Migration falhou | O serviço segue na versão anterior. As migrations do GAI são transacionais por migration só onde o MySQL permite (DDL faz commit implícito). Verifique o estado com `npm run migration:show:prod` (tarefa `-release` com `TASK_COMMAND='["npm","run","migration:show:prod"]'`) antes de tentar de novo. |
| Timeout da release | **Não** rode de novo enquanto a tarefa existir; o script recusa. Acompanhe a tarefa no ECS e nos logs; depois avalie. |
| Bug no app com esquema novo | Redeploy do commit anterior: as migrations das Ondas 1 a 3 são aditivas e compatíveis com o código antigo. O banco fica como está. |
| Dados corrompidos | Restaurar o snapshot `pre-release` numa **instância nova** (`aws rds restore-db-instance-from-db-snapshot --db-instance-identifier <db>-restore-<data> --db-snapshot-identifier <snapshot_id> ...`). Validar e trocar o endpoint (`/gai/<env>/db/host` no SSM, mais redeploy), ou copiar os dados necessários. Os dados gravados depois do snapshot se perdem: avaliar antes. |
| Reverter o esquema | Só com decisão explícita: `migration:revert` (três vezes, ordem inversa) primeiro numa cópia restaurada do snapshot. |
| Proteção de origem bloqueando tráfego | `alb_enforce_origin_header=false` e apply (volta a encaminhar). |

## 6. Riscos remanescentes

- **Validação na AWS:** `plan`, `apply`, snapshot real (tempo e custo de armazenamento), alarmes e scheduler **não verificados**. Os snapshots manuais `pre-release` **não expiram sozinhos**: definir rotina de limpeza (o papel de deploy não pode apagar, de propósito).
- **Segredo de origem no state do Terraform.** É inevitável para headers de origem do CloudFront. O state deve continuar no bucket S3 criptografado, com acesso restrito. A rotação é feita em duas etapas.
- **Concorrência na fila do GitHub:** guarda só **um** job pendente por grupo, e um terceiro disparo cancela o pendente anterior. Isso nunca interrompe o que está em execução.
- **Alarmes com limiares iniciais** (por exemplo, 60 conexões, calibrado para `db.t3.micro`). Ajustar para produção.
- **Tarefa do scheduler não usa `started-by gai-release`.** A limpeza é leve e idempotente, mas pode rodar ao mesmo tempo que um deploy.
- **Continuam:** RDS de homolog público, ausência de WAF, HTTPS de origem sem domínio, e os riscos das Ondas 0 a 4.
