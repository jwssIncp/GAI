# GAI — Handoff: ambiente de homologação na AWS

Estado da homologação e operação no dia a dia. Setup do zero (conta nova): [`deploy-aws-do-zero.md`](./deploy-aws-do-zero.md) · CI/CD: [`aws-cicd.md`](./aws-cicd.md) · Onboarding: [`onboarding-aws-colaborador.md`](./onboarding-aws-colaborador.md).

> **Este documento não contém senhas.** Credenciais só via Parameter Store ou canal seguro.

---

## TL;DR

- Homologação **no ar** (`us-east-1`), CloudFront + ECS + RDS privada.
- **Infra e deploy só no GitHub Actions** — não rode `terraform apply` na máquina para operar.
- Config e senhas em **SSM Parameter Store** `/gai/homolog/*`.
- Deploy homolog: **manual** (Actions → Deploy Homolog). Infra: push em `infra/terraform/**` na `develop` aplica Terraform.
- Branch padrão do repo: **`master`**. Produção ainda **não** provisionada.
- `platform.admin` é garantido a cada deploy (`release:prod`).

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
| Branch app | `develop` → environment GitHub `homolog` |
| Branch padrão / prod (futuro) | `master` |
| Health | `https://<cloudfront>/api/v1/health` |

---

## Acesso (sem Terraform local)

- **AWS:** usuário IAM no grupo **`gai-homolog-operators`**. Onboarding = entrar no grupo; offboarding = sair.
- **Aplicação:** senha do `platform.admin` no Parameter Store:
  ```bash
  aws ssm get-parameter --name /gai/homolog/platform-admin/password --with-decryption --query Parameter.Value --output text
  ```
- **Banco:** RDS privada. Acesso humano (DBeaver etc.) **ainda não liberado** — bastion desligado (`enable_db_bastion = false`). Pendência: definir um fluxo seguro (sem script local que imprime senha mestre; usuário DB dedicado, não o `gai_admin`).

---

## Operação (dia a dia)

| Tarefa | Como |
|---|---|
| Deploy homolog | Actions → **Deploy Homolog** → Run workflow (`develop`) |
| Infra homolog | Push em `infra/terraform/**` na `develop` → workflow **Infra (Terraform)** aplica |
| Infra produção (futuro) | Actions → **Infra (Terraform)** na branch **`master`**, `environment=production`, plan primeiro; depois com `apply` marcado |
| Reset / desbloquear admin | Editar `/gai/homolog/platform-admin/password` no console SSM → Actions → **Ops - Reset platform admin** → `homolog` |
| Logs | `aws logs tail /ecs/gai-homolog --follow` |
| Status ECS | `aws ecs describe-services --cluster gai-homolog --services gai-homolog-backend --query 'services[0].{running:runningCount,desired:desiredCount}'` |

Pipeline de deploy: lint/test → ECR → `release:prod` (migrations + permissions + ensure `platform.admin`) → ECS → frontend S3 → invalidação CloudFront.

**Onde fica cada coisa:**

| Item | Local |
|---|---|
| Config de deploy | `/gai/<env>/deploy/*` |
| Banco | `/gai/<env>/db/*` |
| Admin root | `/gai/<env>/platform-admin/*` (só a task de release recebe a senha) |
| Dev local | `gai-backend/.env` + docker-compose — **não** puxa homolog por padrão |

**Rotação senha do RDS:** incrementar `db_password_version` em `infra/terraform/parameters.tf` → merge na `develop` (Infra aplica) → Deploy (tasks antigas ainda têm a senha velha até o roll).

---

## Sessão admin (Jonathan) — fechar homologação

Checklist para quem tem admin no GitHub e root na AWS. Ordem importa.

### A. GitHub (admin do repo)

1. Environments: `homolog`, `production`, `infra-homolog`, `infra-production`.
2. Variables do repositório: `TF_PLAN_ROLE_ARN`, `TF_APPLY_ROLE_ARN` (IAM roles `gai-terraform-plan` / `gai-terraform-apply`).
3. Em `homolog` (e `production` quando existir): **somente** secret `AWS_ROLE_ARN` = ARN da role `gai-<env>-github-actions`.
4. **Apagar** secrets legados nos environments: `ECR_REPOSITORY`, `ECS_CLUSTER`, `ECS_SERVICE`, `ECS_TASK_DEFINITION`, `ECS_SUBNETS`, `ECS_SECURITY_GROUPS`, `FRONTEND_S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`.

### B. Código

1. Merge/push na `develop` desta entrega; depois Actions → **Deploy Homolog**.
2. Abrir PR **`develop` → `master`** e mergear (para o workflow **Ops - Reset platform admin** ficar disparável no branch padrão).

### C. Rotação do `platform.admin` (sem CLI de senha no chat)

1. Console AWS → Systems Manager → Parameter Store → `/gai/homolog/platform-admin/password` → Edit → senha forte nova.
2. Actions → **Ops - Reset platform admin** → `homolog`.
3. Login na app com a senha do Parameter Store; menus completos.

### D. IAM

```bash
aws iam add-user-to-group --group-name gai-homolog-operators --user-name <usuario-iam>
```

### E. Aceite homolog fechada

- [ ] `GET /api/v1/health` OK
- [ ] Login `platform.admin` com senha do SSM
- [ ] UI com permissões (não zerada)
- [ ] Nenhum `terraform apply` local necessário para operar
- [ ] (Depois) Acesso seguro ao banco — fora deste deploy

---

## Status dos passos (homolog)

| # | Item | Status |
|---|---|---|
| 1 | Bootstrap state no S3 + roles Terraform CI | Feito |
| 2 | Vars `TF_*` + environments infra | Confirmar com Jonathan (A) |
| 3 | Infra homolog (Parameter Store, operators) | Feito (bastion off) |
| 4 | Deploy Homolog (release:prod) | Feito |
| 5 | Ops Reset admin após merge na `master` | Pendente (B+C) |
| 6 | Apagar secrets GitHub legados | Pendente (A) |
| 7 | Usuários no grupo `gai-homolog-operators` | Pendente (D) |
| 8 | Deploy homolog só manual (`workflow_dispatch`) | Feito |
| 9+ | Produção / SES / domínio / SSO | Fora de escopo agora |

---

## Armadilhas

- Operação no **WSL**, não PowerShell.
- `aws ecs run-task` pode “suceder” com container exit ≠ 0 — confira logs da task.
- 5 senhas erradas bloqueiam 30 min → **Ops - Reset platform admin**.
- `infra/scripts/bootstrap-backend-image.sh` é **one-shot histórico** (primeira imagem). Homolog já usa Deploy Homolog — **não** usar no dia a dia.
- Descrições AWS: só ASCII.
- Produção: disparo manual de Infra **somente** a partir da branch **`master`**.

---

## Custos (ordem de grandeza)

Homolog 24/7: **~US$ 85–100/mês**. Produção estimada: **~US$ 190–220/mês**.
