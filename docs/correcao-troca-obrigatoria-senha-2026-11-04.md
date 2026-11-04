# Correção da troca obrigatória de senha — 04/11/2026

## Causa raiz e evidências

O backend já gravava a nova senha com Argon2id, definia `users.must_change_password=false`, removia a validade da senha temporária, incrementava `auth_version` e revogava sessões e tokens de recuperação dentro de uma transação. A investigação não identificou necessidade de migration ou correção de dados.

O frontend tinha duas inconsistências: o formulário limpava somente o `sessionStorage`, mantendo a identidade temporária e o token revogado no `AuthProvider`; e o login reutilizava indiscriminadamente a rota de retorno, inclusive `/app/change-password`, mesmo quando a resposta autenticada indicava `must_change_password=false`. Isso permitia reapresentar o formulário após a troca e um novo login.

O teste de regressão falhou antes da correção com o usuário temporário e seu token ainda em memória após uma resposta de sucesso da API (`.local/password-loop-before.json`). A validação no navegador também identificou uma disputa entre limpar a identidade e sair da rota protegida: seu guard podia substituir a navegação e perder a mensagem de sucesso. A correção sai da rota protegida com navegação síncrona antes de encerrar o estado local.

## Correções implementadas

- `CredentialPages.tsx`: após a confirmação da troca pela API, navega para o login, informa o sucesso e encerra a identidade, o token, a expiração e o cache local pelo `AuthProvider`. O logout local dispensa uma chamada com o token que a transação já revogou.
- `AuthProvider.tsx` e `AuthContext.ts`: o login retorna o usuário efetivamente autenticado; gerações de sessão impedem respostas atrasadas de restauração ou logout de sobrescrever uma autenticação posterior. A restauração consulta `/auth/me` e utiliza o indicador confirmado pelo servidor.
- `loginDestination.ts` e `LoginPage.tsx`: credenciais temporárias continuam seguindo para a troca; credenciais permanentes não herdam a rota de troca obrigatória como destino de retorno. Rotas internas válidas continuam preservadas.
- `http.ts`: um HTTP 401 de uma requisição antiga não apaga uma sessão mais recente. Um HTTP 401 da sessão atual continua encerrando-a.
- `PasswordPages.tsx`: a recuperação bem-sucedida encerra também uma eventual sessão aberta no navegador, inclusive quando o link pertence a outra conta. Um logout recusado porque a sessão já foi revogada não transforma a troca concluída em erro.
- Validadores, DTOs, Swagger, contrato da API, orientações e testes usam a política de oito caracteres.

## Política de senhas

O mínimo para **novas credenciais é 8 caracteres**, com máximo de **128**, contados por pontos de código. Senhas vazias ou compostas somente de espaços continuam inválidas. Frases, espaços e colagem continuam permitidos; não foram acrescentadas exigências de maiúsculas, números ou símbolos.

`Password.MIN_LENGTH` e `Password.MAX_LENGTH` são reutilizados nos DTOs. Os serviços de cadastro, troca própria, recuperação, ativação e redefinição administrativa já utilizam `Password.create()`. O formulário de cadastro, a ação administrativa e as páginas de troca, ativação e recuperação compartilham `validatePassword` e `passwordHint`. O login já aceitava oito caracteres. A política publicada nas opções de cadastro acompanha a constante do domínio.

O relatório histórico de resolução de conflitos registra a política vigente naquela ocasião. Ele não configura os fluxos atuais.

## Sessões e permissões

Esta versão do GAI utiliza **tokens opacos UUID persistidos em `sessions`, não JWT**. A validação verifica `auth_version`, revogação, expiração e resolução atual de permissões/organização. A renovação existente estende a validade da sessão na atividade; não existe fluxo de refresh JWT a alterar.

Os testes verificam a senha efetivamente persistida, o indicador no MySQL, a revogação dos tokens anteriores, um novo token após o login, a restauração por `/auth/me` e a extensão de validade. As permissões posteriores à troca são comparadas às de usuários equivalentes dos perfis `PLATFORM_ADMIN`, `ORG_ADMIN` e operador da organização. Também são rejeitadas a redefinição fora do escopo e a adulteração da organização.

## Validação local

| Execução | Aprovados | Reprovados | Ignorados | Evidência local |
| --- | ---: | ---: | ---: | --- |
| Backend completo, 122 suítes | 823 | 0 | 4 | `.local/password-backend-full.json` |
| MySQL: troca de senha e ciclo de vida | 53 | 0 | 0 | `.local/password-mysql-tests.json` |
| MySQL: perfis, permissões e concorrência | 11 | 0 | 0 | `.local/password-mysql-profiles.json` |
| Frontend completo, 59 arquivos | 358 | 0 | 0 | `.local/password-frontend-final.json` |
| Chromium + API + MySQL, claro/escuro | 2 | 0 | 0 | `.local/password-browser.json` |

Os quatro casos condicionais ignorados na execução SQLite do backend foram executados e aprovados nas suítes MySQL. As contagens por motor incluem cenários repetidos e não representam testes distintos para soma.

Tipos, lint e build do backend e do frontend passaram (código de saída zero). Os 12 casos direcionados de senha/sessão também passaram; estão incluídos na suíte frontend completa. O build do frontend manteve o aviso existente sobre chunks acima de 500 kB.

| Cenário solicitado | Resultado e evidência |
| --- | --- |
| Cadastro com senha provisória e primeiro acesso | MySQL e cadastro pela interface nos dois temas; troca obrigatória no primeiro login |
| Nova senha persistida e fim da obrigatoriedade | Hash verificado, indicador falso, validade provisória removida e `auth_version` incrementado no MySQL |
| Logout e login posterior, sem loop | Navegador completo, inclusive retorno obsoleto para `/app/change-password` |
| Senha provisória e token antigos recusados | HTTP 401 no MySQL e no navegador |
| 7 rejeitados; 8 e 15 aceitos | Cadastro, troca, redefinição administrativa, recuperação e convite na API; validadores/formulários no frontend |
| Recuperação e redefinição administrativa | Tokens de uso único, revogação anterior e preservação da troca obrigatória apenas para nova senha provisória |
| Recarga e renovação | Restauração por `/auth/me`, recarga real no Chromium e extensão de validade conferida no MySQL; sessões opacas, sem JWT |
| Perfis e organizações | Comparadas permissões de plataforma, administrador e operador; recusadas operações fora do escopo |

Durante o desenvolvimento, o teste anterior à correção reproduziu a falha, e execuções intermediárias identificaram a disputa de navegação. Houve também timeouts sob pressão de memória ao executar muitas validações simultâneas. A execução final frontend usa um worker e a validação final do navegador foi executada sem outras suítes concorrentes. Todas as asserções foram preservadas. O teste com o guard real utiliza `AbortSignal` compatível com o `Request` do Node no jsdom.

**Status: APTO para o escopo solicitado e validado localmente.** Não houve validação de entrega de e-mail por SES real ou alteração de produção; a recuperação foi validada com envio simulado e token consumido pela API real de teste.

As evidências ficam em `.local/`, ignorado pelo Git. A suíte MySQL usa exclusivamente `127.0.0.1:33337/gai_validation_disposable`, com credenciais fictícias e armazenamento temporário em um contêiner exclusivo. O navegador usa a API de teste em `33339` e o frontend em `33340`; os administradores recebem senhas aleatórias geradas para aquela execução. Os bancos e serviços persistentes não são alvos desses testes. E-mail é simulado, sem envio externo ou uso de credenciais AWS.

Com o MySQL descartável disponível, os comandos de validação são:

```powershell
# Na pasta gai-backend
npm.cmd test -- --json --outputFile=../.local/password-backend-full.json
npm.cmd run test:integration:mysql -- --runTestsByPath test/integration/auth/password-change.e2e-spec.ts test/integration/users/user-lifecycle.e2e-spec.ts test/integration/users/access-profiles.e2e-spec.ts --json --outputFile=../.local/password-mysql-tests.json
npm.cmd run lint
npm.cmd run build

# Na pasta gai-frontend
npm.cmd test -- --maxWorkers=1 --minWorkers=1 --reporter=json --outputFile=../.local/password-frontend-final.json
npm.cmd run lint
npm.cmd run build

# Credenciais exclusivas dos fixtures de navegador; os valores não são exibidos.
$env:SEED_ADMIN_PASSWORD = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
$env:SEED_ORG_ADMIN_PASSWORD = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
$env:SEED_TEST_USER_PASSWORD = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
node node_modules/@playwright/test/cli.js test --config=playwright.credentials.config.ts
```

As suítes MySQL e de navegador recriam somente o schema descartável e devem ser executadas sequencialmente, pois usam o mesmo banco de testes. O Playwright inicia e encerra seus servidores de teste.

Ao final, o contêiner exclusivo `gai-password-mysql` foi encerrado e removido automaticamente, incluindo seu armazenamento temporário. Os contêineres persistentes `gai-mysql` e `gai-local-storage-storage-1` permaneceram em execução. As capturas dos dois temas foram inspecionadas visualmente em `.local/password-browser-artifacts/`.

## Segurança e escopo

Nenhum dado de produção, migration, configuração de infraestrutura ou funcionalidade de negócio foi alterado. Os mecanismos de hash, bloqueio de tentativas, validade de senhas provisórias, autorização e isolamento entre organizações foram preservados. Nenhum teste existente foi removido ou desabilitado.

A auditoria compara os arquivos alterados com valores sensíveis do ambiente local e credenciais de fixtures expostas anteriormente, sem exibir seus valores; também procura chaves privadas, tokens GitHub, chaves AWS e artefatos indevidos. Os resultados finais e a lista de arquivos ficam em `.local/password-security-audit.json`.

Não houve commit, staging, push, merge ou deploy desta correção.

## Arquivos modificados

Backend:

- `gai-backend/src/modules/auth/domain/value-objects/password.ts`
- `gai-backend/src/modules/auth/application/dto/credential-actions.dto.ts`
- `gai-backend/src/modules/auth/application/dto/password-reset-confirm.dto.ts`
- `gai-backend/src/modules/users/application/dto/create-user.dto.ts`
- `gai-backend/specs/003-users-roles-permissions/contracts/users-api.yaml`
- `gai-backend/test/unit/modules/auth/password.spec.ts`
- `gai-backend/test/integration/auth/password-change.e2e-spec.ts` (novo)

Frontend:

- `gai-frontend/src/api/http.ts`
- `gai-frontend/src/api/session-expiration.test.ts` (novo)
- `gai-frontend/src/features/auth/AuthContext.ts`
- `gai-frontend/src/features/auth/AuthProvider.tsx`
- `gai-frontend/src/features/auth/CredentialPages.tsx`
- `gai-frontend/src/features/auth/CredentialPages.test.tsx` (novo)
- `gai-frontend/src/features/auth/LoginPage.tsx`
- `gai-frontend/src/features/auth/loginDestination.ts` (novo)
- `gai-frontend/src/features/auth/loginDestination.test.ts` (novo)
- `gai-frontend/src/features/auth/PasswordPages.tsx`
- `gai-frontend/src/features/auth/PasswordPages.test.tsx`
- `gai-frontend/src/features/users/userFields.ts`
- `gai-frontend/src/features/users/userFields.test.ts` (novo)
- `gai-frontend/src/features/users/users.test.tsx`
- `gai-frontend/e2e-credentials/password-first-access.spec.ts` (novo)
- `gai-frontend/playwright.credentials.config.ts` (novo)

Documentação:

- `docs/reformulacao-usuarios-2026-11-02/README.md`
- `docs/reformulacao-usuarios-2026-11-02/seguranca.md`
- Este relatório.
