# Reformulação do cadastro e gerenciamento de projetos — 03/11/2026

## 1. Diagnóstico inicial

Foram inspecionados formulário, listagem, detalhes, rotas, permissões, DTOs, casos de uso, domínio, repositório, entidades, migrations e consumidores de projetos. O diagnóstico do MySQL local usou consultas somente de leitura e uma transação com snapshot consistente.

A tabela `projects` tinha 16 colunas e 44 linhas: 43 rascunhos e um projeto ativo. Havia 44 registros de auditoria, quatro vínculos com unidades e dez vínculos com agentes. Todas as linhas de projetos tinham empresa, nenhuma tinha descrição ou JSON preenchido e somente uma tinha datas previstas.

Os arquivos anteriores à tarefa estão em `baseline/`, com hashes em `baseline-manifest.json`. Essa referência inclui alterações que já existiam na área de trabalho; não foi feito reset ou checkout do repositório.

## 2. Problemas identificados

- A API exigia que o cliente enviasse a organização, mesmo para usuários com escopo organizacional único.
- O formulário lateral oferecia somente nome, empresa, descrição e datas.
- O cadastro dependia de `companies:read`, embora selecionar uma empresa não exija acesso ao seu cadastro completo.
- A listagem mostrava identificadores de empresas em vez de seus nomes.
- A auditoria inicial não incluía descrição, datas, JSONs ou todos os vínculos informados.
- Não havia identificador de negócio, classificação, responsáveis gerais ou observações de planejamento.
- A edição tinha proteção transacional contra concorrência durante a requisição, mas não aceitava a versão carregada pelo editor como condição de atualização.
- Na verificação visual, o formatador de datas convertia uma data civil para um instante UTC e mostrava o dia anterior no fuso brasileiro.

## 3. Regras de negócio preservadas e esclarecidas

O modelo atual de autenticação tem um `organizationId` por usuário, validado na sessão. Não foi encontrado contexto de múltiplas organizações ativas para o mesmo usuário. Para usuários organizacionais, inclusive `ORG_ADMIN` e perfis personalizados, o backend usa esse contexto. O parâmetro de organização pode ser omitido; se enviado com outro valor, a requisição é rejeitada. Usuários sem organização válida não podem criar. `PLATFORM_ADMIN` precisa selecionar explicitamente uma organização ativa.

A empresa deve existir, estar ativa e pertencer à organização resolvida. Organização e empresa não podem ser alteradas por PATCH. A situação inicial continua sendo `draft`; datas previstas não mudam a situação. `finished_at` continua sendo preenchido exclusivamente pela finalização operacional. Rascunho, ativo e pausado aceitam edição; os demais estados permanecem somente para consulta.

Nomes iguais continuam permitidos. Códigos preenchidos são únicos por organização, inclusive entre registros excluídos logicamente. Não foi criada unicidade sobre o nome. Não foi introduzida uma API de exclusão de projetos: o gerenciamento continua usando o ciclo existente de cancelamento e arquivamento.

## 4. Decisões de modelagem

Foram acrescentadas cinco colunas opcionais à tabela existente. Nenhuma tabela foi criada, removida ou renomeada. Os projetos antigos continuam sem valores artificiais nesses campos.

Os responsáveis novos representam o projeto e seu planejamento geral. Não substituem responsáveis por questionários de preparação, tarefas de campo, agentes vinculados ou responsáveis profissionais de laudos. A classificação de projeto é independente do tipo de questionário e não muda cálculos ou regras operacionais.

Os JSONs existentes não têm consumidores operacionais que justifiquem controles novos. Permanecem compatíveis na criação pela API, com validação estrutural, limite de 16 KiB, profundidade máxima de oito níveis e rejeição de chaves de contexto protegido e credenciais, inclusive variações de caixa e separadores. Não são editáveis por PATCH nem usados como fonte de organização, empresa, situação ou permissões.

## 5. Campos implementados

| Campo | Semântica e validação |
|---|---|
| `code` | Até 40 caracteres, normalizado para maiúsculas; letras, números, ponto, barra, hífen e sublinhado; mínimo de dois quando informado. O backend gera `PRJ-` seguido de 12 caracteres hexadecimais quando omitido na criação. |
| `project_type` | Opcional: `inventory`, `valuation`, `inventory_valuation`, `reconciliation`, `regularization` ou `other`. |
| `responsible_user_id` | Usuário ativo da organização, opcional; associação não concede permissões. |
| `planning_responsible_user_id` | Usuário ativo da organização responsável pelo planejamento geral, opcional. |
| `planning_notes` | Observações de planejamento, até 5.000 caracteres. |
| `expected_updated_at` | Campo opcional de PATCH, sem coluna nova, para detectar editores desatualizados. |

Nome, descrição, datas previstas, situação e campos de autoria continuam usando as colunas originais. Nomes de empresas e responsáveis são obtidos por joins com condição de organização, sem duplicar informações cadastrais no banco.

A tabela `projects` agora possui estas 21 colunas, confirmadas no schema local:

| Grupo | Colunas persistidas |
|---|---|
| Identificação e escopo | `id`, `organization_id`, `company_id`, `name`, `code`, `project_type` |
| Conteúdo e planejamento | `description`, `start_date`, `end_date`, `responsible_user_id`, `planning_responsible_user_id`, `planning_notes` |
| Ciclo operacional | `status`, `finished_at`, `deleted_at` |
| Integração legada | `settings`, `metadata` |
| Autoria e controle | `created_by_id`, `updated_by_id`, `created_at`, `updated_at` |

O formulário não envia situação ou autoria: o servidor cria como rascunho e registra o usuário autenticado. Unidades, agentes e histórico ficam nas tabelas relacionadas, sem serem embutidos nos JSONs. `expected_updated_at` é uma condição da requisição; não é uma coluna adicional.

## 6. Frontend

O cadastro agora usa uma página inteira em `/app/projects/new`, com quatro etapas: informações gerais, planejamento, estrutura operacional e revisão. A URL antiga com `?new=1` permanece atendida. O seletor de organização só aparece para administradores da plataforma. Mudá-la limpa empresa e responsáveis selecionados.

Há validação por etapa, erros próximos dos campos, preservação dos valores ao voltar, prevenção de duplo envio, carregamento, sucesso com próximo passo, confirmação antes de descartar e proteção ao fechar/recarregar a página. O cadastro mínimo continua possível: empresa e nome, com os demais campos opcionais.

As unidades e a equipe são completadas após salvar, usando os painéis e permissões existentes. A criação não executa uma sequência de requisições para vínculos que poderia deixar um cadastro parcialmente concluído. O sucesso permite abrir o resumo e completar a estrutura, quando o usuário tem acesso de leitura.

A listagem mostra empresa real, código (ou ID para registros antigos), tipo, situação, responsável, período previsto, criação e ações autorizadas. Há busca por nome/código/descrição, filtros por empresa/situação/tipo, ordenação e paginação. Os indicadores usam os mesmos filtros e o mesmo escopo da consulta, incluindo o filtro de situação.

Os detalhes incluem cadastro, planejamento e histórico paginado, além de todos os painéis operacionais anteriores. A edição iniciada no resumo retorna ao mesmo contexto. Datas previstas usam formatação civil específica do módulo, sem conversão de fuso.

A navegação lateral também oferece **Novo projeto** a quem tem `projects:create` sem `projects:read`, permitindo chegar ao cadastro com essa permissão específica. O acesso à listagem continua condicionado à leitura.

## 7. Backend e contratos

Foram ampliados DTOs, domínio, respostas, casos de uso e persistência. As respostas são aditivas; campos antigos permanecem. Clientes antigos podem continuar enviando a própria organização e usando os payloads anteriores válidos. A API documentada foi atualizada em `gai-backend/specs/004-projects/contracts/projects-api.yaml`.

| Endpoint novo | Permissão | Conteúdo |
|---|---|---|
| `GET /projects/creation-options` | `projects:create` | IDs e nomes de empresas/usuários ativos no escopo autorizado. |
| `GET /projects/edit-options` | `projects:update` | Opções mínimas para o editor autorizado. |
| `GET /projects/company-options` | `projects:read` | Opções mínimas de empresas para filtros. |
| `GET /projects/:id/history` | `projects:read` | Auditoria paginada, após validar o escopo do projeto. |

As opções suportam busca, paginação e consulta da seleção atual. Não retornam documentos, endereços, emails, credenciais ou cadastros completos. Não concedem `companies:read` ou `users:read`.

## 8. Migration e preservação dos dados

Migration: `1794200000001-extend-project-registration.ts` (`ExtendProjectRegistration1794200000001`). É aditiva e verifica a existência das colunas, índices e chaves antes de criá-los. Inclui índice único `(organization_id, code)`, índice para organização/tipo, índices e chaves estrangeiras dos responsáveis.

Foi aplicada no MySQL local pelo runner oficial, com proteção contra destino remoto e migrations pendentes alheias à tarefa. Antes e depois foram calculados hashes das mesmas colunas originais. Os 44 projetos e todos os valores originais das oito tabelas verificadas permaneceram iguais. A tabela passou de 16 para 21 colunas. Não houve backfill, seed, criação de projeto ou alteração de vínculos na base local. A repetição do runner confirmou ausência de migrations pendentes.

Evidências: `checks/local-before.json`, `checks/local-migration.json`, `checks/local-migration-idempotent.json`, `checks/local-after.json` e `checks/local-migration-runner.log`. Os snapshots publicados contêm estrutura, contagens e hashes; não contêm cópias de credenciais ou linhas de usuários.

Rollback: a versão anterior da aplicação é compatível com as colunas opcionais. O `down` recusa remoção destrutiva dos novos campos; eventual retirada física exige revisão e backup. Isso preserva dados preenchidos após a atualização. DDL no MySQL pode efetuar commit implícito; as verificações de existência permitem retomar uma aplicação parcial.

## 9. Segurança

Guards e catálogo de permissões permanecem ativos. Nenhuma permissão foi removida ou concedida automaticamente. A organização é resolvida no servidor antes de validar empresas e usuários. Na transação de criação, organização, empresa e responsáveis são revalidados, com bloqueios de leitura no MySQL. Alterações de responsável também são verificadas na transação de edição.

As consultas de rótulos usam a organização do projeto nas condições de join. Listagem, consulta individual, edição, histórico, indicadores e vínculos mantêm o isolamento. Foram exercitadas requisições diretas com tenant, empresa, usuário, unidade, campos protegidos e campos desconhecidos adulterados, inclusive consultas a resumos, exportações e agentes de projetos de outra organização.

## 10. Auditoria e concorrência

A criação registra o ID gerado, organização, empresa, nome, código, tipo, descrição, datas, responsáveis, planejamento, JSONs, autor e momento da criação. Atualizações registram os valores anteriores e posteriores efetivamente modificados. As transações incluem a alteração e sua auditoria; os testes provocam falha da auditoria para verificar rollback.

O histórico exibido mascara os valores de JSONs legados. A API não os interpreta como instruções ou como campos protegidos. O índice único protege o código mesmo sob requisições concorrentes. A edição combina a versão opcional enviada pelo editor com o compare-and-set transacional já existente. O novo instante de atualização avança pelo menos um milissegundo para impedir colisões da versão.

## 11. Integrações

Foram preservados os vínculos em `project_units` e `project_field_agents`, a preparação em `project_preparations`, os responsáveis por tarefas em `field_tasks`, contratos, orçamentos, inventário, avaliações, contas a receber, DRE, laudos, documentos, exportações e dashboards. Nenhum cálculo financeiro/patrimonial ou fluxo operacional foi reescrito.

Não foram criados mecanismos paralelos de equipe ou preparação. O ID do projeto e os campos antigos continuam sendo os pontos de integração. A mudança de classificação não executa ações em outros módulos.

## 12. Testes e evidências

Os comandos reproduzíveis e seus códigos de saída estão nos arquivos JSON de `checks/`; os logs correspondentes ficam no mesmo diretório. A execução utiliza `scripts/projects-checks.cjs`. Testes de integração usam SQLite em memória ou MySQL descartável em `127.0.0.1:33347`. O navegador usa outro schema descartável, com API em `33349` e UI em `33350`. Esses ambientes não usam a base local da aplicação.

<!-- TEST_RESULTS -->
| Verificação | Resultado final | Evidência em `checks/` |
|---|---|---|
| Backend unitário completo | 63 suítes, 463 testes aprovados | `unit-full.json` e `unit-full.log` |
| Backend unitário de projetos | 5 suítes, 32 testes aprovados | `unit.json` e `unit.log` |
| Frontend completo, incluindo navegação com permissão de criação | 54 arquivos, 332 testes aprovados | `frontend-full-final.json` e `.log` |
| Frontend de projetos, resumo, contexto e navegação | 7 arquivos, 51 testes aprovados | `frontend-projects-final.json` e `.log` |
| SQLite: projetos e contrato HTTP | 3 suítes, 39 testes aprovados | `sqlite-projects-final.json` e `.log` |
| MySQL: projetos, atribuição de perfis e metadados gerados | 4 suítes, 40 testes aprovados | `mysql-final.json` e `.log` |
| Playwright com backend e MySQL reais descartáveis | 6 cenários aprovados | `browser.json`, `browser.log`, `browser/playwright.json` |
| Build NestJS | Aprovado | `build-backend.json` e `.log` |
| TypeScript e bundle de produção do frontend | Aprovados | `build-frontend-final.json`, `bundle-frontend-final.json` e logs |
| ESLint dos arquivos alterados no backend e frontend | Aprovado | `lint-backend.json`, `lint-frontend.json` e logs |

Os resultados direcionados se sobrepõem às suítes completas; não devem ser somados como testes distintos.

As regressões amplas de integração foram executadas antes dos ajustes finais. SQLite teve 56 suítes aprovadas, uma falha, 334 testes aprovados e quatro ignorados; a falha estava no novo teste, que preparava requisições Supertest antes da execução sequencial e acabava usando um servidor já fechado. O teste passou a construir cada requisição no momento de executá-la. MySQL teve 48 suítes aprovadas, duas com falha, 408 testes aprovados e três falhas: um teste assumia que o perfil organizacional Operador sempre tinha ID 3, agora reservado a um perfil de sistema, e outro fixava a contagem histórica em 33 migrations. Os testes passaram a localizar o perfil por organização/nome/tipo e a comparar a contagem com as migrations configuradas, mantendo as verificações de atribuição, metadados gerados, unicidade e idempotência.

As suítes afetadas foram reexecutadas junto com as de projetos e passaram, conforme as linhas SQLite e MySQL acima. As suítes amplas de integração não foram repetidas integralmente após essas correções; os logs originais `sqlite.log` e `mysql.log` preservam as falhas iniciais. Nenhuma falha conhecida dessas execuções ficou sem correção e reexecução direcionada.

Para reproduzir, a partir da raiz do repositório, executar `node scripts/projects-checks.cjs unit`, `node scripts/projects-checks.cjs frontend`, `node scripts/projects-checks.cjs sqlite` ou `node scripts/projects-checks.cjs mysql`. Os dois últimos exigem os pré-requisitos definidos no runner de testes; MySQL aponta para o ambiente descartável na porta 33347. Os JSONs de cada execução registram argumentos exatos, diretório, horário, duração, código de saída e caminho do log. Para preservar evidências distintas, usar `$env:GAI_PROJECTS_CHECK_LABEL='nome-da-execucao'` no PowerShell antes do comando.

`checks/final-results.json` reúne os resultados finais e distingue as execuções amplas das reexecuções direcionadas. `checks/final-data-preservation.json` verifica novamente os valores originais das oito tabelas ao encerrar o trabalho.
<!-- /TEST_RESULTS -->

Capturas de tela estão em `screenshots/`; o resultado estruturado do navegador fica em `checks/browser/playwright.json`. Os cenários cobrem criação, revisão, edição, retorno ao resumo, histórico, empresa real, datas civis e ausência de overflow em desktop, tablet e celular, nos temas claro e escuro.

## 13. Pendências

O preenchimento dos novos campos em projetos antigos é opcional e deve ser feito pelos usuários autorizados. Não foi automatizado. Unidades, agentes, preparação e parâmetros específicos continuam sendo gerenciados em seus módulos após a criação.

Não há editor genérico de `settings` ou `metadata`, pois não foram encontrados consumidores que sustentem configurações novas. Não há mecanismo novo de participantes ou de coordenadores gerais; a coordenação e a distribuição de atividades existentes foram preservadas.

<!-- FINAL_STATUS -->
Implementação e migration local concluídas. A verificação HTTP final confirmou backend e frontend disponíveis (200), opções protegidas sem autenticação (401) e documentação OpenAPI com os novos campos e endpoints (200), em `checks/runtime-final.json`. A base local está com 36 migrations aplicadas e nenhuma pendente. Não foram realizados commit, push ou deploy.

Aplicação local: `http://localhost:5173/app/projects/new`. As associações opcionais posteriores e o preenchimento dos campos novos em projetos antigos continuam disponíveis aos usuários autorizados, conforme descrito acima. Não há pendência de implementação identificada no escopo solicitado.
<!-- /FINAL_STATUS -->

## 14. Riscos e limites

- O escopo verificado é o código e os bancos locais/descartáveis desta área de trabalho; não houve acesso ou deploy em produção.
- O código automático usa aleatoriedade criptográfica e índice único. Uma colisão, embora improvável, retorna conflito sem gravar parcialmente o projeto.
- Os JSONs de integração passaram a rejeitar chaves protegidas e credenciais; integrações externas que usassem essas chaves precisam ajustar seu contrato. Não foi encontrado consumidor interno desse padrão.
- Os novos responsáveis não recebem acesso por serem selecionados. Permissões continuam sendo administradas separadamente.
- Nomes iguais continuam legítimos. O código identifica o projeto dentro da organização e não é reutilizado após exclusão lógica.

## 15. Recomendações futuras

Definir configurações operacionais somente quando houver regras e consumidores reais; acrescentar schemas versionados nesse momento. Avaliar busca avançada e relatórios por responsável conforme o uso dos novos campos. Se houver necessidade futura de associação de unidades/equipe no mesmo envio de criação, estender a transação existente e exigir as permissões específicas, em vez de encadear requisições no navegador.

Arquivos alterados pela tarefa: `modified-files.json`. Não foram realizados commit, push ou deploy.
