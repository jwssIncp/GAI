# Research: IDs Numéricos, CRUD de Usuários e Matriz de Permissões (003)

**Feature**: `003-users-roles-permissions` | **Date**: 2026-06-19

## R1 — Estratégia de IDs numéricos vs UUID

**Decision**: `BIGINT UNSIGNED AUTO_INCREMENT` para PKs e FKs de entidades de negócio
(`organizations`, `users`, audit logs, `org_roles`, `permissions`). Manter `sessions.id`
como `CHAR(36)` UUID v4 (token opaco).

**Rationale**: IDs numéricos facilitam suporte, logs e integrações internas. Tokens de
sessão não devem ser sequenciais (previsibilidade/enumeração). Projeto em dev inicial
permite migration destrutiva.

**Alternatives considered**:
- UUID em tudo — status quo; rejeitado pelo requisito de gestão.
- UUID + `serial` exposto — complexidade dupla sem benefício.
- IDs numéricos em sessions — risco de segurança em tokens guessáveis.

## R2 — Migration destrutiva (sem produção)

**Decision**: Nova migration `1739600000001-migrate-to-numeric-ids.ts` que dropa tabelas
na ordem de FKs e recria com schema numérico. Seeds/bootstrap atualizados. Dev reset via
`docker compose down -v`.

**Rationale**: Sem dados de produção; mais simples e confiável que ALTER COLUMN com
conversão UUID→int.

**Alternatives considered**:
- Migration incremental com coluna paralela — over-engineering para estágio atual.
- Manter UUID em API e int internamente — viola requisito explícito.

## R3 — Modelo RBAC híbrido (roles fixas + matriz)

**Decision**: Três roles de sistema fixas (`PLATFORM_ADMIN`, `ORG_ADMIN`, `ORG_USER`) +
catálogo `permissions` + papéis customizados `org_roles` por organization com
`org_role_permissions`. Apenas `ORG_USER` usa `org_role_id`.

**Rationale**: Atende cenários descritos: admins com escopo claro; usuários operacionais
com granularidade extensível sem alterar código para cada novo perfil.

**Alternatives considered**:
- Apenas enum de roles — insuficiente para "cenários que nem consigo descrever".
- RBAC puro sem roles fixas — perde semântica clara de PLATFORM vs ORG admin.
- ABAC completo — complexidade prematura.

## R4 — Bypass de permissões para admins

**Decision**: `PermissionsGuard` verifica: (1) `PLATFORM_ADMIN` → allow all;
(2) `ORG_ADMIN` + permissão scope `ORGANIZATION` + mesmo `organization_id` → allow;
(3) `ORG_USER` → resolve permissões via `org_role_permissions`.

**Rationale**: `ORG_ADMIN` deve "ver informações da própria organization" sem gerenciar
matriz manualmente. Evita papel ORG_ADMIN gigante na tabela de permissões.

**Alternatives considered**:
- ORG_ADMIN com todas permissões seedadas — duplicação e drift.
- ORG_ADMIN como flag sem guard dedicado — inconsistente com matriz.

## R5 — Escopo de CRUD de usuários

**Decision**:

| Operação | PLATFORM_ADMIN | ORG_ADMIN | ORG_USER |
|----------|----------------|-----------|----------|
| Criar user (qualquer org) | ✅ | ❌ | ❌ |
| Criar user (própria org) | ✅ | ✅ | ❌ |
| Criar PLATFORM_ADMIN | ✅ | ❌ | ❌ |
| Listar users (global) | ✅ | ❌ | ❌ |
| Listar users (própria org) | ✅ | ✅ | ❌ |
| Atualizar/desativar no escopo | ✅ | ✅ | ❌ |

**Rationale**: Alinhado à spec; tenant isolation no application layer + query filters.

**Alternatives considered**:
- ORG_USER pode listar colegas — fora de escopo inicial.

## R6 — Catálogo de permissões (formato)

**Decision**: Chave `resource:action` (ex.: `users:read`, `users:write`, `organizations:read`).
Colunas `resource`, `action`, `scope` (`PLATFORM` | `ORGANIZATION`). Seed idempotente.

**Rationale**: Padrão industry (CASL, AWS IAM style); extensível para módulos futuros.

**Alternatives considered**:
- Bitmask inteiro — opaco e difícil de auditar.
- Permissões apenas em código — inflexível para matriz configurável.

## R7 — Papéis customizados (org_roles)

**Decision**: Tabela `org_roles` com `organization_id`, `name` (unique por org),
`description`, `is_active`. Junction `org_role_permissions`. Soft-disable; não deletar
se houver usuários ativos (409 CONFLICT).

**Rationale**: Preserva histórico; evita usuários órfãos.

**Alternatives considered**:
- Hard delete — risco de integridade.
- Papéis globais compartilhados — não atende customização por tenant.

## R8 — Autorização NestJS

**Decision**: Estender guards existentes:

- `SessionAuthGuard` — carrega user + role + org_role permissions no request.
- `RolesGuard` — roles de sistema (`@Roles()`).
- `PermissionsGuard` (novo) — `@RequirePermissions('users:read')`.
- `OrganizationScopeGuard` (novo) — valida `:organizationId` vs user org para ORG-scoped.

**Rationale**: Composição de guards NestJS; DIP via decorators; testável.

**Alternatives considered**:
- CASL library — adiciona dependência; avaliar em feature futura se ABAC crescer.
- Lógica só em use cases — duplicação em cada endpoint.

## R9 — Auditoria

**Decision**: Tabelas `user_audit_logs` e `org_role_audit_logs` com JSON `changes`,
mesmo padrão de `organization_audit_logs`.

**Rationale**: Consistência com 002; princípio V da constituição.

## R10 — Impacto em contratos existentes

**Decision**: Atualizar `auth-api.yaml` e `organizations-api.yaml` (IDs `type: integer`,
`format: int64`). Novos contratos `users-api.yaml` e `rbac-api.yaml`.

**Rationale**: Contratos canônicos para frontend; breaking change documentada.

## R11 — TypeORM mapping

**Decision**: `@PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })` com
transformação para `number` no domínio (JavaScript safe até 2^53; BIGINT MySQL até 2^64 —
documentar limite ou usar string para IDs em respostas se necessário no futuro).

**Rationale**: Padrão TypeORM + NestJS; volume GAI não exige BigInt JS no curto prazo.

**Alternatives considered**:
- `int` (32-bit) — limite 2B pode ser insuficiente em décadas.
- String IDs na API — rejeitado pelo requisito numérico.

## R12 — Seeds e bootstrap

**Decision**: Atualizar `seed/bootstrap.ts`: PLATFORM_ADMIN (id 1), organization demo (id 1),
ORG_ADMIN e ORG_USER demo com org_role "Operador" pré-seedado com permissões básicas.

**Rationale**: Quickstart reproduzível após migration destrutiva.
