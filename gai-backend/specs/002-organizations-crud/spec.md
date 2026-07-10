# Feature Specification: CRUD de Organizations

**Feature Branch**: `002-organizations-crud`

**Created**: 2026-06-15

**Status**: Draft

**Input**: User description: "Vamos criar também, um CRUD completo para o que chamaremos de 'organizations'. As organizations, serão as organizações que irão usar o sistema. Dessa maneira, somente elas irão poder utilizar o sistema."

**Repository Scope**: Este repositório é apenas o backend GAI. Requisitos de UI/frontend
DEVEM ser traduzidos em contratos de API; implementação de interface fica fora de escopo.

## Clarifications

### Session 2026-06-17

- Q: Como o backend NestJS deve rodar no container em desenvolvimento local? → A: `docker-compose` com serviços `app` + `mysql`; backend monta o source (bind mount) e usa hot-reload (`start:dev`).
- Q: Como migrations e seeds devem ser executados no ambiente local Docker? → A: Na primeira subida, migrations e seeds automáticos; em subidas posteriores, migrations e seeds acionados manualmente (comando explícito). Dados do MySQL persistem via volume Docker entre rebuilds — sem reset automático do banco.
- Q: Como as variáveis de ambiente locais devem ser gerenciadas no stack Docker? → A: Arquivo `.env` local para desenvolvimento; homologação e produção usam AWS Parameter Store (PS) para gerenciamento de variáveis.
- Q: Quando existirem migrations pendentes em subidas posteriores, o que o container `app` deve fazer? → A: Falha no startup com erro explícito até `migration:run` manual.
- Q: Onde os testes automatizados devem rodar no fluxo local? → A: Host executa testes; MySQL via `docker compose` (porta 3306 publicada).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar Organization (Priority: P1)

Como administrador da plataforma GAI, quero cadastrar uma nova organization com seus
dados identificadores, para que essa organização possa ser habilitada a utilizar o
sistema e seus usuários acessem funcionalidades patrimoniais.

**Why this priority**: Sem organizations cadastradas, ninguém pode utilizar o sistema.
O cadastro é a fundação do modelo multi-organização e precede qualquer operação
patrimonial.

**Independent Test**: Pode ser testado criando uma organization com dados válidos e
verificando que ela fica disponível no sistema com status ativo e identificador único.

**Acceptance Scenarios**:

1. **Given** um administrador autenticado com permissão de gestão de organizations,
   **When** cadastra uma organization com dados obrigatórios válidos, **Then** o
   sistema persiste a organization e retorna confirmação com identificador único.
2. **Given** dados obrigatórios ausentes ou inválidos, **When** tenta cadastrar uma
   organization, **Then** o sistema rejeita a operação com mensagens claras sobre
   os campos incorretos, sem criar registro parcial.
3. **Given** já existe organization com o mesmo identificador fiscal único,
   **When** tenta cadastrar outra com o mesmo identificador, **Then** o sistema
   impede duplicidade e informa conflito de forma objetiva.

---

### User Story 2 - Consultar e Listar Organizations (Priority: P2)

Como administrador da plataforma, quero consultar os detalhes de uma organization e
listar organizations cadastradas com filtros e paginação, para gerenciar quem pode
utilizar o sistema.

**Why this priority**: Após o cadastro (P1), a consulta é essencial para operação
diária, auditoria e suporte; sem listagem paginada, a gestão em escala é inviável.

**Independent Test**: Pode ser testado listando organizations com paginação e
consultando uma organization específica por identificador, verificando dados
retornados e filtros por status.

**Acceptance Scenarios**:

1. **Given** organizations cadastradas no sistema, **When** solicita listagem paginada,
   **Then** o sistema retorna página de resultados com total e metadados de paginação,
   sem respostas ilimitadas.
2. **Given** uma organization existente, **When** consulta por identificador válido,
   **Then** o sistema retorna dados completos da organization (nome, identificador
   fiscal, status, datas relevantes).
3. **Given** filtro por status (ativo/inativo), **When** aplica o filtro na listagem,
   **Then** o sistema retorna apenas organizations que correspondem ao critério.
4. **Given** identificador inexistente, **When** consulta organization específica,
   **Then** o sistema informa que o registro não foi encontrado de forma consistente.

---

### User Story 3 - Atualizar Organization (Priority: P3)

Como administrador da plataforma, quero atualizar dados de uma organization existente,
para manter informações corretas e refletir mudanças cadastrais sem recriar o registro.

**Why this priority**: Atualização é necessária para manutenção, mas depende de
organizations já cadastradas (P1) e consultáveis (P2).

**Independent Test**: Pode ser testado alterando campos editáveis de uma organization
e verificando persistência, auditoria e rejeição de alterações inválidas.

**Acceptance Scenarios**:

1. **Given** uma organization ativa existente, **When** atualiza campos editáveis
   com dados válidos, **Then** o sistema persiste as alterações e registra trilha de
   auditoria (valor anterior e novo).
2. **Given** tentativa de alterar identificador fiscal para valor já utilizado por
   outra organization, **When** submete atualização, **Then** o sistema rejeita por
   conflito de unicidade.
3. **Given** tentativa de atualizar organization inexistente, **When** submete
   alteração, **Then** o sistema informa registro não encontrado.

---

### User Story 4 - Desativar Organization (Priority: P4)

Como administrador da plataforma, quero desativar uma organization que não deve mais
utilizar o sistema, para bloquear novos acessos e operações sem perder histórico
patrimonial associado.

**Why this priority**: A desativação protege o sistema de uso indevido, mas só faz
sentido após cadastro e consulta estarem operacionais; exclusão física é evitada
por integridade de dados patrimoniais.

**Independent Test**: Pode ser testado desativando uma organization ativa e verificando
que seu status muda para inativo e que novas operações são bloqueadas para essa
organization.

**Acceptance Scenarios**:

1. **Given** uma organization ativa sem impedimentos de negócio, **When** solicita
   desativação, **Then** o sistema altera status para inativo e registra auditoria
   da operação.
2. **Given** uma organization inativa, **When** usuários ou processos tentam utilizá-la,
   **Then** o sistema impede utilização do GAI para essa organization.
3. **Given** uma organization já desativada, **When** solicita desativação novamente,
   **Then** o sistema informa que a organization já está inativa, sem efeitos colaterais.
4. **Given** uma organization ativa, **When** administrador solicita reativação,
   **Then** o sistema restaura status para ativo e permite utilização novamente.

---

### Edge Cases

- O que acontece ao tentar cadastrar organization com identificador fiscal em formato
  inválido?
- Como o sistema trata listagem quando não há organizations cadastradas?
- O que acontece se usuários autenticados pertencem a uma organization desativada
  durante sessão ativa?
- Como o sistema impede exclusão física quando há dados patrimoniais vinculados?
- O que acontece em atualizações concorrentes dos mesmos dados de uma organization?
- Como o sistema trata busca textual por nome em listagens com grande volume?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir cadastro de organizations com campos obrigatórios:
  razão social, identificador fiscal único (CNPJ) e status inicial.
- **FR-002**: O sistema DEVE garantir unicidade do identificador fiscal (CNPJ) entre
  organizations ativas e inativas.
- **FR-003**: O sistema DEVE validar formato do identificador fiscal antes de persistir.
- **FR-004**: O sistema DEVE permitir consulta de uma organization por identificador
  interno único.
- **FR-005**: O sistema DEVE permitir listagem paginada de organizations com tamanho
  de página configurável e limite máximo.
- **FR-006**: O sistema DEVE permitir filtrar listagem por status (ativo/inativo) e
  busca por nome ou identificador fiscal.
- **FR-007**: O sistema DEVE permitir atualização de campos editáveis: razão social,
  nome fantasia e dados de contato (quando informados).
- **FR-008**: O sistema DEVE impedir alteração do identificador fiscal após criação,
  exceto por fluxo administrativo justificado documentado fora desta feature.
- **FR-009**: O sistema DEVE permitir desativação lógica de organizations (soft delete),
  alterando status para inativo sem remoção física.
- **FR-010**: O sistema DEVE permitir reativação de organizations previamente desativadas.
- **FR-011**: O sistema DEVE bloquear utilização do GAI por organizations inativas —
  somente organizations ativas podem operar no sistema.
- **FR-012**: O sistema DEVE registrar auditoria em criação, atualização, desativação
  e reativação (quem, quando, operação, dados alterados).
- **FR-013**: O sistema DEVE restringir operações de CRUD de organizations a usuários
  com perfil administrativo da plataforma.
- **FR-014**: O sistema NÃO DEVE permitir exclusão física de organizations com vínculos
  patrimoniais ou de usuários; desativação é o mecanismo padrão de remoção.

### Non-Functional Requirements *(mandatory per constitution)*

- **NFR-001**: Feature MUST maintain ≥ 80% test coverage (unit + integration).
- **NFR-002**: List endpoints MUST use pagination; unbounded responses are prohibited.
- **NFR-003**: Data mutations MUST use transactions with audit trail.
- **NFR-004**: Domain validations MUST occur before persistence (Clean Code + SOLID).
- **NFR-005**: Organization list MUST return results within 3 seconds for 95% of
  paginated requests under normal load.
- **NFR-006**: Feature MUST NOT include frontend/UI; scope limited to backend API and jobs.
- **NFR-007**: Feature MUST support três ambientes isolados: **local** (Docker Compose +
  `.env`), **homologação** e **produção** (AWS + Parameter Store); configuração
  externalizada por ambiente — valores hardcoded PROIBIDOS.
- **NFR-008**: CRUD operations MUST emit structured JSON logs indexable in Kibana.
- **NFR-009**: CI pipeline MUST run lint, security audit, tests and coverage gate on every PR.
- **NFR-010**: Ambiente local DEVE ser executável via `docker-compose.yml` com dois
  serviços: `mysql` (MySQL 8.0, utf8mb4, volume nomeado persistente) e `app` (backend
  NestJS com bind mount do source e hot-reload via `start:dev`); `docker compose up`
  sobe o stack completo. Na **primeira inicialização** (volume MySQL vazio), migrations
  e seeds DEVEM rodar automaticamente; em subidas posteriores, migrations e seeds DEVEM
  ser acionados manualmente via comando explícito. Se houver migrations pendentes, o
  container `app` DEVE falhar no startup com mensagem clara até `migration:run` manual.
  Rebuild/restart do container `app` ou `mysql` NÃO DEVE apagar dados existentes no volume.
- **NFR-011**: Configuração local DEVE usar arquivo `.env` na raiz (gitignored) com
  `.env.example` versionado como template. Homologação e produção DEVEM obter variáveis
  via **AWS Systems Manager Parameter Store** (PS), injetadas no runtime do container ECS
  — nunca commitadas no repositório.
- **NFR-012**: Testes automatizados locais (unit + e2e) DEVEM executar na máquina host,
  conectando ao MySQL do `docker compose` via porta publicada (`localhost:3306`); o
  container `app` não é obrigatório para execução de testes.

### Key Entities

- **Organization**: Entidade tenant que habilita uso do GAI; possui razão social, nome
  fantasia (opcional), identificador fiscal único (CNPJ), status (ativo/inativo),
  dados de contato opcionais e timestamps de criação/atualização.
- **Auditoria de Organization**: Registro imutável de alterações na organization;
  associa operação, autor, data e valores relevantes anterior/novo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administradores cadastram uma nova organization em menos de 2 minutos
  quando os dados estão disponíveis.
- **SC-002**: 95% das consultas paginadas de organizations retornam resultados em
  menos de 3 segundos.
- **SC-003**: 100% das tentativas de cadastro com identificador fiscal duplicado são
  rejeitadas em testes de homologação.
- **SC-004**: 100% das organizations desativadas ficam impedidas de utilizar o sistema
  em testes de validação de acesso.
- **SC-005**: 100% das mutações (criar, atualizar, desativar, reativar) geram registro
  de auditoria rastreável.
- **SC-006**: Administradores localizam uma organization específica via listagem filtrada
  em menos de 1 minuto em 90% dos casos de suporte simulados.

## Assumptions

- Organizations representam empresas ou entidades jurídicas clientes do GAI; o
  identificador fiscal padrão é CNPJ (Brasil), validado quanto a formato e dígitos.
- Gestão de organizations é restrita a administradores da plataforma; usuários finais
  não criam organizations por conta própria.
- Vínculo entre usuários (feature `001-user-auth`) e organizations será integrado em
  feature futura ou fase de implementação; esta spec define a entidade e o gate de
  status ativo/inativo.
- Campos opcionais iniciais: nome fantasia, e-mail de contato, telefone de contato.
- Desativação é reversível (reativação); exclusão física permanece proibida nesta feature.
- Listagem padrão ordenada por razão social; página padrão de 20 itens, máximo 100.
- Apenas organizations com status ativo podem ser utilizadas no sistema; regra aplicada
  em camadas de autorização consumidas por outras features do GAI.
- Desenvolvimento local usa Docker Compose (`app` + `mysql`); variáveis de conexão ao
  banco no container `app` referenciam o hostname do serviço `mysql`, não `localhost`.
- Dados locais persistem no volume Docker do MySQL; rebuilds e restarts não resetam o
  banco automaticamente. Reset completo exige remoção explícita do volume.
- Variáveis locais via `.env`; homologação e produção via AWS Parameter Store (PS),
  com hierarquia de paths por ambiente (ex.: `/gai/homologacao/`, `/gai/producao/`).
- Testes automatizados (unit + e2e) rodam na máquina host; conectam ao MySQL do
  `docker compose` via `localhost:3306` (porta publicada).

## Dependencies

- **001-user-auth**: Autenticação de administradores que executam o CRUD; integração
  de bloqueio por organization inativa depende de sessão/usuário vinculado a organization
  (a ser detalhado no plano de implementação).
