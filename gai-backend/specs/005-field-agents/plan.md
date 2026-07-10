# Implementation Plan: Field Agents

1. Criar spec, data model, checklist, tasks, quickstart e contrato OpenAPI.
2. Criar entidades TypeORM, migration e registrar entidades no AppModule/test helper.
3. Criar dominio, enums, ports, DTOs, repository TypeORM, use cases e scope service.
4. Criar controllers protegidos por SessionAuthGuard e PermissionsGuard.
5. Adicionar permissoes no seed.
6. Criar testes de contrato, dominio/use cases e integracao seguindo padrao existente.
7. Rodar lint, testes unitarios/contrato e e2e disponiveis.

## Technical Decision

Embora o prompt mencione Prisma, o projeto real usa TypeORM em todos os modulos
existentes. A feature deve seguir TypeORM para preservar padrao, migrations, testes e
registro de entidades ja estabelecidos.
