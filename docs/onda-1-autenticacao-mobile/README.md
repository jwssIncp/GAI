# Onda 1: autenticação e sessão mobile

**Data:** 09/11/2026 · **Branch:** `feature/gai-ajustes-homologacao` · **Base:** [auditoria](../auditoria-api-mobile/README.md), [Onda 0](../onda-0-seguranca-api-mobile/README.md)

**Classificação: APTO COM RESSALVAS para homologação.** O código está validado em SQLite. Faltam a migration e o teste de concorrência no MySQL (não havia banco local) e a validação na AWS, que depende da aplicação da Onda 0.

Não houve deploy, migration executada, commit nem push. Nenhum segredo foi criado ou alterado. As alterações locais preexistentes foram mantidas.

## Decisões de desenho

- **O access token é opaco, não JWT.** É uma linha de `sessions` com `client_type='mobile'`, validada pelo mesmo `SessionAuthGuard` da web. Com isso:
  - todas as rotas, permissões, o confinamento por projeto (Onda 0) e as revogações existentes valem automaticamente para o app;
  - não é preciso criar uma chave de assinatura, o que alteraria segredos;
  - a revogação é imediata, o que um JWT não oferece.

  Diferente da web, a sessão mobile **não desliza** com o uso.
- **Refresh token opaco:** `gmr_` seguido de 32 bytes aleatórios em base64url. Só o SHA-256 é gravado, na tabela `mobile_refresh_tokens`.
- **Acesso ao app exige inventariante vinculado e ativo** (`resolveFieldAccess`). Contas sem inventariante (por exemplo ORG_ADMIN ou equipe interna) recebem 403 `MOBILE_ACCESS_DENIED` depois da senha correta, e nenhuma sessão é criada.
- **Uma regra só para web e mobile.** `resolveFieldAccess` (field-agents) passou a alimentar tanto o guard quanto o `/mobile/me`. O login mobile reaproveita `CredentialTransactionsService.authenticate`, com as mesmas senha, bloqueio e auditoria, por meio de opções novas e de um gancho executado na mesma transação.

## Endpoints

Todos têm o prefixo `/api/v1`. Os erros seguem o formato padrão `{code, message}`.

| Método e rota | Autenticação | Limite | Respostas |
|---|---|---|---|
| `POST /mobile/auth/login` | pública | 10/min por IP, mais o bloqueio de conta (5 falhas → 30 min) | 200 · 400 · 401 · 403 `MOBILE_ACCESS_DENIED` · 423 · 429 |
| `POST /mobile/auth/refresh` | refresh token | 30/min por IP | 200 · 400 · 401 `INVALID_REFRESH_TOKEN` / `REFRESH_TOKEN_REUSED` / `SESSION_EXPIRED` / `SESSION_REVOKED` · 403 `MOBILE_ACCESS_DENIED` · 409 `REFRESH_TOKEN_ALREADY_ROTATED` · 423 |
| `POST /mobile/auth/logout` | refresh token | 30/min por IP | 204 (idempotente; um token desconhecido também recebe 204) |
| `GET /mobile/me` | Bearer | global | 200 · 401 · 403 `MOBILE_ACCESS_DENIED` |

Os DTOs são estritos: campos desconhecidos geram 400 e o refresh token precisa casar com `^gmr_[A-Za-z0-9_-]{43}$`.

### Exemplos (valores ilustrativos)

```http
POST /api/v1/mobile/auth/login
{ "identifier": "tecnico.campo", "password": "********", "device_label": "Galaxy A14" }

200
{ "token_type": "Bearer",
  "access_token": "3f0d5c1e-8a7b-4c39-9d0e-2b6a1f4e7c55",
  "access_token_expires_at": "2026-11-09T13:15:00.000Z",
  "refresh_token": "gmr_q2c...43 caracteres...",
  "refresh_token_expires_at": "2026-11-23T13:00:00.000Z",
  "session_expires_at": "2026-12-09T13:00:00.000Z",
  "user": { "id": 29, "full_name": "João Pedro", "must_change_password": false } }
```

```http
POST /api/v1/mobile/auth/refresh
{ "refresh_token": "gmr_q2c..." }
→ 200, mesmo formato, com tokens novos e o mesmo session_expires_at
```

```http
GET /api/v1/mobile/me
Authorization: Bearer <access_token>

200
{ "user": { "id": 29, "full_name": "João Pedro", "login": "tecnico.campo",
            "email": "tecnico@empresa.com", "must_change_password": false },
  "organization": { "id": 3, "name": "Investor" },
  "field_agent": { "id": 14, "name": "João Pedro", "status": "active" },
  "projects": [ { "id": 97, "name": "TESTE 3 - 2026", "code": null, "status": "active",
                  "assignment": { "id": 51, "role": null, "start_date": "2026-10-01", "end_date": null } } ],
  "permissions": [ "projects:read", "inventory-items:read", "inventory-items:create", "..." ],
  "session": { "client_type": "mobile", "expires_at": "2026-11-09T13:15:00.000Z" } }
```

Regras do `/mobile/me`:
- `projects` lista apenas os projetos com vínculo ativo e vigente de inventariante ativo, da organização da sessão, em status operacional (`draft`, `active` ou `paused`).
- `permissions` é a interseção das permissões efetivas com uma lista de permissões operacionais. Nunca inclui permissões administrativas.
- A organização vem sempre da sessão. Nenhum id enviado pelo app é usado como prova de autorização.

## Expiração e renovação

| Item | Padrão | Variável | Comportamento |
|---|---|---|---|
| Access token | 15 min | `MOBILE_ACCESS_TTL_MINUTES` | Não desliza; nunca passa do limite absoluto |
| Refresh token | 14 dias sem uso | `MOBILE_REFRESH_IDLE_DAYS` | Uso único, rotacionado a cada refresh |
| Sessão (família) | 30 dias absolutos | `MOBILE_SESSION_MAX_DAYS` | Definida no login; a rotação nunca estende; ao fim, novo login |
| Tolerância a refresh duplicado | 30 s | `MOBILE_REFRESH_REUSE_GRACE_SECONDS` | Ver abaixo |

**Refresh:** tudo acontece numa única transação.
1. A linha do token é travada (`SELECT … FOR UPDATE` no MySQL).
2. Validações, em ordem:
   - o token não está revogado;
   - não está rotacionado;
   - não está expirado;
   - usuário ativo e não bloqueado;
   - `auth_version` igual à do login (troca de senha revoga);
   - mesma organização, e organização ativa;
   - a sessão anterior não foi revogada externamente (logout web, desativação, revogação em massa);
   - inventariante elegível.
3. Um compare-and-set (`UPDATE … WHERE rotated_at IS NULL AND revoked_at IS NULL`) garante que só uma requisição rotaciona o token.
4. O access token anterior é revogado e um novo par é emitido na mesma família.

**Reuso:**
- Um token já rotacionado, reapresentado **dentro** da tolerância, recebe 409 sem punição. Isso cobre requisições concorrentes e reenvio após timeout.
- **Depois** da tolerância, o servidor presume roubo: revoga a família inteira (refresh tokens e access tokens) e responde 401 `REFRESH_TOKEN_REUSED`.

**Invalidação:**
- Bloqueio ou inativação do inventariante: o guard corta o acesso na hora (403), e o refresh revoga a família.
- Usuário desativado, troca de senha, organização inativa ou sessões revogadas: o refresh responde 401 e revoga a família.
- Uma revogação é definitiva: reativar a conta exige novo login.

**Logout:** revoga a família inteira.

**Sessões existentes (migração segura):**
- A migration é aditiva: colunas `sessions.client_type` (padrão `web`) e `refresh_family_id`, mais a tabela nova.
- Nenhuma sessão web é revogada ou reescrita, e a web continua com sessão deslizante de 8 h.
- `POST /auth/login` não mudou.

## Arquivos

**Novos:**
- `src/modules/mobile/` (`mobile.module.ts`, `mobile.controller.ts`, `mobile-session.service.ts`, `mobile-identity.service.ts`, `dto/mobile-auth.dto.ts`)
- `src/modules/auth/infrastructure/persistence/mobile-refresh-token.entity.ts`
- `src/modules/field-agents/application/services/field-access.ts`
- `src/migrations/1794400000001-create-mobile-sessions.ts`
- `test/integration/mobile/mobile-auth.e2e-spec.ts`

**Alterados:**
- `auth/application/services/credential-transactions.service.ts`: opções de sessão e gancho transacional; o comportamento web padrão foi mantido.
- `auth/presentation/guards/session-auth.guard.ts`: sessão mobile não desliza; usa `resolveFieldAccess`; libera `GET /mobile/me` para contas confinadas.
- `auth/infrastructure/persistence/session.entity.ts`, `auth/domain/ports/session.repository.port.ts`, `auth/domain/enums/auth-audit.enums.ts` (eventos `MOBILE_*`).
- `common/config/auth.config.ts`.
- `src/app.module.ts`, `test/integration/test-app.helper.ts`, `.env.example`.

## Testes

| Validação | Resultado |
|---|---|
| `tsc --noEmit`, ESLint/Prettier | OK |
| Unitários (completo) | 66 suítes, 484 OK |
| Integração SQLite + contrato (completo) | 62 suítes, 400 OK, 4 pulados (já pulados antes; dependem de MySQL) |

Os testes novos estão em `test/integration/mobile/mobile-auth.e2e-spec.ts` (10/10 OK) e cobrem:
- login válido e inválido;
- DTO estrito;
- conta sem inventariante, sem criar sessão;
- só o hash do token gravado;
- sessão que não desliza;
- rotação;
- duplicata dentro da tolerância (409);
- reuso depois da tolerância, que revoga a família;
- três renovações concorrentes, das quais exatamente uma vence;
- access expirado;
- limite absoluto que nunca é estendido;
- refresh expirado;
- logout idempotente;
- inventariante bloqueado;
- troca de credencial;
- usuário desativado e depois reativado;
- usuário sem projetos;
- restrição entre organizações (a FK composta recusa vínculo com projeto de outra organização, e o acesso direto dá 403);
- perfil personalizado confinado;
- regressão do login, da sessão deslizante e do logout web.

A Onda 0 e os demais testes de autenticação e convites continuam passando.

**Não executados:**
- Migration `1794400000001` e testes no MySQL descartável, porque MySQL e Docker estavam indisponíveis.
- Concorrência real no MySQL: no SQLite as transações são serializadas, e no MySQL a proteção vem do lock de linha e do compare-and-set.
- AWS.

## Pendências e riscos

1. **MySQL:** rodar `npm run test:integration:mysql` e aplicar a migration em homolog, conferindo `up`/`down`. Validar a concorrência do refresh no MySQL.
2. **Senha temporária:** com `must_change_password`, o app precisa da tela de troca de senha (`POST /auth/password/change` com o access token mobile). A troca revoga a família, e então é preciso novo login.
3. **Access token em claro:** a sessão de acesso continua com o id guardado em claro na tabela `sessions` (S5, também na web). A exposição é limitada a 15 minutos e sem renovação. Gravar o hash exige migrar a coluna `sessions.id` e afeta a web; fica para uma próxima onda.
4. **Duplicata na tolerância:** um refresh duplicado dentro de 30 s recebe 409, e se o cliente perdeu a resposta original precisa fazer novo login. O app deve serializar os refreshes.
5. **Rate limit por IP:** atrás de CGNAT, vários aparelhos dividem os limites. Ajustar com os dados da homologação.
6. **Acesso só de inventariantes:** o app atende apenas contas com inventariante vinculado e ativo. Se coordenadores sem inventariante precisarem do app, isso é uma decisão de negócio a revisar.
7. **Depende da Onda 0:** o rate limit individual exige o `trust proxy`, e a leitura correta de 401/403 pelo app exige a correção do CloudFront. Os dois dependem de aplicar a Onda 0 na AWS.
8. **Retenção:** não há limpeza de `mobile_refresh_tokens` antigos. Definir política de retenção ou job de limpeza.
