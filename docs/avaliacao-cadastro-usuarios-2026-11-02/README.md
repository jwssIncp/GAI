# Avaliação do cadastro de usuários — 02/11/2026

O fluxo básico funciona e o banco local não apresentou duplicidades ou vínculos inválidos nas verificações realizadas. Entretanto, há falhas confirmadas de validação, identificação no login e troca administrativa de senha. As duas prioridades são encerrar sessões anteriores ao trocar a senha e impedir colisões entre login e e-mail de contas diferentes.

## Escopo e evidências

Foram examinados o formulário React, os DTOs, controllers, casos de uso, repositórios, autenticação, entidades e migrations. O MySQL `localhost:3306/gai` foi consultado em transação **READ ONLY**. As reproduções usaram a aplicação Nest real com **SQLite em memória e dados sintéticos**. Nenhum usuário, perfil, senha, sessão ou registro do banco local foi alterado. Não houve acesso a produção nem inspeção visual no navegador.

- [Inspeção agregada do banco local](./local-database.json), sem exportação de senhas, hashes ou tokens.
- [Resultados dos 11 cenários adicionais](./disposable-probes.json).
- [Script de consulta somente leitura](./inspect-local.cjs).
- [Script de reprodução descartável](./probe-disposable.cjs).

## Como o cadastro funciona hoje

1. Em Usuários, um administrador informa login, e-mail e senha inicial. O administrador da plataforma também pode informar o ID da organização; vazio significa conta da plataforma.
2. `POST /api/v1/users` exige sessão autenticada, perfil de sistema `PLATFORM_ADMIN` ou `ORG_ADMIN` e a autorização `users:write`. A autorização dos administradores considera os privilégios próprios desses perfis.
3. Para `ORG_ADMIN`, a organização do ator prevalece sobre o ID enviado. Para `PLATFORM_ADMIN`, utiliza-se o ID informado ou `NULL`.
4. O backend verifica login e e-mail duplicados nas respectivas colunas, remove espaços nas pontas do login e converte o e-mail para minúsculas.
5. A senha recebe hash Argon2id. O usuário é criado como `ACTIVE`, com contador de tentativas zerado e sem bloqueio.
6. Usuário e auditoria de criação são gravados na mesma transação.
7. O cadastro **não atribui perfis automaticamente**. A interface orienta abrir “Gerenciar perfis” depois de salvar. Uma conta pode autenticar sem perfil, mas seus acessos dependem das permissões concedidas. O perfil `ORG_USER` existente está sem permissões próprias; sua concessão isolada não libera módulos.

A edição pela tela permite alterar e-mail e senha, ativar e desativar a conta. Login não é editável nesse fluxo. A API também permite mudar a organização, com restrição à plataforma e verificação dos perfis incompatíveis.

Referências: [formulário](../../gai-frontend/src/features/users/UsersPage.tsx), [controller](../../gai-backend/src/modules/users/presentation/users.controller.ts), [criação](../../gai-backend/src/modules/users/application/use-cases/create-user.use-case.ts), [escopo](../../gai-backend/src/modules/users/application/services/user-scope.service.ts).

## Quais dados são salvos

Estrutura conferida diretamente no MySQL local; os IDs de usuário são `BIGINT UNSIGNED`.

| Campo em `users` | Conteúdo e comportamento na criação |
| --- | --- |
| `id` | Identificador numérico gerado pelo banco |
| `organization_id` | Organização vinculada; `NULL` para plataforma; possui chave estrangeira |
| `login` | Texto até 100 caracteres no schema; único globalmente |
| `email` | Texto até 255 caracteres; único globalmente; criação converte para minúsculas |
| `password_hash` | Hash Argon2id; a senha em texto não é persistida nessa coluna |
| `status` | `ACTIVE` inicialmente; schema admite `ACTIVE`, `INACTIVE`, `LOCKED` |
| `failed_login_attempts` | Número de falhas de autenticação; começa em zero |
| `locked_until` | Data de bloqueio; começa nula |
| `password_changed_at` | Data definida na criação; há falha na atualização administrativa, descrita abaixo |
| `created_at` | Data de criação |
| `updated_at` | Data de última atualização |

O cadastro não possui campos de nome completo, CPF, telefone pessoal, cargo ou endereço pessoal. Hoje ele representa uma **conta de acesso**, com identificação por login/e-mail. A ausência desses campos é uma limitação funcional, não uma inconsistência por si só; depende da necessidade de identificação das pessoas.

Os registros relacionados ficam separados:

| Tabela | Dados |
| --- | --- |
| `user_audit_logs` | ID, usuário afetado, operação, autor, alterações antes/depois em JSON e data. A criação registra login, e-mail e organização. Alterações de senha usam `[redacted]` |
| `user_role_assignments` | Usuário, perfil, vínculo ativo, autor da concessão e datas de concessão/revogação/criação. Não é inserido pelo cadastro básico |
| `roles`, `role_permissions`, `permissions` | Definição dos perfis e seus acessos |
| `sessions` | Identificador de sessão utilizado como token, usuário, organização, expiração, revogação, criação e última atividade; criado na autenticação |
| `password_reset_tokens` | Hash do token de recuperação, usuário e datas de expiração/uso/criação; criado na recuperação |
| `auth_audit_logs` | Usuário, operação de autenticação, IP, resultado, metadados e data |

Login e e-mail têm unicidade **global**, inclusive entre organizações diferentes. Isso evita duplicidade por coluna, mas não resolve a colisão entre as duas colunas.

## Inconsistências confirmadas

### 1. Alta — troca administrativa da senha mantém sessões antigas

Após autenticar uma conta sintética, alterei sua senha por `PATCH /users/:id`. A senha antiga passou a receber `401` e a nova recebeu `200`, mas o token anterior continuou acessando `/auth/me` com `200`. `password_changed_at` permaneceu igual.

**Impacto:** trocar uma senha comprometida pela administração não remove o acesso de quem já possui uma sessão válida. A data da última troca também fica incorreta.

**Causa:** a atualização administrativa altera o hash pelo modelo `ManagedUser`, mas não atualiza esse campo nem revoga sessões. O guard não compara a data da sessão com a data de troca. O fluxo de recuperação de senha, por outro lado, atualiza a data e revoga sessões.

**Correção recomendada:** centralizar a troca de senha, atualizar `password_changed_at`, definir o tratamento do bloqueio/tentativas e revogar as sessões anteriores de forma consistente com a persistência da nova senha. Considerar também a invalidação de tokens de recuperação pendentes.

Fontes: [atualização, linha 120](../../gai-backend/src/modules/users/application/use-cases/update-user.use-case.ts#L120), [persistência, linha 196](../../gai-backend/src/modules/users/infrastructure/persistence/typeorm-user-management.repository.ts#L196), [guard](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts), [recuperação, linha 71](../../gai-backend/src/modules/auth/application/use-cases/confirm-password-reset.use-case.ts#L71).

### 2. Alta — login pode ser igual ao e-mail de outra conta

Cadastrei uma conta com e-mail `collision@example.com` e outra com login `collision@example.com`. Ambas foram aceitas com `201`. Ao autenticar com esse identificador, a senha da segunda conta funcionou e a da primeira recebeu `401`.

**Impacto:** o identificador fica ambíguo; uma conta pode perder a possibilidade de entrar pelo próprio e-mail. Não foi demonstrada autenticação sem senha ou tomada de conta: o defeito confirmado é a colisão e o encaminhamento ambíguo da identificação.

**Causa:** cadastro verifica login contra login e e-mail contra e-mail; autenticação consulta `login = identificador OR email = identificador`, sem resolver identidades conflitantes.

**Correção recomendada:** definir uma regra única de identificação: impedir conflitos cruzados também na edição de e-mail, restringir a sintaxe de login para separá-lo de e-mail ou adotar um identificador único. Preservar a regra sob concorrência e verificar contas existentes antes de aplicá-la.

Fontes: [verificações de criação, linha 42](../../gai-backend/src/modules/users/application/use-cases/create-user.use-case.ts#L42), [consulta de autenticação, linha 20](../../gai-backend/src/modules/auth/infrastructure/persistence/typeorm-user.repository.ts#L20).

### 3. Média — validação do login ocorre antes da normalização

`login: "   "` foi aceito e persistido como string vazia; `login: " a "` foi aceito e persistido como `a`. O DTO exige três caracteres antes de o caso de uso executar `trim()`.

Há também `maxLength: 100` na documentação Swagger, mas falta `@MaxLength(100)` na validação. O teste em SQLite aceitou 101 caracteres. O schema MySQL limita a coluna a 100; não foi executada inserção desse valor no MySQL nesta avaliação. Portanto, o retorno exato nesse motor depende de seu modo SQL; o problema comprovado é a falta de validação na API.

**Correção recomendada:** normalizar antes de validar, exigir de 3 a 100 caracteres no resultado e espelhar as regras no formulário. O formulário de criação hoje usa apenas `required` para login e senha, sem mensagens específicas de comprimento.

Fontes: [DTO](../../gai-backend/src/modules/users/application/dto/create-user.dto.ts), [normalização, linha 65](../../gai-backend/src/modules/users/application/use-cases/create-user.use-case.ts#L65), [formulário, linha 52](../../gai-frontend/src/features/users/UsersPage.tsx#L52).

### 4. Média — política de senha muda conforme o fluxo

A criação aceitou `aaaaaaaa`, que a política `Password.create()` usada na recuperação rejeita. Cadastro e edição administrativa exigem somente oito caracteres; recuperação exige também maiúscula, minúscula, número e caractere especial.

**Impacto:** não existe uma política uniforme aplicada às credenciais. O hash Argon2id não compensa uma senha previsível.

**Correção recomendada:** definir a política desejada e aplicá-la pelo mesmo mecanismo em criação, edição, recuperação e provisionamento. Exibir suas exigências no formulário. A decisão sobre complexidade deve ser única para todos os caminhos.

Fontes: [DTO de criação](../../gai-backend/src/modules/users/application/dto/create-user.dto.ts), [DTO de edição](../../gai-backend/src/modules/users/application/dto/update-user.dto.ts), [política de recuperação](../../gai-backend/src/modules/auth/domain/value-objects/password.ts).

### 5. Média — campos opcionais com `null` geram erro interno

`PATCH /users/:id` com `email: null` ou `password: null` retornou `500 INTERNAL_ERROR` nos dois casos. `@IsOptional()` deixa passar `null`, enquanto o caso de uso verifica apenas `undefined` e tenta executar `trim()` ou hash no valor.

**Correção recomendada:** definir a semântica de campos ausentes/nulos e rejeitar `null` com `400` quando o campo não admitir esse valor. Organização é um caso separado, pois `NULL` tem significado de plataforma.

Fontes: [DTO de edição](../../gai-backend/src/modules/users/application/dto/update-user.dto.ts), [tratamento do e-mail, linha 58](../../gai-backend/src/modules/users/application/use-cases/update-user.use-case.ts#L58), [tratamento da senha, linha 120](../../gai-backend/src/modules/users/application/use-cases/update-user.use-case.ts#L120).

### 6. Média — conta ativa pode ser criada para organização inativa

Com uma organização sintética inativada, a plataforma conseguiu criar um usuário `ACTIVE` com `201`. A conta recebeu `401` ao tentar autenticar, pois o login exige organização ativa. A concessão de novos perfis também possui essa exigência.

**Impacto:** o cadastro informa sucesso e cria uma conta ativa que não consegue entrar. Pode ser uma escolha de provisionamento antecipado, mas a interface não explicita essa condição.

**Correção recomendada:** definir a regra de negócio: bloquear esse cadastro com erro claro ou apresentar explicitamente seu estado de espera. Validar existência e situação da organização na API. A chave estrangeira local garante existência, mas não situação ativa; a criação atual não faz uma consulta explícita à organização.

Fontes: [criação](../../gai-backend/src/modules/users/application/use-cases/create-user.use-case.ts), [login](../../gai-backend/src/modules/auth/application/use-cases/login.use-case.ts), [concessão de perfis](../../gai-backend/src/modules/users/infrastructure/persistence/access-administration-lock.ts).

### 7. Achado adicional de autenticação — bloqueio temporário não expira no domínio

Ao simular falhas até atingir o limite, `isLocked()` continuou retornando verdadeiro 31 minutos depois, mesmo com duração configurada de 30 minutos. O método retorna imediatamente verdadeiro quando o status é `LOCKED`, antes de avaliar `locked_until`. O login utiliza esse método antes de verificar a senha.

Esse achado é relacionado ao ciclo de vida da conta, não à inserção inicial. A reprodução foi feita diretamente no domínio com avanço do horário informado, sem aguardar 31 minutos nem alterar o relógio do sistema.

**Correção recomendada:** distinguir bloqueio temporário de bloqueio administrativo e permitir a liberação automática após o prazo, com restauração consistente do estado e contador.

Fonte: [entidade de autenticação, linha 64](../../gai-backend/src/modules/auth/domain/entities/user.ts#L64).

## Situação dos dados existentes no banco local

| Verificação | Resultado |
| --- | --- |
| Usuários | 3, todos ativos; 1 da plataforma e 2 vinculados a organização |
| Hashes | 3 com prefixo Argon2id; nenhum hash foi exportado |
| Organizações | 2, ambas ativas |
| Vínculo com organização inexistente/inativa | Nenhum |
| Login vazio/curto após `trim`, acima de 100 ou e-mail fora da normalização verificada | Nenhum |
| Colisões entre login de uma conta e e-mail de outra | Nenhuma |
| Vínculos ativos duplicados ou incompatíveis de perfil | Nenhum nas consultas realizadas |
| Usuários sem perfil efetivo | Nenhum |
| Organização 1 | 1 administrador organizacional ativo |
| Organização 2 | **Nenhum administrador organizacional ativo** |
| `user_audit_logs` | Nenhum registro |
| Migrations aplicadas | 34; este trabalho não executou migrations |

A organização 2 depende da administração da plataforma para seu provisionamento inicial. Isso é uma lacuna operacional se ela já deveria operar de forma autônoma, mas não caracteriza corrupção referencial. Não foi criado administrador automaticamente.

A ausência de auditoria de usuários não prova falha do cadastro: os registros existentes podem ter sido provisionados por seed ou scripts. Nos testes do caminho normal, criação usa transação conjunta com auditoria. Recomenda-se padronizar também a rastreabilidade do provisionamento por scripts caso isso seja requisito operacional.

Os perfis administrativos locais não têm linhas em `role_permissions`, o que não significa ausência de poder administrativo: o sistema trata seus privilégios de forma própria. `ORG_USER` também tem zero permissões, mas nesse caso não recebe os privilégios administrativos. Há um perfil organizacional personalizado com uma permissão e um vínculo ativo.

## Observações de experiência e regras de negócio

- A organização é digitada como ID numérico e listada como ID. Um seletor com nome e situação reduziria erros de cadastro, especialmente para a plataforma.
- Cadastro e concessão de acesso são etapas separadas por decisão explícita do sistema. Vale apresentar “acessos pendentes” ou conduzir a concessão após salvar para reduzir contas sem utilidade prática. Isso não autoriza conceder perfil administrativo automaticamente.
- O ID de outra organização enviado por `ORG_ADMIN` é ignorado e substituído pelo ID do ator. O teste confirmou esse isolamento; não é uma fuga de organização. Uma resposta explícita a entradas conflitantes tornaria o contrato menos surpreendente.
- Não há estado de convite, confirmação de e-mail ou campo que obrigue troca da senha inicial no modelo examinado. São melhorias a considerar conforme o processo de entrada de pessoas, não requisitos presumidos desta avaliação.

## Validação executada

- 6 suítes unitárias: **19 testes aprovados** — criação, escopo, transferência organizacional, ativação/desativação e política de senha.
- 4 suítes de integração: **19 testes aprovados e 1 ignorado** — criação, listagem, perfis/acessos e recuperação de senha. O cenário ignorado exige MySQL; não foi executado neste conjunto SQLite.
- **11 cenários adicionais** concluídos com aplicação real em SQLite ou, no bloqueio por prazo, com a entidade de domínio. Eles registram os comportamentos defeituosos, não os consideram requisitos corretos.

Os testes existentes passarem não elimina os defeitos reproduzidos: os casos adicionais exercitam entradas e transições que esse conjunto não cobria. Não foi executado teste de concorrência MySQL nem certificado o comportamento de limites de VARCHAR nesse motor.

Para reproduzir a consulta e os cenários adicionais, na raiz do workspace:

```powershell
node docs/avaliacao-cadastro-usuarios-2026-11-02/inspect-local.cjs
node docs/avaliacao-cadastro-usuarios-2026-11-02/probe-disposable.cjs
```

O primeiro script recusa destinos não locais ou ambiente diferente de `local`; o segundo força SQLite em memória. Nenhuma alteração funcional foi aplicada. A ordem recomendada para implementação é: sessões e identidade; validação comum de entradas/senhas; organização e comunicação do estado de acesso; correção do bloqueio temporário e cobertura de regressão dos cenários identificados.
