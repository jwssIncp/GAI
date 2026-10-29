# Complemento da Visão Geral — auditoria e matriz inicial

As referências foram inspecionadas visualmente. A primeira mostra barras anuais de valor e quantidade; a segunda ticket anual; a terceira três roscas; a quarta etapas, segmentos e UF; a quinta mapa geográfico; a sexta empresas; a sétima segmentos; a oitava projetos detalhados. Os números não serão usados como dados.

| Funcionalidade / referência | Situação inicial | Reutilização | Fonte necessária | Alteração / impedimento |
|---|---|---|---|---|
| Valor anual / 1 | Bloqueada | Recharts | Valor e data contratual | Campos inexistentes |
| Quantidade anual de contratos / 1 | Bloqueada | Agregação de projetos existente | Contrato e cardinalidade | Não há entidade contrato; criação de projetos não será chamada contrato |
| Ticket anual / 2 | Bloqueada | Recharts | Valor, data e denominador contratual | Campos inexistentes |
| Status da carteira / 3 | Parcial (barras) | Status oficiais e Recharts | projects.status | Adicionar rosca e seleção, sem classificar todos os demais status como abertos |
| Recorrência quantidade/valor / 3 | Bloqueada | company_id | Histórico e definição de novo/recorrente | Associação empresa-projeto existe, mas regra temporal/comercial não |
| Etapas / 4 | Bloqueada | Status não equivale a etapa | Etapa atual e ordem | Workflow de status não possui seis etapas comerciais |
| Top segmentos / 4 | Bloqueada | Recharts | Segmento e valor | Campos inexistentes |
| UF por valor / 4 | Bloqueada | Unidades vinculadas | Valor e localização contratual | Valor inexistente; localização operacional pode ser mostrada separadamente |
| Mapa / 5 | Ausente na Visão Geral | Relação project_units/company_units | UF das unidades operacionais | Contar projetos distintos por UF vinculada, informar multi-UF e sem localização; filtro por EXISTS |
| Empresas / 6 | Ausente | companies, projects.company_id | Empresa, total, valores/itens/logo | Implementar contagem e seleção; colunas contratuais indisponíveis; nenhum campo tipado de logo |
| Segmentos / 7 | Bloqueada | Tabela compartilhável | Segmento/valor/itens contratados | Campos inexistentes |
| Projetos / 8 | Parcial (50 recentes) | Listagem, links, exportação | Campos reais, paginação e ordenação | Paginar no banco, seleção e colunas visíveis; não criar edição ou dados comerciais fictícios |

Frontend: OrganizationOverviewPage, DashboardPage, React Query, MetricCard, Recharts. Backend: OrganizationOverviewService, OrganizationOverviewController e DTO, SessionAuthGuard/PermissionsGuard, ProjectScopeService. Empresa e organização são entidades distintas; company_id é opcional no projeto. company_units e project_units possuem organization_id e exclusão lógica. projects.metadata/settings e companies.metadata são JSON livres, sem contrato tipado para segmento, logo ou etapa. Não é seguro inferir esses campos de texto arbitrário.

Auditoria concluída antes das alterações de código desta etapa. Sem necessidade de migrations/índices ou alteração de workflow/permissões.

## A. Resultado por referência

| Referência | Resultado final |
|---|---|
| 1 — valor e quantidade de contratos por ano | Bloqueados: não há entidade de contratos, cardinalidade contrato/projeto, data contratual ou valor. Mantida a evolução existente de criação de projetos com identificação explícita; não foi renomeada para contratos. |
| 2 — ticket anual | Bloqueado: sem valor e denominador comercial confiável. Nenhum cálculo fictício ou divisão por zero. |
| 3 — status | Implementada rosca com quantidade/percentual/legenda/tooltip e filtro clicável, com botões acessíveis equivalentes. Parcial em relação à divisão binária da referência: outros status aparecem separadamente. |
| 3 — recorrência por quantidade e valor | Bloqueadas: company_id identifica associação atual, mas não define cliente recorrente, data do primeiro contrato ou se o cliente já era recorrente naquele momento. Sem valor contratual. |
| 4 — etapas | Bloqueadas: workflow real tem draft/active/paused/finished/cancelled/archived/inactive e transições autorizadas, não as seis etapas comerciais. Nenhum mapeamento artificial de sessões de inventário para etapas globais. |
| 4 — segmentos por valor | Bloqueado: ausência de classificação de segmento e valor. |
| 4 — UF por valor, top seis + Outros | Bloqueado: valor e localização contratual não definidos. Não substituído silenciosamente por contagem operacional. |
| 5 — mapa | Implementado mapa geográfico estático com 27 UFs, escala por projetos distintos vinculados a unidades, ranking de oito estados, tooltip, legenda, estados sem dados e filtro por clique/teclado. Parcial: valor contratual indisponível; localização é operacional, não contratual. |
| 6 — empresas | Implementadas contagem, pesquisa, ordenação por nome/quantidade, paginação SQL, filtro por empresa e recolhimento. Parcial: valores/itens contratuais indisponíveis e sem campo de logo validado. Ordem inicial por quantidade decrescente, explicitamente informada. |
| 7 — segmentos | Bloqueada: mesmo impedimento do gráfico. Justificativa visível na própria página. |
| 8 — projetos | Implementadas paginação, ordenação por campos reais, pesquisa geral, seleção, configuração de colunas, navegação autorizada, rolagem horizontal, contagem e recolhimento. Parcial: etapa/segmento/data/valor/itens contratuais indisponíveis. Unidade vinculada não é chamada endereço contratado. Ano de criação permanece no filtro; não é apresentado como ano contratual. |

Os impedimentos também aparecem na seção recolhível “Dashboards dependentes de dados contratuais”. Nenhum item da referência ficou sem implementação ou justificativa.

## B. Arquivos desta etapa

Frontend:

- `gai-frontend/src/features/dashboard/OrganizationOverviewPage.tsx`: integração de filtros UF/empresa, rosca, mapa, tabelas e limitações; mantém cards, exportações e gráficos corretos anteriores.
- `gai-frontend/src/features/dashboard/OverviewDetails.tsx`: seções recolhíveis, status da carteira, mapa SVG acessível, agrupamento por empresa e tabela detalhada.
- `gai-frontend/src/features/dashboard/brazilStatePaths.json`: 27 polígonos geográficos e posições de rótulos, aproximadamente 61 KB, incorporados localmente; sem nova biblioteca.
- `gai-frontend/src/features/dashboard/OrganizationOverviewPage.test.tsx`: seis testes, incluindo novos cenários interativos.

Backend:

- `gai-backend/src/modules/project-dashboard/application/dto/organization-overview-query.dto.ts`: valida UF, empresa, paginação, busca de empresa, coluna e direção permitidas.
- `gai-backend/src/modules/project-dashboard/application/services/organization-overview.service.ts`: filtros compartilhados, contagens distintas por UF, projetos sem UF, paginação SQL de projetos e grupos de empresas, projeções de unidades e empresa.
- `gai-backend/src/modules/project-dashboard/presentation/organization-overview.controller.ts`: novos GET `/organization-overview/projects` e `/organization-overview/companies`, sob os guards existentes.
- `gai-backend/test/unit/modules/project-dashboard/organization-overview.spec.ts`: passou a 14 testes, com dados isolados adicionais de empresas/unidades e vínculos inconsistentes.
- Este relatório. Builds regeneraram dist/cache já presentes no repositório. Arquivos preexistentes de outros módulos não foram modificados deliberadamente.

Evidências ignoradas em `.local`: malha original, gerador da malha, roteiro de navegador e PNGs desktop/tablet/mobile, roteiro de SQL somente leitura e logs da API. Credenciais não foram gravadas nos scripts.

## C e D. Fontes, fórmulas e critérios

- **Status:** fonte `projects.status`. Aberto mantém o critério técnico explícito anterior `active`; concluído usa `finished`. Rascunho, pausado, inativo, cancelado e arquivado são exibidos nas categorias próprias, pois o workflow não permite inferir que todos são concluídos ou abertos. Percentual = quantidade da categoria / total dos projetos filtrados × 100. Uma seleção sem projetos não gera rosca nem percentual inválido.
- **Empresas:** `projects.company_id` → `companies.id`, com organização coincidente e exclusão lógica em ambos os lados. `COUNT(*)` dos projetos filtrados por empresa. Empresa ausente/excluída/vínculo inconsistente entra em “Sem empresa vinculada”, preservando conciliação das contagens sem revelar nome externo. Os grupos são paginados no SQL e somam o total dos projetos quando a pesquisa local de empresa está vazia.
- **Presença por UF:** `projects` → `project_units.project_id` → `company_units.id`. Cada vínculo e unidade deve estar na organização do projeto e não excluído. Só siglas oficiais, normalizadas com UPPER/TRIM, alimentam o mapa. `COUNT(DISTINCT project.id)` por UF impede multiplicação por várias unidades no mesmo estado. O filtro usa EXISTS, não join multiplicador. Projeto multi-UF conta uma vez em cada UF; portanto a soma das UFs pode superar o total de projetos. Sem localização = total menos quantidade de projetos com pelo menos uma unidade em UF válida. Textos completos de estado sem sigla normalizada permanecem fora do mapa, sem inferência geográfica arbitrária.
- **Tabela:** nomes/status/criação vêm de projects; empresa da junção protegida; unidades vinculadas = `COUNT(DISTINCT company_units.id)` nos vínculos válidos; UFs = GROUP_CONCAT DISTINCT das unidades. Esta coluna de detalhamento pode mostrar texto de estado que não seja sigla e não alimenta automaticamente o mapa.
- **Mapa sob filtro UF:** todas as seções consideram o conjunto de projetos com unidade naquela UF. Um projeto selecionado pode ainda mostrar suas outras UFs no mapa, pois são suas presenças operacionais. Nenhum projeto é contado duas vezes no indicador geral.
- **Financeiro/ticket:** permanecem null/Indisponível; despesa e pagamento não são valor contratado. Projeto não foi presumido equivalente a contrato. A fórmula solicitada de ticket anual depende de total contratado e quantidade válida de contratos por ano de assinatura; ambos faltam.
- **Recorrência:** não calculada. Faltam definição temporal, identidade comercial histórica e regra para primeiro contrato versus vários projetos simultâneos. company_id sozinho não autoriza essa classificação.
- **Etapas:** não calculadas. A política real de transições foi examinada; status não é etapa. Nenhuma alteração automática, edição inline ou ação em massa foi criada.
- **Segmento/logo:** não há campo tipado nem contrato documentado nos JSON livres. Não se consultou serviço de logos nem se criou upload. Placeholder usa iniciais.

Malha pública obtida do [IBGE](https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF), com projeção simples para SVG local. Não há chamada externa para renderização ou dados de negócio durante o uso do mapa. Rótulos/cores usam o sistema visual existente.

## E. Interações e desempenho

Os filtros gerais permanecem na URL: ano/mês/intervalo de criação, status e busca por projeto; agora incluem UF e empresa. Clique na rosca, botão de status, mapa, ranking ou empresa modifica a mesma seleção. Remover empresa/UF e Limpar filtros permitem desfazer. O formulário preserva empresa ao aplicar os demais campos. Toda exportação usa os mesmos predicados, sem depender de filtros de organização enviados pelo cliente.

Paginação e ordenação locais de cada tabela são independentes dos critérios globais e não recalculam os cards/mapa. Chaves React Query incluem usuário/organização, seleção e controles da tabela; requisições usam AbortSignal e staleTime de 30 segundos. Busca de empresa é aplicada por submit, sem pedido por tecla; limita somente o agrupamento, não altera silenciosamente o total global. Pesquisa geral por nome de projeto continua comum a todas as seções.

Projetos: dez por página, backend aceita 1–100, ordenação por nome/status/criação/ID/empresa/UF/unidades, cabeçalhos clicáveis nos campos disponíveis, desempate por ID. Colunas sem fonte não oferecem ordenação falsa. Seleção é local, persiste entre páginas e reinicia ao trocar filtros; não há ação em massa. Colunas podem ser ocultadas/exibidas. Empresa: nome e quantidade, dez grupos por página; pesquisa não descarta o estado global. A categoria “Sem empresa vinculada” é informativa e não possui filtro de identificador.

Agregações são SQL, consultas de quantidade fixa, sem N+1 e sem carregar itens de inventário. A listagem legada de até 50 projetos no overview foi preservada por compatibilidade; a nova tabela usa endpoint paginado. Exportação preserva o limite anterior de 10.000 projetos e colunas ID/Projeto/Status/Criado em; filtros UF/empresa também a restringem. Não foi ampliada para campos comerciais inexistentes. Não foram criados índices/migrations/cache compartilhado. Consultas paralelas não usam snapshot transacional, como antes.

## F. Segurança

Todos os endpoints conservam SessionAuthGuard e PermissionsGuard, e o serviço exige ORG_ADMIN com organização válida. OrganizationId deriva exclusivamente da sessão. Junções e subconsultas reforçam organization_id também em companies, project_units e company_units. Identificador de empresa de outra organização produz conjunto vazio, sem nome externo. Vínculos inconsistentes ou excluídos não alimentam mapa/unidades. DTO rejeita UF, identificador negativo, paginação ou ordenação inválidos; o SQL de ordenação usa lista fixa, sem interpolar nome de coluna arbitrário. organization_id extra continua rejeitado com 400 pelo ValidationPipe. CSV/XLSX mantêm a neutralização de fórmulas anterior. Nenhuma permissão ou transição de workflow foi alterada.

## G. Testes e resultados

- `npm.cmd run build` no backend: aprovado.
- `npm.cmd run build` no frontend: aprovado; aviso de bundle de cerca de 1,46 MB permanece, sem erro.
- Backend `npm.cmd test -- --runInBand test/unit/modules/project-dashboard test/unit/modules/projects`: 8 suítes, 34 testes aprovados. Inclui 14 testes do overview com SQL SQLite real em memória, duas organizações, vínculos externos/deletados, filtro UF + empresa sem duplicações, paginação, desempate, ordenação, busca, validação e exportação.
- Frontend `npm.cmd test -- --reporter=dot`: 25 arquivos, 170 testes aprovados. Depois dos ajustes finais, os seis testes da página passaram novamente. Avisos de dimensão de Recharts são do JSDOM sem layout, não falhas na página real.
- Primeira rodada encontrou ordenação por ID sobrescrita pelo desempate: corrigida. Testes de UI tiveram seletor ambíguo dos dois paginadores e opções de tipo inválidas: corrigidos antes da aprovação final.
- MySQL real, somente leitura: serviço e SQL independente coincidem para cinco seleções; total disponível 1 projeto ativo. Soma por status/mês e exportações confere. O banco real não foi populado para simular volume ou outras organizações.
- Chromium com login real ORG_ADMIN autorizado: overview e endpoints novos 200; exportações CSV/XLSX e botão Excel aprovados; organização extra 400, datas invertidas 400 e sem sessão 401. Clique em mapa SP, status e empresa aplicou filtros; limpar, busca vazia, seleção persistida no refresh, seleção de registro, configuração de colunas, ordenação e recolhimento passaram. Navegação real pelo nome do projeto até seu resumo autorizado e retorno também passou. Nenhum pageerror. Uma tentativa imediatamente após reiniciar a API expirou na navegação de login; a repetição com a API disponível e a rodada final completa passaram.
- Viewports reais 1440, 768 e 390: sem overflow horizontal da página; tabelas têm sua rolagem interna. Evidências em `.local/overview-desktop.png`, `overview-tablet.png`, `overview-mobile.png`.
- Paginação com mais de dez registros e isolamento entre organizações foram comprovados em testes isolados, não com escrita no MySQL de desenvolvimento. Seleção de segmento/etapa não foi testada funcionalmente por ausência de campos/regras; impedimento documentado.

## H. Pendências

Não é possível concluir os gráficos comerciais, recorrência, etapas e segmentos sem definir fontes e regras. Uma futura ampliação pode exigir alteração de esquema autorizada; nenhuma foi executada. Não foram inseridos dados de demonstração nem interpretados settings/metadata livres como contrato. A classificação binária “aberto/concluído” ainda requer decisão comercial para status pausado, rascunho, inativo e arquivado. A localização operacional não comprova localização contratual. Logo continua sem fonte tipada.

## I. Resultado local

URL: http://localhost:5173/app/dashboard, usando o ORG_ADMIN já fornecido pelo usuário. A API compilada foi reiniciada localmente com o build novo; PID em `.local/backend.pid` e logs `.local/overview-api*.log`. MySQL e frontend existentes foram preservados. Nenhum commit, push, merge, seed, migration ou alteração de dados de negócio/produção. Login/logout apenas usam o estado de autenticação previsto pelo sistema.
