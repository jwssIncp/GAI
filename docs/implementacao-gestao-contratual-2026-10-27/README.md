# Gestão contratual e indicadores comerciais — homologação local

## Análise e decisões

Foram examinados a matriz e os anexos da auditoria do legado (F002, F003, F005 e F006), os relatórios anteriores da Visão Geral e os módulos de preparação, campo, conciliação e avaliação em lote. Também foram examinados ProjectEntity, CompanyEntity, CompanyUnitEntity, ProjectUnitEntity, ProjectForm/projectSchemas, OrganizationOverviewService/Page/controller/queries, ProjectSummaryService, lifecycle e catálogo/RBAC.

Antes desta implementação, projetos tinham apenas datas operacionais, status e JSON livre de settings/metadata. Empresas/unidades tinham endereços; não existiam contratos, data de contratação, segmento, recorrência, serviços ou valores contratuais tipados. Pagamentos/despesas e valores de bens não são fontes contratuais. O overview devolvia valores comerciais nulos; seus filtros temporais referiam-se corretamente à criação dos projetos. Nada foi inferido ou migrado a partir desses campos.

O domínio contratual é adicionado ao monólito NestJS, com DTOs validados, policy de valores/regras, serviço transacional, entidades e controller. O serviço comercial amplia o módulo de dashboard existente. No React, a mesma Visão Geral recebe filtros/cards/gráfico/tabelas comerciais; a gestão contratual é uma rota filha do ProjectLayout persistente, com os componentes visuais existentes. Não há outra autenticação ou dashboard organizacional.

## Modelo e persistência

Migration `1793500000001-create-project-contracts.ts`, aditiva, sem atualização ou exclusão de registros anteriores:

| Tabela | Finalidade |
|---|---|
| project_contracts | Identidade, organização, projeto, empresa, número único na organização, revisão e estado contratual atual |
| project_contract_versions | Snapshot completo imutável por revisão; operação, justificativa, ator e instante UTC |
| project_contract_amendments | Documentos imutáveis: identificador único por contrato, data civil, tipo, delta DECIMAL(15,2), novo prazo/escopo, motivo e ator autenticado |
| commercial_report_snapshots | Filtros, linhas, revisões, agregados e hash do relatório efetivamente exportado |

Os dados do contrato são um objeto contratual tipado e validado, armazenado em JSON dedicado do domínio, não em metadata/settings de projeto. Contém número, empresa, contratação, início/fim original, moeda BRL/USD/EUR, valor original, tipo, segmento, origem, recorrência triestado, serviços, quantidade estimada, escopo, condições e status; também guarda valor/fim/escopo vigentes e nome/UF da contratante no cadastro. Valores monetários nos snapshots são strings decimais canônicas com duas casas; cálculos usam BigInt em centavos, sem soma em ponto flutuante. O delta do aditivo possui também coluna DECIMAL. Não há conversão de moedas.

Há FKs para organização/projeto/empresa/ator, FKs compostas de escopo nos registros filhos, unicidade de número/revisão/aditivo e índice de organização/projeto. Datas civis são strings YYYY-MM-DD e não passam por conversão de fuso na apresentação. Instantes de auditoria são gerados explicitamente pelo servidor.

## Regras de contratos e aditivos

- Um projeto pode ter zero ou vários contratos. Projetos antigos continuam funcionando sem contrato. A empresa contratante deve ser a empresa do projeto, na mesma organização e não excluída.
- Criação em rascunho ou ativo. Ativação exige contratação, vigência e valor original conhecidos; zero monetário explícito é válido. Dados comerciais opcionais podem permanecer ausentes.
- Estado: rascunho → ativo/cancelado; ativo → suspenso/concluído/cancelado; suspenso → ativo/concluído/cancelado. Rascunho, concluído ou cancelado podem ser arquivados pelo comando próprio. Arquivado é imutável; não há exclusão ou reabertura nesta etapa.
- Número, empresa, moeda e termos originais conhecidos são imutáveis. Em rascunho é permitido apenas complementar termos originais ainda nulos, sempre registrando versão e justificativa. Correções comerciais, serviços/estimativa/recorrência/condições e transições permitidas geram nova versão.
- Aditivos exigem contrato ativo/suspenso, justificativa, identificação, data e pelo menos uma alteração compatível com o tipo valor/prazo/escopo/misto. A data não pode preceder contratação/último aditivo nem ser futura. O responsável é o usuário autenticado, não um ID fornecido pelo navegador.
- **Vigente = original + soma dos deltas assinados registrados.** Cada aditivo preserva o original e o snapshot anterior. Prazo/escopo vigentes assumem a última alteração explícita. Valores vigentes negativos ou acima de 9.999.999.999.999,99 são rejeitados.
- Projetos rascunho/ativo/pausado admitem escrita. Projetos encerrados continuam consultáveis; arquivamento documental é permitido quando o contrato já cumpre as condições. Não são alteradas regras de lifecycle/inventário.
- Toda escrita bloqueia a linha do projeto no MySQL e verifica a revisão enviada. Concorrência resulta em um sucesso e um conflito 409; nenhuma revisão antiga é sobrescrita. Contrato/aditivo/versão são persistidos na mesma transação, com rollback completo em falha. Reenvio duplicado não produz outro contrato/aditivo.

## APIs

Prefixo `/api/v1`:

| Método e caminho | Comportamento |
|---|---|
| GET /projects/:projectId/contracts | Contratos do projeto, até 1.000 |
| POST /projects/:projectId/contracts | Criação com ContractDataDto |
| GET /projects/:projectId/contracts/:id | Estado atual, todas as versões e aditivos |
| PATCH /projects/:projectId/contracts/:id | Substituição validada de dados editáveis, revision e reason obrigatórios |
| POST /projects/:projectId/contracts/:id/amendments | Aditivo tipado, revision/reason obrigatórios |
| POST /projects/:projectId/contracts/:id/archive | Arquivamento com revision/reason |
| GET /organization-overview/commercial | Agregados e linhas comerciais do recorte organizacional |
| POST /organization-overview/commercial/reports | Salva snapshot exportável; filtros e expected_hash da consulta obrigatórios |
| GET /organization-overview/commercial/reports/:id | Recupera o relatório histórico da organização |
| GET /organization-overview/commercial/reports/:id/export.csv ou export.xlsx | Exporta exatamente o relatório salvo |

As rotas operacionais existentes `/organization-overview`, `/projects`, `/companies`, `/export.csv` e `/export.xlsx` também reconhecem os filtros comerciais, com o mesmo predicado contratual. Não há integração ou geração de contas a receber, pagamentos ou despesas.

## Permissões e isolamento

Cinco novas chaves ORGANIZATION no catálogo e no seed: `contracts:read`, `contracts:edit` (criar/editar), `contracts:amend`, `contracts:archive`, `commercial-indicators:read`. Contratos também exigem `projects:read`. Escritas exigem leitura contratual. Indicadores e relatórios exigem `projects:read` e leitura comercial; o overview organizacional conserva a restrição existente a ORG_ADMIN com organização definida.

ORG_ADMIN possui o bypass organizacional existente **somente se as chaves estiverem presentes e com escopo válido no catálogo vivo**. PermissionsGuard e autenticação não foram afrouxados. ORG_USER/papéis personalizados dependem das concessões específicas; nenhuma concessão nova foi atribuída automaticamente. Remover uma chave do catálogo resulta em 403 inclusive para o administrador. Filtros comerciais nas rotas operacionais também exigem leitura comercial, para impedir inferência de dados sensíveis.

O projeto e o contrato são resolvidos com organização/projeto em cada operação, inclusive relatórios históricos. Não é aceito organization_id no filtro. Aditivo não aceita ator indicado pelo cliente. Cada indicador de etapa operacional exige também a permissão de leitura de sua fonte; sem ela a etapa é omitida na consulta atual. Um relatório histórico contendo uma fonte cuja autorização foi revogada retorna 403, preservando o snapshot sem expor dados após a revogação.

## Fórmulas e semântica do recorte

- Total conhecido original/vigente: soma dos valores não nulos, por moeda. Se nenhum valor é conhecido, resultado null. Quantidades conhecidas/ausentes acompanham cada total; totais parciais são explicitados na interface.
- Ano é extraído de **contracted_on**, nunca de created_at. Contratos sem contratação não entram nos grupos anuais; a quantidade excluída é exibida.
- Quantidade anual: contratos do ano, separada por moeda na tabela. Ticket anual vigente = soma vigente conhecida / número de contratos com valor conhecido, com arredondamento half-up em centavos. Ausências não entram no denominador e são exibidas.
- Recorrência decorre exclusivamente da flag do contrato; não é inferida da quantidade de projetos da empresa. Quantidade/valor recorrente usam somente true; false e desconhecido são informados separadamente. Se a classificação é desconhecida em todos os contratos, quantidade recorrente é null.
- Ativos na vigência: status contratual active e data UTC atual inclusa entre starts_on e current_ends_on. Não é o status do projeto. Sem valores elegíveis, total null.
- Segmento/empresa/UF: grupos dos contratos do mesmo recorte. UF comercial é o endereço da contratante registrado no contrato; UF operacional continua sendo a das unidades. Os dois filtros têm rótulos distintos. Ausência de segmento/UF tem grupo explícito.
- Evolução contratual: último status conhecido por mês UTC de registro das versões, para os contratos do recorte atual. Não inventa histórico anterior ao primeiro registro no novo sistema.
- Fontes operacionais compatíveis: project_preparations (approved/total), field_checklists (completed/total), inventory_sessions (finished/total). Denominador é a quantidade de registros da própria fonte nos projetos do recorte; sem registros, total/concluídos/percentual são null. Representa progresso atual, não reconstrução das seis etapas nem série histórica operacional inexistente.
- Todos os filtros são combinados: criação/status/busca do projeto, empresa, UF operacional; período de contratação, status contratual, segmento, UF contratante, recorrência, serviço exato e intervalo inclusivo de estimativa. Todos os filtros comerciais devem ser satisfeitos pelo **mesmo contrato**.
- Projetos são filtrados por EXISTS; várias unidades e vários contratos não multiplicam projetos. Os agregados comerciais contam contratos individualmente. Sem filtro comercial, projetos sem contrato continuam no overview operacional.
- Limite explícito de 10.000 contratos e 100.000 versões por relatório; exceder o limite exige refinar filtros, sem truncar totais silenciosamente. Leitura comercial usa snapshot REPEATABLE READ.

## Exportações e histórico

O navegador envia o hash dos dados exibidos junto dos filtros. Mudança nos dados desde a consulta retorna 409 e exige atualizar antes de exportar. O servidor salva o relatório completo e imutável com suas revisões; um aditivo posterior não muda a exportação antiga. CSV exporta as linhas do recorte; Excel inclui Contratos, Recorte, Indicadores, Anual, Etapas, Segmentos, Empresas e UF. Números monetários são exportados como texto decimal exato; texto de usuário é neutralizado contra fórmulas de planilha.

## Frontend e navegação

- `/app/projects/:projectId/contracts` sob o mesmo ProjectLayout/Outlet; nova aba Contratos entre Dashboard e Preparação, sujeita a RBAC.
- `?contract=:id` preserva o contrato aberto após refresh/link direto.
- Formulários de contrato/aditivo/arquivamento nos modais existentes; listagem, valores original/vigente, prazo/escopo atuais, histórico e ator por versão. Troca de projeto remonta apenas o workspace para impedir seleção herdada de outro projeto.
- `/app/dashboard`: mantém indicadores, mapa, tabelas e exportações operacionais existentes; acrescenta seção comercial com os mesmos componentes de cards, Recharts e DataTable. Os filtros ficam na URL e são restaurados no refresh. Fontes operacionais e localização contratante/unidades são diferenciadas.
- Layout móvel usa a navegação horizontal e tabelas com rolagem existentes. Sem mudança de identidade visual.

## Homologação local e evidências

Conexão confirmada antes da migration: NODE_ENV=local, localhost:3306, banco gai, contêiner MySQL f10269ba8da4. A migration contratual foi a 27ª, aplicada somente nesse banco, sem apagar/recriar dados. A configuração atual continua com synchronize:false. Os testes SQL usam outro MySQL, porta 33317, database gai_validation_disposable e volume temporário.

Iniciar os serviços existentes com `powershell -ExecutionPolicy Bypass -File scripts/local-start.ps1`. O script apenas verifica migrations, não as aplica automaticamente. Frontend `http://localhost:5173`, API `http://localhost:3000/api/v1`, Swagger `http://localhost:3000/api/docs`. Entrar como a conta de teste ORG_ADMIN já existente, abrir um projeto próprio e clicar Contratos; criar somente dados explicitamente sintéticos. Em Visão Geral, filtrar o segmento sintético e verificar original/vigente, ano 2024 e exportação.

Resultados finais, projeto/contrato sintéticos e URLs específicas estão em `testes.json` e `runtime-local.json`; `arquivos.json` relaciona os arquivos desta entrega. Capturas desktop/móvel da navegação real estão em `.local/contracts-playwright/`.

## Limitações explícitas

Não há importação/backfill de contratos do legado, câmbio, renovação automática, recebíveis, DRE, parcelamento ou autenticação nova. Segmentos/serviços/tipo/origem são textos contratuais validados, não catálogos novos. Empresa/moeda/número e termos originais conhecidos não são retificados por edição; o histórico não é apagado. Não há exclusão/reabertura de contrato arquivado. Datas/escopo/valor originais ausentes podem ser complementados somente em rascunho.

Listagem contratual é limitada a 1.000 por projeto; a consulta de detalhe devolve o histórico completo. Agregação comercial é síncrona e limitada; grandes carteiras deverão adotar projeções/índices e processamento específico em etapa própria. Relatórios anteriores são recuperáveis pela API com o ID informado após exportação; não há catálogo de relatórios na interface nesta etapa. Evidências sintetizadas do progresso atual não substituem uma série temporal operacional. O histórico comercial só começa no cadastro neste sistema.

Não foram executados commit, push, deploy ou ações em produção. Alterações locais anteriores foram preservadas.
