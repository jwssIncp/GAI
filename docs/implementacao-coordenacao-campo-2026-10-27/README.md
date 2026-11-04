# Checklist e Coordenação de Campo — GAI

27/10/2026 · America/Sao_Paulo. Implementação local funcional, com persistência SQL, interface, RBAC, testes reais e dados exclusivamente sintéticos na validação. Não houve commit, push, deploy, envio de mensagens ou acesso a produção.

## 1. Análise e decisões de arquitetura

Consultados a auditoria/matriz F060–F063, o relatório de Preparação e as correções posteriores de navegação/autorização. O arquivo legado `pendencias_campo.html` extraído foi examinado e seu SHA-256 conferido: `c09edffaf3d1552bef773c0e156c4dd3810c085f9b38abbfe7c05c0aa2723785`, correspondente à auditoria.

O legado mantinha flags de checklist no navegador, responsáveis pessoais fixos, mensagens montadas localmente e conclusão limitada aos dois primeiros grupos (`MODELO.slice(0,2)`). Essas regras não foram reproduzidas.

Reutilizados: NestJS/TypeORM/DataSource/transações, convenções de IDs, SessionAuthGuard, PermissionsGuard fail-closed, PermissionResolver, ProjectScopeService, ProjectStatusTransitionPolicy, catálogo declarativo, React Query/Axios, identidade visual e componentes de tabela, paginação, cards, formulário e diálogos. A rota foi integrada ao `ProjectLayout` com `Outlet` e à barra persistente existente.

Preparação forneceu os padrões de versão imutável, snapshot, CAS de revisão e auditoria transacional. Não foi alterada nem substituída: respostas de Kick-off/Checklist do Cliente têm semântica diferente de tarefas, prioridades, bloqueios e aprovação de campo. Por isso, o novo agregado possui tabelas próprias e não converte perguntas/respostas em tarefas. Pendências patrimoniais continuam sendo ocorrências por item com estados e permissões independentes.

Usuário autenticado, responsável administrativo e inventariante não são a mesma entidade. Usuários são selecionados da organização, ativos. Inventariantes usam `field_agents` e precisam estar ativos, sem exclusão lógica, com vínculo ativo ao projeto e dentro do período de vigência quando informado. O `user_id` opcional do inventariante é uma relação explícita, não um identificador intercambiável. Atribuir uma tarefa não cria sessão nem concede permissão ao responsável.

## 2. Funcionalidades entregues

- Modelos por organização com descrição, etapas ordenadas e IDs estáveis de tarefas; requisitos, condições e arquivamento/restauração.
- Publicação de versões imutáveis com `expected_version`; consulta de versões anteriores. Snapshot de checklist independente do modelo e de outros projetos.
- Múltiplos checklists paginados por projeto e criação idempotente a partir de versão selecionada.
- Tarefas locais adicionais, edição de título, prioridade, responsável, início previsto, prazo, notas e estado; estados validados no servidor.
- Responsáveis administrativos e inventariantes em seletores distintos, com pesquisa e paginação.
- Filtros por etapa, estado, prioridade, responsável, prazo e vencimento; listagens paginadas.
- Referência opcional a pendência patrimonial do mesmo projeto; status real e abertura do drawer autorizado já existente. Nenhum estado é sincronizado automaticamente.
- Aprovação de tarefa, conclusão de campo, reabertura motivada, arquivamento lógico e histórico antes/depois.
- Dashboard SQL por etapa e responsável, tarefas aplicáveis, concluídas, bloqueadas, vencidas, N/A e ocorrências vinculadas.
- Prévia revisável de cinco tipos de orientação, com filtros e cópia explícita; nenhuma integração de envio.

## 3. Entidades, migration e integridade

| Tabela | Responsabilidade |
|---|---|
| `field_templates` | Modelo da organização, versão corrente e arquivamento |
| `field_template_versions` | Nome, descrição e definição imutável de cada versão |
| `field_checklists` | Projeto/organização, snapshot escolhido, situação, revisão e conclusão com ator/data |
| `field_tasks` | ID estável, etapa, definição da tarefa, aplicabilidade, estado, responsável, prazo, ocorrência e aprovação |
| `field_audit_logs` | Ação, ator/data, escopo e alterações antes/depois |
| `field_commands` | Chave idempotente por organização/projeto, fingerprint canônico incluindo ator e resultado |

Migration: `gai-backend/src/migrations/1793200000001-create-field-coordination.ts`. Cria as seis tabelas, índices de filtros, unicidade de versões/tarefas/comandos, FKs e as três permissões. Um índice composto adicional em `projects(id,organization_id)` permite FK composta da instância e dos comandos. Tarefas e auditoria usam a hierarquia de checklist/organização/projeto. IDs de usuários, inventariantes e pendências são FKs e também são validados em escopo no serviço.

Todas as mutações de checklist/tarefa usam uma revisão global do agregado: UPDATE condicional da revisão antes de gravar; em conflito retorna 409 e a transação inteira é desfeita. Isso serializa inclusive tarefas diferentes da mesma instância. Auditoria e mudança persistem na mesma transação. Modelos têm CAS de versão próprio.

Criação, aprovação e transições críticas usam `command_key`. Repetir o mesmo comando retorna o resultado armazenado sem duplicar eventos; mudar conteúdo/ator usando a mesma chave retorna conflito. A fingerprint ordena chaves de objetos, mantendo ordem de arrays. Não há exclusão física pela API. O `down` é destrutivo e reservado a testes descartáveis; preserva catálogo/concessões.

### Execução local da migration

Antes da execução, confirmados `NODE_ENV=local`, `DB_HOST=localhost`, porta **3306**, banco **gai**, e uma única pendência `CreateFieldCoordination1793200000001`. A migration foi primeiro exercitada com MySQL descartável e depois aplicada somente no banco de desenvolvimento autorizado. Resultado local: **24 migrations aplicadas, nenhuma pendente**. Nenhum volume existente foi apagado.

## 4. Contratos e endpoints

Prefixo `/api/v1`. Swagger em http://localhost:3000/api/docs; a API em execução expõe 15 caminhos do módulo (alguns com mais de um verbo).

| Verbo e caminho | Operação |
|---|---|
| GET /organizations/:organizationId/field-templates | Modelos paginados, inclusive arquivados |
| POST /organizations/:organizationId/field-templates | Modelo e versão 1 |
| GET /organizations/:organizationId/field-templates/:id | Modelo/definição atual |
| PATCH /organizations/:organizationId/field-templates/:id | Nova versão, exige `expected_version` |
| GET /organizations/:organizationId/field-templates/:id/versions/:version | Versão histórica |
| POST /organizations/:organizationId/field-templates/:id/archive | Arquivar/restaurar, com versão esperada |
| GET /projects/:projectId/field-coordination/context | Projeto e responsáveis paginados (`kind=user` ou `field_agent`) |
| GET /projects/:projectId/field-coordination | Checklists paginados |
| POST /projects/:projectId/field-coordination | Criar com versão e `command_key` |
| GET /projects/:projectId/field-coordination/:id | Checklist/snapshot/revisão |
| GET /projects/:projectId/field-coordination/:id/tasks | Tarefas paginadas e revisão global corrente |
| POST /projects/:projectId/field-coordination/:id/tasks | Tarefa adicional com definição e revisão |
| PATCH /projects/:projectId/field-coordination/:id/tasks/:taskId | Editar/responder tarefa com revisão |
| POST /projects/:projectId/field-coordination/:id/tasks/:taskId/approve | Aprovar com revisão e chave idempotente |
| GET /projects/:projectId/field-coordination/:id/dashboard | Agregações SQL |
| GET /projects/:projectId/field-coordination/:id/readiness | Impedimentos estruturados de conclusão |
| POST /projects/:projectId/field-coordination/:id/transition | `complete`, `reopen` ou `archive` |
| GET /projects/:projectId/field-coordination/:id/history | Histórico com cursor `before_id` |
| GET /projects/:projectId/field-coordination/:id/message | Prévia, nunca envio |

O contrato do módulo usa camelCase nas projeções de leitura das entidades e snake_case nos DTOs de comando/filtros, conforme `fieldApi.ts`. Paginação: `page`, `page_size` (máximo 100), resposta `{items,total,page,page_size}`. Filtros de tarefa: `group_id`, `state`, `priority`, `responsible_user_id`, `field_agent_id`, `due_before`, `overdue=true`, `search`. Histórico usa cursor e limite `page_size`.

Exemplo de modelo:

```json
{
  "name": "Coordenação da organização",
  "description": "Modelo revisável de campo",
  "definition": {
    "groups": [{"id":"stage3","title":"Conferência final","order":3,"required":false}],
    "tasks": [{
      "id":"verify","group_id":"stage3","title":"Verificar entregas","order":0,
      "required":true,"allow_not_applicable":true,
      "requires_responsible":true,"requires_due_date":true,"requires_notes":true,
      "requires_approval":true,"requires_issue_resolved":false
    }]
  }
}
```

Condições opcionais em etapa ou tarefa: `applicable_if:[{"task_id":"verify","states":["completed"]}]`; todas precisam ser satisfeitas, e a tarefa de origem precisa estar aplicável. IDs inexistentes, ciclos e tipos inválidos são rejeitados. Condições de uma etapa não podem criar dependência circular com suas próprias tarefas.

Criação: `{template_id, template_version?, title, command_key}`. Atualização de tarefa: `{revision,state?,title?,priority?,responsible_user_id?,field_agent_id?,start_date?,due_date?,notes?,reason?,linked_issue_id?}`. IDs opcionais podem ser `null` para limpar o vínculo. Nunca enviar ambos os tipos de responsável. Datas civis: `YYYY-MM-DD`. Datas de conclusão/aprovação e ator são definidos exclusivamente no backend.

Aprovação: `{revision,command_key}`. Transição do checklist: `{revision,action,command_key,reason?}`; motivo obrigatório em reabertura/arquivamento. Exemplos de erros: 400 `FIELD_VALIDATION`, 409 `FIELD_CONFLICT` com `details` para impedimentos; autenticação 401, permissão/organização 403 e hierarquia/registro inexistente 404.

## 5. Permissões e isolamento

| Permissão organizacional | Operações |
|---|---|
| `field-coordination:read` | Contexto, modelos/versões, checklists, dashboard, tarefas, readiness, histórico e prévias |
| `field-coordination:edit` + read | Modelos, início de checklist, criação/edição de tarefas |
| `field-coordination:coordinate` + read | Aprovar tarefa, concluir/reabrir/arquivar checklist |

Reabrir tarefa resolvida exige **edit + coordinate + motivo novo**. O guard permanece fail-closed: todas as chaves precisam existir no catálogo com escopo válido. ORG_ADMIN recebe as permissões organizacionais pelo resolver existente, sempre restrito à sua organização. Perfis personalizados dependem de concessões reais. A migration e o seed declarativo registram o catálogo; nenhum perfil customizado recebeu permissões automaticamente. A conta `test.user` manteve a concessão anterior única de seu perfil.

Criar/alterar vínculo a ocorrência patrimonial também exige `inventory-pending-issues:read`. Sem essa leitura, tarefas/histórico/mutações não expõem o ID nem detalhes da ocorrência; exibem apenas vínculo protegido. Consultas e alteração validam projeto, organização, checklist e tarefa; modelo/versão estrangeiro não pode criar instância. Responsáveis de outra organização, inventariantes sem vínculo vigente e ocorrências de outro projeto são rejeitados.

## 6. Regras de progresso, conclusão e reabertura

- Estados de tarefa: pending, in_progress, completed, blocked, not_applicable. Bloqueada nunca conta como concluída.
- Task `required=true` **ou** etapa `required=true` torna a tarefa obrigatória. Marcar a etapa obrigatória exige todas as suas tarefas aplicáveis, independentemente da posição da etapa.
- Modelo pode exigir responsável, prazo, observações, aprovação e ocorrência resolvida. Para completed, o servidor verifica esses dados. N/A exige permissão do modelo e motivo; N/A válido resolve a tarefa sem fabricar conteúdo de execução.
- Aplicabilidade é recalculada transacionalmente com base em todas as definições da instância, inclusive tarefas adicionais. Tarefas fora de condição mantêm histórico, mas ficam fora dos denominadores.
- Percentual = `(completed + not_applicable) / tarefas aplicáveis × 100`, com uma casa decimal. Todas as etapas entram. Denominador zero retorna 0 e etapa sem tarefas aplicáveis é apresentada separadamente.
- Dashboard agrupa no SQL por etapa/estado/aplicabilidade e responsável; não carrega uma lista completa de tarefas para calcular KPIs. Contagem de pendências vinculadas é distinta por ID. Vencimento usa data civil **America/Sao_Paulo**; prazo anterior a hoje e tarefa aplicável ainda não resolvida.
- Progresso 100% não implica aprovação. Readiness verifica todas as obrigatórias aplicáveis, estados, requisitos atuais do responsável/ocorrência e aprovações. Retorna `can_complete`, revisão e blockers `{task_id,stable_id,group_id,code,message}`.
- Concluir grava usuário, data e revisão, bloqueando edição. Reabrir exige motivo e conserva eventos anteriores. Uma tarefa resolvida precisa voltar a pending/in_progress com autorização de coordenação antes de ser editada; sua aprovação é invalidada quando é reaberta/editada.
- Projetos em estados terminais/inativo continuam consultáveis, mas suas mutações de campo são bloqueadas pelo lifecycle existente. Concluir campo **não** finaliza o projeto, altera sessões, concilia ativos ou resolve ocorrências.

## 7. Interface e comunicação

Rota única: `/app/projects/:projectId/field-coordination`. A opção **Coordenação de Campo** fica ao lado de Preparação na barra persistente. Componentes: `FieldCoordinationPage`, `FieldWorkspace`, `FieldTemplates`/ModelForm, editor de definição/condições, TaskForm, TransitionForm, HistoryPanel e MessagePanel. Os formulários são acessíveis por rótulos, têm estados de erro/carregamento e layout responsivo.

Mensagens: instruções iniciais, tarefas atribuídas, pendências por responsável, atividades abertas e orientações para início do inventário. A prévia usa somente tarefas autorizadas, os filtros atuais de etapa/responsável e no máximo 100 linhas, informando quando há mais resultados. O texto aparece antes de habilitar cópia. Histórico registra a consulta, sem alegar envio/entrega. Nenhum WhatsApp, e-mail ou canal externo é acionado.

## 8. Testes e evidências

| Validação | Resultado |
|---|---|
| Política + HTTP do novo módulo em SQLite | 16 casos do módulo (6 de política e 10 HTTP); incluindo a revisão de vigência de vínculo |
| Campo + Preparação + negativas de permissões | **50 testes aprovados em 4 suítes**; não somar aos mesmos casos isolados |
| MySQL descartável 8.0, porta fixa 33317 | **16 aprovados**, migrations reais desde schema vazio e concorrência real; mesmas regras/casos, não 16 cenários adicionais distintos |
| Frontend completo | **201 aprovados em 31 arquivos** |
| Última regressão UI + árvore real de rotas | **10 aprovados** após os ajustes finais de apresentação |
| TypeScript backend e frontend | Aprovados |
| Builds Nest e Vite | Aprovados; aviso conhecido de bundle frontend >500 kB |
| ESLint dos arquivos alterados | Aprovado sem erros/avisos |
| Playwright real com ORG_ADMIN | **Aprovado**, última execução 33,6 s, zero pageerrors e zero HTTP de erro no fluxo permitido |

Cobertura: versões/snapshots, projetos independentes, IDs estrangeiros, paginação/filtros, tarefas adicionais, prioridade, datas inválidas/vencidas, etapas condicionais, terceira etapa obrigatória, N/A, requisitos, aprovação/replay idempotente, conclusão/reabertura, histórico, revisões obsoletas, disputa MySQL com um sucesso e um 409, vínculo de inventariante, ocorrência com leitura protegida/status atual, ausência de sessão, customização e catálogo ausente. Em SQLite a verificação de revisão obsoleta é sequencial, pois o driver usa uma conexão; a corrida de transações foi exercitada em MySQL real.

O MySQL de teste `gai-field-mysql-test` foi criado exclusivamente para esta entrega, com tmpfs e destino `127.0.0.1:33317/gai_validation_disposable`. O helper ignora o DB da aplicação. O container foi removido após os testes, preservando os containers/volumes de desenvolvimento. O banco local `gai` nunca foi recriado pelos testes.

Playwright autenticou normalmente `org.admin`, utilizou a empresa sintética existente e criou projetos sintéticos, modelo pela UI, checklist, tarefa, responsável, prazo e resposta. Confirmou impedimento antes de completar, persistência após refresh, aprovação, conclusão, reabertura motivada, histórico, prévia antes da cópia e navegação Campo → Itens → Campo. Testou 390×844 e rota após reload. Projetos sintéticos 6 e 7 foram mantidos para revisão; no projeto 7, checklist 2, estado aberto e revisão 5 após reabertura.

Evidências ignoradas: `.local/field-playwright/` com `.last-run.json`, `field-desktop.png`, `field-mobile.png`; `.local/field-runtime.json` com destino, permissões, instâncias e vínculos customizados. Screenshots inspecionados visualmente. Os testes não foram substituídos por mera renderização isolada da barra.

## 9. Arquivos modificados

Relação individual com SHA-256 em [arquivos.json](arquivos.json). Fontes desta entrega:

- Novo backend: seis arquivos em `gai-backend/src/modules/field-coordination/` e migration `1793200000001-create-field-coordination.ts`.
- Integração: `src/app.module.ts`, `src/scripts/seed/permissions.seed.ts`, `src/common/swagger/error-code.enum.ts` e `test/integration/test-app.helper.ts`.
- Novos testes backend: `test/unit/modules/field-coordination/field.policy.spec.ts` e `test/integration/field-coordination/field.e2e-spec.ts`.
- Novo frontend: `fieldApi.ts`, `FieldTemplates.tsx`, `FieldCoordinationPage.tsx` e seu `.test.tsx` em `src/features/field-coordination/`.
- Navegação: `src/router/projectRoutes.tsx`, `src/features/projects/ProjectLayout.tsx`.
- Teste real: `e2e/field-coordination-real.spec.ts`.
- Este relatório/manifesto. Artefatos gerados de build/cache também foram atualizados pelas ferramentas; já havia dependências/artefatos rastreados no workspace. Alterações anteriores foram preservadas, sem reset global.

Não foram alterados os módulos de Preparação, ocorrências patrimoniais, conciliação, avaliações, autenticação ou lifecycle; suas APIs/componentes foram consumidos.

## 10. Homologação local

Ambiente em execução: frontend http://localhost:5173, API http://localhost:3000/api/v1/health, Swagger http://localhost:3000/api/docs. Health direto e pelo proxy retornam 200. MySQL 3306 e storage locais preservados.

1. Entre como `org.admin` com a senha local já configurada.
2. Abra [o projeto sintético 7](http://localhost:5173/app/projects/7/summary) e clique **Coordenação de Campo**, ou use [o link direto](http://localhost:5173/app/projects/7/field-coordination).
3. Consulte as etapas/indicadores, abra a tarefa, confira responsável, prazo, notas e aprovação. Revise o histórico de conclusão/reabertura.
4. Em Modelos de campo, crie/edite uma versão; verifique que a instância existente não muda. Crie outro checklist, responda, aprove, valide a conclusão e reabra com motivo.
5. Volte para Itens/Preparação e retorne pela mesma barra. Atualize a página e confira persistência.

Comandos na raiz ou pastas indicadas:

```powershell
# Iniciar o ambiente existente, com preflight de migrations
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-start.ps1

# Backend: apenas banco de desenvolvimento explicitamente conferido
Set-Location gai-backend
npm.cmd run migration:show
# Em outro checkout local autorizado, se necessário: npm.cmd run migration:run
# Catálogo declarativo, sem concessões automáticas: npm.cmd run permissions:sync
npm.cmd test -- --runInBand test/unit/modules/field-coordination test/integration/field-coordination
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build
Set-Location ..\gai-frontend
npm.cmd test
npm.cmd run build
Set-Location ..

# Wrapper local: credenciais do .env sem imprimi-las; cria novos dados sintéticos
node .local/run-field-playwright.cjs
```

Teste real versionado é opt-in: `GAI_FIELD_REAL=1`, `GAI_E2E_LOGIN`, `GAI_E2E_PASSWORD`. A empresa sintética local usada pelo teste é ID 2, organização 1; adaptar fixtures explicitamente ao usar outro banco. Para MySQL descartável, usar o helper opt-in existente `GAI_TEST_MYSQL_DISPOSABLE=1` exclusivamente com o destino fixo 33317 e banco descartável; ele recria esse schema e nunca deve apontar para `gai`.

## 11. Limitações e pendências

- Não há bloqueio funcional identificado para o fluxo implementado. Esta entrega não é homologação de carga/produção, nem auditoria especializada de acessibilidade.
- Limites explícitos: 50 etapas, 1000 tarefas por definição/instância, 10 condições por etapa/tarefa, páginas de até 100; a UI usa páginas de 20. Prévia inclui até 100 tarefas e informa truncamento.
- Editor visual de condição escolhe um estado por condição; API aceita múltiplos estados. A criação de tarefa adicional oferece como referências de condição as tarefas do snapshot original; o backend também aceita referência a tarefas adicionais válidas. Não há clonagem entre organizações ou importação automática do checklist legado.
- Modelos/instâncias são arquivos lógicos da organização, sem exclusão física; não há retenção/limpeza automática da tabela de comandos e auditoria. Operações críticas já são seguras contra replay, mas volume/retention precisam ser dimensionados antes de uso intensivo.
- Não há upload de evidências de campo neste módulo, envio automático, cálculo de orçamento, conciliação assistida, avaliação em lote ou laudos. Nada disso foi iniciado.
- A conta customizada não ganhou direitos. Para testar outro perfil, conceder explicitamente somente as permissões necessárias e, para ocorrências, a leitura patrimonial correspondente.
- Recarregue sessões antigas para obter as três novas permissões do catálogo. Produção não recebeu migration nem configuração nesta execução.
