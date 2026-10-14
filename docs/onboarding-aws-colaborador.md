# GAI — Onboarding de colaborador na AWS

Como um segundo desenvolvedor passa a operar o **mesmo ambiente AWS** do GAI (homologação/produção): rodar Terraform, ver logs, disparar deploys, redefinir usuários e simular tudo localmente.

Contexto do ambiente: [`handoff-aws-homolog.md`](./handoff-aws-homolog.md) · Setup do zero: [`deploy-aws-do-zero.md`](./deploy-aws-do-zero.md).

---

## Qual caminho seguir?

| Objetivo | Caminho | Seção |
|---|---|---|
| Operar a infra que já existe (recomendado) | Usuário IAM próprio na **mesma conta** + mesmo state Terraform | Partes 1 e 2 |
| Desenvolver/testar a aplicação sem AWS | Docker local | Parte 3 |
| Ter uma AWS isolada só sua (sandbox) | Conta AWS própria, stack separada | Parte 4 |

> ⚠️ **Não** rode `infra/bootstrap` de novo na conta compartilhada. O bucket de state, a tabela de lock e o OIDC do GitHub **já existem**.

---

## Parte 1 — O que o responsável pela conta faz (Luiz)

### 1.1 Criar o usuário IAM do colega

1. Console AWS → **IAM → Users → Create user** (ex.: `fulano-admin`).
2. **Não** é necessário marcar acesso ao console (opcional).
3. **Attach policies directly** → `AdministratorAccess`.
   - O Terraform cria VPC, RDS, ECS e **roles IAM**, por isso precisa de permissão ampla. Para quem só vai ver logs e disparar tasks, uma política mais restrita é suficiente.
4. Abra o usuário → **Security credentials → Create access key** → "Command Line Interface (CLI)".
5. Entregue **Access key ID + Secret** por canal seguro (gerenciador de senhas). **Nunca** por e-mail, chat aberto ou commit.
6. Recomendado: peça para o colega ativar **MFA** no próprio usuário.

### 1.2 Dar acesso ao GitHub

1. Repositório `jwssIncp/GAI` → **Settings → Collaborators** → convide o colega com papel **Write** (ou Maintain).
2. **Settings → Environments → production → Required reviewers**: adicione o colega se ele também puder aprovar deploys de produção.

Os secrets dos environments **não** precisam ser repassados — o GitHub Actions já os usa via OIDC.

### 1.3 Repassar credenciais da aplicação

Envie por canal seguro a senha do usuário da aplicação (ou, melhor, crie um usuário próprio para ele pela tela do GAI). A senha do banco ele obtém sozinho via Secrets Manager (Parte 2.5).

---

## Parte 2 — O que o colega faz

### 2.1 Ferramentas (WSL Ubuntu ou Linux/macOS)

> No Windows, use o **terminal Ubuntu (WSL)**. Os scripts do projeto são bash.

```bash
sudo apt update && sudo apt install -y unzip jq curl gnupg git

# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install && rm -rf aws awscliv2.zip

# Terraform
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install -y terraform

# Session Manager plugin (opcional - acesso ao banco via bastion)
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o smp.deb
sudo dpkg -i smp.deb && rm smp.deb
```

**Docker:** Docker Desktop no Windows com **Settings → Resources → WSL Integration → Ubuntu** ativado.

> Se o `apt update` mostrar `GPG error ... download.docker.com`, remova o repo: `sudo rm -f /etc/apt/sources.list.d/docker.list /etc/apt/sources.list.d/docker.sources`.

### 2.2 Credenciais AWS

```bash
aws configure
# AWS Access Key ID:     (recebida do Luiz)
# AWS Secret Access Key: (recebida do Luiz)
# Default region name:   us-east-1
# Default output format: json

aws sts get-caller-identity   # deve mostrar o Arn ...:user/fulano-admin
```

### 2.3 Clonar o repositório

```bash
cd ~
git clone https://github.com/jwssIncp/GAI.git
cd GAI
git checkout develop
```

### 2.4 Conectar ao state do Terraform (já existente)

```bash
cd ~/GAI/infra/terraform
terraform init -backend-config=env/homolog.backend.hcl -reconfigure
terraform plan -var-file=env/homolog.tfvars
```

**Resultado esperado do `plan`:** `No changes. Your infrastructure matches the configuration.`

Se o plan mostrar mudanças que você não fez, **não rode `apply`** — provavelmente seu checkout está desatualizado ou alguém tem alterações não commitadas. Alinhe com o time antes.

Para trocar para produção:

```bash
terraform init -backend-config=env/production.backend.hcl -reconfigure
```

### 2.5 Verificar que tudo funciona

```bash
cd ~/GAI/infra/terraform

terraform output -raw app_url                 # URL do sistema
curl -s "$(terraform output -raw app_url)/api/v1/health"   # {"status":"ok"}

aws logs tail /ecs/gai-homolog --since 15m    # logs do backend

aws ecs describe-services --cluster gai-homolog --services gai-homolog-backend \
  --query 'services[0].{running:runningCount,desired:desiredCount}'

# Credenciais do banco
aws secretsmanager get-secret-value --secret-id gai-homolog/app --query SecretString --output text
```

### 2.6 O que você pode fazer a partir daqui

| Tarefa | Como |
|---|---|
| Deploy de homologação | GitHub → Actions → **Deploy Homolog** → Run workflow (`develop`) |
| Deploy de produção | GitHub → Actions → **Deploy Production** (`main`, requer aprovação) |
| Alterar infraestrutura | Editar `infra/terraform/*.tf` → PR → `plan` → `apply` |
| Criar/redefinir admin + diagnosticar login | `ADMIN_PASSWORD='...' ./infra/scripts/reset-admin.sh homolog` |
| Ver logs | `aws logs tail /ecs/gai-homolog --follow` |
| Rodar seed | Ver [`deploy-aws-do-zero.md`](./deploy-aws-do-zero.md), seção do seed |

### 2.7 Regras de convivência (importante)

1. **Nunca** rode `infra/bootstrap` na conta compartilhada.
2. Sempre `git pull` antes de `terraform plan/apply`. O state é compartilhado; código desatualizado = Terraform tenta "desfazer" mudanças do colega.
3. Sempre `plan` antes de `apply`, e leia o plan.
4. Mudanças de infra entram via **commit/PR** — nunca apenas local.
5. Se aparecer `Error acquiring the state lock`: o outro dev está rodando `apply`. **Espere.** Só use `terraform force-unlock <ID>` se tiver certeza de que ninguém está rodando.
6. Avise o time antes de `terraform destroy` ou alterações no RDS.
7. Descrições de recursos AWS: **apenas ASCII** (sem `—`, acentos etc.).
8. Nunca commitar `.env`, `*.tfstate`, access keys ou senhas.

---

## Parte 3 — Simular a aplicação localmente (sem AWS)

Para desenvolver e testar fluxos (incluindo seed e login) sem custo:

```bash
# Backend + MySQL
cd ~/GAI/gai-backend
cp .env.example .env
docker compose up -d --build
docker compose exec app npm run migration:run
docker compose exec app npm run seed:bootstrap
curl -s http://localhost:3000/api/v1/health

# Frontend
cd ~/GAI/gai-frontend
cp .env.example .env.local
npm ci
npm run dev        # http://localhost:5173
```

Usuários locais criados pelo seed (padrões do `.env.example`):

| Login | Senha |
|---|---|
| `platform.admin` | `Admin@123456` |
| `org.admin` | `Admin@123456` |
| `test.user` | `Test@123456` |

### Simular o comportamento da imagem de produção

A imagem de produção só contém `dist/` (sem `src/` nem `ts-node`). Para reproduzir problemas que só acontecem na AWS:

```bash
cd ~/GAI/gai-backend
docker build --target production -t gai-backend:prod .

# Rodar o seed exatamente como na AWS, contra o MySQL do compose
docker run --rm --network gai-backend_default \
  -e DB_HOST=mysql -e DB_USERNAME=gai -e DB_PASSWORD=gai -e DB_DATABASE=gai \
  gai-backend:prod node dist/src/scripts/seed/bootstrap.js
```

> O nome da rede pode variar; confira com `docker network ls`.

---

## Parte 4 — (Opcional) Ambiente AWS isolado na conta do colega

Útil para experimentar Terraform sem risco. Custa ~US$ 85–100/mês enquanto ligado — destrua ao terminar.

1. Conta AWS própria, usuário IAM admin, `aws configure` (como na Parte 2).
2. Bootstrap **na conta dele**:

   ```bash
   cd ~/GAI/infra/bootstrap
   export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   terraform init
   terraform apply -var="state_bucket_name=gai-terraform-state-${ACCOUNT_ID}"
   ```

3. Crie arquivos **locais, não commitados** (ex.: `env/sandbox.backend.hcl`) apontando para o bucket dele, com `key = "gai/sandbox/terraform.tfstate"`.
4. `terraform init -backend-config=env/sandbox.backend.hcl -reconfigure` e `terraform apply -var-file=env/homolog.tfvars`.
5. `./infra/scripts/bootstrap-backend-image.sh homolog` para a primeira imagem.
6. Deploys via GitHub Actions **não** funcionam nesse sandbox (os secrets do repo apontam para a conta principal). Use o script de imagem ou um fork do repositório com seus próprios environments/secrets.
7. Ao terminar: `terraform destroy -var-file=env/homolog.tfvars`.

> Não commite `env/sandbox.*` nem altere os `*.backend.hcl` oficiais.

---

## Troubleshooting

| Sintoma | Causa provável |
|---|---|
| `InvalidClientTokenId` / `SignatureDoesNotMatch` | Access key errada ou desativada → refazer `aws configure` |
| `AccessDenied` no `terraform plan` | Usuário IAM sem permissão suficiente |
| `Error acquiring the state lock` | Outro dev executando `apply` — aguarde |
| `plan` mostra mudanças inesperadas | Checkout desatualizado (`git pull`) ou mudanças não commitadas de alguém |
| `terraform output` vazio | `init` apontando para o backend errado |
| `jq: command not found` | `sudo apt install -y jq` |
| Login no sistema retorna "Invalid credentials" | Rodar `reset-admin.sh` — ele mostra o motivo das falhas |
