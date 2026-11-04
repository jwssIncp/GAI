# Reformulação de Perfis e acessos — 02/11/2026

Implementação local, sem commit, push, deploy ou acesso a produção. O relatório de diagnóstico em `docs/relatorio-perfis-acessos-2026-11-02/relatorio.md` orientou a revisão. Alterações anteriores existentes no workspace foram preservadas.

## Diagnóstico anterior

A tela carregava e exibia o catálogo completo, mas não integrava atribuição ou revogação. O bootstrap não criava `ORG_USER`. As rotas administrativas exigiam permissões RBAC **e** um perfil administrativo de sistema, enquanto a navegação considerava apenas as permissões. Isso fazia o Operador enxergar funcionalidades que o backend recusava. A proteção ao último administrador era restrita à plataforma e não compartilhava uma transação com a gravação. A atualização de um perfil por `PATCH is_active=false` também contornava a verificação de vínculos aplicada por `DELETE`.

## Nova experiência

O catálogo técnico saiu da tela principal. Cards apresentam nome, descrição, tipo, quantidade de usuários, resumo de acesso, detalhes e atribuição. São usados os componentes, cores, fontes e tokens de tema existentes, sem alterar o CSS global.

O formulário de atribuição pesquisa usuários por login/nome de usuário ou e-mail, com paginação no servidor e isolamento do contexto selecionado. Mostra o resumo do perfil e exige ciência explícita para conceder privilégios administrativos. O modelo de usuários atual não possui um campo separado de nome civil.

Os detalhes mostram usuários vinculados e permitem abrir o mesmo gerenciador utilizado a partir de **Usuários → Gerenciar perfis**. Esse gerenciador lista os perfis efetivos, adiciona outro, revoga com confirmação ou substitui o conjunto por uma operação atômica. A interface explica que os acessos se somam e que revogar um perfil pode não retirar uma permissão concedida por outro.

Perfis personalizados possuem formulário secundário para nome, descrição e seleção de permissões existentes, agrupadas por área, com pesquisa. A exclusão usa a desativação lógica existente e preserva histórico. Perfis vinculados precisam ter seus vínculos revogados antes da desativação. Perfis de sistema não são editáveis.

A gestão de usuários também ganhou edição de e-mail/senha e ativação/desativação com feedback de erro. O cadastro organizacional não solicita mais o ID da própria organização; o backend continua determinando esse vínculo. Após criar um usuário, o administrador concede os perfis pelo gerenciador compartilhado.

## Perfis por administrador

| Administrador e contexto | Perfis concedíveis |
| --- | --- |
| ORG_ADMIN | ORG_ADMIN, ORG_USER e perfis personalizados ativos da própria organização |
| PLATFORM_ADMIN / Plataforma | PLATFORM_ADMIN, para usuários sem organização |
| PLATFORM_ADMIN / organização selecionada | ORG_ADMIN, ORG_USER e perfis personalizados ativos daquela organização |

O seletor de organizações é exclusivo da plataforma e possui pesquisa/paginação. A lista vem da API, sem perfis fictícios. As funções globais continuam disponíveis ao retornar ao contexto Plataforma, e a API global de permissões foi preservada para PLATFORM_ADMIN.

## Backend e segurança

- `GET /api/v1/access-profiles?organization_id=...` devolve somente os perfis concedíveis, com resumos e contagens por contexto, sem catálogo de permissões.
- `GET /api/v1/users?role_id=...` permite consultar os usuários vinculados. Os filtros consideram vínculos ativos, não revogados, perfis ativos e compatibilidade de organização. Pesquisa e paginação são executadas no backend.
- POST/DELETE de atribuições existentes continuam sendo utilizados. `PUT /api/v1/users/:userId/role-assignments` substitui o conjunto completo e valida todas as concessões e revogações antes da gravação. IDs duplicados, inválidos, inativos ou fora do escopo são recusados.
- Atribuições idempotentes são verificadas dentro da transação. Duas requisições concorrentes não criam vínculos ativos duplicados.
- Autenticação por sessão, perfil administrativo, permissões necessárias, organização do ator, organização do destinatário e escopo do perfil são verificados no backend. O escopo do destinatário é conferido novamente dentro da transação. Organizações inativas não podem receber novas concessões.
- ORG_ADMIN não recebe PLATFORM_ADMIN nem permissões exclusivas da plataforma. `/permissions`, inclusive com `scope=PLATFORM` manipulado, retorna apenas permissões organizacionais a esse ator. Criação/edição de perfis mantém a validação organizacional já existente.
- A mesma trava InnoDB protege atribuição, revogação, substituição, desativação de perfis e alterações de usuários. A remoção do último ORG_ADMIN ativo é verificada por organização, dentro da transação. A proteção também cobre desativação e transferência de organização, e mantém a proteção da plataforma.
- A trava utiliza as linhas dos perfis de sistema, em ordem estável. É uma estratégia conservadora que serializa operações administrativas entre organizações; não serializa consultas normais dos módulos. Uma futura otimização deve preservar a proteção entre operações diferentes.
- A desativação de perfis por PATCH e DELETE passa a conferir vínculos dentro da gravação transacional. Nenhuma permissão cadastrada é removida por essas correções.

O backend já recalculava perfis e permissões em cada requisição autenticada, sem fixá-los no token. Esse comportamento foi mantido e testado com uma sessão aberta antes da concessão/revogação. A interface invalida as consultas após alterações, restaura os próprios acessos quando necessário e atualiza os dados da sessão ao recuperar foco ou a cada 60 segundos enquanto visível. Uma falha de rede não concede acesso: a API continua sendo a autoridade.

## ORG_USER e preservação do banco local

Não foi encontrada definição oficial de permissões básicas além da enumeração e da resolução de vínculos explícitos. Portanto, o perfil foi criado **sem permissões e sem atribuições automáticas**.

A migration aditiva `EnsureOrgUserRole1794100000001` e o bootstrap passaram a cadastrar o perfil. A migration não altera registros existentes e sua reversão preserva o perfil, pois ele pode já ter usuários vinculados.

Foi executado o runner oficial TypeORM, por meio de um wrapper que exige `NODE_ENV=local`, endereço loopback e ausência de migrations pendentes alheias à tarefa. Destino verificado: `localhost:3306/gai`. O processo foi repetido sem criar registros duplicados. A verificação final encontrou **34 migrations aplicadas, nenhuma pendente**.

| Registro local | Antes | Depois |
| --- | ---: | ---: |
| Perfis | 3 | 4 |
| Permissões | 161 | 161 |
| Vínculos perfil–permissão | 1 | 1 |
| Vínculos usuário–perfil | 3 | 3 |
| Usuários | 3 | 3 |
| Organizações | 2 | 2 |

`ORG_USER`: ID **4**, tipo SYSTEM, organização nula, ativo, **0 permissões**. O wrapper comparou integralmente as linhas anteriores das tabelas de acesso, além dos IDs/vínculos organizacionais de usuários. Nenhum perfil, permissão ou vínculo local anterior foi alterado. Não foram provisionados novos administradores para organizações que já estavam sem usuários.

## Tratamento do Operador

Foi preservado o requisito administrativo das rotas de usuários e perfis. Uma permissão isolada `users:read` não confere gerenciamento de identidades ou acessos. A navegação e as rotas protegidas do frontend agora respeitam esse requisito adicional, e o editor de perfis o explica.

O Operador local continua com a mesma permissão `users:read`, sem permissões adicionais. Os testes confirmam a recusa de acesso às rotas administrativas sem o perfil de sistema adequado.

## Validação e evidências

Os registros estruturados em [checks](./checks/) contêm os códigos de saída, durações e logs por etapa. A [evidência da migration local](./checks/local-migration.json) e a [reexecução idempotente](./checks/local-migration-idempotent.json) registram o cadastro e a preservação dos dados. O executor [run-checks.cjs](./run-checks.cjs) permite reproduzir os grupos `backend`, `frontend`, `mysql` e `browser`.

| Verificação | Resultado verificado |
| --- | --- |
| Backend: lint dos arquivos envolvidos e build Nest | Código 0 |
| Backend: autenticação e usuários, testes unitários | 58 aprovados |
| Backend: integração de usuários, isolamento RBAC e invalidação de sessão em SQLite | 37 aprovados, 1 cenário exclusivo de MySQL ignorado |
| MySQL 8: nova suíte de segurança | 11 aprovados, incluindo concorrência real |
| Frontend: lint, TypeScript e build Vite | Código 0 |
| Frontend: suíte completa Vitest | 307 aprovados |
| Navegador Chromium, API real temporária | 10 aprovados |

A suíte cobre listagem concedível, isolamento de perfis/usuários, bloqueio da plataforma, atribuição inválida e idempotente, revogação autorizada/não autorizada, permissões cumulativas, substituição, proteção administrativa, organização inativa, regularização idempotente e atualização de uma sessão existente. A concorrência MySQL disputa a revogação de um administrador com a desativação do outro: somente uma operação pode retirar o respectivo administrador.

No navegador foram verificados os botões, ciclo completo do perfil personalizado, integração com usuários, confirmação administrativa, bloqueio do último administrador com erro visível, teclado, fechamento por Escape, pesquisa, três larguras e ambos os temas. Estados de carregamento, vazio, erro e nova tentativa também possuem testes de componentes.

Os testes de banco usam exclusivamente MySQL descartável na porta **33347** e SQLite em memória. Os testes de navegador usam API temporária em memória na porta **33429** e frontend na **5342**. As capturas usam dados sintéticos equivalentes aos perfis auditados; não são capturas de produção. O MySQL descartável não possui volume persistente e foi encerrado/removido após a validação. O banco de desenvolvimento foi preservado.

Capturas da tela principal: [desktop claro](./screenshots/desktop-light.png), [desktop escuro](./screenshots/desktop-dark.png), [tablet claro](./screenshots/tablet-light.png), [tablet escuro](./screenshots/tablet-dark.png), [mobile claro](./screenshots/mobile-light.png), [mobile escuro](./screenshots/mobile-dark.png). Os formulários de atribuição também estão registrados na pasta [screenshots](./screenshots/).

## Arquivos alterados e criados

Caminhos relativos à raiz do repositório. Esta relação inclui apenas os arquivos desta implementação, sem atribuir à tarefa as demais alterações anteriores do workspace.

**Backend — novos:**

- `gai-backend/src/migrations/1794100000001-ensure-org-user-role.ts`
- `gai-backend/src/modules/users/application/services/access-profiles.service.ts`
- `gai-backend/src/modules/users/application/dto/replace-user-roles.dto.ts`
- `gai-backend/src/modules/users/infrastructure/persistence/access-administration-lock.ts`
- `gai-backend/src/modules/users/presentation/access-profiles.controller.ts`
- `gai-backend/test/integration/users/access-profiles.e2e-spec.ts`
- `gai-backend/test/profiles-browser-api.cjs`
- `scripts/profiles-migrate-local.cjs`

**Backend — modificados:**

- `gai-backend/src/scripts/seed/bootstrap.ts`
- `gai-backend/src/modules/users/application/dto/list-users-query.dto.ts`
- `gai-backend/src/modules/users/application/use-cases/assign-user-role.use-case.ts`
- `gai-backend/src/modules/users/application/use-cases/revoke-user-role-assignment.use-case.ts`
- `gai-backend/src/modules/users/application/use-cases/deactivate-user.use-case.ts`
- `gai-backend/src/modules/users/application/use-cases/list-users.use-case.ts`
- `gai-backend/src/modules/users/domain/ports/user-management.repository.port.ts`
- `gai-backend/src/modules/users/domain/ports/user-role-assignment.repository.port.ts`
- `gai-backend/src/modules/users/infrastructure/persistence/typeorm-user-management.repository.ts`
- `gai-backend/src/modules/users/infrastructure/persistence/typeorm-user-role-assignment.repository.ts`
- `gai-backend/src/modules/users/infrastructure/persistence/typeorm-org-role.repository.ts`
- `gai-backend/src/modules/users/presentation/permissions.controller.ts`
- `gai-backend/src/modules/users/presentation/user-role-assignments.controller.ts`
- `gai-backend/src/modules/users/users.module.ts`
- `gai-backend/test/unit/modules/users/assign-user-role.use-case.spec.ts`
- `gai-backend/test/unit/modules/users/revoke-user-role-assignment.use-case.spec.ts`
- `gai-backend/test/unit/modules/users/deactivate-user.use-case.spec.ts`

**Frontend — novos:**

- `gai-frontend/src/features/roles/accessProfiles.ts`
- `gai-frontend/src/features/roles/ProfileUserDialog.tsx`
- `gai-frontend/src/features/roles/CustomRoleDialog.tsx`
- `gai-frontend/src/features/roles/RolesPage.test.tsx`
- `gai-frontend/e2e/profiles.spec.ts`
- `gai-frontend/vite.profiles.config.ts`
- `gai-frontend/playwright.profiles.config.ts`

**Frontend — modificados:**

- `gai-frontend/src/features/roles/RolesPage.tsx`
- `gai-frontend/src/features/users/UsersPage.tsx`
- `gai-frontend/src/features/auth/permissions.ts`
- `gai-frontend/src/features/auth/permissions.test.ts`
- `gai-frontend/src/features/auth/AuthProvider.tsx`
- `gai-frontend/src/api/endpoints.ts`
- `gai-frontend/src/types/api.ts`

O build também atualiza os arquivos gerados de TypeScript já usados no projeto. O diretório deste relatório contém o executor, os resultados, o relatório Playwright, a evidência da migration e as capturas.

## Homologação e limites

1. Entrar como ORG_ADMIN e abrir Perfis e acessos. Confirmar ausência do catálogo técnico, presença de ORG_ADMIN/ORG_USER/Operador e ausência de PLATFORM_ADMIN.
2. Selecionar um usuário de teste autorizado da organização. Atribuir ORG_USER e conferir a indicação de que não possui permissões próprias. A atribuição não deve reduzir os acessos anteriores.
3. Atribuir um perfil personalizado e conferir a alteração tanto nos detalhes do perfil quanto em Usuários → Gerenciar perfis. Revogar e conferir novamente.
4. Homologar a concessão administrativa com um usuário sintético adicional e o aviso de ciência. Manter ao menos um administrador ativo. A tentativa de retirar o último deve resultar em conflito e manter a administração disponível.
5. Criar um perfil com acessos organizacionais, editar nome/descrição/acessos, conferir vínculos e excluí-lo quando estiver sem vínculos. A exclusão é lógica.
6. Como PLATFORM_ADMIN, alternar entre Plataforma e uma organização. Conferir isolamento dos cards e usuários e preservação das funções globais.
7. Conferir desktop, tablet e celular, temas claro/escuro, navegação por Tab e Escape. As capturas anexas servem como referência visual.

O build Vite mantém um aviso de bundle JavaScript acima de 500 kB; isso não impede o build e não foi ampliado para um trabalho de divisão de bundles. A validação automatizada de navegador foi feita em Chromium; Firefox, Safari e leitores de tela não foram certificados nesta tarefa. Perfis desativados ficam fora da lista concedível, e as rotas existentes da API continuam disponíveis para sua manutenção autorizada.

Para repetir os testes MySQL, disponibilize um servidor **descartável**, sem volume, em `127.0.0.1:33347`, banco `gai_validation_disposable`, com as credenciais sintéticas do helper. O runner recria exclusivamente esse schema de testes. Não apontar os testes ao banco local de desenvolvimento ou a produção. Para aplicar a regularização em outra instalação, revisar e executar o mecanismo oficial de migrations durante o processo autorizado daquele ambiente.
