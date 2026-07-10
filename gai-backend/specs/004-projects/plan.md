# Implementation Plan: Projects

1. Criar spec e contrato OpenAPI canonico em `specs/004-projects`.
2. Criar migration TypeORM para `projects` e `project_audit_logs`.
3. Adicionar permissoes `projects:*` ao seed.
4. Implementar modulo Nest `ProjectsModule` seguindo camadas existentes.
5. Registrar entidades no `AppModule` e nos helpers de teste.
6. Cobrir regras de dominio, contrato e fluxos e2e principais.

## Technical Context

O projeto atual usa NestJS + TypeORM, nao Prisma. Por consistencia arquitetural, a
feature deve seguir TypeORM entities, repositories e migrations manuais.

