# Infraestrutura GAI

Operação do dia a dia: [`docs/handoff-aws-homolog.md`](../docs/handoff-aws-homolog.md) · CI/CD: [`docs/aws-cicd.md`](../docs/aws-cicd.md).

```
bootstrap/     # uma vez por conta AWS (state S3 + lock + OIDC + roles Terraform CI)
terraform/     # stack (homolog/production) — apply via GitHub Actions, não na máquina
scripts/       # bootstrap-backend-image (só 1ª imagem de um ambiente novo)
# Acesso humano ao banco: pendente (bastion desligado: enable_db_bastion = false)
```

**Não** rode `terraform apply` local para operar homolog. Infra = workflow **Infra (Terraform)**; app = **Deploy Homolog** (push em `develop`).
