# Arquitetura — reformulação de usuários

Implementação local em 02/11/2026, mantendo a rastreabilidade do [diagnóstico original](../avaliacao-cadastro-usuarios-2026-11-02/README.md). Os timestamps das evidências usam UTC; a data deste relatório considera America/Sao_Paulo.

## Organização

Foram preservados Nest, TypeORM, MySQL, React, React Router, React Query, React Hook Form e os componentes/tokens visuais existentes. Não há novo provedor de autenticação, banco paralelo ou biblioteca de produção adicionada.

`CreateUserUseCase` e `UpdateUserUseCase` delegam a `UserLifecycleService`, seguindo o padrão de serviços de aplicação com DataSource já utilizado por `AccessProfilesService`. As transações utilizam as entidades e os repositórios TypeORM existentes. Listagem e consulta continuam utilizando as portas de gerenciamento de usuários.

`CredentialTransactionsService` coordena autenticação, contadores, sessões e tokens com transações. As fachadas de login e recuperação delegam as respectivas operações a esse serviço. A senha passa pela única política `Password.create()` antes do hash. O resolvedor de permissões e os guards existentes foram mantidos.

`rotateCredential(manager, ...)` concentra a gravação da nova credencial, data, versão e revogação de sessões/tokens. O serviço de credenciais e o comando operacional `ensure-platform-admin.ts` compartilham essa operação. O comando foi ajustado no código para validar novas senhas, exigir troca inicial e transacionar conta, concessão e auditoria; não foi executado nesta tarefa. Seu parâmetro explícito `--reset-password` continua sendo uma operação administrativa de provisionamento.

A substituição de perfis foi extraída para `replaceUserRoles(manager, ...)`, compartilhada entre a API de atribuições e o cadastro/edição. Não é executada uma segunda transação independente durante o cadastro. Uma falha no perfil reverte usuário, vínculos e auditoria da operação.

## Rotas de interface

| Rota | Finalidade |
| --- | --- |
| `/app/users` | Listagem com busca, filtros, ordenação, paginação e menu de ações |
| `/app/users/new` | Cadastro completo em página dedicada |
| `/app/users/:id` | Detalhes da conta |
| `/app/users/:id/edit` | Edição compartilhando o mesmo formulário |
| `/app/change-password` | Troca voluntária ou obrigatória da senha temporária |
| `/activate-account#token=...` | Ativação pública por convite; fragmento removido do endereço após leitura |

As rotas administrativas usam `ProtectedRoute` e a política administrativa já existente. O Operador continua sem gestão de identidades, inclusive quando possui a chave isolada `users:read`.

## API

Prefixo: `/api/v1`. Gerenciamento de usuários exige sessão, perfil `PLATFORM_ADMIN` ou `ORG_ADMIN` e a permissão existente `users:read`/`users:write`, conforme a operação. Não foram inventadas permissões que não existem no catálogo.

| Método e endpoint | Comportamento |
| --- | --- |
| `GET /users` | Busca por nome/login/e-mail; filtros de organização, perfil e estado; ordenação com lista permitida |
| `GET /users/form-options` | Disponibilidade de convite e parâmetros da política de credenciais |
| `POST /users` | Identificação, organização, perfis e modo de ativação na mesma operação |
| `GET /users/:id` | Dados de identificação e vínculos efetivos; sem hash ou senha |
| `PATCH /users/:id` | Alterações parciais de identificação, organização e perfis; não aceita senha |
| `POST /users/:id/password-reset` | Senha temporária administrativa, com revogação e troca obrigatória |
| `POST /users/:id/block` | Bloqueio administrativo |
| `POST /users/:id/unblock` | Liberação de bloqueio e limpeza do contador |
| `POST /users/:id/deactivate` | Desativação preservando histórico |
| `POST /users/:id/activate` | Reativação elegível; não contorna convite pendente |
| `POST /users/:id/invitation/resend` | Novo convite, invalidando o anterior |
| `POST /auth/password/change` | Troca autenticada, verificando a senha atual |
| `POST /auth/activation/confirm` | Consumo público de convite e definição da senha |
| `POST /auth/password-reset/request` | Resposta pública genérica para contas existentes ou ausentes |
| `POST /auth/password-reset/confirm` | Consumo transacional do token de recuperação |

As APIs existentes de perfis, atribuições, login, logout e consulta de sessão continuam disponíveis. O contrato estático de criação/edição e a documentação Swagger foram atualizados. Clientes antigos que enviam somente login/e-mail/senha ao cadastro precisam adotar o novo contrato; o PATCH de senha foi substituído pela ação específica.

## Dados e migration

Migration: `ReformUserLifecycle1794100000002`.

| Tabela | Alteração |
| --- | --- |
| `users` | `full_name` nullable (160), `phone` nullable (30), `job_title` nullable (120), `last_login_at` nullable |
| `users` | `must_change_password` com padrão falso, `temporary_password_expires_at` nullable e `auth_version` com padrão zero |
| `users` | Estados adicionais `PENDING_ACTIVATION` e `BLOCKED`; índice de nome e restrições dos espaços de login/e-mail |
| `sessions` | `auth_version` com padrão zero |
| `password_reset_tokens` | `purpose`, padrão `PASSWORD_RESET`, com uso adicional `INVITATION` |

Novos cadastros exigem nome completo e pelo menos um perfil. Dados pessoais desconhecidos dos usuários existentes permanecem nulos. Nenhum CPF foi adicionado e nenhum vínculo obrigatório com funcionários foi criado.

`organization_id = NULL` mantém o significado existente de conta da plataforma. Isso é apresentado como uma escolha explícita da plataforma; para usuários organizacionais a organização é obrigatória e limitada ao escopo do ator. A migration não cria administrador para a organização 2.

A unicidade por coluna já existente foi preservada. Login sem `@` e e-mail com `@` formam espaços distintos, protegidos também por CHECKs MySQL. A preflight interrompe a migration antes do DDL se houver identidades legadas incompatíveis; não renomeia contas. Os três logins locais são compatíveis.

O DDL MySQL é aditivo e a reversão é deliberadamente bloqueada para evitar descarte de dados pessoais e estados novos. Uma eventual reversão exige uma migration futura revisada. Falhas de infraestrutura durante DDL devem ser inspecionadas antes de nova execução; não se deve presumir rollback automático de DDL MySQL.

## Concorrência e integridade

- A trava administrativa existente continua protegendo concessões, revogações e a manutenção do último administrador. Os novos fluxos conferem novamente a elegibilidade administrativa do ator dentro da transação.
- Alterações de senha, autenticação e uso de tokens bloqueiam a linha do usuário em MySQL. O consumo de token verifica novamente propósito, uso, prazo e situação da conta após obter a trava.
- Autenticação e redefinição não gravam cópias antigas do estado fora da transação; isso evita perda de contadores e restauração de hashes anteriores.
- SQLite usa uma fila por DataSource para transações de identidade, pois possui uma conexão no helper de testes. MySQL utiliza transações independentes e travas reais, sem essa fila.
- Troca de organização exige autoridade de plataforma e seleção dos perfis compatíveis; dados, concessões e revogações são confirmados ou revertidos juntos. Sessões e tokens anteriores são invalidados na transferência.
- A edição envia apenas campos alterados. Logins legados não são normalizados silenciosamente ao editar outro dado, e nomes desconhecidos não são preenchidos artificialmente.

## Configuração e preservação local

Convites reutilizam o `EmailSender` existente: SES quando configurado, caixa simulada em memória no desenvolvimento. A interface usa senha temporária por padrão quando o e-mail é simulado. A caixa simulada não expõe tokens por HTTP nem os imprime em logs.

Parâmetros: `INVITATION_TTL_HOURS` (48), `TEMPORARY_PASSWORD_TTL_HOURS` (24), `FRONTEND_URL`, `USE_MOCK_EMAIL`, `SES_FROM_EMAIL` e `AWS_REGION`. Configure o frontend de destino e remetente/credenciais SES no ambiente autorizado antes de usar entrega real.

O bootstrap de desenvolvimento foi restringido a ambiente explicitamente permitido e banco em loopback. Novas contas exigem senhas fornecidas no ambiente e validadas pela política comum. Contas existentes não têm senha substituída nem perfis reaplicados automaticamente. O bootstrap não foi executado nesta tarefa.

O [wrapper local](../../scripts/users-migrate-local.cjs) recusa migrations pendentes alheias à tarefa, executa o runner oficial e compara os dados anteriores. [Evidência da aplicação](./checks/local-migration.json) e [reexecução sem mudanças](./checks/local-migration-idempotent.json) confirmam 35 migrations e preservação de usuários, organizações, perfis, permissões e vínculos.

## Arquivos

A relação dos arquivos TypeScript envolvidos está em [files.json](./files.json). Os novos arquivos incluem o serviço transacional de credenciais, serviço de ciclo de vida, normalizadores/DTOs, migration, formulário compartilhado, ações, seleção organizacional, páginas de credenciais e testes. Também foram adicionados os harnesses de banco/navegador e os scripts de evidência deste diretório.

Arquivos complementares: `gai-backend/.env.example`, `gai-backend/specs/003-users-roles-permissions/contracts/users-api.yaml`, `gai-backend/test/users-browser-api.cjs`, `scripts/users-migrate-local.cjs`, `run-checks.cjs`, `migration-disposable.cjs` e `verify-local-users.cjs` deste diretório. O `.env` real não foi alterado. O diretório de trabalho já continha alterações de outros módulos; elas foram preservadas, sem revertê-las ou incluí-las em commit.
