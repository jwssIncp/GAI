# Feature Specification: Usuários, Papéis e Permissões com Autorização Desacoplada

**Feature Branch**: `003-users-roles-permissions`

**Created**: 2026-06-19

**Revised**: 2026-06-19

**Status**: Draft (revisão de modelo de dados)

**Input**: User description: "Adaptar a spec users-roles-permissions: a tabela de usuário deve armazenar apenas dados do usuário e vínculo com organization; regras de roles e permissions devem residir em tabelas separadas para melhor adaptação a cenários futuros."

**Repository Scope**: Este repositório é apenas o backend GAI. Requisitos de UI/frontend
DEVEM ser traduzidos em contratos de API; implementação de interface fica fora de escopo.

## Clarifications

### Session 2026-06-19 (modelo inicial)

- Q: Estratégia de migração de UUID → BIGINT? → A: Projeto em desenvolvimento inicial; migration destrutiva aceitável (drop/recreate tabelas afetadas). Sem dados de produção a preservar.
- Q: Tokens de sessão devem usar ID numérico? → A: Não. `sessions.id` permanece UUID opaco por segurança (tokens não sequenciais/guessáveis).
- Q: Como modelar permissões granulares? → A: Catálogo global de `permissions` + papéis customizados por organization. Administradores de organization têm acesso implícito total dentro da org; demais usuários dependem do papel atribuído.
- Q: Quem gerencia papéis customizados? → A: Administrador da própria organization. Administrador de plataforma pode gerenciar em qualquer org.

### Session 2026-06-19 (revisão — desacoplamento de autorização)

- Q: Onde ficam roles e permissions em relação ao usuário? → A: A entidade **User** armazena apenas dados de identidade, credenciais, status e `organization_id` (vínculo organizacional). Papéis e permissões efetivas são resolvidos via tabelas de atribuição (`user_role_assignments`) e catálogo de papéis (`roles` + `role_permissions`), nunca como colunas fixas na tabela de usuários.
- Q: Papéis de sistema (administrador de plataforma / administrador de organization) continuam existindo? → A: Sim, como registros no catálogo de papéis com tipo `SYSTEM`, atribuídos ao usuário na tabela de atribuições — não como enum na tabela `users`.
- Q: Um usuário pode ter mais de um papel? → A: Sim. O modelo de atribuições suporta múltiplos papéis simultâneos por usuário; a resolução de permissões considera a união das permissões de todos os papéis ativos atribuídos, respeitando escopo (plataforma vs organization).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar Usuário com Dados e Vínculo Organizacional (Priority: P1)

Como administrador de plataforma ou administrador de organization, quero cadastrar
usuários informando apenas dados pessoais/credenciais e a organization à qual pertencem,
sem embutir regras de acesso na ficha do usuário, para manter o cadastro simples e
evoluir autorização independentemente.

**Why this priority**: Separação entre identidade e autorização é a base do novo modelo;
sem cadastro limpo de usuários, atribuições de papéis não têm onde se apoiar.

**Independent Test**: Pode ser testado criando usuário com login, e-mail, senha e
`organization_id` válido, verificando que nenhum papel ou permissão fica gravado
diretamente na tabela de usuários.

**Acceptance Scenarios**:

1. **Given** administrador de plataforma autenticado, **When** cadastra usuário com
   `organization_id` nulo (usuário de plataforma) ou de qualquer organization,
   **Then** usuário é persistido apenas com dados de perfil e vínculo organizacional.
2. **Given** administrador de organization X autenticado, **When** cadastra usuário,
   **Then** usuário é criado automaticamente vinculado à organization X; não pode
   criar usuários em outras organizations.
3. **Given** dados inválidos (login/e-mail duplicado, senha fraca, organization
   inexistente), **When** tenta cadastrar, **Then** sistema rejeita com validação explícita.
4. **Given** usuário recém-criado sem atribuição de papel, **When** tenta acessar
   recurso protegido, **Then** acesso é negado até que um papel seja atribuído.

---

### User Story 2 - Atribuir e Gerenciar Papéis de Usuário (Priority: P2)

Como administrador autorizado, quero atribuir, consultar, atualizar e revogar papéis
de um usuário em tabelas dedicadas, para adaptar o acesso conforme cenários operacionais
sem alterar a ficha base do usuário.

**Why this priority**: Autorização flexível depende de atribuições explícitas; é o
principal ganho da refatoração solicitada.

**Independent Test**: Pode ser testado atribuindo papel de sistema e papel customizado
ao mesmo usuário e verificando que as atribuições persistem separadamente do registro
de usuário.

**Acceptance Scenarios**:

1. **Given** usuário ativo na organization X, **When** administrador atribui papel
   customizado "Auditor" da org X, **Then** atribuição é registrada em tabela de
   atribuições com escopo da organization.
2. **Given** usuário de plataforma, **When** administrador de plataforma atribui papel
   de sistema "administrador de plataforma", **Then** atribuição é registrada sem
   alterar colunas na tabela de usuários.
3. **Given** usuário com múltiplos papéis ativos, **When** revoga um deles,
   **Then** apenas essa atribuição é desativada; demais permanecem válidas.
4. **Given** administrador de organization, **When** tenta atribuir papel de sistema
   de plataforma ou papel de outra organization, **Then** operação é negada.
5. **Given** tentativa de atribuir papel customizado de org Y a usuário da org X,
   **Then** operação é negada por inconsistência de escopo.

---

### User Story 3 - Consultar e Gerenciar Usuários por Escopo (Priority: P3)

Como administrador de plataforma, quero listar todos os usuários com filtros.
Como administrador de organization, quero listar apenas usuários da minha organization,
incluindo seus papéis atribuídos quando consultados em detalhe.

**Why this priority**: Operação diária de suporte e gestão; depende do cadastro (P1)
e complementa atribuições (P2).

**Independent Test**: Pode ser testado listando com tokens de diferentes escopos e
verificando isolamento de tenant na listagem e no detalhe com papéis.

**Acceptance Scenarios**:

1. **Given** administrador de plataforma, **When** lista usuários com filtro por
   organization, **Then** retorna página paginada de qualquer organization.
2. **Given** administrador da organization 5, **When** lista usuários, **Then**
   retorna apenas usuários da organization 5.
3. **Given** consulta de detalhe de usuário no escopo permitido, **When** solicita
   ficha completa, **Then** resposta inclui papéis atribuídos agregados de tabelas
   de autorização, não da tabela de usuários.
4. **Given** usuário operacional sem permissão de gestão, **When** tenta listar
   usuários, **Then** acesso negado.

---

### User Story 4 - Catálogo de Papéis, Permissões e Papéis Customizados por Organization (Priority: P4)

Como administrador de organization, quero definir papéis customizados (ex.: Contador,
Auditor) com conjuntos de permissões do catálogo global, para controlar acesso
granular sem proliferar regras fixas no cadastro de usuários.

**Why this priority**: Flexibilidade para cenários futuros do patrimônio; administradores
cobrem gestão, mas operação exige granularidade configurável.

**Independent Test**: Pode ser testado criando papel "Auditor" com permissões de
leitura, atribuindo a um usuário e verificando acesso conforme matriz.

**Acceptance Scenarios**:

1. **Given** catálogo de permissões disponível, **When** administrador de organization
   cria papel customizado com subconjunto de permissões, **Then** papel fica
   disponível apenas na sua organization.
2. **Given** usuário com papel customizado atribuído, **When** acessa recurso com
   permissão concedida, **Then** operação permitida; sem permissão, **Then** acesso negado.
3. **Given** administrador de organization com papel de administração da org,
   **When** acessa recursos da própria organization, **Then** tem acesso implícito
   a todas as permissões de escopo organization (bypass da matriz do papel customizado).
4. **Given** administrador de plataforma, **When** gerencia papéis de qualquer
   organization, **Then** operação permitida.

---

### User Story 5 - Migrar Identificadores para Numerais Auto-Incremento (Priority: P5)

Como equipe de desenvolvimento e operações, quero que entidades principais usem
identificadores numéricos auto-incremento, para facilitar gestão, suporte, logs e
integrações sem expor sequência em tokens de sessão.

**Why this priority**: Já em andamento na feature; permanece necessário mas é
independente da separação identidade/autorização.

**Independent Test**: Pode ser testado executando migrations, seeds e operações
existentes com IDs numéricos nas respostas e FKs consistentes.

**Acceptance Scenarios**:

1. **Given** banco migrado, **When** cria organization, usuário ou atribuição de papel,
   **Then** o sistema retorna `id` numérico inteiro positivo auto-gerado.
2. **Given** entidades relacionadas, **When** consulta registros, **Then** FKs
   numéricas mantêm integridade referencial.
3. **Given** sessão autenticada, **When** token é emitido, **Then** identificador de
   sessão permanece opaco e não sequencial.

---

### Edge Cases

- Usuário ativo sem nenhum papel atribuído: acesso negado a recursos protegidos.
- Usuário com múltiplos papéis cuja união de permissões é conflitante: prevalece
  permissão mais ampla (união, não interseção).
- Desativação de organization com usuários e atribuições ativas vinculadas.
- Impedir revogação do último administrador de plataforma ativo no sistema.
- Desativação do único administrador de uma organization.
- Tentativa de atribuir papel customizado de outra organization ao usuário.
- Atualização concorrente de permissões de um papel com usuários ativos atribuídos.
- Desativação de papel customizado ainda atribuído a usuários (soft-disable do papel;
  atribuições existentes devem deixar de conceder permissões).
- Alteração de `organization_id` do usuário com papéis atribuídos incompatíveis com
  a nova organization.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A entidade **User** DEVE armazenar exclusivamente dados de identidade
  e autenticação (login, e-mail, credenciais, status, tentativas de bloqueio) e
  vínculo organizacional (`organization_id` opcional). NÃO DEVE conter colunas de
  papel de sistema nem referência direta a papel customizado.
- **FR-002**: O sistema DEVE manter catálogo de papéis (`roles`) com tipos distintos:
  papéis de **sistema** (ex.: administrador de plataforma, administrador de organization)
  e papéis **customizados por organization**.
- **FR-003**: O sistema DEVE manter tabela de atribuições (`user_role_assignments`)
  vinculando usuário a um ou mais papéis, com controle de ativação e escopo
  organizacional quando aplicável.
- **FR-004**: O sistema DEVE manter catálogo global de permissões (`resource:action`)
  com escopo `PLATFORM` ou `ORGANIZATION`.
- **FR-005**: O sistema DEVE associar permissões a papéis via tabela dedicada
  (`role_permissions`), independente da tabela de usuários.
- **FR-006**: Resolução de autorização DEVE agregar permissões de todos os papéis
  ativos atribuídos ao usuário; papéis de administração de plataforma e de organization
  mantêm bypass implícito conforme escopo definido nas clarificações.
- **FR-007**: O sistema DEVE permitir CRUD de usuários (criar, consultar, listar
  paginado, atualizar, desativar, reativar) com validação de domínio, sem gravar
  regras de acesso na ficha do usuário.
- **FR-008**: O sistema DEVE permitir atribuir, listar, atualizar e revogar papéis
  de usuários em endpoints ou operações dedicadas, separados do CRUD de perfil.
- **FR-009**: Administrador de plataforma DEVE gerenciar usuários e atribuições em
  qualquer organization e criar usuários sem organization (escopo plataforma).
- **FR-010**: Administrador de organization DEVE gerenciar usuários e atribuições
  apenas da própria organization; NÃO DEVE atribuir papéis de plataforma nem
  papéis de outras organizations.
- **FR-011**: O sistema DEVE permitir CRUD de papéis customizados por organization,
  cada um com conjunto de permissões da matriz.
- **FR-012**: O sistema DEVE expor listagem somente leitura do catálogo de permissões
  para montagem da matriz no cliente.
- **FR-013**: O sistema DEVE registrar auditoria em mutações de usuários, atribuições
  de papéis e papéis customizados (quem, quando, operação, alterações).
- **FR-014**: O sistema DEVE impedir revogação/desativação que deixe o sistema sem
  pelo menos um administrador de plataforma ativo.
- **FR-015**: O sistema DEVE validar unicidade de `login` e `email` globalmente.
- **FR-016**: Senhas de novos usuários DEVEM atender à política de segurança existente
  (mínimo 8 caracteres, complexidade).
- **FR-017**: O sistema DEVE migrar PKs e FKs de entidades de negócio para identificadores
  numéricos auto-incremento, mantendo token de sessão opaco.
- **FR-018**: Contratos de API DEVEM refletir usuário (perfil + organization) e
  papéis atribuídos como estruturas separadas nas respostas compostas.

### Non-Functional Requirements *(mandatory per constitution)*

- **NFR-001**: Feature MUST maintain ≥ 80% test coverage (unit + integration).
- **NFR-002**: List endpoints MUST use pagination; unbounded responses are prohibited.
- **NFR-003**: Data mutations MUST use transactions with audit trail.
- **NFR-004**: Domain validations MUST occur before persistence (Clean Code + SOLID).
- **NFR-005**: User list MUST return results within 3 seconds for 95% of paginated
  requests under normal load.
- **NFR-006**: Feature MUST NOT include frontend/UI; scope limited to backend API and jobs.
- **NFR-007**: Feature MUST support três ambientes isolados: local, homologação e produção.
- **NFR-008**: CRUD operations MUST emit structured JSON logs indexable in Kibana.
- **NFR-009**: CI pipeline MUST run lint, security audit, tests and coverage gate on every PR.
- **NFR-010**: Migration de schema DEVE ser documentada com plano de reset em dev
  (`docker compose down -v`) enquanto projeto não estiver em produção.

### Key Entities

- **User**: Identidade e credenciais; vínculo opcional com organization; status.
  Sem papel embutido.
- **Role**: Papel de sistema ou customizado por organization; nome único no escopo
  aplicável; flag de ativo.
- **Permission**: Entrada do catálogo global (`key`, `resource`, `action`, `scope`).
- **RolePermission**: Associação entre papel e permissões do catálogo.
- **UserRoleAssignment**: Vínculo usuário ↔ papel, com escopo, status ativo e metadados
  de atribuição (quem atribuiu, quando).
- **UserAuditLog**: Trilha de alterações em dados de usuário.
- **RoleAuditLog**: Trilha de alterações em papéis customizados.
- **UserRoleAssignmentAuditLog**: Trilha de alterações em atribuições de papéis.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos registros de usuário persistidos após a revisão contêm apenas
  dados de perfil e `organization_id`, sem colunas de papel na tabela de usuários.
- **SC-002**: 100% das verificações de autorização resolvem permissões exclusivamente
  via atribuições e catálogo de papéis, não via campos da tabela de usuários.
- **SC-003**: Administrador de organization não consegue listar, alterar ou atribuir
  papéis a usuários de outra organization em 100% dos testes de isolamento.
- **SC-004**: Usuário com papel restrito recebe acesso negado em 100% dos recursos
  sem permissão na matriz agregada de seus papéis.
- **SC-005**: 100% das mutações de usuários, papéis e atribuições geram auditoria
  rastreável.
- **SC-006**: Administradores cadastram novo usuário e atribuem papel inicial em
  menos de 3 minutos com dados disponíveis.

## Assumptions

- Projeto ainda não está em produção; migrations destrutivas de refactor são aceitáveis.
- `001-user-auth` e `002-organizations-crud` já implementados serão adaptados nesta feature.
- Um usuário pertence a no máximo uma organization por vez (`organization_id` na ficha);
  cenários multi-org futuros exigiriam evolução separada do vínculo organizacional.
- Um usuário pode ter múltiplos papéis ativos simultaneamente; permissões efetivas são
  a união dos papéis ativos.
- Usuário sem papel atribuído não acessa recursos protegidos (princípio do menor privilégio).
- Papéis customizados usam desativação lógica em vez de exclusão física quando ainda
  referenciados.
- Listagem padrão de usuários: página 20, máximo 100; ordenação por login ascendente.
- Permissões iniciais do catálogo cobrem domínios existentes (users, organizations) e
  reservam chaves para módulos futuros sem implementá-los nesta feature.

## Dependencies

- **001-user-auth**: Sessão, guards, política de senha, fluxo de login.
- **002-organizations-crud**: Organization tenant, gate de status ativo.

## Out of Scope (esta revisão)

- Interface de usuário ou telas de administração.
- Motor de políticas dinâmicas baseado em atributos (ABAC) além de papéis e permissões.
- Hierarquia de papéis (herança pai-filho entre papéis).
- Vínculo de um mesmo usuário a múltiplas organizations simultâneas.
