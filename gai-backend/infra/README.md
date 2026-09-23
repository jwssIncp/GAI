# Infra movida

A infraestrutura Terraform do GAI ficou na raiz do monorepo:

- `infra/bootstrap` — state remoto + OIDC GitHub
- `infra/terraform` — VPC, ECS, RDS, S3, CloudFront (homolog + production)
- `docs/aws-cicd.md` — tutorial completo
