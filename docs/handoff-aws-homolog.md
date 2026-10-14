# GAI — Handoff: ambiente de homologação na AWS

Resumo do que foi configurado em **13/10/2026**, estado atual e próximos passos.
Tutorial completo de setup: [`deploy-aws-do-zero.md`](./deploy-aws-do-zero.md) · Detalhes de CI/CD: [`aws-cicd.md`](./aws-cicd.md).

> **Este documento não contém senhas.** Credenciais devem ser repassadas por canal seguro (gerenciador de senhas).

---

## TL;DR

- Homologação está **no ar** na AWS (`us-east-1`), servida por CloudFront.
- Deploy via **GitHub Actions + OIDC** (sem access keys no GitHub), disparo **manual** por enquanto.
- Banco migrado (21 migrations). Existe **apenas o usuário `platform.admin`**.
- Há correções locais que **precisam ser commitadas** (ver "Mudanças no código").
- Produção **ainda não** foi provisionada.

---

## Arquitetura

```
Internet ─► CloudFront (HTTPS)
              ├─ /*      → S3 (frontend Vite)
              └─ /api/*  → ALB → ECS Fargate (NestJS, 1 task)
                                   ├─ RDS MySQL 8 (subnet privada)
                                   ├─ S3 (imagens)
                                   └─ SSM Parameter Store (/gai/<env>/: config + senhas)
```

| Item | Valor |
|---|---|
| Região | `us-east-1` |
| Cluster / Service ECS | `gai-homolog` / `gai-homolog-backend` |
| Logs | CloudWatch `/ecs/gai-homolog` |
| Config e senhas | Parameter Store `/gai/homolog/*` |
| State Terraform | S3 `gai-terraform-state-<ACCOUNT_ID>` + DynamoDB `gai-terraform-locks` |
| Branch de deploy | `develop` → environment GitHub `homolog` |
| URL | `terraform output -raw app_url` |
| Health check | `<app_url>/api/v1/health` |

---

## Acesso

> Passo a passo completo: [`onboarding-aws-colaborador.md`](./onboarding-aws-colaborador.md).

- **AWS:** usuário IAM próprio, adicionado ao grupo **`gai-homolog-operators`** (criado pelo Terraform). Esse grupo dá acesso ao túnel do banco e leitura de `/gai/homolog/*` no Parameter Store — onboarding/offboarding é só entrar/sair do grupo.
- **Aplicação:** o `platform.admin` (root) é criado automaticamente a cada deploy. Senha gerada no `terraform apply` (fora do state), no Parameter Store:
  ```bash
  aws ssm get-parameter --name /gai/homolog/platform-admin/password --with-decryption --query Parameter.Value --output text
  ```
- **Banco:** RDS é privado. Acesso via bastion SSM (EC2 `t4g.nano` sem IP público nem portas abertas, ~US$ 3/mês, `enable_db_bastion = true` em `env/homolog.tfvars`). Não depende de Terraform local — só AWS CLI + plugin. No WSL:
  ```bash
  # uma vez: session-manager-plugin
  curl -fsSLo /tmp/ssm.deb https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb
  sudo dpkg -i /tmp/ssm.deb

  # deixe aberto enquanto usa o DBeaver (imprime host/usuário/senha)
  ./infra/scripts/db-tunnel.sh homolog        # localhost:13306
  ```
  DBeaver (no Windows mesmo): MySQL, host `localhost`, porta `13306`, dados impressos pelo script, driver property `allowPublicKeyRetrieval=true`.
  Depurar o backend local contra o banco de homolog (com o túnel aberto): `eval "$(./infra/scripts/remote-db-env.sh homolog)"` e `npm run start:dev` — nada é gravado em disco.

---

## Mudanças no código feitas hoje

| Arquivo | Mudança | Motivo |
|---|---|---|
| `infra/terraform/security_groups.tf`, `cloudfront.tf` | `—` → `-` nas descrições | AWS rejeita caracteres não-ASCII em descrições de Security Group |
| `infra/terraform/env/*.backend.hcl` | Account ID real no nome do bucket | Configuração do state remoto |
| `gai-backend/data-source.ts` | Entities/migrations resolvidos por `__dirname` + extensão (`.ts` em dev, `.js` no build) | O seed compilado procurava `src/**/*.entity.ts`, inexistente na imagem → seed falhava e o banco ficava sem usuários |
| `.github/workflows/infra.yml` + roles `gai-terraform-plan/apply` (bootstrap) | **Novo** | Terraform roda no GitHub Actions; ninguém aplica da própria máquina |
| `release:prod` (`ensure-platform-admin.ts`, `sync-permissions.ts`) | **Novo** | Cada deploy: migrations → catálogo de permissões → garante o `platform.admin` |
| `.github/workflows/ops-reset-admin.yml` | **Novo** | Redefinir senha/desbloquear o admin pelo GitHub (substitui `reset-admin.sh`) |
| `infra/terraform/bastion.tf`, `iam_operators.tf`, `infra/scripts/db-tunnel.sh` | **Novo** | Acesso ao banco (DBeaver) via SSM controlado por grupo IAM |
| `docs/deploy-aws-do-zero.md`, `docs/handoff-aws-homolog.md` | **Novos** | Documentação |

> ⚠️ Se essas mudanças ainda não estiverem na `develop`, um `terraform apply` a partir de outro checkout vai falhar/recriar os Security Groups. Commitar antes de qualquer outra coisa.

---

## Problemas encontrados e solução

| Sintoma | Causa | Solução |
|---|---|---|
| `terraform apply` falhou ao criar Security Groups | Travessão `—` nas descrições | Trocado por `-` |
| `GPG error ... download.docker.com` no `apt update` | Repo apt do Docker sem chave no WSL | Repo removido (usa Docker Desktop) |
| `jq: command not found` | jq não instalado | `sudo apt install -y jq` ou `tr -d '[]" \n'` |
| Login retornava "Invalid credentials" | Banco sem usuários (`auth_audit_logs.reason = unknown_user`) porque o seed quebrava no container | Fix do `data-source.ts` + admin garantido pelo deploy |
| `platform.admin` logava mas não via nada | Tabela `permissions` vazia (só o seed a populava); `PLATFORM_ADMIN` = todas as linhas dessa tabela | Deploy sincroniza o catálogo (`permissions:sync:prod`) |

---

## Operação

**Infra (Terraform):** só via GitHub Actions → **Infra (Terraform)**. PR que mexe em `infra/terraform/**` gera plan (homolog e production) no resumo do run; merge na `develop` aplica homolog. **Produção é só manual**: Actions → Infra (Terraform) → Run workflow na `main`, `environment = production` — primeiro sem marcar `apply` (só plan, revise o resumo), depois de novo com `apply` marcado.

```bash
# Logs do backend
aws logs tail /ecs/gai-homolog --follow

# Status do serviço
aws ecs describe-services --cluster gai-homolog --services gai-homolog-backend \
  --query 'services[0].{running:runningCount,desired:desiredCount}'
```

**Deploy:** GitHub → Actions → **Deploy Homolog** → Run workflow (branch `develop`).
Pipeline: lint/test → build/push ECR → `release:prod` (migrations → catálogo de permissões → garante `platform.admin`, task one-shot) → update ECS → build frontend → S3 → invalidação CloudFront.

**Admin bloqueado / esqueceu a senha / rotação:** GitHub → Actions → **Ops - Reset platform admin** → escolher ambiente. Define a senha para o valor atual de `/gai/<env>/platform-admin/password`, desbloqueia e reatribui `PLATFORM_ADMIN`. Para trocar a senha, edite o parâmetro (console SSM → Parameter Store) e rode o workflow; o Terraform não sobrescreve o valor editado.

**Rotação da senha do banco:** incrementar `db_password_version` em `infra/terraform/parameters.tf` → merge (Infra aplica: troca no RDS e no Parameter Store juntos) → rodar **Deploy** (tasks antigas ainda têm a senha velha).

**Onde fica cada coisa:**

| Item | Local |
|---|---|
| Config de deploy (cluster, subnets, buckets…) | `/gai/<env>/deploy/*` (String) |
| Banco (host, porta, nome, usuário / senha) | `/gai/<env>/db/*` (String / SecureString) |
| Admin root (login, e-mail / senha) | `/gai/<env>/platform-admin/*` (String / SecureString) — só a task de release recebe |
| Local (dev) | `gai-backend/.env` com valores de docker-compose — não usa AWS |

**Seed completo** (organização de teste, `org.admin`, `test.user`) — somente após deploy com o fix do `data-source.ts`. Comando em [`deploy-aws-do-zero.md`](./deploy-aws-do-zero.md#criar-o-usuário-admin-seed). O seed não altera usuários existentes.

---

## Próximos passos

1. [ ] **Única vez, local (Luiz):** migrar o state do bootstrap para o S3 e criar as roles do Terraform CI:
   `cd infra/bootstrap && terraform init -backend-config=backend.hcl -migrate-state && terraform apply`.
2. [ ] GitHub: criar environments `infra-homolog` e `infra-production`; variáveis de repositório `TF_PLAN_ROLE_ARN` e `TF_APPLY_ROLE_ARN` (outputs do bootstrap).
3. [ ] Commitar e dar push na `develop` → **Infra (Terraform)** aplica homolog (Parameter Store, bastion, grupo de operadores). ⚠️ Esse apply **troca a senha do RDS** (a antiga estava no state) — a aplicação fica fora do ar até o passo 4.
4. [ ] Rodar **Deploy Homolog** logo em seguida → task definitions passam a ler do Parameter Store; release cria/garante o `platform.admin`.
5. [ ] Rodar **Ops - Reset platform admin** (homolog) uma vez: o admin já existia com a senha definida à mão; isso alinha com a do Parameter Store.
6. [ ] Apagar os GitHub secrets antigos (`ECR_REPOSITORY`, `ECS_*`, `FRONTEND_S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`); fica só `AWS_ROLE_ARN`.
7. [ ] Adicionar os usuários IAM ao grupo `gai-homolog-operators`.
8. [ ] Reativar `on.push` em `.github/workflows/deploy-homolog.yml` quando estável (com isso, merge na `develop` = infra + deploy sem intervenção).
9. [ ] Produção: Infra (Terraform) manual na `main` (plan → apply), secret `AWS_ROLE_ARN` do environment `production`, SES verificado e fora do sandbox, `ses_from_email`.
10. [ ] (Opcional) Domínio próprio via Route53.
11. [ ] (Recomendado) Trocar access keys IAM por login via IAM Identity Center (`aws configure sso`).

---

## Custos

Homologação ligada 24/7: **~US$ 85–100/mês** (NAT ~33, ALB ~20, IPs públicos ~11, RDS ~15, Fargate ~9).
Produção estimada: **~US$ 190–220/mês**.
Para economizar, homolog pode ser destruído com `terraform destroy -var-file=env/homolog.tfvars` e recriado em ~20 min.

---

## Armadilhas

- Rode comandos no **WSL**, não no PowerShell.
- `aws ecs run-task` retorna sucesso mesmo se o container falhar → confira os logs.
- `npm run seed:bootstrap` não funciona na imagem de produção → `node dist/src/scripts/seed/bootstrap.js`.
- 5 senhas erradas bloqueiam a conta por 30 min (workflow **Ops - Reset platform admin** desbloqueia).
- Descrições de recursos AWS: apenas ASCII.
