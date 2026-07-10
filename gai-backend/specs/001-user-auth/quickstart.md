# Quickstart: Autenticação Segura (001)

**Feature**: `001-user-auth` | **Prerequisites**: `002-organizations-crud` + seed

## Referências

- Contrato API: [contracts/auth-api.yaml](./contracts/auth-api.yaml)
- Modelo de dados: [data-model.md](./data-model.md)
- Organizations: [../002-organizations-crud/quickstart.md](../002-organizations-crud/quickstart.md)

## 1. Subir ambiente local

```bash
docker compose up -d mysql
npm install
npm run migration:run
npm run seed:bootstrap
npm run start:dev
```

Variáveis (`.env`):

```text
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=gai
DATABASE_PASSWORD=gai
DATABASE_NAME=gai
SES_MOCK=true
PASSWORD_RESET_BASE_URL=http://localhost:3000/reset
NODE_ENV=local
```

## 2. Cenários de validação

```bash
export API="http://localhost:3000/api/v1"
```

### 2.1 Login com credenciais válidas (US1)

```bash
curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@gai.local", "password": "Admin1234"}' | jq .
```

**Esperado**: HTTP 200, `access_token`, `expires_at`, objeto `user`.

```bash
export TOKEN="<access_token>"
curl -s "$API/auth/me" -H "Authorization: Bearer $TOKEN" | jq .
```

**Esperado**: HTTP 200, dados do usuário autenticado.

### 2.2 Logout (US1)

```bash
curl -s -X POST "$API/auth/logout" -H "Authorization: Bearer $TOKEN" -w "%{http_code}"
```

**Esperado**: HTTP 204; `/auth/me` subsequente retorna 401.

### 2.3 Credenciais inválidas — mensagem genérica (US3)

```bash
curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "inexistente", "password": "wrongpass1"}' | jq .
```

**Esperado**: HTTP 401, mensagem genérica.

### 2.4 Lockout após tentativas falhas (US3)

6 logins falhos consecutivos com usuário válido.

**Esperado**: HTTP 423 na 6ª tentativa.

### 2.5 Solicitar recuperação de senha (US2)

```bash
curl -s -X POST "$API/auth/password-reset/request" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@gai.local"}' | jq .
```

**Esperado**: HTTP 200 sempre (mensagem genérica).

### 2.6 Confirmar nova senha (US2)

```bash
export RESET_TOKEN="<token do mock SES>"
curl -s -X POST "$API/auth/password-reset/confirm" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$RESET_TOKEN\", \"new_password\": \"NewPass123\"}" | jq .
```

**Esperado**: HTTP 200; login com nova senha funciona.

### 2.7 Organization inativa bloqueia login

Desativar organization do usuário (quickstart 002), tentar login.

**Esperado**: HTTP 401 com mensagem genérica.

## 3. Testes automatizados

```bash
npm run test -- --testPathPattern=auth
npm run test:e2e -- --testPathPattern=auth
npm run test:cov
```

## 4. Verificar segurança

- [ ] Senhas nunca em logs ou respostas de erro
- [ ] `password_hash` Argon2id no MySQL
- [ ] Eventos em `auth_audit_logs`
- [ ] Logs Pino JSON no Kibana

## 5. Critérios de aceite

- [ ] Login, logout e `/auth/me` funcionais
- [ ] Recuperação de senha end-to-end
- [ ] Lockout e mensagens genéricas validados
- [ ] Integração com organization ACTIVE
- [ ] Cobertura ≥ 80%
