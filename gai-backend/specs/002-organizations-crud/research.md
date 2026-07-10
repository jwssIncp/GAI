# Research: CRUD de Organizations (002)

**Feature**: `002-organizations-crud` | **Date**: 2026-06-15 | **Amended**: 2026-06-17

> Decisões de plataforma compartilhadas com `001-user-auth`. Esta feature define o
> modelo tenant e precede a autenticação na ordem de implementação.

## R1 — Stack da plataforma GAI (greenfield)

**Decision**: TypeScript 5.x + NestJS 11 + MySQL 8.0 (RDS) + TypeORM + class-validator.

**Rationale**: Decisão explícita do projeto; NestJS oferece arquitetura modular alinhada
a SOLID (módulos, providers, injeção de dependência nativa), tipagem forte com
TypeScript, Swagger/OpenAPI integrado e ecossistema maduro para APIs enterprise em AWS.
MySQL 8 atende transações, índices e JSON nativo para auditoria.

**Alternatives considered**:
- Python/FastAPI + PostgreSQL — plano anterior; substituído pela escolha TypeScript.
- Prisma ORM — DX excelente, porém TypeORM integra mais diretamente com padrões NestJS
  e migrations já adotados no ecossistema enterprise.

## R2 — Validação de CNPJ

**Decision**: Value object `Cnpj` em `src/modules/organizations/domain/value-objects/cnpj.ts`
com algoritmo de dígitos verificadores; persistência de CNPJ normalizado (14 dígitos).

**Rationale**: Regra de negócio brasileira no domínio (FR-003, NFR-004), testável com
Jest sem banco.

**Alternatives considered**:
- Validação apenas por regex — insuficiente.
- `@IsCNPJ()` decorator sem domínio — viola separação de camadas.

## R3 — Soft delete e status

**Decision**: Coluna `status` ENUM MySQL (`ACTIVE`, `INACTIVE`); reativação via
`POST /organizations/:id/activate`.

**Rationale**: Atende FR-009/FR-010/FR-014; preserva histórico e unicidade de CNPJ.

**Alternatives considered**:
- Hard delete — viola integridade patrimonial futura.
- `deleted_at` — equivalente funcional; spec usa status explícito.

## R4 — Paginação e busca

**Decision**: Offset pagination (`page` default 1, `page_size` default 20, max 100);
filtros `status`, `search` (LIKE case-insensitive via `LOWER()` em `legal_name`,
`trade_name`, `cnpj`); ordenação `legal_name ASC`. Índices: `UNIQUE(cnpj)`,
`INDEX(status)`, `INDEX(legal_name)`.

**Rationale**: Atende NFR-002; MySQL 8 suporta índices adequados para volume de orgs.

**Alternatives considered**:
- Cursor-based — desnecessário no MVP de organizations.
- Full-text search — over-engineering inicial.

## R5 — Autorização do CRUD

**Decision**: `@UseGuards(SessionAuthGuard, RolesGuard)` com role `PLATFORM_ADMIN` em
todos os endpoints de organizations.

**Rationale**: Atende FR-013; integra com módulo `auth` via guards NestJS.

**Alternatives considered**:
- CRUD público — viola segurança.
- Autorização por organization_id — inadequado para operação de plataforma.

## R6 — Auditoria

**Decision**: Tabela `organization_audit_logs` com coluna `changes` JSON (MySQL);
escrita na mesma transação TypeORM `QueryRunner`.

**Rationale**: Atende FR-012 e princípio V; JSON nativo no MySQL 8 substitui JSONB.

**Alternatives considered**:
- Apenas logs Kibana — insuficiente para auditoria regulatória.
- Event sourcing — complexidade excessiva.

## R7 — Infraestrutura AWS

**Decision**: ECS Fargate (NestJS container) + RDS MySQL 8 Multi-AZ (produção) +
AWS Systems Manager Parameter Store (PS) + Amazon SES + Terraform em `infra/`.
GitHub Actions (ESLint, `npm audit`, Jest, coverage ≥ 80%).

**Rationale**: Alinha princípios VI–VIII e clarificação 2026-06-17 (PS para homolog/prod);
RDS MySQL gerenciado conforme decisão do projeto.

**Alternatives considered**:
- AWS Secrets Manager — válido para secrets; PS escolhido para todas as variáveis de
  ambiente conforme decisão do usuário.
- Aurora MySQL — válido para escala futura; RDS MySQL suficiente no MVP.
- EKS — overhead operacional alto para equipe inicial.

## R8 — Logging e observabilidade

**Decision**: `nestjs-pino` com saída JSON estruturada; campos `service`, `environment`,
`correlationId`, `operation`, `organizationId`, `result`, `durationMs`.

**Rationale**: Substitui `structlog` (Python); Pino é padrão de alta performance em
NestJS e indexável no Kibana via CloudWatch → OpenSearch.

**Alternatives considered**:
- Winston texto plano — menos performático para alto volume de logs.

## R9 — Ambiente local Docker Compose (2026-06-17)

**Decision**: `docker-compose.yml` com dois serviços:

| Serviço | Imagem / build | Comportamento |
|---------|----------------|---------------|
| `mysql` | `mysql:8.0` | Volume nomeado `gai_mysql_data`, healthcheck, utf8mb4 |
| `app` | `Dockerfile` multi-stage dev | Bind mount do source, `npm run start:dev`, `depends_on: mysql: healthy` |

**Entrypoint** (`scripts/docker-entrypoint.sh`):

1. Aguarda MySQL healthy.
2. Se volume MySQL vazio (primeira inicialização): `migration:run` + `seed:bootstrap`.
3. Se migrations pendentes: exit 1 com mensagem clara (fail-fast).
4. Caso contrário: inicia `start:dev`.

**Variáveis**: `.env` local (gitignored) + `.env.example` versionado. No serviço `app`,
`docker-compose.yml` sobrescreve `DB_HOST=mysql`; testes no host usam `DB_HOST=localhost`.

**Rationale**: Atende NFR-010/011/012; dados persistem entre rebuilds; hot-reload
preservado; um comando sobe o stack.

**Alternatives considered**:
- Apenas MySQL em Docker — rejeitado pelo usuário; backend deve rodar containerizado.
- Imagem sem bind mount — rebuild lento; rejeitado para dev local.

## R10 — OpenAPI/Swagger como contrato fidedigno (2026-06-17)

**Decision**: Dupla camada sincronizada:

1. **Contrato canônico** (`specs/002-organizations-crud/contracts/organizations-api.yaml`):
   fonte de verdade para geração do frontend; documenta schemas completos, todos os
   status HTTP possíveis, códigos de erro segmentados e fluxos paralelos por operação.

2. **Swagger runtime** (`@nestjs/swagger` em DTOs e controllers): DEVE refletir o contrato
   via `@ApiProperty`, `@ApiResponse`, `@ApiExtraModels` e exemplos; servido em
   `/api/docs`.

**Regras de fidelidade**:

- Todo endpoint documenta **cada** status HTTP retornável com schema e exemplo distinto.
- `ErrorResponse.code` usa enum fechado (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`,
  `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`).
- Validações de campo retornam `details[]` com `{ field, message }`.
- Contract test valida presença de paths, schemas, status codes e códigos de erro.
- CI pode comparar export OpenAPI (`/api/docs-json`) com contrato YAML (fase futura).

**Rationale**: Frontend será gerado a partir do Swagger; divergências causam bugs de
integração. Documentar fluxos paralelos (sucesso vs validação vs auth vs conflito)
permite ao frontend tratar cada ramo explicitamente.

**Alternatives considered**:
- Apenas decorators NestJS sem YAML — insuficiente para versionamento e review.
- YAML gerado automaticamente sem curadoria — perde fluxos paralelos e exemplos.

## R11 — Configuração por ambiente

**Decision**:

| Ambiente | Mecanismo | Exemplo |
|----------|-----------|---------|
| Local | `.env` + overrides no compose | `DB_HOST=mysql` (app), `DB_HOST=localhost` (host tests) |
| Homologação | AWS PS `/gai/homologacao/*` | Injetado na task definition ECS |
| Produção | AWS PS `/gai/producao/*` | Injetado na task definition ECS |

**Rationale**: Atende NFR-007/011 e constituição VI (config externalizada).

**Alternatives considered**:
- Secrets Manager para tudo — rejeitado; PS escolhido pelo usuário.

## R12 — Testes locais

**Decision**: `npm test` e `npm run test:e2e` executam na máquina host; MySQL via
`docker compose up -d mysql` (porta 3306 publicada). Container `app` não é obrigatório
para testes.

**Rationale**: Atende NFR-012; iteração rápida em testes; CI usa testcontainers ou
service container MySQL conforme workflow.

## Ordem de implementação recomendada

1. Bootstrap NestJS (estrutura modular, CI, TypeORM, logging, migrations base).
2. **002-organizations-crud** (tenant + CRUD + auditoria).
3. **Ambiente local Docker completo** (Phase 8 tasks — app container + entrypoint).
4. **Swagger fidedigno** (Phase 8 tasks — decorators + contract test estendido).
5. **001-user-auth** (login, sessão, recovery, `user.organization_id`).
6. Integração: login rejeita se `organization.status != ACTIVE`.
