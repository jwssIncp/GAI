# Reformulação do cadastro e gerenciamento de inventariantes

Referência: auditoria de 04/11/2026. Implementação e verificações concluídas em 05/11/2026.

## 1. Resumo executivo

**Classificação: APTO COM RESSALVAS para homologação.** A reformulação está implementada e validada em ambientes descartáveis. A aplicação da migration no ambiente definitivo e a entrega real de convites por e-mail dependem de homologação operacional. Não houve commit, push ou deploy.

A solução mantém NestJS/TypeORM/MySQL, React/React Query/RHF/Zod, autenticação, e-mail, RBAC e componentes visuais existentes. Acrescenta elegibilidade operacional centralizada, isolamento de organização, bloqueio explícito de PLATFORM_ADMIN, controle transacional de associação de contas, convite opcional, restauração auditada, consultas de detalhes/histórico e seletores remotos. Nenhuma dependência foi adicionada.

Antes da implementação, o relatório de auditoria foi lido integralmente. O Git continha apenas a pasta não rastreada da auditoria, sem alterações locais de código. O código vigente foi conferido antes das correções e o relatório anterior foi preservado. A matriz abaixo foi preparada antes das alterações e atualizada com o resultado.

**Preservação comprovada:** comparação SHA-256 do conteúdo integral das linhas de 13 tabelas, em transações somente de leitura, confirmou igualdade entre o início e o fim do trabalho. Permanecem 10 inventariantes, 10 vínculos, 12 eventos de auditoria, 7 pagamentos, 8 despesas e 36 migrations aplicadas no banco local. A evidência [verificacao-preservacao.json](verificacao-preservacao.json) contém somente contagens e resultados de igualdade, sem dados pessoais.

## 2. Matriz A01–A16

| Achado | Situação | Implementação e evidência |
| --- | --- | --- |
| A01 — novas observações após impedimento | Corrigido | `operational-eligibility.ts` valida agente, organização, projeto, vínculo, estado e período dentro da transação; aplicado a observações, tarefas e vínculos ativos. Testes negativos para sete condições e espera real por lock no MySQL. |
| A02 — transferência incompatível de conta | Corrigido | Transferência consulta referências inclusive excluídas e retorna 409 `USER_LINKED_TO_FIELD_AGENT`. Associação e transferência compartilham locks administrativos e da conta. Teste simultâneo confirma uma operação recusada e ausência de referência cruzada. FKs compostas complementam a proteção. |
| A03 — limpeza não persistida | Corrigido | PATCH distingue omissão de `null`, enviado somente para campos alterados. Persistência testada para e-mail, telefone, documento, conta, função, início, fim e observações do vínculo. |
| A04 — documentos legados inválidos | Compatibilidade corrigida; saneamento pendente de autorização | Documento omitido permanece intacto ao editar outro campo. Informar documento inválido novamente continua recusado; limpeza explícita é permitida. Os quatro documentos reais não foram alterados nem considerados válidos. |
| A05 — falhas silenciosas | Corrigido | Feedback em cadastro, edição, mudanças de situação, exclusão, restauração, vínculo e convite; erros de confirmação permanecem visíveis no diálogo. Testes de sucesso, conflito e falha de ação. |
| A06 — ciclos operacionais e administrativos | Corrigido | Bloqueio/desativação/exclusão impedem novas atuações sem desativar a conta. Perfil criado por convite acessa somente projetos vigentes no servidor. Conta administrativa independente permanece utilizável; reativação não altera vínculos finalizados/inativos. |
| A07 — auditoria incompleta | Corrigido para operações futuras; lacunas antigas preservadas | Snapshots de criação/vinculação ampliados, atualização e auditoria na mesma transação, histórico paginado com executor. Incluídos RESTORE e INVITE_USER; whitelist exclui metadata arbitrária e segredos. Não foram fabricados eventos retroativos. |
| A08 — divergência ORM/MySQL | Corrigido no código; aplicação definitiva pendente | Entidades reproduzem unicidades e FKs; nova migration com preflight, unicidade da conta não excluída e FKs organizacionais. Testes reais de índice único/FKs, idempotência e down/up/up preservando linhas passaram no MySQL 8. |
| A09 — plataforma no fluxo operacional | Corrigido | Proibição anterior ao bypass administrativo, também na regra de escopo/serviço e UI. Papel de plataforma combinado com outros papéis continua proibido nas permissões. Testes de API, helper e navegador. |
| A10 — identificação após exclusão | Corrigido | E-mail/documento continuam reservados, mensagem orienta consulta aos excluídos, restauração explícita exige permissão de reativar e retorna agente inativo. A conta pode ser reutilizada somente quando não há outro agente não excluído; restauração revalida conflitos. |
| A11 — ID manual e cardinalidade | Corrigido | Seletor remoto por nome/login/e-mail, situação da conta, mesmo tenant, exclusão de contas de plataforma e de contas já vinculadas. Cardinalidade 1:1 para agentes não excluídos, com transação e índice gerado. Cadastro sem conta e convite reutilizando Users/Auth. |
| A12 — detalhes limitados | Corrigido | Dados, organização por nome, identidade/situação da conta, situação operacional, projetos por nome, função, período, estado, histórico e impedimentos. Histórico de excluídos acessível mediante permissão. |
| A13 — pesquisa/paginação | Corrigido | Debounce de 350 ms, telefone e documentos pesquisáveis, ordem estável nome/ID e vínculos por data/ID. Seletores remotos removem corte de 100 pessoas inclusive no financeiro. |
| A14 — validação e interface | Corrigido no escopo testado | Validações alinhadas, labels, obrigatoriedade, seções, loading e prevenção de envio repetido. Oito testes Chromium com temas claro/escuro e larguras desktop/tablet/mobile; ver limites de acessibilidade abaixo. |
| A15 — matriz de testes | Ampliado e validado | Testes unitários, integração SQLite, MySQL real descartável, frontend e navegador. Segurança, escopo, convite/ativação, nulabilidade, concorrência e preservação incluídos. |
| A16 — registro de caminhos legados | Corrigido | Removidos de `UsersModule` os providers/imports de ativação/desativação legados sem consumidor. As classes continuam no repositório para compatibilidade com testes/referências existentes; o fluxo público usa `UserLifecycleService`. |

## 3. Arquivos criados e modificados

O inventário completo está no final deste relatório, separado por arquivos novos e modificados. A documentação anterior de auditoria já existia no início e não integra as mudanças de implementação.

Os impactos fora de `field-agents` têm finalidade delimitada:

- **Auth/RBAC:** veto de plataforma e restrição dos projetos do perfil de campo criado pelo convite.
- **Users:** hook transacional reutilizável na criação existente, proteção de transferência e exportação do serviço de ciclo de vida.
- **Projects:** transporte e aplicação de `allowedProjectIds` antes da paginação/contagem.
- **Inventário e coordenação:** consumo da mesma elegibilidade na transação que grava a operação.
- **Financeiro:** somente seleção remota de pessoas no frontend. Fórmulas, estados, serviços, valores e regras financeiras do backend não foram modificados.

## 4. Migration e integridade

Arquivo: `gai-backend/src/migrations/1794300000001-harden-field-agent-identity.ts`.

A migration `HardenFieldAgentIdentity1794300000001`:

1. Verifica contas repetidas em agentes não excluídos e inconsistências organizacionais em contas/vínculos antes de executar DDL. Em conflito, interrompe com erro; não desassocia, transfere nem saneia registros.
2. Cria `live_user_id` gerado e armazenado: `CASE WHEN deleted_at IS NULL THEN user_id ELSE NULL END`. O índice único `uq_field_agents_live_user` permite múltiplos agentes sem conta e preserva referências de excluídos.
3. Cria unicidades de `(id, organization_id)` em agentes e usuários para as referências compostas; reutiliza a unicidade de projeto existente.
4. Acrescenta FKs compostas de agente/conta e vínculo/agente/projeto, impedindo divergência de tenant também em escrita SQL direta.
5. Registra a expressão no `typeorm_metadata`, verifica existência de colunas/índices/FKs e permite reaplicação idempotente. `down` remove apenas os acréscimos desta migration e sua metadata.

Os índices existentes de e-mail/documento por organização, projeto/status, agente/status e `active_assignment_key` foram mantidos. As entidades TypeORM passaram a declarar as garantias correspondentes, inclusive FKs existentes. O modelo de testes SQLite continua restrito ao ambiente de testes; a aplicação utiliza migrations e não ganhou `synchronize: true`.

No MySQL descartável, o índice da conta rejeitou duplicidade com `ER_DUP_ENTRY`; as FKs rejeitaram referências cruzadas com `ER_NO_REFERENCED_ROW_2`. Foram executados `up` repetido e `down/up/up` com comparação dos dados de negócio. **A migration não foi aplicada no MySQL local existente.**

## 5. Segurança implementada

Todas as rotas usam sessão, permissões granulares e escopo organizacional. PLATFORM_ADMIN é recusado no módulo mesmo com permissões explícitas ou papéis combinados. A proteção de backend acompanha ocultação da navegação e bloqueio da rota no frontend.

A organização do agente é derivada da sessão. `organization_id` não integra os DTOs de criação/edição de agentes; payload arbitrário é rejeitado. Listagens e IDs de agente, projeto, vínculo, conta, histórico e restauração são novamente verificados no servidor.

Associação de conta exige mesma organização, ausência de papel de plataforma e inexistência de outro agente não excluído. Transferência inclui referências históricas/excluídas na verificação e exige desassociação explícita antes de trocar a organização. Nenhum vínculo é corrigido automaticamente. Para referência em agente excluído, o procedimento autorizado é restaurar como inativo, desassociar e só então transferir; exclusão posterior pode ser feita separadamente.

Associação e transferência usam os locks administrativos já existentes e o lock de usuário antes do agente. Novas operações usam projeto → agente → vínculo e mantêm a transação aberta até a gravação. Atualizações cadastrais conferem os valores anteriores dos campos alterados; mudanças concorrentes incompatíveis retornam conflito. Vínculos também conferem a revisão temporal antes de gravar/finalizar. O índice único e as FKs atuam como proteção adicional.

## 6. Cadastro e acesso opcional

- **Sem acesso:** cria somente o inventariante. Um operador autorizado pode registrar sua atuação em projeto elegível, sem gerar usuário automaticamente.
- **Conta existente:** seletor paginado por nome/login/e-mail, exibindo nome, e-mail e situação. O vínculo não concede novos perfis, não ativa a conta e não redefine senha.
- **Convite:** exclusivo do administrador da organização com `field-agents:update` e `users:write`. Reutiliza criação, convite, ativação, definição/recuperação de senha e sessão de Users/Auth. Criação de conta, papéis, associação e auditoria são atômicas; envio usa o mecanismo de e-mail existente após a confirmação da transação.

O perfil organizacional `FIELD_AGENT_ORG_<organização>` é criado somente no primeiro convite, com `projects:read`, `inventory-items:read`, `inventory-sessions:read` e `inventory-observations:create`, todos em escopo ORGANIZATION, junto ao papel sistêmico básico ORG_USER. O serviço recusa catálogo incompleto ou perfil existente com grants diferentes dos quatro esperados. Não concede funções administrativas/financeiras. A função textual do vínculo no projeto não participa de RBAC.

Para esse perfil, o servidor limita a lista e o acesso direto aos projetos do próprio agente ativo, não excluído, com vínculo ativo e vigente. Perfil administrativo independente continua regido pelas permissões administrativas; a atribuição de novas atuações continua validando o agente escolhido. Conta de campo não pode registrar atuação em nome de outra pessoa.

O envio diferencia `SENT`, `DEVELOPMENT` e `FAILED`. Os dois últimos nunca são apresentados como entrega. Conta pendente pode receber reenvio, sem duplicação. Identificadores duplicados retornam conflito pelo serviço existente. O cadastro inicial da pessoa e o convite são duas chamadas: se o convite falhar antes de criar a conta, o cadastro da pessoa permanece válido sem acesso; a tela retém o ID para não criar outra pessoa numa nova tentativa. Depois de criar a conta, usa-se reenvio nos detalhes.

Rotas acrescentadas sob `/api/v1`:

| Método/rota | Permissões |
| --- | --- |
| GET `/field-agents/context` | `field-agents:read` |
| GET `/field-agents/user-options` | `field-agents:read` + `users:read` |
| GET `/field-agents/:id/record` | `field-agents:read`; inclui excluídos do próprio tenant |
| GET `/field-agents/:id/projects` | `field-agents:read` + `project-field-agents:read` |
| GET `/field-agents/:id/history` | `field-agents:read` |
| POST `/field-agents/:id/restore` | `field-agents:reactivate` |
| POST `/field-agents/:id/invite` | `field-agents:update` + `users:write`, ORG_ADMIN |
| POST `/field-agents/:id/resend-invitation` | `field-agents:update` + `users:write`, regras existentes de Users |

Consultas paginadas usam `page` e `page_size` (máximo 100). `user-options` aceita `search` e `current_agent_id`, revalidado no tenant. A listagem aceita `deletion=current|deleted`, `exclude_project_id`, situação e pesquisa. O GET tradicional `/:id` preserva a semântica anterior para excluídos; `/record` é a consulta histórica explícita. PATCH omite campos intocados e envia `null` para limpeza de opcionais.

## 7. Desativação e preservação histórica

Estados permanecem `active`, `inactive`, `blocked`, além de `deleted_at`. Desativar, bloquear ou excluir impede novas observações, atribuições e vínculos ativos. Não exclui vínculos, observações, tarefas, pagamentos, despesas ou auditorias; não muda valores financeiros, documentos ou situação administrativa da conta.

Reativação não reativa vínculos. Restauração é explícita, autorizada, auditada e retorna o agente como inativo. E-mail/documento continuam reservados após exclusão, prevenindo duplicação de identidade; a UI permite consultar excluídos e restaurá-los. O restabelecimento de conta também respeita unicidade e organização.

As quatro inconsistências documentais e as lacunas antigas de CREATE/ASSIGN_TO_PROJECT permanecem como estavam. Novos eventos não incluem metadata livre, senhas, hashes ou tokens. Eventos antigos não são reescritos; a consulta exibe somente campos autorizados do diff.

A conferência de preservação local incluiu agentes, vínculos, auditorias, usuários, atribuições de papéis, papéis, permissões dos papéis, observações, tarefas, pagamentos, despesas, prestações de contas e migrations. O teste descartável também compara observações, vínculos, pagamentos, despesas e eventos de auditoria existentes após bloqueio/desativação/exclusão.

## 8. Projetos e operações

A elegibilidade central verifica agente existente na organização, sem exclusão, ativo; projeto correspondente e operacional; vínculo ativo; início/fim inclusivos quando preenchidos. O dia civil segue `America/Sao_Paulo`; datas de vínculo mantêm o transformer civil existente.

Observações e atribuições de tarefas revalidam a elegibilidade dentro da transação. Criação/reativação de vínculos ativos revalida agente e período; projetos que não permitem mutações continuam protegidos pela política existente. A coordenação mantém seu contrato de erro 400 para atribuição inválida; observações usam conflitos 409. Repetição de observação com chave idempotente pode devolver o registro já gravado, sem autorizar nova atuação.

O painel de projeto oferece busca, filtro de estado, paginação, função/período, indicação de vínculo encerrado/fora de vigência, confirmação de finalização, feedback e exclusão remota de pessoas já vinculadas ativamente. Somente agentes ativos e não excluídos aparecem como opções para novas vinculações. O backend continua sendo a autoridade final.

## 9. Frontend

Foram mantidos tema, componentes, cores, tipografia e navegação do GAI. O formulário apresenta dados pessoais/contato, acesso e informações operacionais. A organização aparece somente para consulta e mudanças de situação usam as ações já identificadas na listagem.

A pesquisa tem debounce, consulta remota, telefone/documento normalizados e ordem estável. A listagem trata loading, vazio, erro, filtros e excluídos. Formulários preservam entrada em conflito, enviam somente alterações e permitem limpeza explícita de campos. Dados legados inválidos têm aviso e não são reenviados sem alteração.

Detalhes mostram nomes, conta/situação, estado operacional, projetos, função/período, histórico com executor e valores antes/depois, avisos e reenvio de convite. As ações dependem das permissões existentes. Seletores de inventariantes têm pesquisa/paginação remotas, incluindo os formulários e filtros financeiros, sem carregar toda a organização.

A verificação Chromium cobriu 1440×960, 768×1024 e 390×844, ambos os temas, labels, foco via Tab, ausência de overflow horizontal e erros JavaScript. Houve inspeção visual das capturas desktop escuro e mobile claro. Isso não substitui auditoria WCAG completa, teste com leitor de tela ou homologação em todos os navegadores.

## 10. Testes e resultados

Os resultados abaixo correspondem às execuções finais bem-sucedidas; contagens sobrepostas entre execuções não devem ser somadas como testes únicos.

| Verificação | Resultado |
| --- | --- |
| Backend unitário completo | 64 suites, 479 testes aprovados |
| Backend integração SQLite: agentes, campo, inventário, usuários, troca/recuperação de senha, projetos e financeiro | 8 suites, 113 aprovados e 3 condicionais MySQL não executados nesse motor |
| MySQL descartável: reforma + coordenação de campo | 2 suites, 40 testes aprovados |
| Frontend focado: agentes, permissões e financeiro | 5 arquivos, 57 testes aprovados |
| Frontend completo | 60 arquivos, 369 testes aprovados |
| MySQL: regressão do ciclo de usuários, incluindo os três testes condicionais | 1 suite, 37 testes aprovados |
| Chromium | 8 testes aprovados |
| TypeScript backend/frontend | Aprovado |
| ESLint backend/frontend | Aprovado |
| Build Nest e Vite | Aprovado |
| Preservação do MySQL local | 13/13 tabelas idênticas |
| `git diff --check` | Aprovado; avisos de conversão LF/CRLF do Git no Windows |

Ambiente MySQL: versão 8.0.46, container exclusivo `gai-field-agents-validation-20261104`, bind em `127.0.0.1:33337`, banco `gai_validation_disposable`, dados sintéticos em tmpfs. O helper fixa alvo e credenciais de teste, ignorando DB_* do banco da aplicação. SQLite utiliza memória. Nenhum teste mutante foi apontado para o MySQL local da aplicação. O container descartável é encerrado ao final.

No MySQL foram exercitados: associação simultânea 1:1; disputa associação/transferência; espera real em `performance_schema.data_lock_waits`; bloqueio durante atuação; FKs/índices reais; migration idempotente e reversão; campos nulos; legado; restauração; convite/ativação; restrição de projeto e ausência de acesso financeiro. Os testes de navegador interceptam a API e usam sessão/dados sintéticos: validam UI, não representam ponta a ponta contra backend real. As integrações HTTP Nest/Supertest validam o backend e o MySQL separadamente.

Durante o desenvolvimento foram encontrados e corrigidos: fixture organizacional duplicada; expressão SQL de transferência com mapeamento incorreto de coluna; diferença de status HTTP esperada na coordenação; expectativas de mock e seletor ambíguo no frontend. Uma execução inicial no container descartável apresentou timeout no preparo repetido do schema; somente esse container foi recriado com tmpfs e a execução final passou. O comando amplo de lint incluindo `.cjs` encontrou arquivos fora do projeto TypeScript; o comando oficial de lint para `*.ts` foi executado depois, com sucesso. Falhas intermediárias não são tratadas como aprovações.

Comandos para reprodução (a partir de cada projeto, após preparar exclusivamente banco descartável quando necessário):

```powershell
# gai-backend
npm run test:unit
node test/run-tests.cjs sqlite --runTestsByPath test/integration/field-agents/field-agents.e2e-spec.ts test/integration/field-coordination/field.e2e-spec.ts test/integration/inventory-operations/inventory-operations.e2e-spec.ts test/integration/users/user-lifecycle.e2e-spec.ts test/integration/auth/password-change.e2e-spec.ts test/integration/auth/password-reset.e2e-spec.ts test/integration/projects/project-registration.e2e-spec.ts test/integration/payments-expenses/payments-expenses.e2e-spec.ts
node test/run-tests.cjs mysql --runTestsByPath test/integration/field-agents/field-agent-reform.e2e-spec.ts test/integration/field-coordination/field.e2e-spec.ts
node test/run-tests.cjs mysql --runTestsByPath test/integration/users/user-lifecycle.e2e-spec.ts
npx tsc --noEmit
npm run lint
npm run build
# gai-frontend
npx vitest run --config vitest.config.ts --no-cache --maxWorkers=2 --minWorkers=1
npx playwright test --config playwright.field-agents.config.ts
npx tsc --noEmit -p tsconfig.app.json --incremental false
npm run lint
npm run build
```

A evidência [resultados-testes.json](resultados-testes.json) registra comandos, contagens e códigos de saída sem copiar logs de requisições ou dados pessoais. Logs técnicos e capturas ficaram em `.local/field-agents-*`, ignorados pelo Git. A suite frontend completa emitiu avisos já existentes do Recharts sobre dimensões de gráficos em jsdom; nenhum teste falhou por isso.

## 11. Pendências e limitações

- Homologar a migration em cópia autorizada do ambiente de destino e aplicá-la mediante o processo de implantação. O banco local permanece no schema anterior deliberadamente; a nova versão não deve ser iniciada ali antes da migration.
- Validar entrega e reenvio com provedor real de e-mail, URL pública e destinatário autorizado. Foram comprovados os fluxos mock DEVELOPMENT, FAILED e ativação, não recebimento real no provedor.
- Documentos inválidos e lacunas históricas de auditoria continuam pendentes de autorização específica para eventual saneamento. Não bloqueiam edição de outros campos.
- Chromium automatizado e inspeção visual limitada não abrangem todos os navegadores, leitores de tela ou critérios WCAG. Homologação humana dos fluxos reais permanece necessária.
- Não foi executada a totalidade das suites de integração de todos os demais módulos nem ensaio de carga. Foram executados os testes unitários completos e a regressão dos módulos atingidos.
- Não há aprovação para publicação, transferência real de usuários ou envio de mensagens a terceiros; nenhuma dessas ações foi realizada.

Essas ressalvas impedem classificar a entrega como APTO irrestrito para produção.

## 12. Homologação e implantação

1. Revisar as mudanças e obter autorização para o ambiente de destino. Preparar backup pelo procedimento da organização e janela para DDL; não executar reset/synchronize.
2. Em cópia autorizada MySQL 8, confirmar as migrations anteriores e executar as consultas de preflight da nova migration: conta repetida em agentes não excluídos e divergência de organização em contas/vínculos. Se houver conflito, interromper e solicitar decisão específica; não automatizar correção.
3. Aplicar `npm run migration:run` no fluxo de desenvolvimento/homologação ou `npm run migration:run:prod` no release autorizado. Conferir coluna gerada, índices e FKs, além da ausência de mudanças de dados de negócio. MySQL DDL pode confirmar implicitamente; em falha parcial, inspecionar estrutura e reaplicar a migration idempotente após resolver a causa.
4. Publicar backend/frontend compatíveis pelo fluxo existente somente após aprovação. Nenhum comando de release/seed foi executado neste trabalho. Verificar catálogo dos quatro grants ORGANIZATION; perfil de campo é criado sob demanda no convite.
5. Configurar o serviço de e-mail existente e URL de ativação em homologação; confirmar entrega, reenvio, ativação, login e recuperação com conta de teste autorizada. Não apresentar DEVELOPMENT/FAILED como entrega.
6. Homologar ORG_ADMIN, conta granular, conta convidada e plataforma: cadastrar sem acesso, associar conta, convidar, limpar campos, vincular, bloquear durante atuação, consultar histórico, restaurar e tentar IDs de outro tenant. Confirmar preservação das referências financeiras.
7. Monitorar conflitos 409, erros de FK, latência/espera de locks e falhas de envio. Se necessário reverter código, coordenar a versão com a migration; `down` reduz garantias de integridade e exige janela/autorização. Não apaga dados de negócio, mas não desfaz convites ou operações legítimas já realizados.

## 13. Riscos de regressão e mitigação

| Risco | Mitigação |
| --- | --- |
| Lock administrativo global serializa associação/transferência | Reutiliza a ordem já existente; testes concorrentes confirmam integridade. Monitorar contenção e latência em carga real. |
| DDL em tabelas existentes e falha parcial | Preflight sem saneamento, backup autorizado, janela, verificação de estrutura, idempotência e down/up testados. |
| Perfis administrativos combinados com perfil de campo | Acesso administrativo independente preservado; atuação do agente alvo sempre validada. Plataforma tem veto explícito anterior a bypass. |
| Campo opcional limpo acidentalmente | PATCH restrito a dirty fields; `null` somente em limpeza explícita; persistência testada. |
| Documento legado inválido bloquear edição | Compatibilidade somente quando omitido; novos valores continuam validados. Sem normalização em lote. |
| Exclusão parecer liberar identidade | Identificadores reservados, conflito explicativo, consulta de excluídos e restauração inativa auditada. |
| E-mail indisponível deixar pessoa sem acesso | Estados de entrega explícitos, conta pendente e reenvio sem duplicação; cadastro sem conta é válido. |
| Seleção financeira perder referências antigas | Filtros remotos incluem situações históricas e formulários preservam a opção já selecionada; nenhum cálculo/backend financeiro alterado; regressão financeira passou. |
| Mudança de regras de projeto/campo | Política existente preservada, validação comum com lock e testes nos dois motores; respostas anteriores de coordenação mantidas. |

## Inventário de arquivos

### Criados (15)

- [docs/reformulacao-inventariantes-2026-11-04/README.md](../../docs/reformulacao-inventariantes-2026-11-04/README.md)
- [docs/reformulacao-inventariantes-2026-11-04/resultados-testes.json](../../docs/reformulacao-inventariantes-2026-11-04/resultados-testes.json)
- [docs/reformulacao-inventariantes-2026-11-04/verificacao-preservacao.json](../../docs/reformulacao-inventariantes-2026-11-04/verificacao-preservacao.json)
- [gai-backend/src/migrations/1794300000001-harden-field-agent-identity.ts](../../gai-backend/src/migrations/1794300000001-harden-field-agent-identity.ts)
- [gai-backend/src/modules/field-agents/application/dto/field-agent-management.dto.ts](../../gai-backend/src/modules/field-agents/application/dto/field-agent-management.dto.ts)
- [gai-backend/src/modules/field-agents/application/services/field-agent-audit.ts](../../gai-backend/src/modules/field-agents/application/services/field-agent-audit.ts)
- [gai-backend/src/modules/field-agents/application/services/field-agent-management.service.ts](../../gai-backend/src/modules/field-agents/application/services/field-agent-management.service.ts)
- [gai-backend/src/modules/field-agents/application/services/operational-eligibility.ts](../../gai-backend/src/modules/field-agents/application/services/operational-eligibility.ts)
- [gai-backend/test/integration/field-agents/field-agent-reform.e2e-spec.ts](../../gai-backend/test/integration/field-agents/field-agent-reform.e2e-spec.ts)
- [gai-backend/test/unit/modules/field-agents/operational-eligibility.spec.ts](../../gai-backend/test/unit/modules/field-agents/operational-eligibility.spec.ts)
- [gai-frontend/e2e/field-agents-reform.spec.ts](../../gai-frontend/e2e/field-agents-reform.spec.ts)
- [gai-frontend/playwright.field-agents.config.ts](../../gai-frontend/playwright.field-agents.config.ts)
- [gai-frontend/src/features/field-agents/FieldAgentUserSelect.tsx](../../gai-frontend/src/features/field-agents/FieldAgentUserSelect.tsx)
- [gai-frontend/src/features/field-agents/fieldAgentSchemas.test.ts](../../gai-frontend/src/features/field-agents/fieldAgentSchemas.test.ts)
- [gai-frontend/src/features/field-agents/useDebouncedValue.ts](../../gai-frontend/src/features/field-agents/useDebouncedValue.ts)

### Modificados (46)

- [gai-backend/src/modules/auth/application/services/permission-access.ts](../../gai-backend/src/modules/auth/application/services/permission-access.ts)
- [gai-backend/src/modules/auth/infrastructure/persistence/user.entity.ts](../../gai-backend/src/modules/auth/infrastructure/persistence/user.entity.ts)
- [gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts)
- [gai-backend/src/modules/field-agents/application/dto/list-field-agents-query.dto.ts](../../gai-backend/src/modules/field-agents/application/dto/list-field-agents-query.dto.ts)
- [gai-backend/src/modules/field-agents/application/dto/project-field-agent.dto.ts](../../gai-backend/src/modules/field-agents/application/dto/project-field-agent.dto.ts)
- [gai-backend/src/modules/field-agents/application/errors/field-agent-conflict.ts](../../gai-backend/src/modules/field-agents/application/errors/field-agent-conflict.ts)
- [gai-backend/src/modules/field-agents/application/services/field-agent-scope.service.ts](../../gai-backend/src/modules/field-agents/application/services/field-agent-scope.service.ts)
- [gai-backend/src/modules/field-agents/application/use-cases/assign-project-field-agent.use-case.ts](../../gai-backend/src/modules/field-agents/application/use-cases/assign-project-field-agent.use-case.ts)
- [gai-backend/src/modules/field-agents/application/use-cases/create-field-agent.use-case.ts](../../gai-backend/src/modules/field-agents/application/use-cases/create-field-agent.use-case.ts)
- [gai-backend/src/modules/field-agents/application/use-cases/list-field-agents.use-case.ts](../../gai-backend/src/modules/field-agents/application/use-cases/list-field-agents.use-case.ts)
- [gai-backend/src/modules/field-agents/application/use-cases/list-project-field-agents.use-case.ts](../../gai-backend/src/modules/field-agents/application/use-cases/list-project-field-agents.use-case.ts)
- [gai-backend/src/modules/field-agents/domain/enums/field-agent-audit-operation.enum.ts](../../gai-backend/src/modules/field-agents/domain/enums/field-agent-audit-operation.enum.ts)
- [gai-backend/src/modules/field-agents/domain/ports/field-agent.repository.port.ts](../../gai-backend/src/modules/field-agents/domain/ports/field-agent.repository.port.ts)
- [gai-backend/src/modules/field-agents/field-agents.module.ts](../../gai-backend/src/modules/field-agents/field-agents.module.ts)
- [gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity.ts](../../gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity.ts)
- [gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent.entity.ts](../../gai-backend/src/modules/field-agents/infrastructure/persistence/field-agent.entity.ts)
- [gai-backend/src/modules/field-agents/infrastructure/persistence/project-field-agent.entity.ts](../../gai-backend/src/modules/field-agents/infrastructure/persistence/project-field-agent.entity.ts)
- [gai-backend/src/modules/field-agents/infrastructure/persistence/typeorm-field-agent.repository.ts](../../gai-backend/src/modules/field-agents/infrastructure/persistence/typeorm-field-agent.repository.ts)
- [gai-backend/src/modules/field-agents/presentation/field-agents.controller.ts](../../gai-backend/src/modules/field-agents/presentation/field-agents.controller.ts)
- [gai-backend/src/modules/field-coordination/field.service.ts](../../gai-backend/src/modules/field-coordination/field.service.ts)
- [gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts](../../gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts)
- [gai-backend/src/modules/projects/application/services/project-scope.service.ts](../../gai-backend/src/modules/projects/application/services/project-scope.service.ts)
- [gai-backend/src/modules/projects/application/use-cases/list-projects.use-case.ts](../../gai-backend/src/modules/projects/application/use-cases/list-projects.use-case.ts)
- [gai-backend/src/modules/projects/domain/ports/project.repository.port.ts](../../gai-backend/src/modules/projects/domain/ports/project.repository.port.ts)
- [gai-backend/src/modules/projects/infrastructure/persistence/project.entity.ts](../../gai-backend/src/modules/projects/infrastructure/persistence/project.entity.ts)
- [gai-backend/src/modules/projects/infrastructure/persistence/typeorm-project.repository.ts](../../gai-backend/src/modules/projects/infrastructure/persistence/typeorm-project.repository.ts)
- [gai-backend/src/modules/projects/presentation/projects.controller.ts](../../gai-backend/src/modules/projects/presentation/projects.controller.ts)
- [gai-backend/src/modules/users/application/services/user-lifecycle.service.ts](../../gai-backend/src/modules/users/application/services/user-lifecycle.service.ts)
- [gai-backend/src/modules/users/users.module.ts](../../gai-backend/src/modules/users/users.module.ts)
- [gai-backend/test/integration/field-coordination/field.e2e-spec.ts](../../gai-backend/test/integration/field-coordination/field.e2e-spec.ts)
- [gai-frontend/src/api/endpoints.ts](../../gai-frontend/src/api/endpoints.ts)
- [gai-frontend/src/features/auth/permissions.test.ts](../../gai-frontend/src/features/auth/permissions.test.ts)
- [gai-frontend/src/features/auth/permissions.ts](../../gai-frontend/src/features/auth/permissions.ts)
- [gai-frontend/src/features/field-agents/FieldAgentDetailDrawer.tsx](../../gai-frontend/src/features/field-agents/FieldAgentDetailDrawer.tsx)
- [gai-frontend/src/features/field-agents/FieldAgentForm.tsx](../../gai-frontend/src/features/field-agents/FieldAgentForm.tsx)
- [gai-frontend/src/features/field-agents/FieldAgentSelect.tsx](../../gai-frontend/src/features/field-agents/FieldAgentSelect.tsx)
- [gai-frontend/src/features/field-agents/FieldAgentsPage.test.tsx](../../gai-frontend/src/features/field-agents/FieldAgentsPage.test.tsx)
- [gai-frontend/src/features/field-agents/FieldAgentsPage.tsx](../../gai-frontend/src/features/field-agents/FieldAgentsPage.tsx)
- [gai-frontend/src/features/field-agents/ProjectFieldAgentsPanel.tsx](../../gai-frontend/src/features/field-agents/ProjectFieldAgentsPanel.tsx)
- [gai-frontend/src/features/field-agents/fieldAgentSchemas.ts](../../gai-frontend/src/features/field-agents/fieldAgentSchemas.ts)
- [gai-frontend/src/features/field-agents/fieldAgentsQueries.ts](../../gai-frontend/src/features/field-agents/fieldAgentsQueries.ts)
- [gai-frontend/src/features/finance/ExpenseForm.tsx](../../gai-frontend/src/features/finance/ExpenseForm.tsx)
- [gai-frontend/src/features/finance/PaymentForm.tsx](../../gai-frontend/src/features/finance/PaymentForm.tsx)
- [gai-frontend/src/features/finance/ProjectFinancePage.tsx](../../gai-frontend/src/features/finance/ProjectFinancePage.tsx)
- [gai-frontend/src/features/finance/financeQueries.ts](../../gai-frontend/src/features/finance/financeQueries.ts)
- [gai-frontend/src/types/api.ts](../../gai-frontend/src/types/api.ts)
