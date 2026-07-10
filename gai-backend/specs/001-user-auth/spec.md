# Feature Specification: Autenticação Segura de Usuários

**Feature Branch**: `001-user-auth`

**Created**: 2026-06-15

**Status**: Draft

**Input**: User description: "Quero ter um login completo na minha aplicação. O usuario passa seu login e senha, que vai ser armazenado no banco de dados de maneira criptografada. Esse login deve ser feito de forma segura, com padrões adequados de cybersegurança. Além do login, devemos ter recuperação de senha, caso o usuário não consiga logar no sistema."

**Repository Scope**: Este repositório é apenas o backend GAI. Requisitos de UI/frontend
DEVEM ser traduzidos em contratos de API; implementação de interface fica fora de escopo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Login com Credenciais (Priority: P1)

Como usuário do sistema GAI, quero informar meu identificador de acesso e senha para
entrar no sistema de forma segura, para que eu possa acessar as funcionalidades
patrimoniais autorizadas ao meu perfil.

**Why this priority**: Sem autenticação funcional, nenhuma outra funcionalidade do GAI
pode ser acessada de forma segura. É o bloqueador absoluto do sistema.

**Independent Test**: Pode ser testado enviando credenciais válidas e verificando que o
usuário recebe confirmação de acesso autenticado com sessão válida, sem expor dados
sensíveis na resposta.

**Acceptance Scenarios**:

1. **Given** um usuário ativo com credenciais válidas cadastradas, **When** informa
   identificador e senha corretos, **Then** o sistema autentica o usuário e concede
   acesso com sessão válida por tempo limitado.
2. **Given** um usuário autenticado com sessão ativa, **When** solicita encerramento
   de sessão, **Then** o sistema invalida a sessão e o usuário precisa autenticar
   novamente para acessar recursos protegidos.
3. **Given** um usuário tenta acessar recurso protegido, **When** não possui sessão
   válida, **Then** o sistema nega o acesso de forma consistente.

---

### User Story 2 - Recuperação de Senha (Priority: P2)

Como usuário que esqueceu ou não consegue usar sua senha, quero solicitar a
recuperação de acesso informando meu e-mail cadastrado, para que eu possa definir
uma nova senha e voltar a usar o sistema sem intervenção manual do suporte.

**Why this priority**: Recuperação de senha é essencial para continuidade operacional
e reduz dependência de suporte, mas depende da existência do fluxo de autenticação (P1).

**Independent Test**: Pode ser testado solicitando recuperação com e-mail válido,
utilizando o mecanismo de redefinição recebido e verificando login com a nova senha.

**Acceptance Scenarios**:

1. **Given** um usuário ativo com e-mail cadastrado, **When** solicita recuperação de
   senha informando o e-mail, **Then** o sistema envia instruções de redefinição por
   canal seguro sem revelar se outras contas existem com o mesmo dado.
2. **Given** um usuário com link ou código de recuperação válido e não expirado,
   **When** define uma nova senha que atende à política de segurança, **Then** o
   sistema atualiza a senha e invalida tokens de recuperação anteriores.
3. **Given** um usuário com link ou código de recuperação expirado ou já utilizado,
   **When** tenta redefinir a senha, **Then** o sistema rejeita a operação e exige
   nova solicitação de recuperação.

---

### User Story 3 - Proteção contra Acessos Indevidos (Priority: P3)

Como administrador do sistema e como usuário legítimo, quero que tentativas de login
inválidas sejam tratadas com proteções de segurança, para que contas não sejam
comprometidas por ataques de força bruta ou enumeração de usuários.

**Why this priority**: Segurança reforça a confiança no login, mas o fluxo básico (P1)
e a recuperação (P2) podem operar antes destas proteções avançadas em um MVP mínimo.

**Independent Test**: Pode ser testado enviando credenciais inválidas repetidamente e
verificando bloqueio temporário, mensagens genéricas e registro de tentativas suspeitas.

**Acceptance Scenarios**:

1. **Given** um usuário informa credenciais incorretas, **When** tenta autenticar,
   **Then** o sistema retorna mensagem genérica que não revela se o identificador
   existe ou se apenas a senha está errada.
2. **Given** múltiplas tentativas falhas consecutivas para a mesma conta ou origem,
   **When** o limite configurado é atingido, **Then** o sistema bloqueia temporariamente
   novas tentativas e registra o evento para auditoria.
3. **Given** uma tentativa de autenticação ou recuperação de senha, **When** a
   operação ocorre, **Then** o sistema registra o evento de segurança (sucesso ou
   falha) para rastreabilidade, sem expor senhas ou tokens em logs.

---

### Edge Cases

- O que acontece quando o usuário tenta login com conta desativada ou bloqueada
  administrativamente?
- Como o sistema trata solicitação de recuperação para e-mail não cadastrado?
- O que acontece quando o usuário tenta reutilizar senha anterior já utilizada
  (se política de histórico estiver ativa)?
- Como o sistema se comporta quando o usuário possui sessão ativa e redefine senha
  via recuperação?
- O que acontece em tentativas simultâneas de login e recuperação para a mesma conta?
- Como o sistema trata senhas que não atendem à política mínima de complexidade?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir autenticação de usuários mediante identificador
  único (e-mail ou nome de usuário) e senha.
- **FR-002**: O sistema DEVE armazenar senhas de forma segura, usando transformação
  irreversível de uso industrial — nunca em texto puro ou reversível sem justificativa.
- **FR-003**: O sistema DEVE validar credenciais e conceder sessão autenticada com
  tempo de expiração configurável.
- **FR-004**: O sistema DEVE permitir encerramento explícito de sessão (logout).
- **FR-005**: O sistema DEVE negar acesso a recursos protegidos quando não houver
  sessão válida.
- **FR-006**: O sistema DEVE permitir solicitação de recuperação de senha informando
  o e-mail cadastrado.
- **FR-007**: O sistema DEVE enviar mecanismo de redefinição de senha (link ou código)
  com validade temporal limitada e uso único.
- **FR-008**: O sistema DEVE permitir definição de nova senha somente após validação
  do mecanismo de recuperação.
- **FR-009**: O sistema DEVE aplicar política mínima de senha (comprimento mínimo e
  complexidade básica) na criação e redefinição.
- **FR-010**: O sistema DEVE retornar mensagens genéricas em falhas de autenticação e
  recuperação, evitando enumeração de contas.
- **FR-011**: O sistema DEVE limitar tentativas consecutivas de login falhas por conta
  ou origem, com bloqueio temporário configurável.
- **FR-012**: O sistema DEVE registrar eventos de autenticação e recuperação de senha
  para auditoria (quem, quando, resultado, origem), sem expor credenciais.
- **FR-013**: O sistema DEVE invalidar sessões ativas e tokens de recuperação
  anteriores quando a senha for redefinida com sucesso.
- **FR-014**: O sistema DEVE rejeitar credenciais de contas desativadas ou bloqueadas,
  com mensagem adequada ao contexto de segurança.

### Non-Functional Requirements *(mandatory per constitution)*

- **NFR-001**: Feature MUST maintain ≥ 80% test coverage (unit + integration).
- **NFR-002**: List endpoints MUST use pagination; unbounded responses are prohibited.
- **NFR-003**: Data mutations MUST use transactions with audit trail.
- **NFR-004**: Domain validations MUST occur before persistence (Clean Code + SOLID).
- **NFR-005**: Login MUST complete within 3 seconds for 95% of attempts under normal load.
- **NFR-006**: Feature MUST NOT include frontend/UI; scope limited to backend API and jobs.
- **NFR-007**: Feature MUST support homologação and produção environments on AWS.
- **NFR-008**: Authentication and recovery events MUST emit structured JSON logs indexable in Kibana.
- **NFR-009**: CI pipeline MUST run lint, security audit, tests and coverage gate on every PR.
- **NFR-010**: All authentication traffic MUST occur over encrypted transport only.
- **NFR-011**: Tokens and recovery mechanisms MUST expire within a bounded, documented time window.

### Key Entities

- **Usuário**: Pessoa com acesso ao GAI; possui identificador único, e-mail, status
  (ativo/inativo/bloqueado) e referência à credencial de acesso.
- **Credencial**: Dados de autenticação do usuário; armazena representação segura da
  senha e metadados de política (última alteração, tentativas falhas).
- **Sessão**: Contexto autenticado concedido após login válido; possui identificador,
  usuário associado, data de criação e expiração.
- **Token de Recuperação**: Mecanismo temporário e de uso único para redefinição de
  senha; associado ao usuário, com data de expiração e status (pendente/utilizado/expirado).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários com credenciais válidas completam o login em menos de 30 segundos
  na primeira tentativa.
- **SC-002**: 95% das solicitações de recuperação de senha com e-mail válido resultam em
  envio do mecanismo de redefinição em menos de 2 minutos.
- **SC-003**: 90% dos usuários que iniciam recuperação de senha conseguem redefinir e
  autenticar com a nova senha sem contato com suporte.
- **SC-004**: Tentativas de força bruta são bloqueadas após o limite configurado em 100%
  dos casos testados em homologação.
- **SC-005**: Zero incidentes de exposição de senha em texto puro em auditorias de
  segurança da feature antes do deploy em produção.
- **SC-006**: 100% dos eventos de login, logout, falha de autenticação e recuperação
  de senha são rastreáveis em logs de auditoria.

## Assumptions

- Usuários já possuem cadastro prévio no sistema (criação de conta por administrador
  ou processo externo); auto-cadastro público está fora do escopo desta feature.
- O identificador de login aceita e-mail ou nome de usuário único; cada usuário possui
  e-mail válido cadastrado para recuperação de senha.
- Recuperação de senha utiliza envio por e-mail como canal padrão de entrega do
  mecanismo de redefinição.
- Clientes de interface (web/mobile) consomem os endpoints de autenticação deste backend;
  telas de login e recuperação ficam em repositórios separados.
- Política inicial de senha: mínimo de 8 caracteres com letras e números; ajustável
  futuramente sem quebrar o escopo desta especificação.
- Bloqueio temporário padrão: 5 tentativas falhas em 15 minutos, com bloqueio de
  30 minutos — valores configuráveis por ambiente.
- Sessão padrão expira após período de inatividade configurável (assume 8 horas de
  inatividade como padrão corporativo).
