# Quickstart: Usuários, Papéis e Permissões Desacopladas (003)

**Feature**: `003-users-roles-permissions` | **Date**: 2026-06-19 | **Revised**: 2026-06-19

**Prerequisites**: Docker + Docker Compose; `.env` a partir de `.env.example`

> **Breaking change**: após merge desta feature, executar migration + seed:
> `docker compose run --rm --no-deps --entrypoint bash app -c "npm run migration:run"`
> e `docker compose exec app npm run seed:bootstrap`
> (ou `docker compose down -v` para reset completo).

## Referências

- Usuários: [contracts/users-api.yaml](./contracts/users-api.yaml)
- RBAC: [contracts/rbac-api.yaml](./contracts/rbac-api.yaml)
- Modelo de dados: [data-model.md](./data-model.md)
- Auth: [../001-user-auth/quickstart.md](../001-user-auth/quickstart.md)
- Organizations: [../002-organizations-crud/quickstart.md](../002-organizations-crud/quickstart.md)

## 1. Reset e subir ambiente

```bash
docker compose down -v
cp .env.example .env
docker compose up --build
```

Na primeira subida: migrations (schema numérico + RBAC) + seed automáticos.

## 2. Credenciais seed (após bootstrap)

| Usuário | Papel atribuído | Org ID | Uso |
|---------|-----------------|--------|-----|
| `platform.admin` | PLATFORM_ADMIN (SYSTEM) | — | Gestão global |
| `org.admin` | ORG_ADMIN (SYSTEM) | 1 | Gestão da org demo |
| `test.user` | Operador (ORGANIZATION) | 1 | Usuário operacional |

```bash
export API="http://localhost:3000/api/v1"

# Login PLATFORM_ADMIN
export TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"platform.admin","password":"Admin@123456"}' \
  | jq -r '.access_token')
```

**Esperado**: `user.id` numérico (ex.: `1`); `user.role_assignments` com `role_key: PLATFORM_ADMIN`.

## 3. Validar IDs numéricos em organizations

```bash
curl -s "$API/organizations" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0].id'
```

**Esperado**: inteiro (ex.: `1`).

## 4. Cenários de usuários (US1 + US2)

### 4.1 PLATFORM_ADMIN cria usuário e atribui papel

```bash
# Listar permissões para montar matriz
curl -s "$API/permissions?scope=ORGANIZATION" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Criar papel customizado na org 1
ROLE=$(curl -s -X POST "$API/organizations/1/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Contador","description":"Acesso financeiro","permission_ids":[3]}')
ROLE_ID=$(echo "$ROLE" | jq -r '.id')

# Criar usuário (apenas perfil — sem papel)
USER=$(curl -s -X POST "$API/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "login": "novo.usuario",
    "email": "novo@empresa.com.br",
    "password": "Senha@123456",
    "organization_id": 1
  }')
USER_ID=$(echo "$USER" | jq -r '.id')

# Atribuir papel customizado
curl -s -X POST "$API/users/$USER_ID/role-assignments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"role_id\": $ROLE_ID}" | jq .
```

**Esperado**: HTTP 201 no cadastro; `role_assignments: []` inicialmente; após atribuição, `role_assignments` com o papel "Contador".

### 4.2 ORG_ADMIN isolamento de tenant

```bash
export ORG_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"org.admin","password":"Admin@123456"}' \
  | jq -r '.access_token')

# Lista apenas usuários da org 1
curl -s "$API/users" -H "Authorization: Bearer $ORG_TOKEN" | jq .

# Tentativa de atribuir PLATFORM_ADMIN (deve falhar 403)
curl -s -o /dev/null -w "%{http_code}" -X POST "$API/users/2/role-assignments" \
  -H "Authorization: Bearer $ORG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role_id": 1}'
```

**Esperado**: listagem só da org 1; atribuição de PLATFORM_ADMIN retorna `403`.

## 5. Cenários RBAC (US4)

### 5.1 ORG_USER com permissão restrita

```bash
export USER_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test.user","password":"Test@123456"}' \
  | jq -r '.access_token')

# ORG_USER não pode listar usuários (sem users:read no papel)
curl -s -o /dev/null -w "%{http_code}" "$API/users" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Esperado**: `403` se papel "Operador" não incluir `users:read`.

### 5.2 Atualizar matriz do papel

```bash
curl -s -X PATCH "$API/organizations/1/roles/1" \
  -H "Authorization: Bearer $ORG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permission_ids":[3,4,5]}' | jq .
```

**Esperado**: HTTP 200; usuários com o papel passam a ter novas permissões na próxima request.

## 6. Proteção do último PLATFORM_ADMIN

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "$API/users/1/deactivate" \
  -H "Authorization: Bearer $TOKEN"
```

**Esperado**: `409 CONFLICT` se for o único PLATFORM_ADMIN ativo.

## 7. Testes automatizados

```bash
docker compose up -d mysql
npm test
npm run test:e2e
```

**Esperado**: suite verde; cobertura ≥ 80%.

## 8. Swagger

- UI: `http://localhost:3000/api/docs`
- Verificar endpoints `/users`, `/users/{id}/role-assignments`, `/permissions`, `/organizations/{id}/roles`
- IDs exibidos como `integer` nos schemas
