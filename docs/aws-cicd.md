# GAI — CI/CD e infraestrutura AWS

Tutorial completo para subir **homologação** e **produção** do zero, com Terraform, OIDC (sem access keys no GitHub) e GitHub Actions.

> **Monorepo:** front e back permanecem no mesmo repositório (`GAI`). Separar os repos **não é necessário** — o CloudFront unifica SPA + API no mesmo domínio, e um único OIDC/role por ambiente cobre o deploy dos dois.

---

## Arquitetura

```
Internet
   │
   ▼
CloudFront (HTTPS)
   ├─ /*        → S3 (frontend Vite)
   └─ /api/*    → ALB → ECS Fargate (NestJS)
                         │
                         ├─ RDS MySQL 8 (privado)
                         ├─ S3 assets (imagens)
                         └─ SES (e-mail)
```

| Ambiente    | Branch   | GitHub Environment | VPC CIDR       | NAT | RDS        | ECS tasks |
|-------------|----------|--------------------|----------------|-----|------------|-----------|
| Homologação | `develop`| `homolog`          | `10.20.0.0/16` | 1   | single-AZ  | 1         |
| Produção    | `main`   | `production`       | `10.30.0.0/16` | 2   | Multi-AZ   | 2         |

**CI em todo PR/push:** lint → `npm audit --audit-level=high` → testes → build (backend e frontend).

**Deploy:** OIDC → build/push ECR → migrations (ECS RunTask) → update service → sync S3 + invalidação CloudFront.

---

## Pré-requisitos

1. Conta AWS com permissão de administrador (só para o bootstrap inicial).
2. [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configurado (`aws configure` ou SSO).
3. [Terraform](https://developer.hashicorp.com/terraform/install) `>= 1.5`.
4. Docker (para a imagem inicial do backend).
5. Repositório GitHub `jwssIncp/GAI` (ajuste `github_org` nos `.tfvars` se for outro).
6. Branches `main` e `develop`.

Região padrão: **`us-east-1`**.

---

## Passo 1 — Bootstrap do estado Terraform + OIDC

Isso cria **uma vez por conta AWS**:

- Bucket S3 versionado para o state
- Tabela DynamoDB de lock
- Provider OIDC do GitHub (compartilhado pelos dois ambientes)

```bash
# Escolha um nome de bucket globalmente único
export TF_STATE_BUCKET="gai-terraform-state-$(aws sts get-caller-identity --query Account --output text)"

cd infra/bootstrap
terraform init
terraform apply -var="state_bucket_name=${TF_STATE_BUCKET}" -var="aws_region=us-east-1"
```

Anote os outputs `state_bucket`, `lock_table`, `github_oidc_provider_arn`.

Edite os backends:

- `infra/terraform/env/homolog.backend.hcl`
- `infra/terraform/env/production.backend.hcl`

Substitua `YOUR_ACCOUNT_ID` / o nome do bucket pelo valor real de `TF_STATE_BUCKET`.

Confirme `github_org` / `github_repo` em:

- `infra/terraform/env/homolog.tfvars`
- `infra/terraform/env/production.tfvars`

---

## Passo 2 — Provisionar homologação

```bash
cd infra/terraform

terraform init -backend-config=env/homolog.backend.hcl -reconfigure
terraform plan  -var-file=env/homolog.tfvars
terraform apply -var-file=env/homolog.tfvars
```

Tempo típico: **15–25 min** (RDS + NAT + CloudFront).

Exporte os outputs (você vai colar no GitHub):

```bash
terraform output
```

Principais:

| Output | Uso |
|--------|-----|
| `github_actions_role_arn` | Secret `AWS_ROLE_ARN` |
| `ecr_repository_url` | Secret `ECR_REPOSITORY` (só o **nome** após a `/`, ex. `gai-homolog-backend`) |
| `ecs_cluster_name` | `ECS_CLUSTER` |
| `ecs_service_name` | `ECS_SERVICE` |
| `ecs_task_definition_family` | `ECS_TASK_DEFINITION` |
| `frontend_bucket_name` | `FRONTEND_S3_BUCKET` |
| `cloudfront_distribution_id` | `CLOUDFRONT_DISTRIBUTION_ID` |
| `private_subnet_ids` | `ECS_SUBNETS` (CSV) |
| `ecs_security_group_id` | `ECS_SECURITY_GROUPS` |
| `app_url` | URL do ambiente |

### Imagem inicial (obrigatório uma vez)

O service ECS aponta para `:latest`, que ainda não existe:

```bash
chmod +x infra/scripts/bootstrap-backend-image.sh
./infra/scripts/bootstrap-backend-image.sh homolog
```

---

## Passo 3 — Provisionar produção

Use um **state separado** (já configurado no backend `production`):

```bash
cd infra/terraform

terraform init -backend-config=env/production.backend.hcl -reconfigure
terraform plan  -var-file=env/production.tfvars
terraform apply -var-file=env/production.tfvars

chmod +x infra/scripts/bootstrap-backend-image.sh
# Re-init com backend de prod já feito; rode o script com o state de production ativo:
./infra/scripts/bootstrap-backend-image.sh production
```

> Custo: produção tem **2 NAT Gateways** + RDS Multi-AZ — espere dezenas de USD/mês mesmo ocioso. Homologação é bem mais barata (1 NAT).

---

## Passo 4 — GitHub Environments + Secrets (OIDC)

No repositório: **Settings → Environments**.

Crie `homolog` e `production`.

Em **production**, ative **Required reviewers** (approval manual antes do deploy).

### Secrets por environment

| Secret | Exemplo / origem |
|--------|------------------|
| `AWS_ROLE_ARN` | `terraform output -raw github_actions_role_arn` |
| `ECR_REPOSITORY` | Nome do repo ECR, ex. `gai-homolog-backend` |
| `ECS_CLUSTER` | `gai-homolog` |
| `ECS_SERVICE` | `gai-homolog-backend` |
| `ECS_TASK_DEFINITION` | `gai-homolog-backend` |
| `ECS_SUBNETS` | `subnet-aaa,subnet-bbb` (`private_subnet_ids`) |
| `ECS_SECURITY_GROUPS` | SG do ECS |
| `FRONTEND_S3_BUCKET` | bucket do frontend |
| `CLOUDFRONT_DISTRIBUTION_ID` | id da distribuição |

### Variable (opcional, repo ou environment)

| Variable | Valor |
|----------|-------|
| `AWS_REGION` | `us-east-1` |

**Não** coloque `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. O role assume via OIDC.

Trust do role (já no Terraform):

- Branch de deploy (`develop` / `main`)
- Environment GitHub (`homolog` / `production`)

---

## Passo 5 — Domínio customizado (opcional)

Nos `.tfvars`:

```hcl
domain_name    = "app.seudominio.com"   # homolog: homolog.seudominio.com
hosted_zone_id = "Zxxxxxxxxxxxx"
```

O Terraform emite certificado ACM em `us-east-1`, valida no Route53 e associa ao CloudFront.

Sem domínio, use o `app_url` (`*.cloudfront.net`).

---

## Passo 6 — Fluxo do dia a dia

1. PR → workflow **CI** (audit + tests + build).
2. Merge em `develop` → **Deploy Homolog** (quando o auto-deploy estiver reabilitado).
3. Validar em homolog.
4. Merge em `main` → **Deploy Production** (com approval se configurado).

Deploy manual: Actions → Deploy Homolog / Deploy Production → **Run workflow**.

### Testar pipelines sem deploy (sem AWS)

Enquanto os secrets OIDC/AWS não existirem:

1. Os workflows de deploy disparam **somente** via `workflow_dispatch` (push em `develop`/`main` **não** faz deploy).
2. O workflow **CI** roda em push/PR para `main`/`develop`/`master` e também pode ser disparado manualmente.
3. Fluxo recomendado:
   - Branch de feature → push → abra PR para `develop` (ou `master` enquanto `main`/`develop` não existirem).
   - Confirme em **Actions** que **CI** passou (lint, audit, test, build).
   - **Não** rode Deploy Homolog/Production até o Passo 4 (secrets) estar completo.
4. Quando a AWS estiver pronta, reabilite o `on.push` nos arquivos `deploy-homolog.yml` e `deploy-production.yml` (há comentário no topo de cada um).

Ordem no deploy:

1. Quality gates  
2. Build/push imagem ECR  
3. Register task definition  
4. **Migrations** (RunTask one-shot)  
5. Update ECS service + wait stable  
6. Build frontend (`VITE_API_BASE_URL=/api/v1`)  
7. Sync S3 + invalidate CloudFront  

Como SPA e API passam pelo **mesmo CloudFront**, o frontend usa path relativo `/api/v1` — sem CORS cruzado.

---

## Passo 7 — Pós-deploy útil

### Seed admin (homolog, primeira vez)

```bash
# Via ECS Exec (habilite se quiser) ou RunTask com:
# npm run seed:bootstrap
```

Em produção, rode seed só se souber o impacto — não está no pipeline de propósito.

### SES

1. Verifique domínio/e-mail no SES.  
2. Saia do sandbox para e-mail real.  
3. Em produção o task já tem `USE_MOCK_EMAIL=false`. Ajuste `SES_FROM_EMAIL` na task definition (console ou Terraform) quando tiver o remetente.

### Logs

```bash
aws logs tail /ecs/gai-homolog --follow
```

### Health

`https://<app_url>/api/v1/health` → `{ "status": "ok" }`

---

## Estrutura no repositório

```
.github/workflows/ci.yml
.github/workflows/deploy-homolog.yml
.github/workflows/deploy-production.yml
.github/scripts/ecs-run-migrations.sh
infra/bootstrap/          # state + OIDC (uma vez)
infra/terraform/          # stack por ambiente (states separados)
infra/scripts/bootstrap-backend-image.sh
gai-backend/Dockerfile    # targets: production | dev
docs/aws-cicd.md          # este arquivo
```

---

## Segurança (o que foi feito de propósito)

- Subnets privadas para ECS e RDS; saída via NAT  
- ALB só aceita prefix list do **CloudFront**  
- Buckets S3 privados; frontend só via OAC  
- Secrets no **Secrets Manager** (senha RDS gerada)  
- Deploy via **OIDC** (sem keys estáticas no GitHub)  
- Roles IAM separadas por ambiente  
- RDS deletion protection + final snapshot em produção  
- Circuit breaker no ECS service  

---

## Troubleshooting

| Sintoma | Causa comum |
|---------|-------------|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | `github_org`/`github_repo` errados, ou environment name diferente de `homolog`/`production` |
| ECS tasks `CannotPullContainerError` | Ainda não rodou `bootstrap-backend-image.sh` |
| Migrations exit ≠ 0 | Ver logs do task one-shot no CloudWatch |
| Frontend 404 em rotas SPA | Invalidação CloudFront / error pages 403→index (já no TF) |
| OIDC provider already exists | Já criado no bootstrap; não recrie no stack principal |
| `terraform init` state lock | Outro apply em andamento, ou lock órfão na tabela DynamoDB |

---

## Destruir um ambiente (cuidado)

```bash
# Homolog
cd infra/terraform
terraform init -backend-config=env/homolog.backend.hcl -reconfigure
terraform destroy -var-file=env/homolog.tfvars
```

Produção tem `deletion_protection` no RDS — desative no console/TF antes de destroy.
