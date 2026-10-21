# GAI — Deploy na AWS do zero (passo a passo)

Tutorial prático para subir o GAI na AWS partindo de uma conta nova. Complementa o guia técnico [`aws-cicd.md`](./aws-cicd.md).

O projeto já possui:

- Terraform da infraestrutura em `infra/` (bootstrap + stack por ambiente)
- Workflows de CI/CD em `.github/workflows/`
- Script da imagem inicial em `infra/scripts/bootstrap-backend-image.sh` (one-shot; depois use Deploy Homolog)

O que falta é: criar a conta, instalar as ferramentas, rodar o Terraform e cadastrar os secrets no GitHub.

---

## Arquitetura

```
Internet ─► CloudFront (HTTPS)
              ├─ /*      → S3 (frontend Vite)
              └─ /api/*  → ALB → ECS Fargate (NestJS)
                                   ├─ RDS MySQL 8 (privado)
                                   ├─ S3 (imagens)
                                   └─ SSM Parameter Store (/gai/<env>/: config + senhas)
```

| Ambiente    | Branch    | GitHub Environment | Observação                      |
|-------------|-----------|--------------------|---------------------------------|
| Homologação | `develop` | `homolog`          | 1 NAT, RDS single-AZ, 1 task    |
| Produção    | `master`  | `production`       | 2 NAT, RDS Multi-AZ, 2 tasks    |

> **Recomendação:** suba primeiro **homologação**. Produção custa bem mais.

---

## Passo 0 — Conta AWS e segurança

1. Crie a conta em [aws.amazon.com](https://aws.amazon.com). Ative **MFA no usuário root** e não use o root no dia a dia.
2. Crie um alerta de custos: **Billing → Budgets → Create budget** (ex.: US$ 50/mês com aviso por e-mail).
3. Crie um usuário para o terminal:
   - **IAM → Users → Create user** (ex.: `luiz-admin`)
   - Anexe a política `AdministratorAccess`
   - Aba **Security credentials → Create access key** → tipo "CLI". Guarde o Access Key ID e o Secret.
4. Use a região **`us-east-1`** (padrão do projeto).

---

## Passo 1 — Ferramentas no WSL (Ubuntu)

> Rode **tudo no terminal Ubuntu (WSL)**, não no PowerShell — os scripts são bash.

```bash
# Utilitários
sudo apt update && sudo apt install -y unzip jq curl gnupg

# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install && rm -rf aws awscliv2.zip

# Terraform
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install -y terraform
```

**Docker:** instale o Docker Desktop no Windows e ative **Settings → Resources → WSL Integration → Ubuntu**.

Configure e valide:

```bash
aws configure                 # Access Key, Secret, região us-east-1, output json
aws sts get-caller-identity   # deve mostrar seu Account ID
terraform version
docker ps
```

---

## Passo 2 — Bootstrap do Terraform (uma vez por conta)

Cria o bucket S3 do state, a tabela DynamoDB de lock e o provedor OIDC do GitHub (deploy sem access keys).

```bash
cd ~/GAI
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export TF_STATE_BUCKET="gai-terraform-state-${ACCOUNT_ID}"

cd infra/bootstrap
terraform init
terraform apply -var="state_bucket_name=${TF_STATE_BUCKET}" -var="aws_region=us-east-1"
```

Digite `yes` quando solicitado. Em seguida, substitua o placeholder do Account ID nos backends:

```bash
cd ~/GAI/infra/terraform
sed -i "s/YOUR_ACCOUNT_ID/${ACCOUNT_ID}/" env/homolog.backend.hcl env/production.backend.hcl
cat env/homolog.backend.hcl   # confira o nome do bucket
```

Confira também em `env/homolog.tfvars` e `env/production.tfvars`:

```hcl
github_org  = "jwssIncp"
github_repo = "GAI"
```

---

## Passo 3 — Provisionar homologação

```bash
cd ~/GAI/infra/terraform
terraform init -backend-config=env/homolog.backend.hcl -reconfigure
terraform plan  -var-file=env/homolog.tfvars
terraform apply -var-file=env/homolog.tfvars
```

Leva de **15 a 25 minutos** (RDS, NAT, CloudFront). Ao final, rode `terraform output` e guarde os valores.

### Imagem inicial do backend (obrigatório uma vez)

O serviço ECS aponta para a imagem `:latest`, que ainda não existe:

```bash
cd ~/GAI
chmod +x infra/scripts/bootstrap-backend-image.sh
./infra/scripts/bootstrap-backend-image.sh homolog
```

> **Atenção:** esse script **não roda migrations**. O banco só recebe as tabelas no primeiro deploy pelo GitHub Actions (Passo 5). Até lá é normal o backend falhar no health check.

---

## Passo 4 — Configurar o GitHub

### 4.1 Branches

Os workflows usam `develop` (homolog) e `master` (produção / branch padrão). Se ainda não existir `develop`:

```bash
cd ~/GAI
git checkout master && git pull
git checkout -b develop && git push -u origin develop
```

`github_branch_deploy` em homolog = `develop`; em production = `master`.

### 4.2 Environments e secrets

No GitHub: **Settings → Environments** → `homolog`, `production`, `infra-homolog`, `infra-production`.

O único secret por environment de app é **`AWS_ROLE_ARN`** (IAM → Roles → `gai-<env>-github-actions`).  
Vars de repositório: `TF_PLAN_ROLE_ARN`, `TF_APPLY_ROLE_ARN`.

Config de deploy = Parameter Store `/gai/<env>/deploy/*` (workflow `.github/scripts/load-deploy-config.sh`).  
Senhas = `/gai/<env>/db/password` e `/gai/<env>/platform-admin/password` (fora do state Terraform).

Apague secrets legados: `ECR_REPOSITORY`, `ECS_*`, `FRONTEND_S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`.

> **Não** cadastre access keys no GitHub. Auth = OIDC.

---

## Passo 5 — Primeiro deploy

1. **Actions → Deploy Homolog → Run workflow** (branch `develop`).
2. O pipeline executa:
   1. Lint, audit e testes
   2. Build e push da imagem no ECR
   3. Registro da nova task definition
   4. **Migrations** (task ECS one-shot)
   5. Atualização do serviço ECS
   6. Build do frontend com `VITE_API_BASE_URL=/api/v1`
   7. Sync para o S3 + invalidação do CloudFront
3. Teste: `https://<APP_URL>/api/v1/health` → `{"status":"ok"}`

### Usuário `platform.admin`

Cada deploy roda `release:prod` (migrations + catálogo de permissões + `ensure-platform-admin`). Senha em `/gai/<env>/platform-admin/password`.  
Rotação: editar o parâmetro no SSM → Actions → **Ops - Reset platform admin**.

Seed completo (`org.admin`, `test.user`) é opcional; preferir criar usuários pela UI. Se precisar do bootstrap legado, use a imagem compilada (`node dist/src/scripts/seed/bootstrap.js`) via task ECS — não use `terraform output` local; leia cluster/subnets de `/gai/<env>/deploy/*`.

### Deploy automático

Homolog: push na `develop` já dispara **Deploy Homolog**. Produção permanece `workflow_dispatch` na `master`.

---

## Passo 6 — Produção

Repita os passos 3, 4.2 e 5 com o state de produção:

```bash
cd ~/GAI/infra/terraform
terraform init -backend-config=env/production.backend.hcl -reconfigure
terraform plan  -var-file=env/production.tfvars
terraform apply -var-file=env/production.tfvars

cd ~/GAI
./infra/scripts/bootstrap-backend-image.sh production
```

Gere os secrets com os mesmos comandos `echo` do Passo 4.2 (com o state de produção ativo) e cadastre-os no environment `production`.

### E-mail (SES) — obrigatório em produção

Em produção a task usa `USE_MOCK_EMAIL=false`; sem SES configurado, envio de e-mails (ex.: reset de senha) falha.

1. **SES → Identities**: verifique seu domínio ou e-mail remetente.
2. **SES → Account dashboard → Request production access** (sair do sandbox).
3. Em `env/production.tfvars`, adicione:

   ```hcl
   ses_from_email = "noreply@seudominio.com"
   ```

4. Rode `terraform apply -var-file=env/production.tfvars` novamente.

> Em homologação o e-mail é simulado (`USE_MOCK_EMAIL=true`).

---

## Passo 7 — Domínio próprio (opcional)

1. **Route 53 → Hosted zones**: crie a zona do seu domínio. Se o domínio foi comprado fora da AWS, aponte os nameservers no registrador.
2. Nos `.tfvars`:

   ```hcl
   domain_name    = "app.seudominio.com"   # homolog: homolog.seudominio.com
   hosted_zone_id = "Z0123456789ABC"
   ```

3. Rode `terraform apply` novamente. O certificado ACM é emitido e validado automaticamente.

Sem domínio, use o endereço `*.cloudfront.net` do output `app_url`.

---

## Custos estimados (24/7)

| Ambiente    | Principais itens                                                   | Estimativa           |
|-------------|--------------------------------------------------------------------|----------------------|
| Homologação | 1 NAT (~US$ 33), ALB (~US$ 18), RDS t3.micro (~US$ 13), Fargate (~US$ 9) | **~US$ 75–90/mês**   |
| Produção    | 2 NAT, ALB, RDS t3.small Multi-AZ, 2 tasks Fargate                 | **~US$ 180–230/mês** |

Para economizar enquanto testa, destrua homologação:

```bash
cd ~/GAI/infra/terraform
terraform init -backend-config=env/homolog.backend.hcl -reconfigure
terraform destroy -var-file=env/homolog.tfvars
```

> Produção tem `deletion_protection` no RDS — desative antes de um destroy.

---

## Operação do dia a dia

1. Abra PR → workflow **CI** roda lint, audit, testes e build.
2. Merge em `develop` → **Deploy Homolog**.
3. Valide em homologação.
4. Merge em `master` → **Deploy Production** (manual).

Comandos úteis:

```bash
# Logs do backend
aws logs tail /ecs/gai-homolog --follow
aws logs tail /ecs/gai-production --follow

# Status do serviço
aws ecs describe-services --cluster gai-homolog --services gai-homolog-backend \
  --query 'services[0].{running:runningCount,desired:desiredCount,events:events[0:3]}'
```

---

## Troubleshooting

| Sintoma | Causa provável |
|---------|----------------|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Nome do environment no GitHub diferente de `homolog`/`production`, branch errada, ou `github_org`/`github_repo` incorretos |
| `CannotPullContainerError` no ECS | Primeira imagem ausente — one-shot `bootstrap-backend-image.sh` ou Deploy Homolog |
| Backend reiniciando em loop | Migrations pendentes ou erro de conexão com o banco — veja os logs no CloudWatch |
| Migrations com exit ≠ 0 | Ver logs da task one-shot em `/ecs/gai-<ambiente>` |
| Frontend 404 em rotas | Aguardar a invalidação do CloudFront |
| `terraform init` com state lock | Outro `apply` em andamento ou lock órfão na tabela `gai-terraform-locks` |
| `OIDC provider already exists` | Já criado no bootstrap; não recriar |

---

## Checklist

- [ ] Conta AWS com MFA no root e alerta de custos
- [ ] Usuário IAM admin + `aws configure`
- [ ] AWS CLI, Terraform, Docker e jq instalados no WSL
- [ ] Bootstrap aplicado e `*.backend.hcl` atualizados
- [ ] Homologação provisionada (primeiro apply; depois só via Actions)
- [ ] Imagem inicial / Deploy Homolog OK
- [ ] Branches `develop` e `master`
- [ ] Environments + só `AWS_ROLE_ARN` + vars `TF_*`
- [ ] Parameter Store `/gai/homolog/*` + grupo `gai-homolog-operators`
- [ ] Health OK + `platform.admin` via `release:prod`
- [ ] Auto-deploy `on.push` develop ativo
- [ ] Produção (depois): provisionar + SES + secrets
- [ ] (Opcional) Domínio próprio
