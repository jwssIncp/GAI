# GAI — Documentação da API para o aplicativo Investor

**Migração das rotas do Laravel legado para o GAI · Contrato `1.0.0-rc.2` · Revisão 2, 10/11/2026 (URL oficial na AWS)**

Este documento descreve, para a equipe do aplicativo Investor (Android/Flutter), todas as rotas que o app 1.4.6+1.12 usa no Laravel e a rota correspondente no GAI, com payloads, respostas, erros, permissões e o que muda no app. Ele pode ser lido sem acesso ao código do backend.

> **Estado: release candidate.** Todas as rotas descritas aqui estão implementadas e cobertas por testes automatizados no backend (SQLite, MySQL 8 e storage S3 compatível, em ambiente local). A aplicação está publicada na AWS via CloudFront, e a URL base oficial é `https://d1kanjou9wgm7q.cloudfront.net/api/v1`. **As rotas `/mobile/*` ainda não estão disponíveis nesse endereço** (ver [Ambientes](#ambientes)), e a homologação do app contra a AWS continua pendente.

Documentos complementares, na mesma pasta:

- [MATRIZ-MIGRACAO.md](MATRIZ-MIGRACAO.md): rota antiga → rota nova, rota por rota.
- [GUIA-MIGRACAO-ANDROID.md](GUIA-MIGRACAO-ANDROID.md): o que implementar no app (Dio, fila, sincronização, fotos), com código.
- [openapi.yaml](openapi.yaml): especificação OpenAPI 3.1 (importável em Postman, Insomnia ou geradores de cliente).

## Sumário

1. [Convenções gerais](#1-convenções-gerais)
2. [Autenticação e sessão](#2-autenticação-e-sessão)
3. [Projetos do inventariante](#3-projetos-do-inventariante)
4. [Itens](#4-itens)
5. [Fotos dos itens](#5-fotos-dos-itens)
6. [Placas: duplicidade e pendências](#6-placas-duplicidade-e-pendências)
7. [Despesas](#7-despesas)
8. [Reconciliação (importação)](#8-reconciliação-importação)
9. [Sincronização, conflitos e fila offline](#9-sincronização-conflitos-e-fila-offline)
10. [Exemplos completos de fluxo](#10-exemplos-completos-de-fluxo)
11. [Rotas descontinuadas e recursos pendentes](#11-rotas-descontinuadas-e-recursos-pendentes)
12. [Referência de códigos de erro](#12-referência-de-códigos-de-erro)

## 1. Convenções gerais

| Tema | Regra no GAI |
|---|---|
| Base | `https://d1kanjou9wgm7q.cloudfront.net/api/v1` (ver [Ambientes](#ambientes)). Todas as rotas do app ficam em `/mobile/...`, exceto `POST /auth/password/change`. Nos caminhos abaixo, a base é omitida. |
| Formato | JSON UTF-8 em todas as rotas (não há mais `multipart/form-data` nem `form-urlencoded`). Envie `Content-Type: application/json` e `Accept: application/json`. |
| Nomes de campos | `snake_case` em inglês (`new_plate`, `unit_text`). A tabela de equivalência com o legado está na [seção 4.1](#41-campos-do-item-legado--gai). |
| Campos desconhecidos | Qualquer campo não documentado, no corpo ou na query, gera **400 `VALIDATION_ERROR`**. Não envie campos legados “a mais”. |
| Autenticação | `Authorization: Bearer <access_token>` em todas as rotas, exceto login, refresh e logout. O token é **opaco** (não é JWT). |
| Datas e horas | ISO 8601 em UTC (`2026-11-10T13:00:00.000Z`). Datas civis em `YYYY-MM-DD`. |
| Dinheiro | Texto com ponto e até 2 casas: `"120.50"`, `"150"`, `"0.5"`. `"12,50"`, `"R$ 10"` ou número JSON geram 400. |
| ID do item | O id gerado no aparelho (`microsecondsSinceEpoch`) é **texto** e vai na URL: `"1730736000123456"`. Aceita até 100 caracteres `[A-Za-z0-9._:-]`, começando por letra ou número. Nunca converta para número. |
| Paginação por página | `page` (≥ 1) e `page_size` (1 a 100). A resposta traz `items`, `page`, `page_size`, `total_items`, `total_pages`. |
| Paginação por cursor | Somente em `GET .../items/sync` (ver [4.4](#44-sincronização-incremental-por-cursor)). |
| Erros | `{ "code": "...", "message": "...", "details": ... }`. `message` é texto, ou **lista de textos** em erros de validação de campos. Decida pelo **status HTTP + `code`**, nunca pela mensagem. |
| Sucesso | 200, 201 ou 204, conforme a rota. **Não** trate “só 200” como sucesso: 201 é a resposta normal de criação. |
| Limite de requisições | Global: 100 requisições por minuto por IP (configurável no servidor). Login: 10/min; refresh e logout: 30/min; troca de senha: 5/min. Excesso: **429 `TOO_MANY_REQUESTS`**. |

Exemplo de erro de validação:

```json
{
  "code": "VALIDATION_ERROR",
  "message": ["property gai_user should not exist", "year must not be greater than 2100"]
}
```

Exemplo de erro de regra de negócio:

```json
{
  "code": "VERSION_CONFLICT",
  "message": "O item mudou no servidor. Baixe a versão atual e reaplique a alteração.",
  "details": { "item": { "external_item_id": "1730736000123456", "version": 1902, "...": "..." } }
}
```

### Ambientes

| Ambiente | URL base da API | Observação |
|---|---|---|
| **Produção (AWS/CloudFront)** | `https://d1kanjou9wgm7q.cloudfront.net/api/v1` | Endereço oficial por enquanto. Frontend em `https://d1kanjou9wgm7q.cloudfront.net` (login em `/login`). |
| Desenvolvimento (local) | `http://localhost:3000/api/v1` | Somente para quem roda o backend na própria máquina. Não usar em builds distribuídos. |

### Observações sobre o ambiente

- Toda a API é servida pelo mesmo endereço do frontend, no prefixo `/api/v1`.
- Health check: `GET https://d1kanjou9wgm7q.cloudfront.net/api/v1/health` → `200 {"status":"ok"}`.
- Rotas autenticadas sem token retornam **401 em JSON** (ex.: `GET /auth/me` → `{"code":"UNAUTHORIZED","message":"Authentication required"}`).
- **Atenção:** uma requisição para uma rota inexistente ou com método errado pode retornar **200 com HTML** (a página do app) em vez de 404, por causa do fallback do CloudFront para a SPA. Se a resposta vier como `text/html`, revise a rota e o método. O app deve tratar qualquer resposta `text/html` da API como erro, nunca como sucesso.
- Ainda não há domínio próprio. Se um domínio for configurado depois, basta trocar a URL base.

> **Rotas `/mobile/*` ainda não publicadas (verificado em 10/11/2026).** No endereço acima, `/health`, `POST /auth/login` e `GET /auth/me` respondem em JSON, mas `GET /mobile/me`, `POST /mobile/auth/login` e `POST /mobile/auth/refresh` devolvem **200 `text/html`** (a página da SPA). O motivo é que o módulo mobile (`gai-backend/src/modules/mobile`) existe no código local, mas ainda não foi commitado nem implantado. Os caminhos documentados continuam corretos. Eles passam a funcionar nessa URL depois do próximo deploy que incluir o módulo. Até lá, o app não consegue usar o ambiente da AWS.

### 1.1 Regras de acesso comuns

Toda rota com Bearer passa pelas mesmas verificações, nesta ordem:

1. Sessão válida e não expirada (senão **401 `UNAUTHORIZED`**).
2. Usuário ativo e organização ativa (senão **401**).
3. Senha temporária: enquanto `must_change_password` for `true`, só a troca de senha funciona; as rotas `/mobile/...` respondem **403 `PASSWORD_CHANGE_REQUIRED`**. Senha temporária vencida: **401**.
4. Conta de campo: a conta precisa estar vinculada a um **inventariante ativo**. Sem isso: **403 `MOBILE_ACCESS_DENIED`**.
5. Projeto: nas rotas `/mobile/projects/{projectId}/...`, o inventariante precisa ter **vínculo ativo e vigente** com o projeto. Sem vínculo: **403 `FORBIDDEN`** (ou `PROJECT_NOT_AUTHORIZED`). Projeto inexistente ou de outra organização tem a mesma resposta.
6. Permissão: cada rota exige as permissões listadas (todas). Sem alguma: **403 `FORBIDDEN`** (“Insufficient permissions”).
7. Status do projeto: operações de escrita só em projetos `draft`, `active` ou `paused`. Fora disso: **409 `PROJECT_STATUS_BLOCKS_OPERATION`**.

A organização e o inventariante vêm **sempre da sessão**. Nada que o app envie (ids de usuário, nome, organização) é usado como prova de identidade.

### 1.2 Permissões

| Permissão | Usada em | Perfil padrão do inventariante |
|---|---|---|
| `inventory-items:read` | listar, sincronizar e consultar itens; placas | Sim |
| `inventory-items:create` + `inventory-items:update` | `PUT` de item (as duas são exigidas) | Sim |
| `inventory-items:deactivate` | `DELETE` de item | Sim |
| `inventory-item-images:read` + `:download` | listar fotos com URL | Sim |
| `inventory-item-images:create` | pedir URL de upload | Sim |
| `inventory-item-images:update` | confirmar upload | Sim |
| `inventory-item-images:remove` | remover foto | Sim |
| `import-sessions:create`, `:read`, `:finish` | reconciliação | Sim |
| `import-files:create`, `import-payloads:create`, `import-errors:read` | reconciliação | Sim |
| `expenses:create` | registrar despesa | **Não** — concedida por perfil, explicitamente |
| `expenses:upload-attachment` | comprovante | **Não** — concedida explicitamente |
| `expenses:read` | listar as próprias despesas | **Não** — e não aparece em `/mobile/me` (ver [7.2](#72-listar-as-próprias-despesas)) |

`GET /mobile/me` devolve em `permissions[]` as permissões relevantes ao app que a conta possui. Use a lista para mostrar ou ocultar funções (por exemplo, o menu de despesas só com `expenses:create`).

## 2. Autenticação e sessão

### 2.1 Modelo de sessão

| Elemento | Valor |
|---|---|
| Access token | Opaco (UUID). Vale **15 minutos** e **não** é renovado pelo uso. Não tente decodificar; use `access_token_expires_at`. |
| Refresh token | Opaco, formato `gmr_` + 43 caracteres. **Uso único e rotativo**: cada refresh devolve um par novo. Vale 14 dias desde a última rotação. |
| Limite absoluto | `session_expires_at`: **30 dias** desde o login. Depois disso, só com novo login (o refresh responde 401 `SESSION_EXPIRED`). |
| Janela de duplicidade | Se o mesmo refresh token for usado de novo em até 30 s, a resposta é **409 `REFRESH_TOKEN_ALREADY_ROTATED`** (requisição duplicada, não ataque). |
| Detecção de roubo | Reuso do refresh token depois de 30 s revoga a sessão inteira: **401 `REFRESH_TOKEN_REUSED`**. |
| Bloqueio de conta | 5 senhas erradas seguidas bloqueiam a conta por 30 minutos: **423 `ACCOUNT_LOCKED`**. |
| Inventariante bloqueado | Login, refresh e demais rotas respondem **403 `MOBILE_ACCESS_DENIED`**. |

### 2.2 Login

| | |
|---|---|
| Funcionalidade | Tela de login do app. Abre a sessão do aparelho. |
| Legado | `POST /auth/login` `{email, password}` → JWT de 1 h + `user.projects` |
| GAI | `POST /mobile/auth/login` |
| Headers | `Content-Type: application/json`. **Sem** `Authorization`. |
| Parâmetros | Nenhum. |
| Permissões | Nenhuma permissão específica; a conta precisa estar ativa e vinculada a um inventariante ativo. |

Requisição:

```json
{
  "identifier": "tecnico@empresa.com",
  "password": "<senha>",
  "device_label": "Galaxy A14 - João"
}
```

| Campo | Obrigatório | Validação |
|---|---|---|
| `identifier` | Sim | E-mail **ou** login. Texto não vazio, até 255 caracteres. |
| `password` | Sim | 8 a 256 caracteres. |
| `device_label` | Não | Até 100 caracteres. Informativo (aparece na auditoria); não é prova de identidade. |

Resposta **200**:

```json
{
  "token_type": "Bearer",
  "access_token": "00000000-0000-4000-8000-000000000000",
  "access_token_expires_at": "2026-11-10T13:15:00.000Z",
  "refresh_token": "gmr_EXEMPLOexemploEXEMPLOexemploEXEMPLOexempl",
  "refresh_token_expires_at": "2026-11-24T13:00:00.000Z",
  "session_expires_at": "2026-12-10T13:00:00.000Z",
  "user": { "id": 29, "full_name": "João Pedro", "must_change_password": false }
}
```

| Status | `code` | Significado e ação no app |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Campos ausentes, senha com menos de 8 caracteres, campo extra (por exemplo `email`). Corrija o envio. |
| 401 | `UNAUTHORIZED` | Credenciais inválidas ou conta indisponível. Mensagem genérica, sem revelar o motivo. |
| 403 | `MOBILE_ACCESS_DENIED` | A conta não tem inventariante ativo (conta só web, inventariante bloqueado ou excluído). Mostre “acesso ao aplicativo não liberado”. |
| 423 | `ACCOUNT_LOCKED` | Bloqueio temporário por tentativas erradas. Mostre a mensagem e não repita. |
| 429 | `TOO_MANY_REQUESTS` | Mais de 10 tentativas por minuto do mesmo IP. Aguarde. |

Diferenças em relação ao legado:

- O campo `email` virou `identifier` e aceita e-mail ou login.
- O token não é JWT. O app não pode mais conferir `exp` decodificando o token: deve usar `access_token_expires_at`.
- O access token dura 15 minutos (antes 1 hora) e existe um refresh token separado.
- A resposta não traz `user.projects`, `user.email` nem `user.role`. Os projetos vêm de `GET /mobile/me`.
- `user.name` (usado como `gai_user`) deixou de ser necessário: o servidor identifica o técnico pela sessão.

O que muda no app:

- Trocar o corpo para `{identifier, password, device_label}`.
- Guardar `access_token`, `refresh_token`, `access_token_expires_at` e `session_expires_at` em armazenamento seguro (ver [2.8](#28-armazenamento-seguro-e-tratamento-de-401403)).
- Se `user.must_change_password` for `true`, abrir a tela de troca de senha **antes** de qualquer outra chamada ([2.6](#26-troca-de-senha-obrigatória)).
- Depois do login, chamar `GET /mobile/me` para obter projetos e permissões.
- Tratar 401, 403, 423 e 429 com mensagens distintas (o legado mostrava sempre “Não foi possível fazer o login”).

### 2.3 Refresh (renovação da sessão)

| | |
|---|---|
| Funcionalidade | Renovar o access token sem pedir senha. |
| Legado | `POST /auth/refresh`, sem corpo, com `Authorization: Bearer <JWT vencido>` |
| GAI | `POST /mobile/auth/refresh` |
| Headers | `Content-Type: application/json`. **Sem** `Authorization`. |
| Permissões | Nenhuma; a conta e o inventariante precisam continuar ativos. |

Requisição:

```json
{ "refresh_token": "gmr_EXEMPLOexemploEXEMPLOexemploEXEMPLOexempl" }
```

`refresh_token` é obrigatório, com exatamente 47 caracteres no formato `gmr_[A-Za-z0-9_-]{43}`.

Resposta **200**: mesmo formato do login, com **um par novo** (access e refresh). O access token anterior é revogado na hora.

| Status | `code` | Ação no app |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Token mal formado. Apague os tokens e peça login. |
| 401 | `INVALID_REFRESH_TOKEN`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `REFRESH_TOKEN_REUSED` | Sessão encerrada. Apague os tokens e peça login. **Não apague a fila offline.** |
| 403 | `MOBILE_ACCESS_DENIED` | Inventariante bloqueado. Mostre “acesso suspenso”. Não apague a fila. |
| 409 | `REFRESH_TOKEN_ALREADY_ROTATED` | Outra requisição do próprio app já renovou com esse token. Use o par que ela recebeu; se não houver, peça login. |
| 423 | `ACCOUNT_LOCKED` | Conta bloqueada temporariamente. |
| 429 | `TOO_MANY_REQUESTS` | Aguarde e repita. |

Diferenças em relação ao legado:

- O token vencido não serve mais para renovar. Só o refresh token renova.
- Cada refresh token funciona **uma vez**. Duas renovações paralelas com o mesmo token geram 409 na segunda.
- Se o refresh falhar, o app não deve seguir com o token antigo: ele já não vale.

O que muda no app:

- Renovar um pouco antes de `access_token_expires_at` (por exemplo, 60 s antes) ou ao receber 401 em qualquer rota.
- Garantir **um refresh por vez** (mutex) e substituir os **dois** tokens a cada sucesso, gravando-os antes de liberar as requisições que esperavam.

### 2.4 Logout

| | |
|---|---|
| Funcionalidade | Encerrar a sessão do aparelho (menu “Sair”). |
| Legado | Não existia (o app só apagava o JWT local). |
| GAI | `POST /mobile/auth/logout` |
| Headers | `Content-Type: application/json`. Sem `Authorization`. |

Requisição: `{ "refresh_token": "gmr_..." }`. Resposta: **204** sem corpo, sempre (inclusive para token desconhecido ou já revogado). Erros possíveis: 400 (formato inválido) e 429.

O que muda no app: chamar o logout antes de apagar os tokens locais; se não houver rede, apagar os tokens mesmo assim (a sessão expira sozinha). Antes de sair, avisar se houver itens pendentes na fila.

### 2.5 Identidade do inventariante

| | |
|---|---|
| Funcionalidade | Saber quem está logado, de qual organização, qual inventariante, quais projetos pode abrir e quais funções mostrar. |
| Legado | Dados em `user` do login (`id`, `name`, `email`, `role`, `projects`). |
| GAI | `GET /mobile/me` |
| Headers | `Authorization: Bearer <access_token>`, `Accept: application/json`. |
| Permissões | Nenhuma específica; exige inventariante ativo. |

Resposta **200**:

```json
{
  "user": { "id": 29, "full_name": "João Pedro", "login": "tecnico.campo", "email": "tecnico@empresa.com", "must_change_password": false },
  "organization": { "id": 3, "name": "Empresa Exemplo" },
  "field_agent": { "id": 12, "name": "João Pedro", "status": "active" },
  "projects": [
    {
      "id": 97,
      "name": "TESTE 3 - 2026",
      "code": "P-097",
      "status": "active",
      "assignment": { "id": 40, "role": "Técnico", "start_date": "2026-10-01", "end_date": null }
    }
  ],
  "permissions": [
    "projects:read", "inventory-items:read", "inventory-items:create", "inventory-items:update",
    "inventory-items:deactivate", "inventory-item-images:read", "inventory-item-images:create",
    "inventory-item-images:update", "inventory-item-images:download", "inventory-item-images:remove",
    "import-sessions:create", "import-sessions:read", "import-sessions:finish",
    "import-files:create", "import-payloads:create", "import-errors:read"
  ],
  "session": { "client_type": "mobile", "expires_at": "2026-11-10T13:15:00.000Z" }
}
```

| Status | `code` | Ação |
|---|---|---|
| 401 | `UNAUTHORIZED` | Renove a sessão; se o refresh falhar, peça login. |
| 403 | `MOBILE_ACCESS_DENIED` | Inventariante bloqueado ou desvinculado. Mostre “acesso suspenso”. |
| 403 | `PASSWORD_CHANGE_REQUIRED` | Abra a troca de senha. |

Regras:

- `projects[]` traz só projetos com vínculo **ativo e vigente** (dentro de `start_date`/`end_date`) e status `draft`, `active` ou `paused`, ordenados por nome.
- `session.expires_at` é a expiração do access token atual (não da sessão absoluta).
- A lista `permissions[]` cobre as permissões relevantes ao app; `expenses:read` não é listada.

Diferenças e mudanças no app:

- O filtro de projetos agora é feito no servidor. O app não deve filtrar por conta própria nem guardar ids de projeto do login.
- Chame `/mobile/me` após o login, ao abrir o app e periodicamente (por exemplo, a cada sincronização) para refletir vínculos novos ou encerrados.
- O nome a exibir é `field_agent.name` (ou `user.full_name`).

### 2.6 Troca de senha obrigatória

| | |
|---|---|
| Funcionalidade | Trocar a senha temporária criada pelo administrador. |
| Legado | Não existia no app. |
| GAI | `POST /auth/password/change` (rota compartilhada com a web) |
| Headers | `Authorization: Bearer <access_token>`, `Content-Type: application/json`. |
| Permissões | Nenhuma; é a única rota liberada enquanto `must_change_password` for `true`. Limite 5/min. |

Requisição:

```json
{ "current_password": "<senha temporária>", "new_password": "<nova senha>" }
```

| Campo | Obrigatório | Validação |
|---|---|---|
| `current_password` | Sim | 1 a 256 caracteres. |
| `new_password` | Sim | 8 a 128 caracteres, não pode ser só espaços, diferente da atual. Frases e espaços são aceitos. |

Resposta **200**:

```json
{ "message": "Senha alterada. Entre novamente para continuar." }
```

| Status | `code` | Ação |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Senha nova fora da regra ou igual à atual. |
| 401 | `UNAUTHORIZED` | Senha atual errada, sessão inválida ou **senha temporária vencida** (peça uma nova ao administrador). |
| 429 | `TOO_MANY_REQUESTS` | Aguarde. |

O que muda no app: criar a tela de troca. Depois do 200, **todas as sessões do usuário são revogadas**: apague os tokens e faça login de novo com a senha nova.

### 2.7 Ciclo de vida recomendado

```text
Abrir app
  ├─ sem tokens ─────────────► Login
  ├─ session_expires_at passou ► Login
  └─ tokens válidos ─────────► GET /mobile/me
        ├─ 200 ───────────────► Projetos / fila / sincronização
        ├─ 401 ───────────────► Refresh (mutex) ─► repete; se falhar ► Login
        ├─ 403 PASSWORD_CHANGE_REQUIRED ► Troca de senha ► Login
        └─ 403 MOBILE_ACCESS_DENIED ────► Tela "acesso suspenso"
```

### 2.8 Armazenamento seguro e tratamento de 401/403

- Guarde os tokens com `flutter_secure_storage` (Android Keystore / EncryptedSharedPreferences). **Nunca** em `SharedPreferences` comum, banco local sem criptografia ou logs.
- Não registre tokens, senhas ou URLs pré-assinadas nos logs de diagnóstico.
- **401** em qualquer rota: renove uma vez e repita a requisição original uma vez. Se o refresh devolver 401, apague os tokens e vá para o login, mantendo a fila offline.
- **403** não se resolve com refresh. Diferencie pelo `code`: `PASSWORD_CHANGE_REQUIRED` (troca), `MOBILE_ACCESS_DENIED` (acesso suspenso), `FORBIDDEN` em rota de projeto (vínculo encerrado: atualize `/mobile/me` e retire o projeto da tela; itens daquele projeto na fila ficam bloqueados até novo vínculo).

## 3. Projetos do inventariante

| | |
|---|---|
| Funcionalidade | Lista de projetos que o técnico pode abrir. |
| Legado | `GET /gai/projects` (sem token, todos os projetos; o app filtrava por `user.projects`) |
| GAI | `GET /mobile/me` → `projects[]` ([2.5](#25-identidade-do-inventariante)) |

Diferenças:

- Não há rota pública de projetos. A lista vem filtrada pelo servidor, só com projetos vinculados ao inventariante.
- `nome` → `name`; `descricao` não existe; há `code`, `status` e `assignment`.
- **`extra_fields` por projeto não existe no GAI.** O legado devolvia os nomes dos campos extras (`"[\"Patrimônio\",\"Setor\"]"`). No GAI, cada item guarda seu próprio objeto `extra_fields`, mas não há cadastro de nomes por projeto (ver [11.2](#112-recursos-ainda-não-implementados)).

O que muda no app: remover a chamada a `/gai/projects` e o filtro local; usar `projects[]`. Para montar os campos extras do formulário, use os nomes já presentes nos itens sincronizados do projeto, mais os que o técnico digitar.

## 4. Itens

### 4.1 Campos do item (legado → GAI)

| Legado (`sync_items`) | GAI | Tipo e validação |
|---|---|---|
| `id` | `externalId` na URL; `external_item_id` na resposta | Texto, até 100 caracteres `[A-Za-z0-9._:-]` |
| `gai_user` | — (vem da sessão) | **Não enviar** (400) |
| `project_id` | `projectId` na URL | Inteiro |
| — | `sequence` | Texto até 50 (opcional) |
| `placa_antiga` | `old_plate` | Texto até 100; normalizado |
| `placa_antiga_2` | `old_plate_2` | Texto até 100; normalizado |
| `placa_nova` | `new_plate` | Texto até 100; normalizado |
| `unidade` | `unit_text` | Texto até 255 |
| `endereco` | `address_text` | Texto até 2000 |
| `localizacao` | `location_text` | Texto até 2000 |
| `descricao` | `description` | Texto até 4000 |
| `marca` | `brand` | Texto até 100 |
| `modelo` | `model` | Texto até 100 |
| `num_serie` | `serial_number` | Texto até 100 |
| `capacidade` | `capacity` | Texto até 100 |
| `ano` (texto) | `year` | **Inteiro** 1900–2100 ou `null` |
| `obs` | `notes` | Texto até 4000 |
| `valor_usado` / `valor_novo` | `used_value` / `new_value` | Texto `"150.00"` ou `null` |
| `fonte` | `source` (só leitura) | Definido pelo servidor: `mobile_app` |
| `extra_fields` (não enviado pelo app 1.4.6) | `extra_fields` | Objeto texto → texto, até 100 campos (nome ≤ 100, valor ≤ 1000) |
| `image_1 … image_n` | Fotos em 3 passos ([seção 5](#5-fotos-dos-itens)) | — |
| — | `base_version` (envio) / `version` (resposta) | Controle de conflito |
| — | `deleted`, `deleted_at`, `status` | Exclusão lógica e situação |

Regras de valores:

| Valor enviado | Efeito |
|---|---|
| Campo **ausente** | Mantém o valor do servidor. |
| `null` | **Limpa** o campo. |
| `""` ou só espaços (campos de texto e placas) | Limpa o campo (vira `null`). |
| `""` em `year`, `used_value` ou `new_value` | **400** — envie `null`. |
| Texto com espaços nas pontas | Gravado sem os espaços. |
| Placa `"ab-12 3"` | Gravada como `"AB123"` (maiúsculas, só `[A-Z0-9]`). `"11-27"` vira `"1127"`. |
| `extra_fields: {"Setor": null}` ou `""` | A entrada é descartada. |
| `extra_fields` enviado | **Substitui** o conjunto inteiro de campos extras do item. |
| `extra_fields: null` | Remove todos os campos extras. |

Objeto `Item` devolvido pelas rotas de itens:

```json
{
  "id": 5012,
  "external_item_id": "1730736000123456",
  "version": 1843,
  "sequence": null,
  "old_plate": "12345",
  "old_plate_2": null,
  "new_plate": "251",
  "unit_text": "SEDE",
  "address_text": "Rua X, 100",
  "location_text": "RECEPÇÃO",
  "description": "CADEIRA GIRATÓRIA",
  "brand": null,
  "model": null,
  "serial_number": null,
  "capacity": null,
  "year": 2019,
  "notes": null,
  "source": "mobile_app",
  "used_value": "150.00",
  "new_value": null,
  "extra_fields": { "Patrimônio": "123", "Setor": "TI" },
  "status": "pending",
  "deleted": false,
  "created_by_id": 29,
  "updated_by_id": 29,
  "created_at": "2026-11-10T13:00:00.000Z",
  "updated_at": "2026-11-10T13:00:00.000Z",
  "deleted_at": null,
  "images": [
    { "id": 881, "status": "uploaded", "original_name": "foto_1.jpg", "mime_type": "image/jpeg", "size_bytes": 214733, "checksum": "3f0c…", "created_at": "2026-11-10T13:01:00.000Z" }
  ]
}
```

- `id` é o id interno do GAI; a chave do app continua sendo `external_item_id`.
- `version` é a versão do item no projeto; use-a como `base_version` na próxima edição. Ela muda a cada alteração do item, inclusive feita pela web, pela importação ou por fotos.
- `extra_fields` é sempre objeto (`{}` quando vazio).
- `images` aparece em `GET` (lista, sync e item), com as fotos não removidas. **Não** aparece nas respostas de `PUT`/`DELETE` nem em `details.item` dos conflitos.
- `status`: `pending`, `evaluated`, `divergent`, `not_found`, `duplicated`, `removed` ou `inactive`. `deleted: true` significa excluído.

### 4.2 Criar ou editar item

| | |
|---|---|
| Funcionalidade | Cadastro e edição de item (fila de envio). |
| Legado | `POST /gai/sync_items` (multipart, sem token, 1 item por chamada; criava ou atualizava pelo `id`). Também `POST /gai/item/create` e `/gai/item/update` (não usadas desde a 1.4.6). |
| GAI | `PUT /mobile/projects/{projectId}/items/{externalId}` |
| Headers | `Authorization: Bearer`, `Content-Type: application/json`. |
| Parâmetros de URL | `projectId` (inteiro ≥ 1), `externalId` (id do aparelho, texto). |
| Permissões | `inventory-items:create` **e** `inventory-items:update`; vínculo com o projeto; projeto em `draft`/`active`/`paused`. |

Criação (sem `base_version`):

```http
PUT /api/v1/mobile/projects/97/items/1730736000123456
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "new_plate": "251",
  "old_plate": "12345",
  "old_plate_2": null,
  "unit_text": "SEDE",
  "address_text": "Rua X, 100",
  "location_text": "RECEPÇÃO",
  "description": "CADEIRA GIRATÓRIA",
  "brand": null,
  "model": null,
  "serial_number": null,
  "capacity": null,
  "year": 2019,
  "notes": null,
  "used_value": "150.00",
  "extra_fields": { "Patrimônio": "123", "Setor": "TI" }
}
```

Resposta **201**:

```json
{ "result": "created", "item": { "external_item_id": "1730736000123456", "version": 1843, "...": "demais campos do Item" } }
```

Edição (com `base_version` = `version` que o aparelho conhece; envie só o que mudou ou o item inteiro):

```json
{ "base_version": 1843, "location_text": "SALA 2", "old_plate_2": "998877" }
```

Resposta **200** `{ "result": "updated", "item": { ..., "version": 1902 } }`.

| Situação | Resposta |
|---|---|
| Item não existe | **201** `created` (`base_version` deve ser omitido ou `null`/`0`). |
| Item existe e o corpo não muda nada | **200** `unchanged`, mesmo sem `base_version`. Reenvio após timeout é seguro. |
| Item existe, corpo muda algo, `base_version` igual à versão atual | **200** `updated`. |
| `base_version` ausente ou diferente da atual, com mudança | **409 `VERSION_CONFLICT`**, com o item atual em `details.item`. |
| Item excluído | **409 `ITEM_DELETED`**, com o item em `details.item`. O app não reativa itens. |
| `base_version` > 0 para item que não existe | **404 `ITEM_NOT_FOUND`**. |
| Projeto encerrado/cancelado/arquivado | **409 `PROJECT_STATUS_BLOCKS_OPERATION`**. |
| Campo inválido ou desconhecido (`gai_user`, `id`, `placa_nova`…) | **400 `VALIDATION_ERROR`**. |
| `externalId` fora do padrão | **400 `VALIDATION_ERROR`**. |
| Sem vínculo com o projeto / sem permissão | **403**. |

Diferenças em relação ao legado:

- JSON em vez de multipart; o id vai na URL e os nomes de campo mudaram ([4.1](#41-campos-do-item-legado--gai)).
- As fotos não vão junto: são enviadas depois, em 3 passos, e só depois que o item existe no servidor.
- `gai_user` não é enviado: o autor é a conta da sessão (`created_by_id`/`updated_by_id`), e a auditoria registra o inventariante.
- Edição exige `base_version`; o legado sobrescrevia sempre (“o último ganha”).
- 201 também é sucesso; 409 não deve ser repetido automaticamente.
- `extra_fields` passa a ser enviado e salvo por item.

O que muda no app:

- Montar o corpo com os nomes novos; converter `ano` para inteiro (ou `null`) e valores para `"0.00"` (ou `null`). Se o técnico digitou um ano não numérico, mantenha o texto original em `notes` ou em `extra_fields` (decisão do app).
- Guardar `version` de cada item depois de cada resposta e usá-la como `base_version`.
- Tratar 409 como conflito a resolver ([9.3](#93-conflitos-409)), nunca como falha a repetir.

### 4.3 Consultar um item

`GET /mobile/projects/{projectId}/items/{externalId}` — permissão `inventory-items:read`. Devolve o `Item` com `images`, **inclusive se excluído** (`deleted: true`). Erros: 400 (id inválido), 403, 404 `ITEM_NOT_FOUND`. Use para recuperar um item específico após conflito ou para conferir se ele chegou ao servidor. Não existia no legado.

### 4.4 Sincronização incremental por cursor

| | |
|---|---|
| Funcionalidade | Atualizar a base local com tudo que mudou no servidor: itens de outros técnicos, alterações da web, importações, exclusões e fotos. |
| Legado | `POST /gai/update_items` (lotes de 200 ids já enviados; devolvia `gai_user` e `fields`) e `GET /external/projects/{id}/items/sync` (Reconciliação; respondia 500). |
| GAI | `GET /mobile/projects/{projectId}/items/sync?cursor=&limit=` |
| Headers | `Authorization: Bearer`, `Accept: application/json`. |
| Permissões | `inventory-items:read` e vínculo ativo e vigente com o projeto. |

| Query | Obrigatório | Validação |
|---|---|---|
| `cursor` | Não | `next_cursor` da página anterior (até 200 caracteres). Sem cursor: desde o início. |
| `limit` | Não | 1 a 500; padrão 200. |

Resposta **200**:

```json
{
  "items": [
    { "id": 5012, "external_item_id": "1730736000123456", "version": 1843, "deleted": false, "...": "Item completo com images" },
    { "id": 4420, "external_item_id": null, "version": 1850, "deleted": false, "...": "item criado pela web (somente leitura)" },
    { "id": 5100, "external_item_id": "1730736000999999", "version": 1851, "deleted": true, "deleted_at": "2026-11-10T12:40:00.000Z", "...": "..." }
  ],
  "next_cursor": "eyJ2IjoxLCJwIjo5NywicyI6MTg1MSwiaSI6NTEwMH0",
  "has_more": true,
  "server_time": "2026-11-10T13:05:00.000Z"
}
```

Regras:

- Ordem por (`version`, `id`). Cada página traz itens criados, alterados **e excluídos** depois do cursor.
- Processe a página inteira no banco local e **só então** grave `next_cursor`. Repita enquanto `has_more` for `true`.
- O cursor é opaco e vinculado ao projeto: não o decodifique nem o reutilize em outro projeto. Cursor inválido ou de outro projeto: **400 `INVALID_CURSOR`** → apague o cursor e recomece sem ele.
- Se a sincronização cair no meio, retome com o último cursor salvo; nada é perdido.
- Um item alterado durante a paginação reaparece depois com `version` maior. Sempre aplique a versão mais alta.
- `deleted: true` → remova (ou marque como excluído) localmente.
- `external_item_id: null` → item criado pela web ou pelo legado; mostre-o, mas **somente leitura** no app (não há como editá-lo pela API mobile).
- Fotos: o item traz `images` (metadados). A URL de visualização é pedida em `GET .../images` ([5.4](#54-listar-fotos-e-urls-de-visualização)).

Diferenças em relação ao legado: substitui `update_items` (que só trazia itens já enviados pelo próprio aparelho) e a rota `external/.../items/sync` (que falhava). O cursor substitui `last_id`/`next_last_id`; o filtro `unidade` e `updated_since` não existem (filtre localmente).

O que muda no app: guardar um cursor por projeto; rodar a sincronização ao abrir o projeto, depois de esvaziar a fila de envio e periodicamente; remover a chamada a `update_items`.

### 4.5 Listar itens (paginado)

`GET /mobile/projects/{projectId}/items` — permissão `inventory-items:read`. Útil para busca pontual on-line; para manter a base local, use a sincronização.

| Query | Validação |
|---|---|
| `page` | ≥ 1, padrão 1 |
| `page_size` | 1 a 100, padrão 50 |
| `new_plate` | Igualdade após normalização |
| `old_plate` | Igualdade em `old_plate` **ou** `old_plate_2` |
| `search` | Contém, em descrição, placas e `external_item_id` |
| `include_deleted` | `true` ou `false` (padrão) |

Resposta: `{ "items": [Item...], "page": 1, "page_size": 50, "total_items": 132, "total_pages": 3 }`. Não existia no legado.

### 4.6 Excluir item

| | |
|---|---|
| Funcionalidade | O técnico exclui um item. |
| Legado | `POST /gai/item/delete` (form `id=...`, só com internet, resposta ignorada, sem nova tentativa). |
| GAI | `DELETE /mobile/projects/{projectId}/items/{externalId}[?base_version=N]` |
| Headers | `Authorization: Bearer`. Sem corpo. |
| Permissões | `inventory-items:deactivate`; vínculo; projeto em `draft`/`active`/`paused`. |

Resposta **200**:

```json
{ "result": "deleted", "item": { "external_item_id": "1730736000123456", "deleted": true, "status": "inactive", "version": 1910, "deleted_at": "2026-11-10T14:00:00.000Z", "...": "..." } }
```

| Situação | Resposta | Ação no app |
|---|---|---|
| Excluído agora | 200 `deleted` | Concluído. |
| Já estava excluído | 200 `already_deleted` | Concluído. |
| Nunca chegou ao servidor | 404 `ITEM_NOT_FOUND` | **Concluído** (nada a excluir). |
| `base_version` enviado e diferente | 409 `VERSION_CONFLICT` | Mostrar ao técnico (o item mudou depois da última sincronização). |
| Projeto bloqueado | 409 `PROJECT_STATUS_BLOCKS_OPERATION` | Erro definitivo. |

Diferenças: exclusão **lógica** e idempotente; o item continua no servidor marcado como excluído e aparece na sincronização com `deleted: true`. Itens excluídos não podem ser editados pelo app (409 `ITEM_DELETED`).

O que muda no app: a exclusão entra na **fila**, como qualquer escrita, também offline. Se o item ainda não foi enviado (criado e excluído sem rede), remova as duas operações da fila e não chame o servidor. `base_version` é opcional: envie para evitar excluir um item que outra pessoa alterou.

## 5. Fotos dos itens

### 5.1 Visão geral

```text
1. PUT do item (o item precisa existir no servidor)
2. POST .../images/upload-url      → image.id, upload_url, upload_headers, expires_in_seconds (300)
3. PUT upload_url (bytes da foto)  → direto no storage S3, SEM Authorization
4. POST .../images/{id}/confirm-upload → result, image, item_version
```

| Regra | Valor |
|---|---|
| Tipos | `image/jpeg` (ou `image/jpg`), `image/png`, `image/webp` |
| Tamanho máximo | 10 MiB (10.485.760 bytes) por foto |
| Fotos por item | Até 3 fotos ativas (pendentes + enviadas). A 4ª: **409 `CONFLICT`** |
| Janela para enviar e confirmar | `expires_in_seconds` (300 s por padrão), contada desde o pedido da URL |
| URL de visualização | Temporária (300 s por padrão). Não guarde; peça de novo quando precisar |

As fotos do app (JPEG, lado maior 1600 px, qualidade 80, ~150–250 KB) estão bem abaixo do limite.

### 5.2 Pedir URL de upload

| | |
|---|---|
| Legado | Fotos iam no multipart do `sync_items` (`image_1…n`). |
| GAI | `POST /mobile/projects/{projectId}/items/{externalId}/images/upload-url` |
| Permissões | `inventory-item-images:create`; item existente e não excluído. |

Requisição:

```json
{ "original_name": "foto_1.jpg", "mime_type": "image/jpeg", "size_bytes": 214733 }
```

| Campo | Obrigatório | Validação |
|---|---|---|
| `original_name` | Sim | Até 255 caracteres |
| `mime_type` | Sim | `image/jpeg`, `image/jpg`, `image/png`, `image/webp` |
| `size_bytes` | Sim | Inteiro ≥ 1, até 10 MiB; deve ser o tamanho exato do arquivo |
| `checksum` | Não | SHA-256 em hexadecimal minúsculo (64 caracteres). Se enviado, o servidor confere |

Resposta **201**:

```json
{
  "image": {
    "id": 881, "organization_id": 3, "inventory_item_id": 5012, "storage_provider": "s3",
    "original_name": "foto_1.jpg", "mime_type": "image/jpeg", "size_bytes": 214733, "checksum": null,
    "status": "pending_upload", "uploaded_by_id": 29,
    "created_at": "2026-11-10T13:01:00.000Z", "updated_at": "2026-11-10T13:01:00.000Z", "deleted_at": null
  },
  "upload_url": "https://<bucket>.s3.<região>.amazonaws.com/...&X-Amz-Signature=...",
  "upload_headers": { "Content-Type": "image/jpeg", "Content-Length": "214733" },
  "expires_in_seconds": 300
}
```

Erros: 400 `VALIDATION_ERROR` / `STORAGE_INVALID_SIZE` / `STORAGE_UNSUPPORTED_MIME`; 404 `ITEM_NOT_FOUND` (envie o item antes); 409 `ITEM_DELETED`, `CONFLICT` (limite de 3 fotos) ou `PROJECT_STATUS_BLOCKS_OPERATION`; 403.

### 5.3 Enviar ao storage e confirmar

Envio direto (sem passar pelo backend):

```http
PUT <upload_url>
Content-Type: image/jpeg
Content-Length: 214733

<bytes do arquivo>
```

- Envie **exatamente** os headers de `upload_headers`; a assinatura cobre `Content-Type` e `Content-Length`.
- **Não** envie `Authorization` nem outros headers de autenticação do GAI.
- O storage responde **200** sem corpo útil. 403 do storage = URL expirada ou headers diferentes: peça nova URL.

Confirmação: `POST /mobile/projects/{projectId}/items/{externalId}/images/{imageId}/confirm-upload` — permissão `inventory-item-images:update`. Corpo `{}` (opcionalmente `{ "size_bytes": 214733, "checksum": "<sha256>" }` para conferência extra).

Resposta **200**:

```json
{ "result": "confirmed", "image": { "id": 881, "status": "uploaded", "checksum": "3f0c…", "...": "..." }, "item_version": 1844 }
```

| Status | `code` | Ação |
|---|---|---|
| 200 | `confirmed` / `already_confirmed` | Concluído. Atualize a `version` local do item com `item_version`. |
| 404 | `STORAGE_OBJECT_NOT_FOUND` | O PUT não chegou ao storage. Refaça o PUT (se dentro da janela) ou recomece do passo 1. |
| 409 | `STORAGE_SIZE_MISMATCH`, `STORAGE_MIME_MISMATCH`, `STORAGE_CHECKSUM_MISMATCH`, `STORAGE_CONTENT_MISMATCH` | O arquivo enviado não bate com o declarado (por exemplo, PNG declarado como JPEG). Corrija e recomece do passo 1. |
| 409 | `ITEM_DELETED` | O item foi excluído. Descarte a foto. |
| 410 | `STORAGE_UPLOAD_EXPIRED` | Passou a janela. Recomece do passo 1. |
| 503 | `STORAGE_UNAVAILABLE` | Repita com backoff. |

Confirmar de novo uma foto já confirmada responde 200 `already_confirmed`: é seguro repetir.

Uma foto pedida e nunca confirmada fica `pending_upload` e ocupa uma das 3 vagas. Se desistir dela, remova-a ([5.5](#55-remover-foto)).

### 5.4 Listar fotos e URLs de visualização

`GET /mobile/projects/{projectId}/items/{externalId}/images[?with_urls=false]` — permissões `inventory-item-images:read` **e** `inventory-item-images:download`.

```json
{
  "item_version": 1844,
  "items": [
    {
      "id": 881, "status": "uploaded", "original_name": "foto_1.jpg", "mime_type": "image/jpeg",
      "size_bytes": 214733, "checksum": "3f0c…", "created_at": "2026-11-10T13:01:00.000Z",
      "download_url": "https://<bucket>.s3.<região>.amazonaws.com/...", "expires_in_seconds": 300
    }
  ]
}
```

- `download_url` só existe para fotos `uploaded`; para `pending_upload` vem `null`.
- `with_urls=false` devolve só metadados (sem assinar URLs).
- Atende ao pedido do legado de “URL da foto no servidor”: o app pode apagar fotos locais de itens já sincronizados e baixar quando precisar. Não armazene a URL: ela expira.

### 5.5 Remover foto

`DELETE /mobile/projects/{projectId}/items/{externalId}/images/{imageId}` — permissão `inventory-item-images:remove`. Resposta 200 `{ "result": "removed" | "already_removed", "item_version": 1845 }`. Idempotente. Erros: 404 (foto ou item), 409 `ITEM_DELETED`. Não existia no legado.

## 6. Placas: duplicidade e pendências

As placas são comparadas **normalizadas**: maiúsculas e só `[A-Z0-9]` (`"ab-12"` = `"AB12"`). Só contam itens ativos (não excluídos) do projeto, de todos os aparelhos e da web.

### 6.1 Verificar duplicidade no cadastro

| | |
|---|---|
| Funcionalidade | Avisar, com internet, que a placa digitada já existe no projeto. |
| Legado | `POST /gai/projects/{project_id}/check_duplicate` (multipart `search=251`; resposta texto, o aviso nunca aparecia). |
| GAI | `GET /mobile/projects/{projectId}/plates/check?plate=251&kind=new&exclude_external_id=<id>` |
| Permissões | `inventory-items:read`. |

| Query | Obrigatório | Validação |
|---|---|---|
| `plate` | Sim | Até 100 caracteres, com ao menos uma letra ou número (senão 400) |
| `kind` | Não | `new` (placa nova), `old` (placa antiga **e** placa antiga 2) ou `any` (padrão, as três) |
| `exclude_external_id` | Não | Id do item em edição, para não acusar o próprio item |

Resposta **200**:

```json
{
  "plate": "251",
  "kind": "new",
  "exists": true,
  "matches": [
    {
      "id": 5100, "external_item_id": "1730736000999999", "version": 1901,
      "new_plate": "251", "old_plate": null, "old_plate_2": null,
      "unit_text": "SEDE", "location_text": "COPA", "description": "MESA",
      "technician": { "user_id": 31, "name": "Maria Souza", "field_agent_id": 14 },
      "created_at": "2026-10-29T12:00:00.000Z",
      "matched_fields": ["new_plate"]
    }
  ]
}
```

`matches` traz no máximo 20 itens. Erros: 400 `VALIDATION_ERROR`, 403.

O que muda no app: usar o booleano JSON `exists` (corrige o defeito do legado) e mostrar técnico, unidade e localização dos itens encontrados. Sem rede, a checagem é só local.

### 6.2 Pendências: placas faltantes e duplicadas

| | |
|---|---|
| Funcionalidade | Tela Pendências: furos na numeração de placas novas e placas duplicadas (novas e antigas). |
| Legado | `POST /gai/projects/pendencias` `{project_id, itens: []}` (a rota **gravava** os itens recebidos). |
| GAI | `GET /mobile/projects/{projectId}/plates/report[?from=1&to=500]` (somente leitura) |
| Permissões | `inventory-items:read`. |

| Query | Validação |
|---|---|
| `from`, `to` | Inteiros ≥ 0. Padrão: menor e maior placa nova numérica do projeto. Faixa invertida ou com mais de 1.000.000 de placas: **400 `PLATE_RANGE_INVALID`**. |

Resposta **200**:

```json
{
  "project_id": 97,
  "generated_at": "2026-11-10T13:00:00.000Z",
  "totals": { "items": 10, "with_new_plate": 10, "numeric_new_plates": 8, "non_numeric_new_plates": 1 },
  "missing_new_plates": { "from": 1, "to": 12, "count": 5, "ranges": ["4", "6-8", "11"] },
  "duplicated_new_plates": [
    {
      "plate": "251",
      "items": [
        { "id": 5012, "external_item_id": "1730736000123456", "version": 1843, "new_plate": "251", "old_plate": "12345", "old_plate_2": null, "unit_text": "SEDE", "location_text": "RECEPÇÃO", "description": "CADEIRA GIRATÓRIA", "technician": { "user_id": 29, "name": "João Pedro", "field_agent_id": 12 }, "created_at": "2026-10-28T13:00:00.000Z" },
        { "id": 5100, "external_item_id": "1730736000999999", "version": 1901, "new_plate": "251", "old_plate": null, "old_plate_2": null, "unit_text": "SEDE", "location_text": "COPA", "description": "MESA", "technician": { "user_id": 31, "name": "Maria Souza", "field_agent_id": 14 }, "created_at": "2026-10-29T12:00:00.000Z" }
      ]
    }
  ],
  "duplicated_old_plates": []
}
```

| Legado | GAI |
|---|---|
| `placas_faltantes: ["5","9","11-27"]` | `missing_new_plates.ranges` (mesmo formato de faixas) + `from`, `to`, `count` |
| `novas_duplicadas[]` | `duplicated_new_plates[]` |
| `antigas_duplicadas[]` | `duplicated_old_plates[]` — considera `old_plate` e `old_plate_2` |
| `item_id` | `external_item_id` (pode ser `null` para item da web) |
| `gai_user` | `technician.name` |
| `unidade`, `localizacao`, `descricao` | `unit_text`, `location_text`, `description` |
| `created_at` `"2026-10-28 10:00:00"` | ISO 8601 UTC |

Regras: placas novas não numéricas (com letras) não entram nas faltantes, mas entram nas duplicadas e em `non_numeric_new_plates`. Um item com a mesma placa em `old_plate` e `old_plate_2` conta uma vez.

O que muda no app: chamada `GET` sem corpo; **não enviar itens** por essa rota (os itens sobem pelo `PUT`). Sincronize a fila antes de abrir o relatório. Sem rede, mantenha o cálculo local como hoje e avise o técnico.

## 7. Despesas

> Despesas exigem **permissões financeiras concedidas explicitamente** ao perfil do inventariante (`expenses:create`, `expenses:upload-attachment` e, para listar, `expenses:read`). O perfil padrão de campo **não** as possui. Mostre o menu só quando `permissions[]` contiver `expenses:create`.

### 7.1 Registrar despesa

| | |
|---|---|
| Funcionalidade | Tela Financeiro (nota fiscal). |
| Legado | `POST /gai/projects/financeiro` (multipart com `project_id`, `gai_user`, `descricao`, `motivo`, `data` e `valor` em texto livre, `image`; resposta ignorada). |
| GAI | `POST /mobile/projects/{projectId}/expenses` + comprovante em 3 passos |
| Permissões | `expenses:create`; vínculo; projeto em `draft`/`active`/`paused`; inventariante ativo. |

Requisição:

```json
{
  "client_expense_id": "exp-1730736000123456",
  "description": "Combustível",
  "reason": "Deslocamento",
  "expense_date": "2026-11-08",
  "amount": "120.50"
}
```

| Campo | Obrigatório | Validação |
|---|---|---|
| `client_expense_id` | Sim | Gerado no aparelho, 8 a 100 caracteres `[A-Za-z0-9._:-]`, começando por letra ou número. Chave de idempotência. |
| `description` | Sim | Texto (legado `descricao`). |
| `reason` | Não | Texto ou `null` (legado `motivo`). |
| `expense_date` | Sim | Data civil válida `YYYY-MM-DD` (legado `data`). |
| `amount` | Sim | `"120.50"` (legado `valor`). |
| `metadata` | Não | Objeto livre ou `null`. |
| `field_agent_id`, `project_id`, `gai_user` | — | **Não enviar** (400). O inventariante vem da sessão; o projeto, da URL. |

Resposta **201** (`created`) ou **200** (`existing`, reenvio com a mesma chave e os mesmos dados):

```json
{
  "result": "created",
  "expense": {
    "id": 731, "organization_id": 3, "project_id": 97, "field_agent_id": 12,
    "description": "Combustível", "reason": "Deslocamento",
    "expense_date": "2026-11-08", "amount": "120.50", "status": "pending",
    "metadata": null, "created_at": "2026-11-10T13:10:00.000Z", "updated_at": "2026-11-10T13:10:00.000Z"
  }
}
```

| Status | `code` | Ação |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Data ou valor em formato errado, campo extra. Corrija; não repita igual. |
| 403 | `FORBIDDEN` | Sem permissão financeira ou sem vínculo. Esconda a função. |
| 409 | `IDEMPOTENCY_KEY_REUSED` | A chave já foi usada com outros dados. Gere outra chave **só** se for de fato outra despesa. |
| 409 | `REQUEST_IN_PROGRESS` | A mesma despesa ainda está sendo gravada. Repita em alguns segundos. |
| 409 | `FIELD_AGENT_INELIGIBLE` | Inventariante inativo. Erro definitivo. |
| 409 | `CONFLICT` | Corrida rara na chave. Repita. |
| 409 | `PROJECT_STATUS_BLOCKS_OPERATION` | Projeto não aceita novas despesas. |

Diferenças e mudanças no app:

- JSON em vez de multipart; a foto da nota vai em 3 passos ([7.3](#73-comprovante-da-despesa)), depois de criar a despesa.
- Converter data digitada para `YYYY-MM-DD` e valor para `"0.00"` antes de enfileirar; validar no formulário.
- Gerar `client_expense_id` uma vez, ao salvar, e reutilizá-lo em todas as tentativas. Guardar `expense.id` para o comprovante.
- Status da despesa: `pending`, `approved`, `rejected`, `paid` ou `cancelled` (decididos pela web).

### 7.2 Listar as próprias despesas

`GET /mobile/projects/{projectId}/expenses?page=1&page_size=50` — permissão `expenses:read`. `page_size` de 1 a 100, padrão 50. Devolve só as despesas do inventariante da sessão, no formato paginado `{ items: [Expense], page, page_size, total_items, total_pages }`.

> `expenses:read` **não** aparece em `permissions[]` do `/mobile/me`. O app deve chamar a rota e, se receber **403**, esconder o histórico.

### 7.3 Comprovante da despesa

1. `POST /mobile/projects/{projectId}/expenses/{expenseId}/attachments/upload-url` — permissão `expenses:upload-attachment`.

```json
{ "original_name": "nota_combustivel.jpg", "mime_type": "image/jpeg", "size_bytes": 183402 }
```

Resposta **201**:

```json
{
  "attachment": { "id": 55, "organization_id": 3, "expense_id": 731, "original_name": "nota_combustivel.jpg", "mime_type": "image/jpeg", "size_bytes": 183402, "checksum": null, "status": "pending_upload", "created_at": "2026-11-10T13:10:05.000Z" },
  "upload_url": "https://<bucket>.s3.<região>.amazonaws.com/...",
  "upload_headers": { "Content-Type": "image/jpeg", "Content-Length": "183402" },
  "expires_in_seconds": 300
}
```

2. `PUT upload_url` com os bytes e exatamente `upload_headers` (sem `Authorization`).
3. `POST /mobile/projects/{projectId}/expenses/{expenseId}/attachments/{attachmentId}/confirm-upload` com `{}` → 200 `{ "result": "confirmed" | "already_confirmed", "attachment": { ..., "status": "uploaded" } }`.

| Regra | Valor |
|---|---|
| Tamanho máximo | **20 MiB** (20.971.520 bytes) por comprovante — limite próprio, independente dos 100 MiB do backup |
| Tipos recomendados | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |
| Janela | 300 s |
| Erros | 400 `STORAGE_INVALID_SIZE` (acima de 20 MiB), 400 `STORAGE_UNSUPPORTED_MIME`, 404 `NOT_FOUND` (despesa de outro inventariante), 409 `STORAGE_*_MISMATCH`, 410 `STORAGE_UPLOAD_EXPIRED` |

## 8. Reconciliação (importação)

A Reconciliação envia em lote os itens de uma unidade, com fotos e um backup opcional, dentro de uma **sessão**. Cada técnico só vê as sessões que ele mesmo abriu.

```text
POST import-sessions                          → session_uuid (status open, expira em 7 dias)
  ├─ por foto: files/upload-url {type:image} → PUT → files/{file_id}/confirm-upload
  ├─ backup:   files/upload-url {type:raw_backup} → PUT → confirm-upload   (opcional)
  ├─ por lote: payloads {payload_number, idempotency_key, items[≤1000]}
  ├─ finish                                   → finished | finished_with_errors | failed
  └─ GET {uuid} (contadores) · GET {uuid}/errors (erros por linha)
```

Base das rotas: `/mobile/projects/{projectId}/import-sessions`. `{uuid}` é o `session_uuid`.

| Permissão | Rotas |
|---|---|
| `import-sessions:create` | criar sessão |
| `import-sessions:read` | consultar sessão |
| `import-files:create` | upload-url e confirm-upload de arquivos |
| `import-payloads:create` | enviar lote |
| `import-sessions:finish` | encerrar |
| `import-errors:read` | erros |

Sessão de outra conta, de outro projeto ou inexistente: **404 `NOT_FOUND`**. `uuid` mal formado: **400**.

### 8.1 Criar sessão

| | |
|---|---|
| Legado | `POST /gai/items/import-sessions` `{project_id, unidade, source?, expected_payloads?}` → `{data: {session_uuid}}` |
| GAI | `POST /mobile/projects/{projectId}/import-sessions` |

Requisição (todos opcionais):

```json
{ "unidade": "SEDE", "expected_payloads": 3, "device_label": "Galaxy A14 - João" }
```

| Campo | Validação |
|---|---|
| `unidade` | Texto até 255 |
| `expected_payloads` | Inteiro 1 a 1000. Se informado, o `finish` exige que todos os lotes tenham chegado |
| `device_label` | Texto até 100 |
| `project_id`, `source` | **Não enviar** (400). Projeto vem da URL; a origem é definida pelo servidor |

Resposta **201** (sem envelope `data`):

```json
{
  "session_uuid": "8f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  "status": "open",
  "unidade": "SEDE",
  "expires_at": "2026-11-17T13:00:00.000Z",
  "expected_payloads": 3,
  "received_payloads": 0,
  "processed_payloads": 0,
  "pending_payloads": 3,
  "payloads_with_errors": 0,
  "total_items": 0,
  "success_items": 0,
  "failed_items": 0,
  "created_items": 0,
  "updated_items": 0,
  "deleted_items": 0,
  "backup_uploaded": false,
  "finished_at": null
}
```

### 8.2 Fotos e backup da sessão

| | |
|---|---|
| Legado | `POST …/images/presign` (até 100 arquivos por chamada, `client_file_id`, devolvia `path`) e `POST /gai/import-sessions/{uuid}/backup` (multipart `backup_file`) |
| GAI | `POST …/{uuid}/files/upload-url` (um arquivo por chamada) → `PUT` → `POST …/{uuid}/files/{fileId}/confirm-upload` |

Requisição de foto:

```json
{ "type": "image", "original_name": "foto_1.jpg", "mime_type": "image/jpeg", "size_bytes": 201544 }
```

Requisição de backup:

```json
{ "type": "raw_backup", "original_name": "backup-sessao.zip", "mime_type": "application/zip", "size_bytes": 73400320 }
```

| Tipo | MIME | Tamanho máximo | Janela |
|---|---|---|---|
| `image` | `image/jpeg`, `image/jpg`, `image/png`, `image/webp` | 10 MiB | 300 s |
| `raw_backup` | `application/zip` (também aceita `application/json`) | **100 MiB** (104.857.600 bytes) | **1800 s** |

Resposta **201**:

```json
{
  "file_id": 4410,
  "type": "image",
  "status": "pending_upload",
  "upload_url": "https://<bucket>.s3.<região>.amazonaws.com/...",
  "upload_headers": { "Content-Type": "image/jpeg", "Content-Length": "201544" },
  "expires_in_seconds": 300
}
```

Depois do `PUT`, confirme com `{}`. Resposta **200**:

```json
{ "file_id": 4410, "type": "image", "status": "uploaded", "size_bytes": 201544, "checksum": "9a1b…" }
```

Erros: 400 `INVALID_IMPORT_FILE` (tipo ou tamanho), 409 (sessão encerrada/expirada; `STORAGE_*_MISMATCH`), 410 `STORAGE_UPLOAD_EXPIRED`. A confirmação é idempotente. Um backup confirmado faz `backup_uploaded = true`.

O que muda no app: uma chamada por arquivo (mantenha até 3 envios ao storage em paralelo); guardar `file_id` de cada foto; o backup deixa de ser multipart e passa pelos mesmos 3 passos, com janela de 30 min para redes lentas.

### 8.3 Enviar lote de itens

| | |
|---|---|
| Legado | `POST …/{uuid}/payloads` `{payload_number, items[]}` com campos em português, `gai_user` e `images[{disk, path, sort_order}]` |
| GAI | `POST /mobile/projects/{projectId}/import-sessions/{uuid}/payloads` |

Requisição:

```json
{
  "payload_number": 1,
  "idempotency_key": "rec-8f1c2b3a-p1",
  "items": [
    {
      "operation": "upsert",
      "external_item_id": "1730736000123456",
      "sequence": "12",
      "new_plate": "251",
      "old_plate": "12345",
      "unit_text": "SEDE",
      "location_text": "RECEPÇÃO",
      "description": "CADEIRA GIRATÓRIA",
      "used_value": "150.00",
      "extra_fields": { "Patrimônio": "123" },
      "images": [{ "file_id": 4410 }]
    },
    { "operation": "delete", "external_item_id": "1730736000777777" }
  ]
}
```

| Campo | Obrigatório | Validação |
|---|---|---|
| `payload_number` | Sim | Inteiro ≥ 1 |
| `idempotency_key` | Sim | 8 a 128 caracteres; gere uma por lote e reutilize nas tentativas |
| `items` | Sim | Até 1000 |
| `items[].operation` | Sim | `upsert` ou `delete` |
| `items[].external_item_id` | Sim | Mesmo padrão do id do item |
| `items[].<campos do item>` | Não | Os mesmos do `PUT` ([4.1](#41-campos-do-item-legado--gai)), com as mesmas regras de ausente/`null` |
| `items[].images` | Não | Até 50 `{file_id}` de fotos **desta sessão**, já confirmadas |
| `base_version`, `gai_user`, `item_id`, `fonte`, `disk`, `path`, `sort_order` | — | **Não enviar** (400) |

Resposta **201**:

```json
{ "payload_number": 1, "status": "partially_processed", "items_count": 2, "created_count": 1, "updated_count": 0, "deleted_count": 0, "failed_count": 1 }
```

| Situação | Resposta |
|---|---|
| Lote aplicado | 201, `status` `processed`, `partially_processed` (alguns itens falharam) ou `failed` (todos falharam) |
| Mesmo lote reenviado (mesmo número, chave e conteúdo) | 201 com o mesmo resultado; nada é aplicado de novo |
| Mesmo número ou chave com conteúdo diferente | **409 `PAYLOAD_IDEMPOTENCY_CONFLICT`** |
| `file_id` que não pertence à sessão | **400 `INVALID_IMAGE_FILE`** (lote inteiro recusado) |
| Foto da sessão ainda não confirmada | O item falha (erro da linha), os demais seguem |
| Sessão expirada / encerrada | **409 `IMPORT_SESSION_EXPIRED`** / **`IMPORT_SESSION_TERMINAL`** |

Regras de aplicação: cada item é aplicado de forma isolada (sem escrita parcial do item). Itens excluídos não são alterados nem reativados. No lote mobile, `null` limpa o campo, como no `PUT`. O lote não usa `base_version`: ele aplica o estado enviado (use a Reconciliação para carga em massa, não para edições concorrentes).

Diferenças: nomes de campo iguais aos do `PUT`; `item_id` → `external_item_id`; `sequence` passa a ser **texto** (`"12"`, não `12`); `gai_user` sai (vem da sessão); fotos por `file_id`; `idempotency_key` obrigatória; operação `delete` disponível.

### 8.4 Encerrar sessão

`POST /mobile/projects/{projectId}/import-sessions/{uuid}/finish` — sem corpo (ou `{}`). Resposta **200** com o mesmo objeto da sessão; `status` final `finished`, `finished_with_errors` ou `failed`.

| Status | `code` | Ação |
|---|---|---|
| 409 | `CONFLICT` | Faltam lotes de `expected_payloads`. Envie os que faltam. |
| 409 | `IMPORT_PAYLOAD_PROCESSING` | Há lote em processamento. Aguarde e tente de novo (ver [8.7](#87-sessões-interrompidas)). |
| 409 | `IMPORT_SESSION_TERMINAL` / `IMPORT_SESSION_EXPIRED` | Sessão já encerrada ou expirada. Consulte o status. |

### 8.5 Consultar sessão

`GET /mobile/projects/{projectId}/import-sessions/{uuid}` → 200 com o objeto da sessão ([8.1](#81-criar-sessão)).

| Legado (`data.*`) | GAI |
|---|---|
| `status` `ready` | `receiving` |
| `status` `completed` / `completed_with_errors` | `finished` / `finished_with_errors` |
| — | `cancelled`, `expired` (novos) |
| `received_payloads`, `processed_payloads`, `total_items`, `success_items`, `failed_items`, `expected_payloads`, `pending_payloads`, `backup_uploaded` | Mesmos nomes, sem envelope `data` |
| — | `created_items`, `updated_items`, `deleted_items`, `payloads_with_errors`, `unidade`, `expires_at`, `finished_at` |

Status possíveis: `open`, `receiving`, `processing`, `finished`, `finished_with_errors`, `failed`, `cancelled`, `expired`. `success_items` = criados + atualizados + excluídos. `pending_payloads` = esperados − recebidos (`null` sem `expected_payloads`).

O app pode consultar a cada 5 s enquanto houver lote em processamento, como hoje; o envio de lote já devolve o resultado de forma síncrona na maioria dos casos.

### 8.6 Erros da sessão

`GET /mobile/projects/{projectId}/import-sessions/{uuid}/errors?page=1&page_size=100` (`page_size` 1 a 100, padrão 100):

```json
{
  "items": [
    { "payload_number": 1, "row_number": 2, "item_id": "1730736000999999", "error_code": "VALIDATION_ERROR", "error_message": "image file not uploaded and confirmed in this session" }
  ],
  "page": 1,
  "page_size": 100,
  "total_items": 1,
  "total_pages": 1
}
```

Diferença: o legado devolvia `{data: {errors: [...]}}`; agora é paginado, com `row_number` e `error_code` além de `payload_number`, `item_id` e `error_message`.

### 8.7 Sessões interrompidas

- **App fechado no meio:** guarde `session_uuid`, `file_id` confirmados e o número/chave de cada lote. Ao voltar, consulte a sessão; reenvie os lotes não confirmados com a **mesma** `idempotency_key` (é seguro) e encerre.
- **Foto não confirmada a tempo (410):** peça nova URL; o `file_id` antigo não deve ser usado.
- **Lote preso em `processing`** (queda do servidor durante o processamento, por mais de 15 min): o `finish` responde 409 `IMPORT_PAYLOAD_PROCESSING`. **O app não tem rota de reprocessamento**: um gestor reprocessa pela web e o app reenvia o lote (idempotente) ou apenas encerra.
- **Sessão expirada (7 dias):** abra uma sessão nova e reenvie.

### 8.8 Baixar itens para a Reconciliação

O legado usava `GET /external/projects/{id}/items/sync` (que respondia 500). No GAI, use a sincronização por cursor ([4.4](#44-sincronização-incremental-por-cursor)), que já inclui itens importados, fotos e exclusões. Filtre por `unit_text` no aparelho, se necessário.

## 9. Sincronização, conflitos e fila offline

### 9.1 Identificadores e idempotência

- O id gerado no aparelho é a chave do item em todas as rotas e **sempre texto**. Zeros à esquerda são preservados. Ids numéricos do app não sofrem com a comparação sem distinção de maiúsculas usada pelo banco.
- `PUT` de item, `DELETE` de item, confirmação de upload, criação de despesa (`client_expense_id`) e lote de reconciliação (`idempotency_key`) são idempotentes: repetir a mesma requisição depois de um timeout não duplica nada.
- Itens criados por vários aparelhos ao mesmo tempo no mesmo projeto não colidem (validado com 4 aparelhos em paralelo no MySQL).

### 9.2 Versão do item

- Cada item tem `version`, que aumenta a cada alteração (app, web, importação, fotos). As versões são únicas e crescentes por projeto.
- Na edição, envie `base_version` = última `version` que o aparelho recebeu para aquele item (do `PUT`, do `confirm-upload` via `item_version`, ou da sincronização).

### 9.3 Conflitos 409

| `code` | Causa | Recuperação recomendada |
|---|---|---|
| `VERSION_CONFLICT` | O item mudou no servidor (web ou outro técnico) depois da versão conhecida | Leia `details.item`. Se o técnico alterou campos que não mudaram no servidor, reaplique **só esses campos** sobre `details.item` e reenvie com `base_version = details.item.version`. Se os mesmos campos mudaram dos dois lados, mostre as duas versões e deixe o técnico escolher. **Nunca** force sem `base_version` atualizado. |
| `ITEM_DELETED` | O item foi excluído no servidor | Descarte a edição local, marque o item como excluído e avise o técnico. |
| `PROJECT_STATUS_BLOCKS_OPERATION` | Projeto não aceita mais escrita | Erro definitivo; mova para “não enviados”. |

Quando dois aparelhos enviam a mesma `base_version`, exatamente um recebe 200 e os outros recebem 409 (validado em teste de concorrência).

### 9.4 Fila de envio e política de tentativas

| Resposta | Ação na fila |
|---|---|
| 2xx (inclui 201, `unchanged`, `already_deleted`, `already_confirmed`, `existing`) | Remove da fila e grava `version`/ids devolvidos. |
| 404 `ITEM_NOT_FOUND` em `DELETE` | Remove da fila (concluído). |
| 401 | Renova a sessão (uma vez) e repete. Se o refresh falhar, pausa a fila até novo login. |
| 403 | Pausa as operações daquele projeto; atualiza `/mobile/me`. Não repete automaticamente. |
| 409 | Move para a tela de conflitos ([9.3](#93-conflitos-409)). Não repete automaticamente. |
| 410 (upload) | Recomeça a foto do passo 1. |
| Outros 4xx (400, 404 de foto, 413) | “Erro definitivo”, visível ao técnico, **sem repetir**. |
| 429, 5xx, timeout ou sem rede | Repete com backoff exponencial: 5 s, 10 s, 20 s… até 5 min, com variação aleatória. |

Ordem: uma operação por item, na ordem em que foram feitas (criar → fotos → editar → excluir). Operações de itens diferentes podem seguir em paralelo (o app usa 2). A foto só sobe depois que o `PUT` do item foi concluído.

### 9.5 Exclusão offline

1. O técnico exclui sem rede: marque o item como excluído localmente e enfileire `DELETE`.
2. Se o item ainda tinha `PUT` pendente na fila (nunca enviado), cancele as duas operações.
3. Ao voltar a rede, o `DELETE` responde 200 (`deleted`/`already_deleted`) ou 404 (nunca chegou): os dois são sucesso.
4. A sincronização seguinte traz o item com `deleted: true`, confirmando o estado.
5. Se outra pessoa editou o item antes, e o app enviou `base_version`, a resposta é 409 `VERSION_CONFLICT`: pergunte ao técnico se mantém a exclusão (reenvie com a versão nova ou sem `base_version`).

### 9.6 Alterações simultâneas (web e outros técnicos)

- A sincronização por cursor traz todas as alterações, inclusive as da web, com a nova `version`.
- Ao aplicar uma página, se o item local tiver edição pendente na fila, **não sobrescreva** a edição local: guarde a versão do servidor como base e deixe a fila resolver (o envio dará 200 ou 409).
- Itens com `external_item_id: null` (web/legado) são somente leitura no app.

## 10. Exemplos completos de fluxo

Valores fictícios. Os caminhos abaixo são relativos à base `https://d1kanjou9wgm7q.cloudfront.net/api/v1`. Exemplo: `POST /mobile/auth/login` = `POST https://d1kanjou9wgm7q.cloudfront.net/api/v1/mobile/auth/login`.

### 10.1 Login → projetos → refresh

```http
POST /mobile/auth/login
Content-Type: application/json

{ "identifier": "tecnico.campo", "password": "<senha>", "device_label": "Galaxy A14" }
```

```json
{
  "token_type": "Bearer",
  "access_token": "00000000-0000-4000-8000-000000000000",
  "access_token_expires_at": "2026-11-10T13:15:00.000Z",
  "refresh_token": "gmr_EXEMPLOexemploEXEMPLOexemploEXEMPLOexempl",
  "refresh_token_expires_at": "2026-11-24T13:00:00.000Z",
  "session_expires_at": "2026-12-10T13:00:00.000Z",
  "user": { "id": 29, "full_name": "João Pedro", "must_change_password": false }
}
```

```http
GET /mobile/me
Authorization: Bearer 00000000-0000-4000-8000-000000000000
```

Resposta: ver [2.5](#25-identidade-do-inventariante) (`projects: [{ "id": 97, ... }]`).

Às 13:14 (antes de `access_token_expires_at`):

```http
POST /mobile/auth/refresh
Content-Type: application/json

{ "refresh_token": "gmr_EXEMPLOexemploEXEMPLOexemploEXEMPLOexempl" }
```

Resposta 200 com **novo** `access_token` e **novo** `refresh_token`; grave os dois antes de liberar outras requisições.

### 10.2 Cadastro de item → fotos → confirmação

```http
PUT /mobile/projects/97/items/1730736000123456
Authorization: Bearer <access_token>
Content-Type: application/json

{ "new_plate": "251", "unit_text": "SEDE", "location_text": "RECEPÇÃO", "description": "CADEIRA GIRATÓRIA" }
```

→ **201** `{ "result": "created", "item": { "version": 1843, ... } }`

```http
POST /mobile/projects/97/items/1730736000123456/images/upload-url
Authorization: Bearer <access_token>
Content-Type: application/json

{ "original_name": "foto_1.jpg", "mime_type": "image/jpeg", "size_bytes": 214733 }
```

→ **201** `{ "image": { "id": 881, "status": "pending_upload", ... }, "upload_url": "...", "upload_headers": { "Content-Type": "image/jpeg", "Content-Length": "214733" }, "expires_in_seconds": 300 }`

```http
PUT <upload_url>
Content-Type: image/jpeg
Content-Length: 214733

<bytes>
```

→ **200** (storage)

```http
POST /mobile/projects/97/items/1730736000123456/images/881/confirm-upload
Authorization: Bearer <access_token>
Content-Type: application/json

{}
```

→ **200** `{ "result": "confirmed", "image": { "id": 881, "status": "uploaded", ... }, "item_version": 1844 }` — grave `version = 1844`. Repita os 3 passos para a 2ª e a 3ª foto.

### 10.3 Edição com versão → conflito 409 → recuperação

O aparelho conhece `version 1844` e o técnico muda a localização. Enquanto isso, a web mudou a descrição (versão atual 1902).

```http
PUT /mobile/projects/97/items/1730736000123456
Content-Type: application/json

{ "base_version": 1844, "location_text": "SALA 2" }
```

→ **409**

```json
{
  "code": "VERSION_CONFLICT",
  "message": "O item mudou no servidor. Baixe a versão atual e reaplique a alteração.",
  "details": { "item": { "external_item_id": "1730736000123456", "version": 1902, "location_text": "RECEPÇÃO", "description": "CADEIRA GIRATÓRIA PRETA", "...": "..." } }
}
```

O técnico alterou só `location_text`, que não mudou no servidor. O app reaplica sobre a versão nova:

```http
PUT /mobile/projects/97/items/1730736000123456
Content-Type: application/json

{ "base_version": 1902, "location_text": "SALA 2" }
```

→ **200** `{ "result": "updated", "item": { "version": 1903, "location_text": "SALA 2", "description": "CADEIRA GIRATÓRIA PRETA", ... } }`

### 10.4 Exclusão offline → envio posterior → sincronização

Sem rede, o técnico exclui o item `1730736000999999` (versão conhecida 1901). O app marca como excluído e enfileira. Com rede:

```http
DELETE /mobile/projects/97/items/1730736000999999?base_version=1901
Authorization: Bearer <access_token>
```

→ **200** `{ "result": "deleted", "item": { "deleted": true, "status": "inactive", "version": 1910, ... } }`

Se a mesma exclusão for reenviada: **200** `already_deleted`. Se o item nunca tivesse sido enviado: **404 `ITEM_NOT_FOUND`** (também concluído). Na próxima sincronização, o item vem com `"deleted": true` e `"version": 1910`.

### 10.5 Sincronização paginada com cursor

```http
GET /mobile/projects/97/items/sync?limit=200
Authorization: Bearer <access_token>
```

→ `{ "items": [ ...200 itens... ], "next_cursor": "eyJ2IjoxLCJwIjo5NywicyI6MTIwMCwiaSI6NDQwMH0", "has_more": true, "server_time": "..." }`

Aplica os 200 itens, grava o cursor e continua:

```http
GET /mobile/projects/97/items/sync?limit=200&cursor=eyJ2IjoxLCJwIjo5NywicyI6MTIwMCwiaSI6NDQwMH0
```

→ `{ "items": [ ...37 itens... ], "next_cursor": "eyJ2IjoxLCJwIjo5NywicyI6MTkxMCwiaSI6NTEwMH0", "has_more": false, ... }`

Grava o último cursor. Na próxima sincronização, comece dele: virão só os itens alterados depois. Se a conexão cair na segunda página, repita com o cursor da primeira.

### 10.6 Placas duplicadas e faltantes

```http
GET /mobile/projects/97/plates/check?plate=251&kind=new&exclude_external_id=1730736000123456
Authorization: Bearer <access_token>
```

→ `{ "plate": "251", "kind": "new", "exists": true, "matches": [ { "external_item_id": "1730736000999999", "technician": { "name": "Maria Souza", ... }, "matched_fields": ["new_plate"], ... } ] }`

```http
GET /mobile/projects/97/plates/report
Authorization: Bearer <access_token>
```

→ ver [6.2](#62-pendências-placas-faltantes-e-duplicadas) (`missing_new_plates.ranges`, `duplicated_new_plates`, `duplicated_old_plates`).

### 10.7 Despesa com comprovante

```http
POST /mobile/projects/97/expenses
Authorization: Bearer <access_token>
Content-Type: application/json

{ "client_expense_id": "exp-1730736000123456", "description": "Combustível", "reason": "Deslocamento", "expense_date": "2026-11-08", "amount": "120.50" }
```

→ **201** `{ "result": "created", "expense": { "id": 731, "status": "pending", ... } }` (reenvio: **200** `existing`, mesmo `id`).

```http
POST /mobile/projects/97/expenses/731/attachments/upload-url
Content-Type: application/json

{ "original_name": "nota.jpg", "mime_type": "image/jpeg", "size_bytes": 183402 }
```

→ **201** `{ "attachment": { "id": 55, "status": "pending_upload", ... }, "upload_url": "...", "upload_headers": {...}, "expires_in_seconds": 300 }` → `PUT upload_url` → 

```http
POST /mobile/projects/97/expenses/731/attachments/55/confirm-upload
Content-Type: application/json

{}
```

→ **200** `{ "result": "confirmed", "attachment": { "id": 55, "status": "uploaded", ... } }`

### 10.8 Reconciliação completa

```http
POST /mobile/projects/97/import-sessions
Content-Type: application/json

{ "unidade": "SEDE", "expected_payloads": 2 }
```

→ **201** `{ "session_uuid": "8f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b", "status": "open", "expected_payloads": 2, "pending_payloads": 2, ... }`

Fotos (uma por chamada):

```http
POST /mobile/projects/97/import-sessions/8f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b/files/upload-url
Content-Type: application/json

{ "type": "image", "original_name": "foto_1.jpg", "mime_type": "image/jpeg", "size_bytes": 201544 }
```

→ **201** `{ "file_id": 4410, "status": "pending_upload", "upload_url": "...", ... }` → `PUT` → `POST .../files/4410/confirm-upload {}` → **200** `{ "file_id": 4410, "status": "uploaded", ... }`

Backup (opcional): mesmo fluxo com `{ "type": "raw_backup", "original_name": "backup.zip", "mime_type": "application/zip", "size_bytes": 73400320 }` (janela de 1800 s).

Lotes:

```http
POST /mobile/projects/97/import-sessions/8f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b/payloads
Content-Type: application/json

{
  "payload_number": 1,
  "idempotency_key": "rec-8f1c2b3a-p1",
  "items": [
    { "operation": "upsert", "external_item_id": "1730736000123456", "new_plate": "251", "unit_text": "SEDE", "description": "CADEIRA", "images": [{ "file_id": 4410 }] },
    { "operation": "upsert", "external_item_id": "1730736000555555", "new_plate": "252", "unit_text": "SEDE", "images": [{ "file_id": 4411 }] }
  ]
}
```

→ **201** `{ "payload_number": 1, "status": "partially_processed", "items_count": 2, "created_count": 1, "updated_count": 0, "deleted_count": 0, "failed_count": 1 }` (a foto 4411 não tinha sido confirmada). O lote 2 segue igual, com `payload_number: 2` e outra chave.

```http
POST /mobile/projects/97/import-sessions/8f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b/finish
```

→ **200** `{ "status": "finished_with_errors", "received_payloads": 2, "processed_payloads": 2, "success_items": 3, "failed_items": 1, "backup_uploaded": true, "finished_at": "...", ... }`

```http
GET /mobile/projects/97/import-sessions/8f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b/errors
```

→ `{ "items": [ { "payload_number": 1, "row_number": 2, "item_id": "1730736000555555", "error_code": "...", "error_message": "image file not uploaded and confirmed in this session" } ], "page": 1, "page_size": 100, "total_items": 1, "total_pages": 1 }`

Para corrigir, abra nova sessão (a atual está encerrada) ou envie o item pelo `PUT` normal.

## 11. Rotas descontinuadas e recursos pendentes

### 11.1 Rotas legadas sem equivalente direto

| Rota legada | Situação no GAI |
|---|---|
| `GET /gai/projects` | Substituída por `GET /mobile/me` (`projects[]`). |
| `POST /gai/item/create`, `POST /gai/item/update` | Descontinuadas (já não eram usadas desde a 1.4.6). Use o `PUT` de item. |
| `POST /gai/update_items` | Substituída pela sincronização por cursor. |
| `POST /gai/import-sessions/{uuid}/backup` | Substituída pelo upload de arquivo `raw_backup` em 3 passos. |
| `POST …/images/presign` (lote de até 100) | Substituída por `files/upload-url` (um arquivo por chamada) + confirmação obrigatória. |
| `GET /external/projects/{id}/items/sync` | Substituída pela sincronização por cursor do item. |

As rotas legadas continuam no Laravel e **não** são replicadas no GAI: cada versão do app aponta para uma única base.

### 11.2 Recursos ainda não implementados

| Recurso | Situação | Alternativa até lá |
|---|---|---|
| Nomes de `extra_fields` por projeto (legado em `GET /gai/projects`) | Não existe cadastro por projeto no GAI | Derivar os nomes dos itens sincronizados do projeto; o técnico pode adicionar nomes novos |
| Renomear unidade/localização em lote | Sem rota mobile | Renomear item a item com `PUT` (cada item gera nova versão) ou pela web |
| Upload de logs de diagnóstico do app | Sem rota | Manter o envio manual atual |
| Reprocessar lote preso da reconciliação | Só pela web (gestor) | Reenviar o lote (idempotente) depois do reprocessamento |
| Editar itens sem `external_item_id` (criados na web/legado) | Não suportado pela API mobile | Somente leitura no app |
| Filtro por unidade e `updated_since` na sincronização | Não existe | Filtrar localmente |

### 11.3 Pendências de ambiente (não dependem do app)

- Publicar o módulo mobile na AWS. Hoje as rotas `/mobile/*` caem no fallback da SPA (200 `text/html`). Ver [Ambientes](#ambientes).
- Homologação do app na AWS (CloudFront, ALB, RDS, S3) **não realizada**. Tempos medidos são de ambiente local.
- Já confirmado em 10/11/2026: erros 4xx de rotas existentes chegam como JSON com o status real (401 em `/auth/me`, 400 em `/auth/login`). Rotas inexistentes recebem 200 `text/html` do fallback da SPA.
- Aparelhos atrás do mesmo IP (CGNAT, Wi-Fi do cliente) dividem o limite de 100 requisições/min; o valor será ajustado com dados da homologação. O backoff em 429 é obrigatório.
- Backup de 100 MiB em rede móvel real: confirmar que cabe na janela de 30 min.

## 12. Referência de códigos de erro

| HTTP | `code` | Onde | Ação |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Qualquer rota | Corrigir o envio; não repetir igual |
| 400 | `INVALID_CURSOR` | sync | Apagar cursor e recomeçar |
| 400 | `PLATE_RANGE_INVALID` | plates/report | Ajustar `from`/`to` |
| 400 | `STORAGE_INVALID_SIZE`, `STORAGE_UNSUPPORTED_MIME` | upload-url | Corrigir arquivo |
| 400 | `INVALID_IMPORT_FILE`, `INVALID_IMAGE_FILE` | reconciliação | Corrigir arquivo / `file_id` |
| 401 | `UNAUTHORIZED` | Rotas com Bearer, login | Refresh; se falhar, login |
| 401 | `INVALID_REFRESH_TOKEN`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `REFRESH_TOKEN_REUSED` | refresh | Login (manter fila) |
| 403 | `MOBILE_ACCESS_DENIED` | login, refresh, todas | “Acesso suspenso” |
| 403 | `PASSWORD_CHANGE_REQUIRED` | todas `/mobile` | Troca de senha |
| 403 | `FORBIDDEN`, `PROJECT_NOT_AUTHORIZED` | rotas de projeto | Sem permissão ou vínculo; atualizar `/mobile/me` |
| 404 | `ITEM_NOT_FOUND` | itens, fotos | Em `DELETE`: concluído. Em fotos: enviar o item antes |
| 404 | `NOT_FOUND`, `STORAGE_OBJECT_NOT_FOUND` | despesas, sessões, confirmação | Conferir ids / refazer o PUT |
| 409 | `VERSION_CONFLICT`, `ITEM_DELETED` | itens | Resolver conflito |
| 409 | `PROJECT_STATUS_BLOCKS_OPERATION` | escritas | Erro definitivo |
| 409 | `REFRESH_TOKEN_ALREADY_ROTATED` | refresh | Usar o par da outra requisição |
| 409 | `STORAGE_SIZE_MISMATCH`, `STORAGE_MIME_MISMATCH`, `STORAGE_CHECKSUM_MISMATCH`, `STORAGE_CONTENT_MISMATCH` | confirmações | Recomeçar o upload com o arquivo correto |
| 409 | `CONFLICT` | fotos (limite de 3), despesas, finish | Ver rota |
| 409 | `IDEMPOTENCY_KEY_REUSED`, `REQUEST_IN_PROGRESS`, `FIELD_AGENT_INELIGIBLE` | despesas | Ver [7.1](#71-registrar-despesa) |
| 409 | `PAYLOAD_IDEMPOTENCY_CONFLICT`, `IMPORT_PAYLOAD_PROCESSING`, `IMPORT_SESSION_TERMINAL`, `IMPORT_SESSION_EXPIRED` | reconciliação | Ver [8.3](#83-enviar-lote-de-itens) e [8.4](#84-encerrar-sessão) |
| 410 | `STORAGE_UPLOAD_EXPIRED` | confirmações | Pedir nova URL |
| 423 | `ACCOUNT_LOCKED` | login, refresh | Aguardar o desbloqueio |
| 429 | `TOO_MANY_REQUESTS` | todas | Backoff |
| 500 | `INTERNAL_ERROR` | todas | Backoff; reportar se persistir |
| 503 | `STORAGE_UNAVAILABLE` | confirmações, URLs | Backoff |
