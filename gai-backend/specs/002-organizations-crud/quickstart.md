# Quickstart: CRUD de Organizations (002)

**Feature**: `002-organizations-crud` | **Amended**: 2026-06-17

**Prerequisites**: Docker + Docker Compose; `.env` configurado a partir de `.env.example`

## Referências

- Contrato API (canônico para frontend): [contracts/organizations-api.yaml](./contracts/organizations-api.yaml)
- Modelo de dados: [data-model.md](./data-model.md)
- Auth (token): [../001-user-auth/quickstart.md](../001-user-auth/quickstart.md)

## 1. Subir ambiente local (Docker Compose)

### 1.1 Configurar variáveis

```bash
cp .env.example .env
```

O serviço `app` no compose sobrescreve `DB_HOST=mysql`. Para testes no host, use
`DB_HOST=localhost` no `.env`.

### 1.2 Subir stack completo

```bash
docker compose up --build
```

| Cenário | Comportamento |
|---------|---------------|
| **Primeira subida** (volume MySQL vazio) | Migrations + seed automáticos, depois `start:dev` |
| **Subidas posteriores** | Fail-fast se migration pendente; seeds manuais |
| **Rebuild** | Dados preservados no volume `gai_mysql_data` |

Comandos manuais (subidas posteriores):

```bash
docker compose exec app npm run migration:run
docker compose exec app npm run seed:bootstrap
```

Reset completo do banco (explícito):

```bash
docker compose down -v
```

### 1.3 Verificar saúde

- API: `http://localhost:3000/api/v1/health`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/docs-json`

## 2. Obter token de administrador

Autentique como `PLATFORM_ADMIN` (ver quickstart 001) e exporte:

```bash
export TOKEN="<access_token>"
export API="http://localhost:3000/api/v1"
```

## 3. Cenários de validação

> Status HTTP e códigos de erro completos: ver tabelas de fluxos paralelos em
> [contracts/organizations-api.yaml](./contracts/organizations-api.yaml).

### 3.1 Criar organization (US1 — fluxo sucesso)

```bash
curl -s -X POST "$API/organizations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "legal_name": "Empresa Exemplo Ltda",
    "trade_name": "Exemplo",
    "cnpj": "11222333000181",
    "contact_email": "contato@exemplo.com.br"
  }' | jq .
```

**Esperado**: HTTP 201, `status: ACTIVE`, `id` UUID retornado.

### 3.2 Rejeitar CNPJ duplicado (fluxo conflito)

Repetir POST com mesmo CNPJ.

**Esperado**: HTTP 409, `code: CONFLICT`.

### 3.3 Rejeitar CNPJ inválido (fluxo validação)

POST com CNPJ de dígitos verificadores inválidos.

**Esperado**: HTTP 400, `code: VALIDATION_ERROR`, `details[].field: cnpj`.

### 3.4 Listar paginado (US2)

```bash
curl -s "$API/organizations?page=1&page_size=20&status=ACTIVE" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Esperado**: HTTP 200, `items`, `total_items`, `total_pages`.

### 3.5 Buscar por ID

```bash
export ORG_ID="<id da org criada>"
curl -s "$API/organizations/$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Esperado**: HTTP 200 com dados completos.

### 3.6 Atualizar (US3)

```bash
curl -s -X PATCH "$API/organizations/$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"trade_name": "Exemplo Atualizado"}' | jq .
```

**Esperado**: HTTP 200, `trade_name` atualizado.

### 3.7 Desativar e reativar (US4)

```bash
curl -s -X POST "$API/organizations/$ORG_ID/deactivate" \
  -H "Authorization: Bearer $TOKEN" | jq .

curl -s -X POST "$API/organizations/$ORG_ID/activate" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Esperado**: HTTP 200, `status` alterna INACTIVE → ACTIVE.

### 3.8 Desativar organization já inativa (fluxo conflito)

Repetir deactivate em org INACTIVE.

**Esperado**: HTTP 409, `code: CONFLICT`, `message: Organization is already inactive`.

### 3.9 Autorização negada (fluxo forbidden)

Chamar POST `/organizations` com token de `ORG_USER`.

**Esperado**: HTTP 403, `code: FORBIDDEN`.

## 4. Testes automatizados (host)

MySQL deve estar rodando (`docker compose up -d mysql`):

```bash
npm install
npm run test -- --testPathPattern=organizations
npm run test:e2e -- --testPathPattern=organizations
npm run test:cov
```

**Esperado**: cobertura global ≥ 80%.

## 5. Verificar Swagger fidedigno

1. Abrir `/api/docs` e comparar schemas/responses com `contracts/organizations-api.yaml`.
2. Rodar contract test:

```bash
npm run test -- --testPathPattern=organizations-api
```

## 6. Verificar observabilidade

Logs JSON (Pino) com: `operation`, `organizationId`, `environment`, `correlationId`, `result`.

## 7. Critérios de aceite

- [ ] Stack local sobe com `docker compose up` (app + mysql)
- [ ] Primeira subida executa migrations + seed; subidas posteriores preservam dados
- [ ] CRUD completo via API NestJS
- [ ] Swagger documenta todos os status HTTP e códigos de erro por endpoint
- [ ] Paginação e filtros operacionais
- [ ] CNPJ duplicado rejeitado (409 CONFLICT)
- [ ] Auditoria em `organization_audit_logs`
- [ ] Cobertura ≥ 80%
