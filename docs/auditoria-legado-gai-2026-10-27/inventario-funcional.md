# Inventário funcional do legado

Ler com a metodologia e as classificações do [relatório principal](README.md). Caminhos sem prefixo são relativos à extração temporária do ZIP. Todas as telas, campos/atributos, botões, listeners e funções detectados estão enumerados no [anexo do legado](anexo-legado.md); este inventário descreve comportamento e regras, sem promover um controle visual a funcionalidade operacional. “Local comprovado” significa tratamento presente no JavaScript, sem validação de execução no navegador. “Remoto não verificado” significa cliente implementado, servidor ausente.

## 1. Painel de projetos, histórico de propostas e prospecção

Origem: `paineis/painel_projetos_inventario_ativos.html` (6.975 linhas); cópia de `dashboards/` com mesmo hash.

| Dimensão | Achado baseado no código |
|---|---|
| Telas/abas/modais/componentes | Projetos, histórico de propostas, curso/prospecção; cards, gráficos, mapa SVG do Brasil, agrupamentos por empresa/segmento e tabelas. Modais novo/editar projeto, proposta e outbound, edição em massa, valor de proposta, duplicidades e logos (`660–1628`, `3400–3537`, `4193–4216`, `5308–5337`). |
| Campos/validações | Projeto/nome, empresa, ano, segmento, UF, tipo/origem, local, data e valor de contrato, início/fim de campo, conclusão/motivo, qtd. de itens, custo por placa, despesas por conta de, forma de pagamento, parcelas/percentuais, escopo vistoria/inventário/conciliação/CPC, recorrência, endereços, responsável e aditivo com data/parcelas. `required` em nome/ano/segmento/valor e min/max de ano; tratamento no submit (`3540–3616`). Proposta: empresa/data/valor/ano/status. Outbound: empresa, lista/responsável, curso/data, setor/sede, CNPJ/LinkedIn e etapas/datas. |
| Ações/handlers | CRUD e persistência locais (`openNewModal`, `openEditModal`, `persist`), backup JSON e importação (`1905–1939`), importações/exports XLSX, ignorar/marcar proposta (`4095`), edição de etapas, seleção e normalização de empresas/duplicidades (`outFundirGrupo:6016`, `outPadronizarModal:6041`). Não presumir criação de contrato real em serviço externo. |
| Filtros/tabelas/paginação | Ano/mês/segmento/UF/data/status/serviços/faixa de itens/busca; cortes temporais e filtro cruzado (`applyFilters:2055`, `baseProjExceto:3005`). Propostas: ano/status/mês/valor/empresa. Outbound: responsável/curso/inserção/lista/etapas e paginação explícita (`renderOutboundPager:5100`, page size salvo). Ordenação nas três listas, colunas ocultáveis e larguras/arraste. |
| Indicadores/fórmulas | `atualizarCustoPorPlaca:3438`: contrato ÷ itens com tratamento de denominador; `renderKPIs:2174` total/ticket e carteira. Evolução por conclusão/andamento/pendências e quantidades conciliadas (`pjCampoEnc:2095`, `pjMet:2108`, `carregarQtdConciliacao:2472`, `pctEvolucao:2505`). Propostas: conversão em quantidade e valor, tickets por ano (`3815`, `3934–4074`). |
| Gráficos/fontes | Chart.js: valor, quantidade e ticket anual, carteira/status/recorrência, etapas abertas, top segmentos, UF e mapa; fonte são arrays filtrados de projetos/propostas/outbound. Logos consultam serviços externos e guardam cópia (`wdGet:2702`, `acharLogoUrl:2713`). Não são geocodificação real de endereços. |
| Dados/storage/API | Objetos por projeto/proposta/registro; `projetos-inventario-v1`, `propostas-historico-v1`, `outbound-v1`, logos e preferências. `loadData:1757`, `persist:1889`; sharedStore do sincronizador. IndexedDB de conciliação alimenta contagens. Há padronização de homônimos e movimentação de lançamentos por nome (`1810–1870`). Sem organização como chave. |
| Imports/exports/relatórios | Backup JSON de dados de painel, planilhas e logos; o backup do painel não comprova backup transacional de todos os módulos e anexos. |
| Permissões/vínculos | Usuário/responsável lido de localStorage/parent; visibilidade vem do shell. Projeto ligado por nome a remuneração/despesas/inventário/pendências/kick-off. Não há garantia de autorização por operação no servidor exportado. |
| Limites e GAI | Cadastro e dashboards básicos têm equivalentes. Contrato/escopo/recorrência/aditivos e carteira comercial são lacunas; overview ORG_ADMIN atual já tem filtros/status/UF/empresa/export, mas valor contratado e quantidade contratada retornam null. CRM é escopo adjacente. Não migrar os arrays embarcados. |

## 2. Inventário físico e edição de planilhas

Origem: `paineis/inventario.html` (5.965 linhas), igual a `dashboards/inventario.html`.

| Dimensão | Achado baseado no código |
|---|---|
| UI/formulários | Gate de projetos, importação, indicadores, dados da planilha, consolidado, agrupamento físico e cronograma (`254–491`). Seleção de arquivo e colunas de chave/descrição/valor; tabela editável com menus de coluna, seleção e diálogos de códigos/placas/duplicidades. Importação por arraste/FileReader (`bindDrop:2738`). |
| Campos/validações | Cabeçalhos livres normalizados, colunas Status, Placa antiga, Cod base, Código Investor e Seleção criadas/ajustadas (`622–750`). Valor numérico pt-BR em `toNum:595`; seleção por códigos verifica existência e duplicidade. Validações são de planilha, não schema de entidade persistida no servidor. |
| Ações com processamento | Worker trata `load`, `appendLote`, `removerLote`, `setCell`, `fillCol`, `clearCol`, `dropCol`, copiar/colar colunas e seleção, `pasteSel`, `gerarNumInv`, limpar/gerar placas, `statusEspecial`, desconciliar/substituir/normalizar códigos, excluir linhas, undo/redo e export (`onmessage:1139–2515`). As mensagens de solicitação e resposta são enumeradas no anexo. |
| Filtros/tabelas/páginas | Busca e filtros por coluna/status/seleção, ocultar/reordenar/redimensionar colunas, ordenação, zoom, paginação via `page:1025` e `renderPreview:3484`, seleção de todos os filtrados. Não há paginação remota comprovada. |
| Indicadores/fórmulas | `calcularResumos:1062` conta linhas/status e agrega valores; agrupamento físico/consolidado e cruzamento de colunas (`renderConsolidado:3104`, `renderConsFis:3298`, `renderCruzado:3242`). `reconcile:929` também existe no worker, mas não basta para assumir que toda UI de conciliação esteja exposta nesta tela: há helper `__noopEl:2521` que absorve elementos ausentes. |
| Gráficos/fontes | Chart.js e resumos a partir de DB.inv/DB.cont e recortes selecionados; não são contagens consultadas da API GAI. |
| Dados/storage | Matrizes `{head,rows,meta}`, arrays de snapshots/undo/redo, deltas por linha/coluna. IndexedDB `conciliacao_db/bases` com namespace `inv::<projeto>::<base>` (`527–586`). Cache/memória do worker e preferências no navegador. |
| APIs/import/export | XLSX parse da primeira aba (`parse:605`), lotes e export de bases/resultados (`exportar:1040`, mensagens exportBases/export). `conc-db` para ping/deltas/base (`dbPing:4649`, `dbEnviarDeltas:4659`, `dbBaixarBase:4686`) é cliente comprovado e persistência remota não verificada. |
| Cronograma | `cronoLinhas:4801`, `cronoSalvar:4854`, `cronoPuxar:4869`, `cronoRender:4920`: linhas com campos editáveis, filtros/seleção, colar série, ordem/largura, histórico local e sharedStore. Não é calendário de sessão/rodada do GAI. |
| Dependências/permissões | Depende de cadastro de projeto, estado de andamento/campo e bases no mesmo browser; gate e bloqueios de duplicidade são client-side. `destravarConciliacao:4448` é desbloqueio de UI, não permissão de servidor. |
| Limites e GAI | GAI já tem itens, imports tipados, sessões/observações e evidência imutável; falta experiência de planilha livre/lote e cronograma. Não importar manipulação de colunas/códigos diretamente no cadastro mestre. |

## 3. Conciliação físico-contábil e variantes

| Arquivo | Papel real e diferenças |
|---|---|
| `conciliacao_fisico_contabil.html` | Engine genérico com chaves/valores/tolerância (`reconcile:856–938`), base de ambos os lados, sugestões (`autoConc:1635–1721`, `autoAprovar:1722`), agrupamentos, placas/séries, edição e export. Não usa gate/namespace por projeto como a variante 3. |
| `conciliacao_fisico_contabil_3.html` | Gate por projeto e limpeza/restore por projeto; importa físico a partir do inventário (`__puxarDoInventario:2979`); indicadores com valor residual; agrupamento por placa e validação de série/placa (`1785–1851`); sugestões `1852–1967`, exclusão de linhas e ligações de sincronização entre inventário e contábil. É variante mais rica para esta capacidade, não prova de ser a versão oficial. |
| `conciliacao_fisico_contabil_2.html` | Tela intitulada Avaliação; tem colunas fonte/novo/usado e `avaliarLinhas:1501–1522`; conserva engine/edição genéricos. Não tem `autoConc`. Usa dados de avaliação, não é o mesmo que `_02`. |
| `conciliacao_fisico_contabil_avaliacao2.html` | Avaliação por projeto, importação da base do inventário (`puxarInventario:2169–2188`, `abrirProjetoAval:4159`) e avaliação em lote (`1515–1535`). Preserva colunas e persistência separada de avaliação. |
| `conciliacao_fisico_contabil_02.html` | Somente cards de projetos filtrados por flag conciliação/aberto e busca (`render:68–96`). Cards têm `data-projeto`, mas nenhum handler os abre. **Não há motor de conciliação operacional nesta página.** |

Os quatro primeiros arquivos existentes também em `dashboards/` (`principal`, `_2`, `_3`) têm cópias idênticas; `_02` e `_avaliacao2` só existem em `paineis/`. O `_02` não deve ser confundido por aproximação de nome com `_2`.

| Dimensão | Regras, evidências e limites |
|---|---|
| UI/formulários | Upload de planilhas, de/para de colunas, seleção de chaves, descrições e valores, tolerância, previews físico/contábil, agrupamentos cruzados, selecionados, auto conciliação e revisão, troca de códigos, status especiais e duplicidades. Em `_3`, diálogos `abrir:5069`, `rodar:5101`, `renderStatusBox:5203`. Campos: placa antiga/nova, série, descrição, unidade/local, código, valor/residual, regra/nível sugeridos. |
| Comparação por chave/valor | Exemplo `inventario.html:929–1011`, com equivalente nas variantes: normaliza chaves, cria Map por nível, procura candidato, calcula `dif = valorFisico − valorContabil`; `abs(dif) <= tolerancia` resulta conciliado, demais divergência, sobras dos dois lados. O Map guarda só o primeiro candidato por chave e há fallback para encontrado já usado; **essa rotina genérica não garante 1:1 robusto**. Não copiar sem redesenho. |
| Sugestões automáticas | `_3:1852–1938`: r1 placa antiga, r2 série, r3 descrição+local/unidade, r4 descrição. Consome candidatos uma vez, ignora códigos já conciliados; tokens sem stopwords e Dice `2*comuns/(tokensFisico+tokensContabil)`. Limiar é `cfg.sim/100`, usando 60% quando o parâmetro é falsy; top 40 por físico, ignora token com lista >8.000, candidatos manuais >=25%, no máximo 600 apresentados. Desempata priorizando **maior valor contábil**, depois score. Os rótulos citam “valor”, mas não há teste de tolerância monetária nessas regras 3/4; valor é ordenação. |
| Aprovação/revisão | `_3:1939–1967` grava códigos e níveis/regra após seleção; nível 05 é revisão manual. Placa/série com nenhuma palavra comum gera sinal de divergência (`1920–1928`). `validarPlacaSerie` copia código físico, conta ausentes/duplicados e atualiza status; isso altera planilha, não preserva evidência como o GAI. |
| Manipulações | `setCell`, preencher/limpar/copiar coluna, seleção entre filtros, colar, trocar códigos, normalizar substituição, cancelar conciliação, manter escolhidos e descartar substituição, undo/redo. Há tratamento no worker, mas não validações transacionais de negócio no servidor do export. |
| Filtros/tabelas/paginação | Busca/filtros por coluna/status, selecionados, ordenação/colunas/zoom, `page` e previews; agrupamento contábil/físico e cruzamento. Em `_3`, `renderConsolidado:3837`, `renderConsFis:4138`, `grpPlacaRender:4950`. |
| Indicadores/gráficos | Contagens/valores por conciliado/sobras/status e agrupamento por placa/grupo/valor residual, sobre as matrizes locais. Seleção de coluna contábil determina valores; não se presume uma única coluna de valor residual. |
| Persistência/API | IndexedDB `conciliacao_db/bases`, namespaces diferentes e `PROJ_ATUAL` em variantes. Snapshots limitados de undo/redo; deltas por índice; `conc-db` para base/deltas/ping. Sem função de servidor no ZIP, esquema remoto/autorização/conflitos são não verificados. |
| Imports/exports | XLSX/CSV via SheetJS, de/para e export de bases, buckets e resumo; copiar do inventário em variantes específicas. Não equivale a reprocessar dados de sessão no GAI. |
| Permissões/dependências | Depende das duas bases, cabeçalhos reconhecidos/códigos e projeto nas variantes correspondentes. Desbloqueios client-side não podem virar permissão. |
| Comparação GAI | GAI já concilia por placa normalizada e última observação, detecta duplicidade/sobras, versiona runs e consolida snapshot. Falta motor de sugestões por série/texto/local e fluxo de revisão detalhado. O campo série existe em observação, mas não é usado pelo `reconcile` atual. Pareamento divergência monetária por tolerância também não é equivalente ao status divergent de observação. |

## 4. Avaliação manual e em lote

Origem específica: `_2:640–648,1501–1522` e `_avaliacao2:653–661,1515–1535`, além da família acima.

O modal “Avaliar itens selecionados” recebe fonte de consulta, valor novo e valor usado. O worker adiciona colunas se faltarem, aplica somente valores não vazios às linhas selecionadas, registra deltas, persiste e retorna quantidade. Não há cálculo comprovado de depreciação, valor justo, vida útil ou busca automática de preços. Valores em branco são ignorados, portanto esse caminho não limpa o valor existente. A importação de inventário em `_avaliacao2:2171–2177` tenta primeiro chaves do projeto e depois bases `sem-projeto`/global: origem ambígua que precisa ser proibida no GAI.

Tabela, seleção/filtros/paginação, XLSX e IndexedDB seguem a família de conciliação. A variante avaliacao2 importa a base de inventário do projeto; a `_2` carrega a base de avaliação. O GAI já tem `asset_valuations` e formulário por item (fonte/data/valores/responsável), com histórico e pelo menos um valor obrigatório. O ganho é avaliação em lote e navegação/agrupamento; as regras e evidências devem ficar no backend, preservando o histórico de avaliações.

## 5. Despesas de projetos

Origem: `paineis/despesas_projetos.html`, 3.538 linhas, cópia idêntica em dashboards.

| Dimensão | Achado |
|---|---|
| UI/modais/campos | Gate de projetos, acompanhamento, gráficos, resumo por inventariante, lançamentos, lotes de prestação, concluir projeto e export ZIP (`494–787`). Nova/editar despesa: data, técnico, tipo do contrato, tipo da despesa/reembolso, motivo, observação, valor, depositado, forma à vista/a prazo/faturado, qtd e datas/valores de parcelas, data de pagamento e até dois anexos. Novo/editar adiantamento: data/técnico/observação/valor/responsável. |
| Validações/regras | `tipoFixoDoProjeto:2123` fixa tipo contratual; técnico deve estar vinculado; normalização de data/valor e rótulo de reembolso (`1151–1174`). Parcelamento é mensal, com edição/distribuição e verificações de soma nos handlers `2269–2282`, `2574–2611` e submit posterior. Anexos têm preparação/redução de imagem (`prepararAnexo:2414`). Limite visual de dois não comprova limite no servidor. |
| Ações comprovadas | Novo/editar/excluir, adiantamentos (`1638–1690`), fechar lote/prestação e reabrir em handlers da tabela/barra (`1801–1884`, `2444–2470`), anexar/baixar/excluir, ZIP/import/export e limpeza geral (`1972–1996`, perigosa para reuso). |
| Filtros/tabela | Projeto, técnico, motivo/tipo, data/status/lote/busca conforme controles do anexo; `filtered:1180`, ordenação, seleção, paginação `renderPager:1888`, zoom/colunas/larguras. Clique no resumo filtra o técnico sem despesas criando opção válida (`1762–1779`). |
| Indicadores/fórmulas | KPIs/gráficos (`renderKPIs:1219`, `renderCharts:1245`): totais de despesas e reembolsáveis por projeto. `resumoInventariantes:1726–1793` restringe vinculados, agrega despesas e calcula **saldo = adiantamentos − despesas**. Label reembolso é normalizado por `normReemb`, e encerrado controla solicitação/lote; não tratar automaticamente como recebimento do cliente. |
| Dados/storage/API | `despesas_projetos_v1::<projeto>`, índice por projeto, mapa de adiantamentos, anexos em IndexedDB `desp_anexos` (`1312–1383`), sessionStorage de projeto. sharedStore e `dados` com indexação/merge/pendências (`save:831`, `sincronizarDespProjetos:947`). Sem backend exportado. |
| Imports/exports | XLSX e ZIP por projeto com dados e anexos (`abrirZip:2702`, `gerarZip:2731–2768`). `pdfDemo:1394` gera documento demonstrativo, que não é comprovante real. Rotinas de seed e purga coexistem. |
| Permissões/dependências/GAI | Projeto/inventariante por nome e cadastro compartilhado. GAI já tem CRUD/aprovar/rejeitar/pagar/cancelar despesas, anexos, prestação e parcelas; não tem modelo comprovado de adiantamento/recebível de reembolso ou ZIP binário completo. Tipo/reembolso em metadata sem contrato de domínio não é equivalente. |

## 6. Inventariantes

Origem: `inventariantes.html`, 1.212 linhas, duplicado idêntico.

Tela com busca, UF, função, seleção, tabela ordenável, contagem, novo/editar, documentos anexados e modal de projetos (`157–251`, `filtrar:582`, `render:596`, `abrirEdicao:652`). Campos nome, e-mail, login, senha, telefone com máscara, UF, função e projetos do aplicativo. Submit, `salvar:289–319`, `selarEdicao:376` e merge por campos/IDs (`mesclarInv:441`) comprovam edição local; a senha faz parte do legado e não deve ser portada. Documentos têm upload/download via `dados` (`anexEnviar:325`, `anexBaixar:334`) e confirmação de remoção. `pdfFake:896` e seed de anexos não provam documentação cadastral real.

Estrutura é lista em `inventariantes_v1`, snapshots/pendências locais e vínculos por nome de projeto. Sincronização direta `lerServidor:500`, `sincronizarInv:510`; ausência do servidor impede comprovar ACL e autenticação do aplicativo. Planilha de cadastro tem handlers locais; detalhes de campos/eventos no anexo. Não foi localizado gráfico de negócio próprio nem paginação de servidor.

GAI já possui cadastro tipado, CPF/CNPJ/telefone, status ativo/inativo/bloqueado, exclusão controlada, vínculos e validação de organização/projeto. Cadastro do técnico não equivale a criar usuário autenticável. Falta repositório de documentos cadastrais e, se desejado, vínculo explícito técnico↔conta com permissões adequadas; não copiar login/senha deste formulário.

## 7. Remuneração técnico

Origem: `remuneracao_tecnico.html`, 2.161 linhas, duplicado idêntico.

Gate por projeto, resumo/subtotais, filtros inventariante/UF/status/busca, tabela/seleção, novo/editar/excluir/mudar status e export XLSX. Modal: técnico/UF/status, início/fim, data de pagamento obrigatória, dias, diária, adicional, total editável, desconto, observação (`496–517`, `abrirEdicao:1429`, submit `1490–1513`). O técnico deve estar cadastrado e data de pagamento não pode ser vazia (`1497–1498`). Não há prova de aprovação segregada como no GAI.

`recalcularDias:1415` usa diferença de datas **inclusiva**, calendário corrido; recalcula total dias×diária. Handler `1469–1474` inclui adicional ao alterar dias/diária/adicional. **Há inconsistência:** recalcular datas (`1422`) não inclui adicional, embora handler de valores inclua. `calcFinal:1425` calcula total−desconto. Total pode ser digitado manualmente e é salvo, então fórmula não é invariável. Totais do projeto/percentuais de contrato/despesas (`173–225`, `881–901`) dependem dos lançamentos e contrato locais. Não foi encontrado motor de folha/salário automático.

Dados por `remuneracao[-_]tecnico[-_]v1::<projeto>`, mapa `rt_mapa_compartilhado_v1`, exclusões e reparo de nomes/sufixos (`599–819`, `1120–1174`). APIs `dados`/sharedStore, merge para preservar baixas. `filtradas:1213`, `render:1226`, `aplicarStatus:1362`, export `1520–1528`. Scripts de zerar/semear/recuperar órfãos não são funcionalidades seguras a migrar.

GAI possui `FieldAgentPayment`, fórmula no domínio e estados/auditoria. Não portar total livre nem reduzir seu controle de estados; oportunidades são consolidado entre projetos e experiência de edição/consulta.

## 8. Pagamentos de inventariantes

Origem: `pagamentos_inventariantes.html`, 1.449 linhas, duplicado idêntico.

Tela consolida remunerações de vários projetos por técnico, filtros projeto/técnico/status/previsão/pagamento e data, resumo mensal, tabelas com seleção e colunas/ordenadores (`335–464`, `coletar:604–658`, `filtrar:698`, `render:769`, `renderResumo:858`). KPIs (`814–856`) distinguem abertos/atrasos/mês. Fonte são chaves de remuneração e cadastro de projetos; não movimenta banco real.

`confirmar:1025` vincula modal à ação; `aplicarStatusPag:1038` atualiza selecionados na chave de origem. Se status não Pago, preserva previsão e limpa data de pagamento; `aplicarDataPagamento:1078` altera datas em lote. Baixa/status/datas e export têm handlers, mas sem prova de transação/concorrência no backend Netlify. `sincronizarPag:568` tenta manter espelho mapa RT. Seeds/purgas na abertura permanecem risco. O GAI tem pagamentos por projeto, resumo e exports; consolidado global por técnico, batch autorizado e previsão separada da data efetiva são diferenças a tratar.

## 9. Fluxo de caixa e DRE

Origem: `paineis/fluxo_caixa.html` (4.685 linhas) e `dashboards/fluxo_caixa.html` (4.596), **conteúdos diferentes**.

| Dimensão | Achado |
|---|---|
| UI/formulários | Filtros ano/projeto/tipo; cards/ponto de equilíbrio, simulação de venda/parcelas, custos fixos e parâmetros. Tabelas faturamento, reembolsos a receber, saídas reembolsáveis/não reembolsáveis, DRE mensal/acumulada/comparativa e configuração de linhas/contas (`176–510`, `render:953`, `dre:3317`, `dreComparativo:3689`). |
| Campos/validações | Valor venda, sinal e parcelas, vencimentos/datas/status, imposto e percentuais de comissões/custos, modo fixo versus média/percentual, valores de contas mensais, ajustes. Parsers num/partes e guardas de denominador por fórmula; não há validação contábil central no servidor. |
| Ações | Gerar simulações (`simParcelas:890`, `adicionar:924`), configurar custos (`salvarCustos:4444`), baixar recebimento/alterar data/status e desfazer (`1957–2024`, `2360`), importar DRE (`aplicarPlanilhaDre:3627`, handler `4034`), editar/excluir contas/ajustes e exportar. Ações de recebimento são estado no sistema, não integração bancária comprovada. |
| Fontes/dados | `coletar:636–772` agrega contratos, remunerações e despesas, deduplica por identificadores e repara nomes; contratos viram entradas, gastos parcelados viram saídas por parcela. Reembolsos somente ganham data prevista após prestação encerrada. À vista é tratado como pago na data; faturado/a prazo depende de baixa manual. |
| Fórmulas | Fluxo separa entradas/saídas, pago/previsto; IR sobre entradas Recebido (`737–745`). `DRE_LINHAS:2491+` e `calcAno:3161` calculam receita/resultados; `ENT_INI:3211` fixa **setembro/2026** como início de entradas na DRE. Histórico anterior é importado e em certos cálculos dividido por **0,8667**. `pctVar12:2912` agrega 12 meses fechados; `pctComBruta3a:2937` usa três anos civis fechados (apesar de comentário anterior sugerir janela móvel). Projeção de custo em ponto de equilíbrio usa orçamento de projetos (`2958–2980`, `orcProjetos:3032`), não todo o realizado. |
| Diferenças entre cópias | `paineis/` acrescenta `pctVar12`, `pctComBruta3a` e helpers de custo faltante, altera base de receitas/comissões/projeções e parâmetros de cards. Logo, mesma interface não implica mesmos resultados. Ver catálogo de funções e manifesto de ambas as cópias. |
| Gráficos/filtros/páginas | `graficos:859` usa movimentos filtrados em Chart.js; agrupamento mensal, selects/filtros cruzados, ordenação, seleção e scroll sincronizado da DRE. Não identificado paginador de servidor para o consolidado; grandes listas são client-side. |
| Storage/API | JSON de recebimentos/status/datas por chave, DRE por ano, ajustes, parâmetros e custos, `fc-dre-v1`/`dre_gai_v2`, simulações e preferências. sharedStore busca fontes (`fcSincFontes:608`, `sincronizarDre:2619`), mas servidor não veio no ZIP. |
| Dependências/limites/GAI | Contratos, despesas, parcelas, remuneração, prestação, origem comercial e orçamento. GAI tem saídas e resumo financeiro; não tem caixa/recebíveis/DRE/tributação/orçamento equivalentes. Não transplantar constantes pessoais/fiscais/históricas. Calcular no backend com política financeira validada e distinguir competência, caixa, cenário e realizado. |

## 10. Orçamentos e propostas

Origem: `orcamentos.html`, 4.256 linhas, duplicado idêntico.

| Dimensão | Achado |
|---|---|
| UI/campos/modais | Lista/filtros e novo/editar orçamento, parâmetros de despesas/faixas/opções de valor, editor de sites/segmentos, memória de cálculo e proposta/previews. Empresa, tipo de site, produtividade/escopo, itens/endereços/cidades/UFs, prazo campo/projeto, segmento, equipe necessária/proposta, diária, despesas e plaquetas por conta de, comissão, custo/qtde de plaquetas, entrada/parcelas, imposto e despesas (`229–441`). |
| Produtividade | `prodEfetiva:542`: se itens/endereço < produtividade nominal, usa max(itens/endereço × endereços/dia,0,01); defaults nominais 80/60/50, configuráveis. `invNecessarios:476` arredonda necessidade a duas casas, sem ceil para contratar pessoa. `diasCampo:563` é ceil(itens/produtividade/equipe); `diasProjeto:568` é itens/produtividade com duas casas. |
| Preço/memória | `totalTecnicos:573`: diária × diasProjeto; default de diária 185. `subtotalRec:614` calcula técnicos/fator ou fallback e aplica piso 21.000 para valor positivo; por endereço com até 20 endereços retorna piso. `fatorSugerido:588`: até 10.000 itens opção 1, acima opção 2; >125 endereços na faixa por endereço usa opção 3. Defaults de fatores 0,20/0,30/0,15. Não são percentuais universais de margem. |
| Despesas/tributos/parcelas | Hospedagem ceil(equipe/2) quartos × diária × (dias + floor(dias/5)×dias extras); alimentação equipe×dias hospedagem×valor, transporte por dia (`1034–1055`). Gross-up despesa/(1−alíquota) (`1056–1069`). Total = subtotal + despesa gross-up quando Investor + comissão com gross-up + plaquetas quando Investor (`1189–1287`). Entrada e saldo/parcelas, percentuais customizados e aviso de divergência; `dividirSaldo:1144` põe residual de centavos na última parcela. |
| Ações/validação | CRUD local, editar faixas, despesas, condições, memória e proposta; deduplica sites (`dedupeSites:671`), seleção de orçamento e estado de edição. Validação de percentuais/quantidades nos inputs/handlers; não há validação independente no servidor exportado. |
| Tabela/filtros/indicadores | `filtered:807`, `renderKPIs:846`, `ordenar:883`, `renderTable:906`; indicadores de orçamento e cálculos são dos dados locais. Não identificado gráfico de receita financeira real próprio. |
| Dados/storage/API | Orçamentos e parâmetros em chaves investor_* (faixas/endereços/site/opções), textos/modelo de proposta e escopo por segmento; sharedStore (`save:768`, `loadRemoto:786`, `puxarServidor:2313`). Sem tenant. |
| Arquivos/relatórios | Proposta HTML/deck/Word (`verProposta:2461`, `deckHTML:2487`, `docHTML:2627`); JSZip manipula pacote PPTX/modelo, remove slides/escopos, troca textos/parcelas/imagens (`exportarModelo:3150–3423`, `criarTroca:3425`). Modelos/slides/imagens/fontes vêm em `proposta/`. Presença do gerador não comprova renderização fiel no PowerPoint. |
| GAI/risco | Não localizado módulo equivalente. Reaproveitar a ideia da memória explicável e parâmetros versionados; política de preços, imagem/layout e percentuais precisam validação. Converter em contrato/projeto/recebíveis deve ser operação explícita e idempotente, futura. |

## 11. Kick-off

Origem: `kickoff.html`, 1.691 linhas, cópia idêntica.

Lista/seleção de kick-offs, filtro por situação, criar/clonar/excluir, tabela por seções, edição de textos/itens/colunas e geração de comunicação. Modelo `SECOES:254+` contém resumo de escopo/preparação e vida útil; não é engine de cálculo de vida útil. Dados `{id,cliente,projeto,data,responsavel,respostas,marcados,textos,criadoEm}` em `novo:314`; persistência `checklist_kickoff_v1`, seleção atual e textos/colunas ocultas (`save:379`, `loadRemoto:392`).

Campos incluem contatos/focais, objetivo, escopo, histórico de inventário, itens/endereço, sistema/base contábil/centros de custo/série/bens/veículos/data-base, documentos/valores patrimoniais, auditoria, etiquetas (fornecedor/quantidade/sequências/modelo/retirada), EPIs/segurança, prazos/horário, despesas, report semanal/planta e documentos de manutenção/turnos/VUE. `celula:661–794` gera inputs/selects, complementos condicionais, datas/quantidades/UFs/horários e sequências. `bloqueado:597` controla dependências/N/A; nem todo campo é obrigatório no sentido de impedir salvar.

`progressoKo:433` conta itens marcados exceto ocultos; participação por endereço = qtd itens/endereço ÷ total ×100 com uma casa (`pctCalc:627`). `puxarDoPainel:817` importa dados de projeto/escopo/endereço. `ligarLinhas:910–1113` salva respostas e checks; `criarNovo:1198` trata criação. `gerarEmail:1271`, `abrirEmail:1377`, `gerarMsgTecnico:1388` e handlers posteriores geram texto/HTML, cópia/download e abertura de cliente de e-mail/WhatsApp; **não comprovam entrega automática ou integração de mensagens**. Não foram enviadas mensagens nesta auditoria.

Fonte são respostas e projeto, sem gráfico de negócio separado; tabela com colunas configuráveis e contadores, sem paginação de API identificada. sharedStore tenta sincronizar; regras de usuário derivam do shell. GAI já tem projeto/empresa/unidades; falta preparação versionada e validação no backend. Preservar IDs de pergunta e versão, sem vincular histórico ao índice do array.

## 12. Checklist do cliente

Origem: `checklist_cliente.html`, 966 linhas, cópia idêntica. Similar estrutural ao kick-off, mas chave **`checklist_cliente_v1`**, modelo/respostas próprios e funções distintas (`novo:277`, `save:322`, `loadRemoto:327`, `celula:480`, `ligarLinhas:667`, `criarNovo:896`). Não presumir que os checks de uma tela são os da outra.

Tem lista/filtro de situação, novo/clonar/editar, perguntas/seções resumo e vida útil, marcações, complementos, N/A/bloqueios (`bloqueado:453`), UF/quantidades/sequências/horários, responsavel/cliente/projeto/data e textos/colunas. Lista de campos do modelo em `221–267`; todos controles no anexo. Persistência JSON local+sharedStore, contadores e tabela configurável. Não encontrado envio de e-mail específico equivalente ao kick-off nem engine de vida útil. Não identificado gráfico ou paginação remota. GAI não tem checklist do cliente implementado; pendências de inventário não são substituto funcional.

## 13. Pendências de campo e coordenação

Origem: `pendencias_campo.html`, 1.246 linhas, cópia idêntica.

Tela de projetos/busca “somente com pendência”, destaques e painel de checklist por grupos, modelo/ordem editáveis e mensagens de orientação (`lista:173`, `desenhar:191`, `modeloDeGrupos:375`, `desenhaCheck:1009`). Grupos iniciais de coordenação de projeto/campo, contatos/logística/pagamento e verificações diárias de placas/série/local/descrição (`336–367`). Responsáveis de pessoas fixas são exemplos do legado, não papéis do GAI.

`selecionar:474`, `salvar:526`, `salvarModelo:431` e `salvarEstrutura:444` provam tratamento de seleção/checks e customização. **Conclusão = todos os checks das primeiras duas faixas**, não de todos os grupos (`statusDe:507–513`), data é gravada/removida conforme progresso (`516–523`). Storage: projetos/andamento, `investor_pendcampo_lista`, `inv-em-andamento-v1`, `inv-campo-manual-v1`, `pendencias-checklist-campo-v1`, modelo/ordem/layout/conclusão e destaques. Autorização da edição é `ehAdmin:461` baseada em localStorage; não é garantia de backend.

Geradores de mensagem de técnico e grupo aproveitam kick-off/endereços/pagamento (`605`, `815`). Há handlers para cópia/abertura WhatsApp. Download de APK tem handler (`960–1007`) que monta `/app/<arquivo>` e permite mudar nome, **mas não há APK no ZIP**, apenas leia-me. Isso comprova a construção do link, não distribuição funcional de aplicativo. Não há gráfico próprio nem validação automática de qualidade de campo neste checklist; os textos “verificar duplicada/furo” são tarefas manuais, salvo rotinas concretas nas telas de inventário/conciliação.

GAI já possui ocorrências de inventário com criação/geração/resolve/ignore/cancel. Falta checklist de coordenação com templates/responsáveis/progresso; manter os conceitos separados, permitindo referência cruzada.

## 14. Gestão de atividades, jornada e solicitações

Origem: `gestao_atividades.html`, 1.598 linhas, cópia idêntica.

| Dimensão | Achado |
|---|---|
| UI/campos | Minhas atividades/consolidado por técnico, criar atividade e lançar horário esquecido, solicitações e ociosidade a validar (`102–166`). Atividade/projeto/responsável/data/status, início/saída/pausa, motivo/observação e modalidade. Calendário mensal, feriados e marcações de dia/almoço. |
| Ações/permissões | `confirmarAtividade:302`, iniciar/pausar/retomar/encerrar nos handlers e `gravarCampo:1248`; `ADMIN` vê consolidado/outros, usuário próprio (`visiveis:344`). Controle deriva de identidade/admin no navegador, não ACL confiável. |
| Validação retroativa | `salvarRetro:970`: atividade e data obrigatórias, não futura, saída após início e não depois de agora; motivo obrigatório para não-admin. Admin lança direto; usuário envia solicitação pendente. `solDecidir:1036` aprova/recusa/cancela, aprovação cria registro com referência; decisões ficam em estado compartilhado. |
| Tempo/cálculos | `pausaMin:409`, `janelasDia:424`, `totalDia:455`: diferença dentro de janelas de início/fim do dia menos pausas, mínimo zero; dia passado sem encerramento fecha na última saída conhecida. Consolidado une intervalos para evitar sobreposição (`unirMin:606`, `totalUniao:638`), calcula ociosidade e horas/dias do mês; feriados MG e Páscoa (`754–785`). Essas regras locais não devem ser adotadas como política trabalhista universal. |
| Filtros/tabelas/gráficos | Hoje/mês/dia, texto/status/responsável, consolidado por pessoa, visualização/edição de horários e contadores. Indicadores de tempo são de registros locais; não identificada integração de ponto nem gráfico remoto de produtividade. Não identificada paginação de API. |
| Dados/storage/API | `investor_atividades_v1`, `investor_jornada_v1`, `investor_jornada_on`, `investor_ociosidade_v1`, `investor_atv_solicitacoes_v1`, `investor_dia_encerrado`, listas de atividades/projetos/usuários. sharedStore e consulta de cadastros; shell usa login/logoff, mensagens de iframe e sinais de atividade/ociosidade (`index.html:378–686`). |
| Imports/exports/limites/GAI | Operações principais são registros/checks/consulta; não comprovado sistema de folha ou homologação de banco de horas. GAI não tem módulo equivalente; auditoria de usuário e produtividade de itens não equivalem a jornada. Domínio futuro independente, com relógio do servidor e privacidade/escopo por sujeito. |

## 15. Laudos e laudo padrão

Origens: `laudo.html` (1.177 linhas) e `laudo_padrao.html` (1.205), ambas com cópias idênticas em dashboards, mas **não idênticas entre si**.

Tela lista de laudos, editor com seções/formulário/quadro/fotos, preview do documento, textos padrão e ações criar/editar/duplicar/emitir/imprimir/exportar (`renderForm:707`, `renderLista:926`, `abrir:1113`). `laudoVazio:301` constrói objeto; campos abrangem código, cliente/CNPJ/endereços/data-base/vistoria, objetivo/escopo/premissas, dados técnicos, textos de metodologia/conclusão, responsável/CREA/ART, quadro por classe com quantidades/custo/VLC/VLC avaliado/depreciações e fotos/legendas/justificativa.

`pendencias:675–691` calcula lista de campos/documentos faltantes; não é prova de validade normativa ou assinatura. `totaisQuadro:438` soma valores e calcula VLC avaliado/VLC; `pctLinha:447` divide VLC avaliado da linha pelo **VLC total**, não pelo VLC da própria linha. `secoes:526` monta documento condicional ao escopo, incluindo textos CPC 27/46/01, vida útil/glossário/grau de fundamentação. Não há motor comprovado de avaliação normativa, impairment ou depreciação científica nessas seções.

`importarQuadro:865` lê planilha e `importarFotos:889` lê imagens, redimensiona (`409–427`), salva/baixa fotos via `dados` (`392–408`). Estrutura `laudos_v1`, `laudo_textos_v1`, `laudo_foto::<...>`, snapshots e sincronização (`mesclar:332`, `sincronizar:353`). Lista, busca e preview são locais; não identificado gráfico de negócio ou paginação remota. Admin é flag local (`251–256`).

`docParaImpressao:978`, `janelaImpressao:1012`, `imprimirDoc:1035` criam HTML/iframe e chamam print. `baixarHtmlImpressao:1042` baixa HTML; `exportarWord:1086–1110` gera **HTML com MIME application/msword e extensão .doc**, orientando salvar como docx no Word. Não comprova geração DOCX/PDF nativa, assinatura ou fidelidade final.

`laudo_padrao.html` acrescenta `laudo_modelo_v1`, permissão local `ehEditorPadrao:251`, `salvarLocal:323` e papel de manter modelo/textos reutilizáveis; usa as mesmas chaves de laudos/textos/fotos. Isso pode acoplar edição do padrão a conteúdo compartilhado. GAI tem dados de ativos/avaliações/export XLSX; não possui laudo narrativo, templates, workflow de emissão nem DOCX/PDF equivalentes. Snapshot/versionamento e aprovação são necessários antes de emissão real.

## 16. Histórico de versões

Origem: `historico_versoes.html`, 280 linhas, cópia idêntica.

Interface de busca/listagem de chaves, versões por data/tamanho, preview JSON, comparar, baixar, restaurar tudo/selecionados e “recuperar perdas desde horário”. `carregarChaves:60`, `abrir:64`, `versao:139` chamam `dados?historicoChaves`, `?historico`, `?versao`. Comparação (`compararComAtual:78–120`) usa ID de registro ou fallback de nome+posição e JSON stringify para alterados/incluídos/excluídos. Sem campos de formulário de negócio além de busca/horário/seleção/confirm; sem gráfico nem paginação remota comprovada.

`restaurarSelecionados:122–138` reinsere/substitui registros escolhidos e POSTa chave+JSON+base timestamp; restauração total handler `157–167` envia `acao:restaurar`; recuperação de perdas em `193–232`, gravação `259–270`. Há handlers completos **do cliente**, mas armazenamento histórico/retention/concorrência/ACL não são verificáveis sem backend. É ferramenta destrutiva de dados e não deve ser copiada como restauração bruta.

GAI possui audit logs por módulo, snapshots de consolidação e runs; não existe interface/API genérica de diff/restauração identificada. Leitura de histórico é enriquecimento compatível; restauração deve ser comando específico que respeita estado/regras/tenant.

## 17. Inbound, outbound, curso e fluxograma (escopo adicional do ZIP)

| Módulo | Inventário e comprovação |
|---|---|
| `inbound.html` (899 linhas) | Lista, dashboard de estágios/origem, busca/UF/origem/estágio, seleção/colunas, criar/editar, histórico. Campos data conversão/nome/cargo/empresa/email/telefone/origem/estágio/responsável/departamento/parceiro/histórico (`219–239`). `filtradas:353`, `pintarDash:418`, `registrar:463`, `valoresForm:780`, `sincronizar:841`. Seeds em `semente:277`; não são leads reais confirmados. Persistência JSON/sharedStore, sem backend exportado. |
| Outbound no painel | Campos e handlers no item 1; etapas conexão/convite/inscrição, listas e metas, planilhas, deduplicação. Metas/funil não significam integração automática com LinkedIn ou disparo de mensagens. |
| `curso_funil_vendas.html` (2.759 linhas) | Funil por contato/reunião/proposta/contrato, gráfico (`renderChart:814`), inscritos por empresa e tabela, filtros curso/data/lista/etapa/contato, modal de contrato/edição em massa/import/listas e normalização de empresas. Campos inscritos nome/email/telefone/empresa/cargo/conversão/curso/data e flags comerciais (`333–374`). `renderGrupos:888`, `renderPager:1048`, import `rd.onload:1192`, `dupAbrirModal:1344`, inscrição `1922–1953`. Gráfico conta dados locais filtrados; persistência de inscritos/estágios/vínculos por curso/empresa/data e sharedStore. Não há LMS/cobrança bancária comprovados. |
| `paineis/fluxograma_curso.html` (1.636 linhas) | Cursos com nome/data/links de formulário/respostas, etapas com responsável/data/observação, iniciar/concluir/reabrir/editar/arquivar, concluídos e captura/export PNG/HTML conforme handlers. `dados:398`, `venceu:466`, `statusDe:581`, `aplicarEdicoes:606`, `novoCurso:1132`, `capturarTela:1436`; estado por curso, prazos e calendário. Formulário/respostas são links, não integração comprovada com Google Forms. |
| `dashboards/fluxograma_curso.html` (1.590 linhas) | Variante diferente: não contém os mesmos helpers de migração de datas e aplicação inicial do servidor presentes em paineis `1239–1276`. Comparar ambas antes de definir política. Mesmas ideias visuais, sem prova de equivalência de persistência. |

Esses módulos apresentam filtros, contadores/tabelas, formulários e ações locais com sincronização compartilhada; a lista completa de campos, storage e eventos está no anexo por arquivo. Não foram localizados modelos/rotas equivalentes no GAI. São expansão de CRM/treinamento a decidir separadamente do sistema patrimonial.

## 18. Shell, configuração e infraestrutura de navegador

| Arquivo | Conteúdo e limites |
|---|---|
| `index.html` (1.681 linhas) | Shell de login, solicitação de redefinição/troca de senha, menus/áreas e iframe, administração de usuários/permissões, publicação/backup de contas, histórico embutido, jornada/ociosidade e sessão persistida. `authApi:300` chama `/api/auth`; permissões vêm de `/api/permissoes:180`, JSON e overrides locais. `tentarLoginLocal:319`, `doLogin:334`, `getDashes:287`, `setAccess:732`, `publicarContas:819`, `restoreSession:1449`. “Esqueci senha” orienta procurar administrador; não comprova reset automático. Senha mínima de seis no cliente; credenciais em estado local/export coexistem com purga posterior (`1437`). Não copiar. |
| `usuarios.json` | Mapa de contas contendo dados de identidade/role e campo de senha em texto. Estrutura foi inspecionada sem transcrever valores. Não é uma base de usuários a importar. |
| `permissoes.json` | Mapa de acesso de usuários às áreas/dashboards. Não implementa RBAC de ações, nem separação de organizações. Valores de contas não constam dos artefatos da auditoria. |
| `sync-remoto.js` (duas cópias iguais) | sharedStore para dados; GET por chave/chaves/prefixo, POST base/valor, observer/polling, retries, debounce, pending timestamp, merge por ID e fallback quota em sessionStorage. Intercepta Storage/get/set/remove e storage events. `96–97` pode trocar local pelo servidor; `285–290` não propaga removeItem. Ausência do backend impede validar consistência global. |
| `undo-redo.js` (duas cópias iguais) | Histórico de alterações no navegador, teclas/controles para desfazer/refazer, captura/restaura dados de storage. Não é trilha de auditoria imutável nem transação multiusuário. Ver funções completas no anexo. |
| `filtro-sementes.js` (duas cópias iguais) | Filtro/limpeza de registros classificados como demonstração por flags/IDs, intercepta dados de armazenamento. Nem toda rotina de seed foi eliminada das páginas. Inspeção estática não garante que nenhum exemplo chegue ao servidor. |
| `netlify.toml` | Caminhos absolutos de build/functions/database do computador de origem, Node 20, esbuild, cabeçalhos no-cache; nenhum código de função/migration exportado. Não define arquitetura equivalente ao GAI. |
| `app/leia-me.txt` | Solicita APK na pasta; **nenhum APK acompanha o ZIP**. Não executar instruções desse texto. |
| `proposta/slides/leia-me.txt`, PNG/PPTX/fontes | Recursos e orientação para material de proposta. São dependências do gerador legado, não autorização para substituição da identidade visual do GAI. Não foi validada a licença ou fidelidade de fontes/templates binários. |

## 19. Capacidades aparentes que não devem ser declaradas operacionais

| Aparência | O que é efetivamente comprovado |
|---|---|
| Backend online seguro e multiusuário | Clientes fetch/sharedStore existem; funções Netlify e banco não acompanham o ZIP. Segurança, estado remoto e funcionamento fim a fim são NÃO VERIFICADOS. |
| Conciliação 02 | Cards/filtros apenas, sem handler de abertura nem engine nessa página. |
| App móvel e “Baixar APK” | Handler cria URL; binário/app/API móvel ausentes. |
| “Enviar e-mail/WhatsApp” | Geração de texto, cópia e abertura de link/cliente; não prova envio, recebimento ou consentimento. |
| Documentos de inventariante e comprovantes | Há upload/download e também geradores de documento fictício. Anexo seed não prova documento real. |
| CPC 27/46/01, vida útil e avaliação de veículos | Escopos/textos/checklists e campos manuais; não foram encontrados cálculos normativos completos correspondentes. |
| PDF/Word final assinado | Impressão HTML e HTML `.doc`; assinatura digital, DOCX nativo e PDF emitido por serviço não comprovados. |
| “Projeto concluído”/“campo concluído” | Flags e critérios distintos, inclusive só primeiras duas faixas no checklist; não inferir verificação completa de todos os ativos/documentos. |
| “Login seguro porque existe purga” | O código posterior tenta limpar senhas, mas também permite fallback/export e JSON público; não comprova eliminação de todos os caminhos inseguros. |
| “Restauração de versões disponível” | UI e requisições implementadas; retenção, integridade, ACL e operação remota não verificáveis. |
| “Botão com texto = ação” | Anexo separa controles/listeners/mensagens; helper no-op, elementos ausentes e handlers condicionais impedem concluir renderização/operacionalidade só por presença no código. |

## 20. Regras a transportar como especificação, não como cópia

Memória de preço, filtros cruzados, resumo de despesas/adiantamentos, checklist por etapas, revisão assistida de conciliação, avaliação em lote e preview de laudo são boas capacidades candidatas. Antes de implementá-las: selecionar a regra validada, definir dados tipados e versão, permissão e escopo da organização, testar casos negativos, integrar aos serviços existentes e preservar evidência/auditoria. Regras comerciais ou históricas do legado só viram defaults após aprovação explícita na execução de implementação.
