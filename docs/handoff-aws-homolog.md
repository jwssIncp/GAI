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
                                   └─ Secrets Manager (credenciais do banco)
```

| Item | Valor |
|---|---|
| Região | `us-east-1` |
| Cluster / Service ECS | `gai-homolog` / `gai-homolog-backend` |
| Logs | CloudWatch `/ecs/gai-homolog` |
| Secret do banco | `gai-homolog/app` |
| State Terraform | S3 `gai-terraform-state-<ACCOUNT_ID>` + DynamoDB `gai-terraform-locks` |
| Branch de deploy | `develop` → environment GitHub `homolog` |
| URL | `terraform output -raw app_url` |
| Health check | `<app_url>/api/v1/health` |

---

## Acesso

> Passo a passo completo: [`onboarding-aws-colaborador.md`](./onboarding-aws-colaborador.md).

- **AWS:** peça ao Luiz um usuário IAM próprio (não compartilhe access keys).
- **Aplicação:** peça a senha do `platform.admin` ao Luiz por canal seguro; depois crie seu próprio usuário pela tela do sistema.
- **Banco:** RDS é privado. Senha em Secrets Manager:
  ```bash
  aws secretsmanager get-secret-value --secret-id gai-homolog/app --query SecretString --output text
  ```
  Para conectar com DBeaver/Workbench é necessário um bastion via SSM (ainda não criado).

---

## Mudanças no código feitas hoje

| Arquivo | Mudança | Motivo |
|---|---|---|
| `infra/terraform/security_groups.tf`, `cloudfront.tf` | `—` → `-` nas descrições | AWS rejeita caracteres não-ASCII em descrições de Security Group |
| `infra/terraform/env/*.backend.hcl` | Account ID real no nome do bucket | Configuração do state remoto |
| `gai-backend/data-source.ts` | Entities/migrations resolvidos por `__dirname` + extensão (`.ts` em dev, `.js` no build) | O seed compilado procurava `src/**/*.entity.ts`, inexistente na imagem → seed falhava e o banco ficava sem usuários |
| `infra/scripts/reset-admin.sh` + `reset-admin.cjs` | **Novo** | Diagnóstico de login + criar/redefinir admin via task ECS one-shot, sem deploy |
| `docs/deploy-aws-do-zero.md`, `docs/handoff-aws-homolog.md` | **Novos** | Documentação |

> ⚠️ Se essas mudanças ainda não estiverem na `develop`, um `terraform apply` a partir de outro checkout vai falhar/recriar os Security Groups. Commitar antes de qualquer outra coisa.

---

## Problemas encontrados e solução

| Sintoma | Causa | Solução |
|---|---|---|
| `terraform apply` falhou ao criar Security Groups | Travessão `—` nas descrições | Trocado por `-` |
| `GPG error ... download.docker.com` no `apt update` | Repo apt do Docker sem chave no WSL | Repo removido (usa Docker Desktop) |
| `jq: command not found` | jq não instalado | `sudo apt install -y jq` ou `tr -d '[]" \n'` |
| Login retornava "Invalid credentials" | Banco sem usuários (`auth_audit_logs.reason = unknown_user`) porque o seed quebrava no container | Fix do `data-source.ts` + `reset-admin.sh` para criar o admin |

---

## Operação

```bash
# Sempre no WSL, a partir de infra/terraform com o state certo
cd ~/GAI/infra/terraform
terraform init -backend-config=env/homolog.backend.hcl -reconfigure

# Logs do backend
aws logs tail /ecs/gai-homolog --follow

# Status do serviço
aws ecs describe-services --cluster gai-homolog --services gai-homolog-backend \
  --query 'services[0].{running:runningCount,desired:desiredCount}'
```

**Deploy:** GitHub → Actions → **Deploy Homolog** → Run workflow (branch `develop`).
Pipeline: lint/test → build/push ECR → migrations (task one-shot) → update ECS → build frontend → S3 → invalidação CloudFront.

**Criar/redefinir admin e diagnosticar login** (não precisa de deploy):

```bash
cd ~/GAI
ADMIN_PASSWORD='SenhaForte!2026' ./infra/scripts/reset-admin.sh homolog
```

O script imprime as últimas falhas de login com o motivo, a lista de usuários, cria/redefine o usuário, desbloqueia e atribui `PLATFORM_ADMIN`. Use `ADMIN_LOGIN=...` para outro login (atenção: atribui papel de admin da plataforma).

**Seed completo** (organização de teste, `org.admin`, `test.user`) — somente após deploy com o fix do `data-source.ts`. Comando em [`deploy-aws-do-zero.md`](./deploy-aws-do-zero.md#criar-o-usuário-admin-seed). O seed não altera usuários existentes.

---

## Próximos passos

1. [ ] Commitar as mudanças acima e dar push na `develop`.
2. [ ] Rodar **Deploy Homolog** (publica o fix do seed).
3. [ ] Rodar o seed para criar `org.admin` / `test.user` (ou criar usuários pela UI).
4. [ ] Trocar a senha do `platform.admin`.
5. [ ] Reativar `on.push` em `.github/workflows/deploy-homolog.yml` quando estável.
6. [ ] Produção: `terraform apply -var-file=env/production.tfvars`, secrets do environment `production` (com Required reviewers), SES verificado e fora do sandbox, `ses_from_email`.
7. [ ] (Opcional) Domínio próprio via Route53.
8. [ ] (Opcional) Bastion SSM para acesso ao banco.

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
- 5 senhas erradas bloqueiam a conta por 30 min (`reset-admin.sh` desbloqueia).
- Descrições de recursos AWS: apenas ASCII.
