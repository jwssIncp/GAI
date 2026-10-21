# GAI — Onboarding de colaborador

Como um segundo desenvolvedor passa a operar **homologação** e desenvolver localmente.

Contexto: [`handoff-aws-homolog.md`](./handoff-aws-homolog.md) · Setup do zero: [`deploy-aws-do-zero.md`](./deploy-aws-do-zero.md).

---

## Qual caminho seguir?

| Objetivo | Caminho | Seção |
|---|---|---|
| Operar homolog (logs, deploys via GitHub) | Usuário IAM no grupo `gai-homolog-operators` | Partes 1 e 2 |
| Desenvolver/testar a aplicação sem AWS | Docker local | Parte 3 |
| AWS isolada só sua (sandbox) | Conta própria | Parte 4 |

> **Não** rode `infra/bootstrap` na conta compartilhada.  
> **Não** rode `terraform apply` local para operar — infra e deploy são **GitHub Actions**.

---

## Parte 1 — O que o admin da conta faz (Jonathan / root)

### 1.1 Usuário IAM + grupo de operadores

1. IAM → Users → Create user (ex.: `fulano`).
2. Access key CLI (ou SSO, preferível).
3. Adicionar ao grupo **`gai-homolog-operators`** (criado pelo Terraform):
   ```bash
   aws iam add-user-to-group --group-name gai-homolog-operators --user-name fulano
   ```
4. Entregar Access key / SSO por canal seguro. Recomendado: MFA.

Quem só precisa de logs/Parameter Store **não** precisa de `AdministratorAccess`. Acesso humano ao banco ainda é pendência.

### 1.2 GitHub

1. Repo `jwssIncp/GAI` → Collaborators → Write (ou Maintain).
2. Secrets dos environments **não** se compartilham — Actions usa OIDC (`AWS_ROLE_ARN` só no environment).

### 1.3 Aplicação

Criar usuário próprio pela UI do GAI (ou enviar senha do `platform.admin` só se necessário — preferível usuário próprio). Senha do banco o colega lê sozinho via Parameter Store (Parte 2.5).

---

## Parte 2 — O que o colega faz

### 2.1 Ferramentas (WSL Ubuntu)

```bash
sudo apt update && sudo apt install -y unzip jq curl gnupg git

curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install && rm -rf aws awscliv2.zip

```

**Docker:** Docker Desktop + WSL Integration.  
Terraform CLI **não** é necessário para o dia a dia.

### 2.2 Credenciais AWS

```bash
aws configure   # region us-east-1
aws sts get-caller-identity
```

### 2.3 Clonar

```bash
git clone https://github.com/jwssIncp/GAI.git
cd GAI && git checkout develop
```

### 2.4 Verificar acesso

```bash
# Health (substitua pela URL CloudFront do time)
curl -s "https://<cloudfront-domain>/api/v1/health"

aws logs tail /ecs/gai-homolog --since 15m

aws ecs describe-services --cluster gai-homolog --services gai-homolog-backend \
  --query 'services[0].{running:runningCount,desired:desiredCount}'

aws ssm get-parameters-by-path --path /gai/homolog/db --with-decryption \
  --query 'Parameters[].[Name,Value]' --output text
```

### 2.5 O que você pode fazer

| Tarefa | Como |
|---|---|
| Deploy homolog | Push/merge na `develop` (automático) ou Actions → **Deploy Homolog** |
| Deploy produção | Actions → **Deploy Production** (branch `master`, quando existir) |
| Alterar infra | PR em `infra/terraform/**` → plan no CI → merge na `develop` aplica homolog; produção = dispatch manual na `master` |
| Senha `platform.admin` | `aws ssm get-parameter --name /gai/homolog/platform-admin/password --with-decryption --query Parameter.Value --output text` |
| Reset admin | Actions → **Ops - Reset platform admin** (após editar o parâmetro no SSM) |
| Banco (DBeaver) | Pendente — sem bastion/túnel por enquanto |
| Logs | `aws logs tail /ecs/gai-homolog --follow` |

### 2.6 Regras

1. Nunca `infra/bootstrap` na conta compartilhada.
2. Nunca `terraform apply` local para “ajustar” homolog — use o workflow **Infra (Terraform)**.
3. Mudanças de infra só via commit/PR.
4. Nunca commitar `.env`, `*.tfstate`, keys ou senhas.
5. Descrições AWS: só ASCII.

---

## Parte 3 — Local (sem AWS)

```bash
cd ~/GAI/gai-backend
cp .env.example .env
docker compose up -d --build
docker compose exec app npm run migration:run
docker compose exec app npm run seed:bootstrap

cd ~/GAI/gai-frontend
cp .env.example .env.local
npm ci && npm run dev
```

| Login | Senha (padrão seed) |
|---|---|
| `platform.admin` | `Admin@123456` |
| `org.admin` | `Admin@123456` |
| `test.user` | `Test@123456` |

---

## Parte 4 — Sandbox AWS (opcional)

Conta própria + bootstrap + apply com backend próprio. Deploys do repo oficial **não** apontam para o sandbox. Ao terminar: `terraform destroy`. Ver histórico em [`deploy-aws-do-zero.md`](./deploy-aws-do-zero.md).  
`bootstrap-backend-image.sh` é one-shot da **primeira** imagem; não é operação contínua.

---

## Troubleshooting

| Sintoma | Causa |
|---|---|
| `InvalidClientTokenId` | Access key errada → `aws configure` |
| `AccessDenied` no SSM / SSM Session | Fora do grupo `gai-homolog-operators` |
| Login "Invalid credentials" | Bloqueio ou senha ≠ SSM → **Ops - Reset platform admin** |
| Precisa mudar infra | PR + GitHub Actions — não apply local |
