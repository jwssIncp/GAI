# Implementation Plan: Inventory Items

## Sequencia

1. Criar especificacao e modelo de dados da feature.
2. Criar contrato OpenAPI em `contracts/inventory-items-api.yaml`.
3. Criar migration TypeORM para `inventory_items` e `inventory_item_audit_logs`.
4. Criar modulo NestJS `inventory-items` com camadas existentes:
   - `domain/entities`
   - `domain/enums`
   - `domain/ports`
   - `application/dto`
   - `application/services`
   - `application/use-cases`
   - `infrastructure/persistence`
   - `presentation`
5. Registrar permissoes em seed.
6. Registrar entities e module no `AppModule`.
7. Cobrir dominio, contrato e fluxo e2e basico.
8. Rodar lint/testes disponiveis.

## Decisoes tecnicas

- O projeto usa TypeORM, nao Prisma; portanto schema/migration seguem o padrao TypeORM
  existente.
- Endpoints principais serao aninhados em `/projects/:projectId/inventory-items`.
- Endpoints globais somente leitura serao adicionados: `/inventory-items` e
  `/inventory-items/:id`, pois o projeto ja possui listagens globais por recurso.
- Regras de project operacional reutilizam o enum/status de Projects.
