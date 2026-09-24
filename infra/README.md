# Infraestrutura GAI

Veja o tutorial completo em [`docs/aws-cicd.md`](../docs/aws-cicd.md).

```
bootstrap/     # uma vez por conta AWS (S3 state + DynamoDB lock + OIDC)
terraform/     # stack de aplicação (aplicar 2×: homolog e production)
scripts/       # bootstrap da imagem Docker inicial
```
