# GAI — Kick-off e Checklist do Cliente

27/10/2026 · America/Sao_Paulo.

**Módulo funcional implementado**, com persistência SQL, modelos versionados por organização, instâncias independentes de Kick-off/Checklist do Cliente, respostas tipadas, regras condicionais no servidor, responsáveis, datas, progresso, aprovação, histórico e prévias de comunicação. Interface integrada ao workspace do projeto, usando os componentes e a identidade visual existentes. Nenhum envio de mensagem, commit, push ou deploy foi realizado.

## Referências e análise prévia

Foram utilizados o [inventário funcional](../auditoria-legado-gai-2026-10-27/inventario-funcional.md), a [matriz F054–F059](../auditoria-legado-gai-2026-10-27/matriz-comparativa.md), os anexos e manifestos da auditoria, a [validação técnica](../validacao-tecnica-gai-2026-10-27/README.md) e a última entrega localizada pelo conteúdo: [correção das pendências críticas](../correcao-pendencias-criticas-gai-2026-10-27/README.md). O diretório desta última é `docs/correcao-pendencias-criticas-gai-2026-10-27/`, não o nome sugerido no pedido.

O ZIP original continua disponível em `C:/Users/Jonathan/Downloads/deploy-6adf9b21af66f3795090e396.zip`. Também foram lidos os HTMLs já extraídos em `C:/Users/Jonathan/AppData/Local/Temp/gai-legacy-audit-20261027/paineis/`. Seus hashes coincidem com a auditoria:

- `kickoff.html`: `cf8d9dfb35d370f43e89026b9b62d1d7ffe3f610432d108436f70c70ea6aa3ba`.
- `checklist_cliente.html`: `d2bafd953ffe87fa3cfd67f366559f73824fd5ca68f3e6b741e94155cae43654`.

Foram examinados módulos, controllers, services, repositories, DTOs, entidades e migrations de projetos, empresas/unidades, prestação de contas, autenticação, catálogo e guard corrigido. No frontend, foram reutilizados PageContainer, PageHeader, Tabs, FormField, Input, Button, ModalForm/DrawerForm/ConfirmDialog, ProgressCard e estados compartilhados. Autenticação e componentes compartilhados não foram modificados.

O workspace já continha alterações staged/unstaged e arquivos novos das entregas anteriores. O estado de entrada foi registrado em `.local/project-preparation-20261027/baseline-status.txt`; nenhuma restauração global ou sobrescrita desses trabalhos foi feita. Os arquivos desta etapa estão em [arquivos.json](arquivos.json), com hashes. [referencias.json](referencias.json) registra as referências e a integridade dos documentos anteriores.

| Referência | Implementação |
|---|---|
| F054 | Instâncias de Kick-off com respostas estruturadas, responsáveis, datas e histórico. |
| F055 | Tipo e aba próprios do Checklist do Cliente, sem compartilhamento de respostas. |
| F056 | Condições por ID estável, N/A explícito e validação de intervalo/quantidade de etiquetas no backend. |
| F057 | Unidades existentes vinculadas ao projeto, alocação de quantidades e participação calculada com uma casa decimal. |
| F058 | Texto, ordem, visibilidade e obrigatoriedade versionados; denominador de progresso explícito. |
| F059 | Prévia revisável de e-mail e orientação técnica, com cópia e sem envio. |

## 1. Arquitetura

`ProjectPreparationModule` segue a composição NestJS/TypeORM existente:

- **Controllers:** autenticação de sessão, PermissionsGuard, DTOs e permissões específicas por operação.
- **PreparationService:** validação de organização/projeto, casos de uso, transações, revisão, aprovação, histórico e comunicação.
- **PreparationRepository:** acesso TypeORM e consultas que incluem organização, projeto e instância.
- **Política de domínio:** validação dos modelos/respostas, grafo de condições, aplicabilidade, sequências e progresso.
- **Frontend:** contratos tipados, API/React Query, página do projeto, formulários de respostas/dados e gestão visual de modelos.

Dados de empresa, unidades e usuários são consultados nos cadastros existentes. A preparação não cria empresas, endereços ou pessoas paralelas, não usa `localStorage` como persistência e não depende de storage remoto.

Modelos possuem versões imutáveis. A instância referencia a versão e guarda seu snapshot de perguntas, textos, ordem e regras. Atualizar ou arquivar o modelo não modifica o snapshot nem as respostas existentes. IDs de perguntas são estáveis dentro do modelo/snapshot, sem relação com posição do array; mudar o tipo de uma pergunta existente exige novo ID. A verificação considera também versões históricas, não apenas a versão atual.

Edições de instância/respostas usam `revision`; publicação de modelo usa `expected_version`. Além da checagem inicial, um UPDATE condicional no banco garante que uma revisão concorrente não seja sobrescrita. Respostas e eventos são gravados na mesma transação. Um lote inválido não deixa respostas parciais.

## 2. Entidades e migration

| Tabela | Conteúdo e relações |
|---|---|
| `preparation_templates` | Organização, nome, tipo, versão atual e arquivamento lógico. |
| `preparation_template_versions` | Versão única por modelo, perguntas JSON imutáveis, autor e data. FK composta garante a organização do modelo. |
| `project_preparations` | Organização/projeto, referência à versão, snapshot, título, status, revisão, usuário responsável, datas civis, notas e aprovação. |
| `preparation_answers` | Resposta única por instância/pergunta; estado, valor JSON tipado, notas, responsável, prazo, ator e data. FK composta vincula organização/projeto à instância. |
| `preparation_audit_logs` | Organização, projeto/instância ou modelo, operação, ator, data e alterações antes/depois. |

Migration: [1793100000001-create-project-preparation.ts](../../gai-backend/src/migrations/1793100000001-create-project-preparation.ts). Cria as cinco tabelas, índices, FKs e as três permissões no catálogo. O seed declarativo também inclui as permissões, preservando a ordem das entradas anteriores.

Não há exclusão física pela API. DELETE arquiva o modelo ou a instância. Aprovações impedem edição até uma reabertura autorizada; instâncias arquivadas ficam somente para consulta. Arquivar um modelo impede novas instâncias, mas preserva versões e preparações existentes.

O `down` da migration remove somente as cinco tabelas do módulo e **preserva catálogo e concessões**, evitando apagar configuração de perfis. Como qualquer remoção de tabelas, o rollback perde os dados do módulo; foi exercitado apenas em banco descartável. Não foi executada migration em produção.

## 3. Rotas e contratos

Prefixo comum: `/api/v1`.

| Rota | Operação |
|---|---|
| `GET /organizations/:organizationId/preparation-templates` | Listar modelos, incluindo arquivados. |
| `POST /organizations/:organizationId/preparation-templates` | Criar modelo e versão 1. |
| `GET /organizations/:organizationId/preparation-templates/:id` | Modelo atual, perguntas e índice de versões. |
| `GET /organizations/:organizationId/preparation-templates/:id/versions/:version` | Consultar versão histórica. |
| `PATCH /organizations/:organizationId/preparation-templates/:id` | Publicar nova versão com `expected_version`. |
| `DELETE /organizations/:organizationId/preparation-templates/:id` | Arquivar; body `{revision: current_version}`. |
| `POST /organizations/:organizationId/preparation-templates/:id/clone` | Clonar exclusivamente dentro da organização de origem. |
| `GET /projects/:projectId/preparations/context` | Projeção autorizada do projeto, empresa, unidades vinculadas e usuários responsáveis. Sem credenciais, e-mails privados ou dados financeiros de pagamentos/despesas. |
| `GET /projects/:projectId/preparations` | Listar instâncias independentes do projeto. |
| `POST /projects/:projectId/preparations` | Criar a partir de `template_id`, versão opcional e dados iniciais. |
| `GET /projects/:projectId/preparations/:id` | Snapshot, respostas, aplicabilidade e progresso do servidor. |
| `PATCH /projects/:projectId/preparations/:id` | Editar título, responsável, datas e notas com revisão. |
| `PATCH /projects/:projectId/preparations/:id/answers` | Lote atômico de respostas com revisão. |
| `POST /projects/:projectId/preparations/:id/approve` | Aprovar com revisão e obrigatórias resolvidas. |
| `POST /projects/:projectId/preparations/:id/reopen` | Reabrir aprovação, preservando histórico. |
| `DELETE /projects/:projectId/preparations/:id` | Arquivar sem apagar respostas. |
| `GET /projects/:projectId/preparations/:id/history?before_id=...` | Histórico com cursor e páginas de até 50 eventos. |
| `GET /projects/:projectId/preparations/:id/communication?channel=email\|guidance` | Gerar prévia de comunicação, sem envio. |

Modelo:

```json
{
  "name": "Preparação da organização",
  "kind": "kickoff",
  "questions": [{
    "id": "has-prior-inventory",
    "category": "Escopo",
    "label": "Já houve inventário?",
    "type": "boolean",
    "order": 0,
    "required": true,
    "visible": true,
    "allow_not_applicable": false
  }]
}
```

`kind` aceita `kickoff` ou `client_checklist`. A publicação seguinte envia `name`, `questions` e `expected_version`; o tipo do modelo permanece fixo. A criação da instância envia `template_id`, `title`, `template_version` opcional, `responsible_user_id`, `scheduled_date` e `due_date` opcionais. A versão omitida seleciona a versão atual disponível.

Lote de respostas:

```json
{
  "revision": 1,
  "answers": [{
    "question_id": "has-prior-inventory",
    "state": "completed",
    "value": false,
    "notes": null,
    "responsible_user_id": null,
    "due_date": null
  }]
}
```

Tipos de pergunta: `text`, `long_text`, `boolean`, `number`, `date`, `select`, `sequence` e `unit_allocations`. Seleções usam `options`; sequências usam `{start,end}` e podem referenciar `quantity_question_id`. Alocações usam `[{unit_id,quantity}]`, com unidade já vinculada ao projeto e à empresa correspondente. Datas civis usam `YYYY-MM-DD`, sem conversão de fuso; ator/data da resposta são definidos pelo servidor.

Respostas GET retornam perguntas do snapshot e respostas por ID, incluindo `applicable`, estado, valor, observações, responsável, prazo, autor/data e participações calculadas. `progress` informa total, concluídas, N/A, pendentes, ocultas, desabilitadas, percentual e IDs obrigatórios pendentes.

Estados da instância: `draft`, `in_progress`, `approved`, `archived`. Salvar respostas coloca a instância em preenchimento. Aprovar resolve a exigência das perguntas **obrigatórias aplicáveis**; perguntas opcionais podem continuar pendentes, portanto aprovação não implica necessariamente progresso de 100%. N/A permitido e justificado resolve uma obrigatória sem inventar uma resposta.

Negativas: autenticação **401**, permissão/organização indevida **403**, modelo/instância fora da hierarquia consultada **404**, definição/resposta/data/unidade/responsável inválido **400**, revisão antiga, estado bloqueado ou obrigatória pendente na aprovação **409**. As rotas constam do Swagger com DTOs de entrada e descrições das operações; contratos frontend estão em `preparationTypes.ts` e `preparationQueries.ts`.

## 4. Permissões e isolamento

Todas são organizacionais e precisam existir no catálogo, inclusive para bypass administrativo:

| Permissão | Acesso |
|---|---|
| `project-preparation:read` | Contexto, modelos/versões, instâncias/respostas, histórico e prévias. |
| `project-preparation:edit` | Criar/editar/clonar/arquivar modelos; criar/editar/arquivar instâncias e responder. Também exige read. |
| `project-preparation:approve` | Aprovar e reabrir instâncias. Também exige read; edit sozinho não aprova. |

ORG_ADMIN conserva o bypass organizacional válido e o limite de sua organização. Usuários customizados dependem das concessões efetivas. PLATFORM_ADMIN conserva o alcance de plataforma já admitido pelo sistema, sempre selecionando explicitamente o escopo; isso não permite combinar modelo de uma organização com instância de outra. Nenhum endpoint foi criado para copiar respostas entre projetos ou para clonar modelo entre organizações.

Cada operação valida o projeto e sua organização antes de consultar a instância, e a consulta usa `organization_id`, `project_id` e ID da instância. Perguntas precisam pertencer ao snapshot da instância. Responsáveis precisam ser usuários ativos da mesma organização. Unidades precisam pertencer à empresa e estar vinculadas ao projeto, sem aceitar endereços/IDs arbitrários de outro projeto.

As mutações reutilizam `ProjectStatusTransitionPolicy`: projetos `draft`, `active` e `paused` permitem operações; `inactive`, `finished`, `cancelled` e `archived` preservam consulta/histórico e bloqueiam novas instâncias, edição e aprovação com o código existente `PROJECT_STATUS_BLOCKS_OPERATION`. Não foram alteradas regras de lifecycle, inventário ou conciliação.

Provas HTTP negativas em SQLite e MySQL incluem:

- ORG_ADMIN e usuário customizado autenticado com read/edit acessando projeto de outra organização: 403 em contexto/lista/detalhe/histórico/comunicação e mutação.
- ID de instância de outro projeto usado sob projeto autorizado: 404, inclusive quando os dois projetos pertencem à mesma organização.
- Modelo de outra organização consultado/clonado sob organização autorizada, ou usado para criar uma instância: 404; organização estrangeira explícita: 403 para usuários organizacionais.
- Usuário somente leitura não edita; editor sem approve não aprova; perfil com read/approve aprova quando os requisitos estão resolvidos.
- Remover `project-preparation:read` do catálogo do banco descartável nega o acesso inclusive a ORG_ADMIN e PLATFORM_ADMIN; concessões antigas não contornam o guard.
- Responder uma instância não modifica respostas de outra instância, de outro projeto ou do checklist paralelo.

## 5. Regras condicionais e progresso

`enabled_when` é uma lista de condições combinadas por AND. Cada condição referencia ID estável, usa `equals`, `not_equals`, `in` ou `answered` e é validada conforme o tipo da origem. Referências inexistentes, autorreferência, ciclos, IDs duplicados e seleções inválidas são rejeitados. O grafo é avaliado independentemente da ordem das perguntas.

A origem precisa estar habilitada e concluída para disparar uma condição; ausência, pendência e N/A não satisfazem automaticamente `not_equals`. `false` e `0` são respostas válidas e diferentes de ausência. Uma alteração pode responder origem/dependente no mesmo lote, desde que o estado final seja válido.

Perguntas ocultas ou desabilitadas não aceitam alteração direta de resposta. Desabilitar um dependente não apaga sua resposta: preserva o valor e o histórico, exclui-o do progresso/obrigatoriedade atuais e da comunicação; caso volte a ser habilitado na mesma versão, seu valor anterior continua disponível. Campos ativos já respondidos também são revalidados quando outro campo muda: não é possível alterar uma quantidade e deixar uma sequência ativa contraditória.

Ocultar uma pergunta obrigatória é rejeitado. O editor precisa alterar explicitamente sua obrigatoriedade na nova versão, evitando relaxamento silencioso. O snapshot de instâncias existentes continua inalterado.

`pending` exige valor nulo. `not_applicable` exige habilitação no modelo, valor nulo e justificativa não vazia. `completed` exige valor válido do tipo da pergunta. Não existe conversão automática de N/A em pendente ou concluído.

O denominador do progresso é o conjunto de perguntas **visíveis e habilitadas**. Numerador = concluídas + N/A explícitos. O percentual usa uma casa decimal; total zero retorna zero. Ocultas/desabilitadas são contabilizadas separadamente e aparecem na explicação da tela.

Sequências exigem início/fim inteiros não negativos, fim ≥ início e, quando vinculadas a uma quantidade, comprimento inclusivo igual à quantidade. Unidades aceitam quantidades inteiras não negativas, sem duplicação; participação = quantidade da unidade / total ×100, arredondada a uma casa. Os dados persistidos continuam sendo IDs e quantidades; o servidor calcula os percentuais, sem impor ajuste artificial para soma arredondada de 100%.

## 6. Frontend e comunicação

Acesso pelo novo link **Preparação** nas abas do resumo do projeto, respeitando a permissão de leitura. Rotas:

- `/app/projects/:projectId/preparation/kickoff`.
- `/app/projects/:projectId/preparation/client-checklist`.

As duas abas mantêm instâncias e respostas separadas. A página mostra empresa/unidades vinculadas, seleção de preparação, responsáveis, datas, status/aprovação, categorias, respostas/observações, condições e progresso calculado pelo backend. Há estados de carregamento, erro com nova tentativa, vazio e sucesso, layout responsivo e consulta sem ações de mutação quando o perfil ou o status do projeto não permite edição.

Componentes novos: `ProjectPreparationPage`, `PreparationForms`, `TemplateManager`, contratos/hooks/API e sugestões em `referenceTemplates`. Os painéis internos fornecem editor de respostas tipadas, metadados, gestão visual de perguntas/condições/ordem, consulta de versões, clonagem/arquivamento, histórico legível de antes/depois e comunicação.

As sugestões de referência são criadas **somente por ação explícita**, após revisão do usuário, dentro da organização corrente. Cobrem resumo/escopo, contatos, inventário anterior e complementos, sistema/base contábil, etiquetas e sequências, segurança/logística/prazos e documentos de vida útil. A adaptação usa nomes/IDs semânticos e unidades existentes; não importa índices, respostas, identidades ou credenciais do legado. Os modelos sugeridos começam com perguntas opcionais e N/A explícito: a organização define sua obrigatoriedade antes de utilizar. Não há seed demonstrativo em produção.

O editor publica novas versões, permite adicionar/remover/reordenar perguntas, alterar textos/categorias, configurar tipos/opções/visibilidade/obrigatoriedade/N/A e condições. IDs existentes não são editados, e o tipo de uma pergunta persistida é bloqueado na interface e validado no servidor. Modelos arquivados e versões anteriores permanecem consultáveis.

React Query invalida contexto, lista, detalhe e histórico do projeto após mutações, sem invalidar projetos alheios. Alterar modelos invalida o cache organizacional de modelos, sem reescrever instâncias. Gerar comunicação invalida seu histórico para mostrar o evento registrado.

Comunicação retorna `{channel, recipient:null, subject, body, delivery_status:"preview_only"}`. O texto usa o projeto autorizado, empresa/unidades e respostas visíveis/aplicáveis resolvidas. Não consulta pagamentos/despesas nem inclui automaticamente valores financeiros ou respostas desabilitadas. A tela exige gerar e **exibir a prévia antes de copiar**. Clipboard tem tratamento de falha e alternativa de seleção manual. Não há SES, WhatsApp, abertura de cliente externo, destinatário presumido ou alegação de entrega.

Para integração futura com checklist de campo, já existem identificadores persistidos e o endereço estável `(organization_id, project_id, preparation_id, question_id)`, revisão e referência/snapshot de versão. Esse outro domínio não foi criado nem habilitado como terceiro tipo.

## 7. Testes e validações

Resultados detalhados, tentativas investigadas e nomes dos casos: [testes.json](testes.json). Logs originais em `.local/project-preparation-20261027/`.

| Verificação | Resultado |
|---|---|
| Backend completo + última reexecução dos casos finais | **507 aprovados**, 7 testes S3 opt-in não executados nesta etapa, 100 arquivos encontrados. A suíte completa aprovou 503; a reexecução de quatro arquivos aprovou 56 e acrescentou os quatro casos finais de status de projeto. |
| Novos testes backend | **42 casos**: 23 HTTP/integração e 19 de política. |
| Frontend completo | **191 aprovados em 29 arquivos**, incluindo 12 novos casos do módulo. |
| MySQL descartável | **26 aprovados em dois arquivos**: 23 do módulo e três de perfis/permissões. |
| Migrations MySQL | **23 aplicadas**, cinco tabelas do módulo; rollback e reaplicação da nova migration aprovados, mantendo tabelas alheias, permissões e concessões. |
| TypeScript backend, incluindo testes | **Aprovado**, `tsc --noEmit --incremental false`. |
| TypeScript frontend e builds backend/frontend | **Aprovados**. Vite mantém aviso de chunk acima de 500 kB. |
| ESLint dos arquivos alterados | **0 erros e 0 avisos** nos 16 arquivos backend e nove frontend. Sem `--fix` global. |
| `git diff --check` no escopo da entrega | **Aprovado**. |

Cobertura: CRUD/arquivamento/clonagem de modelos, versões, snapshot imutável, independência de instâncias/projetos, persistência, condições encadeadas, valores false/zero, datas civis, sequências/quantidades, unidades e participação, N/A/obrigatórias/progresso, aprovação/reabertura, revisão obsoleta, rollback de lote inválido, histórico/ator/data, RBAC e isolamento. Frontend cobre loading/erro/vazio/sucesso, resposta e atualização de condições, acesso somente leitura, projeto encerrado, criação de instância/modelo e prévia/cópia sem envio.

Falhas investigadas e corrigidas durante o trabalho:

1. Revisão obsoleta era detectada após validação das respostas, produzindo 400 por uma contradição de sequência antes de apontar o conflito. A revisão passou a ser verificada também no início, mantendo o UPDATE condicional final; teste aprovado.
2. O helper de MySQL pressupunha catálogo vazio, mas a nova migration já registra as permissões. Foi usado upsert no fixture, sem alterar autenticação ou seeder de produção para contornar testes.
3. Um teste antigo de perfis usava ID fixo `3` para `users:read`; a entrada de novas permissões mostrou a suposição incorreta. O fixture agora consulta o ID pela chave, validado também em MySQL. Nenhum contrato ou política de produção foi relaxado.

Playwright e homologação manual em navegador não foram executados nesta etapa. O lint global não foi reexecutado; os 175 erros backend e o aviso frontend preexistentes documentados na entrega anterior ficam fora desta alteração. Não se declara o repositório inteiro livre dessa dívida.

## 8. Ambiente descartável

Docker Desktop estava parado e foi iniciado localmente para permitir os testes. Foi criado exclusivamente para esta execução o container `gai-preparation-mysql-20261027`, em `127.0.0.1:33317`, com banco `gai_validation_disposable`, credenciais sintéticas e `/var/lib/mysql` em tmpfs. Versão MySQL: **8.0.46**; imagem `mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`.

O helper opt-in usa destino/credenciais fixos e ignora `DB_*` da aplicação. Recria o schema e aplica as migrations somente nesse destino. Não foi usado o banco `gai-mysql` preexistente na porta 3306. Ao final, o container desta execução foi removido, eliminando o tmpfs; o container preexistente foi preservado. Nenhum bucket ou serviço de mensagens foi utilizado.

Com um MySQL descartável disponível na porta fixa, a reprodução dos testes específicos é:

```powershell
# gai-backend — SQLite, política e catálogo
npm.cmd test -- --runInBand test/integration/project-preparation test/unit/modules/project-preparation test/unit/modules/auth/permissions-negative.spec.ts test/integration/users/org-roles.e2e-spec.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build

# MySQL: exclusivamente o destino descartável do helper
$env:GAI_TEST_MYSQL_DISPOSABLE='1'
npm.cmd test -- --runInBand test/integration/project-preparation test/integration/users/org-roles.e2e-spec.ts
Remove-Item Env:GAI_TEST_MYSQL_DISPOSABLE

# gai-frontend
npm.cmd test -- src/features/project-preparation/ProjectPreparationPage.test.tsx
npm.cmd run build
```

## 9. Arquivos alterados

**25 arquivos de fonte/testes**, relacionados individualmente com SHA-256 em [arquivos.json](arquivos.json), além dos quatro documentos desta pasta:

- Backend: oito arquivos do novo módulo, migration, integração no AppModule, catálogo/códigos de erro, helper de testes, duas novas suítes e correção do fixture de perfis existente.
- Frontend: sete arquivos do novo módulo, rota protegida e link nas abas do projeto.

Não houve adição de dependências. Builds atualizaram artefatos locais gerados quando presentes; `dist`, caches e dependências rastreadas já modificadas no workspace não foram restaurados a partir de HEAD e não compõem a relação de fontes desta entrega.

## 10. Limitações e prontidão

O módulo está pronto para revisão funcional e homologação em ambiente de aplicação autorizado. Antes de disponibilizar suas rotas, aplicar a nova migration e sincronizar/verificar o catálogo nesse ambiente, conforme o processo existente; isso **não foi feito em produção**. Os bloqueios/configurações gerais de storage AWS descritos na entrega anterior permanecem independentes: este módulo não depende desse storage, mas não homologa nem dispensa as condições de liberação do sistema inteiro.

Limites explícitos desta versão: até 120 perguntas por modelo, dez condições por pergunta, 50 opções por seleção e 200 unidades por resposta de alocação; listagem inicial de até 200 modelos, 100 instâncias por projeto e índice das últimas 100 versões; consulta de versão/instância por ID e histórico com cursor continuam disponíveis. A seleção de responsáveis projeta até 500 usuários ativos da organização. Paginação ampliada/autocomplete para catálogos maiores não foi implementada.

As sugestões adaptam as funções confirmadas, sem alegar reprodução literal de todos os controles antigos. Múltiplos intervalos de etiquetas antigas, tabelas livres de endereços e particularidades antigas de layout/colunas não receberam editores idênticos: usam campos descritivos ou a alocação estruturada nas unidades existentes. Não há cálculo de orçamento, vida útil ou importação automática de respostas legadas. Carga, acessibilidade por auditoria especializada e testes visuais manuais de navegador permanecem para homologação.

Não foram iniciados checklist de campo, orçamento, conciliação assistida ou outros módulos. Nenhuma regra de inventário/conciliação, autenticação, componente compartilhado, dado de produção, credencial do legado ou configuração remota foi alterada. Não houve commit, push ou deploy.
