# Aba Projetos: Netlify × GAI — mapeamento, gaps e plano

Data: 23/11/2026 · Branch: `feat/visual-netlify`

Fontes:
- **Netlify:** páginas do zip `deploy-6aff6e8645587192cd1bf3ff`, na ordem do menu "Projetos" (`index.html`, `AREAS.projetos`):
  - Painel Geral → `painel_projetos_inventario_ativos.html#projetos`
  - Kick-off → `kickoff.html`
  - Pendências - Campo → `pendencias_campo.html`
  - Inventário → `inventario.html`
  - Conciliação Físico-Contábil → `conciliacao_fisico_contabil_3.html`
  - Avaliação → `conciliacao_fisico_contabil_avaliacao2.html`
  - Laudo → `laudo.html`
- **GAI:** `gai-frontend/src/features/*` e `gai-backend/src/modules/*`.

Legenda de status:
- **Pronto**: já existe; só ajuste de front.
- **Parcial**: existe em parte ou com outra forma.
- **Falta**: não existe; precisa de backend e front.

---

## 0. Diferenças de conceito, que valem para todas as sub-abas

1. **Onde ficam os dados.**
   - No Netlify as sub-abas são planilhas no navegador: arquivos lidos com SheetJS, guardados em IndexedDB/localStorage e sincronizados por polling. As colunas são as da planilha do cliente, e quase tudo se edita na célula, com desfazer/refazer.
   - No GAI os dados são entidades tipadas, auditadas e versionadas: itens, base contábil, sessões, execuções de conciliação imutáveis e laudos com aprovação.
   - Consequência: **grade livre, colunas dinâmicas e desfazer não devem ser copiados.** A paridade é feita sobre campos fixos, com seletor de colunas, filtros e ações em lote.
2. **Onde se escolhe o projeto.**
   - No Netlify cada sub-aba é global e começa com uma lista para escolher o projeto, com KPIs por projeto.
   - No GAI o projeto já vem da rota, dentro do workspace.
   - Consequência: manter o workspace e levar os números daquela lista para o topo de cada aba.
3. **Duas coisas chamadas "Pendências".**
   - "Pendências - Campo" no Netlify é o **check list operacional de campo** (por projeto e entre projetos). No GAI isso corresponde a **Coordenação de campo**.
   - A aba "Pendências" do GAI trata de ocorrências do inventário (placa faltante, divergência, duplicidade). Não tem relação com a do Netlify.
4. **Avaliação.** O Netlify **não calcula** valor: não há depreciação nem vida útil. São três campos digitados: Fonte de consulta, Valor novo e Valor usado. O GAI já faz isso, com histórico em lotes. Não há diferença de fórmula.
5. **Funcionalidades em que o GAI é superior e que devem ser mantidas:**
   - Execuções de conciliação versionadas.
   - Conciliação assistida com aprovação e motivo.
   - Laudos com modelo versionado, revisão e aprovação.
   - Tarefas de campo com prioridade, prazo, bloqueio e vínculo com pendência patrimonial.

---

## 1. Navegação da área Projetos

| Netlify (menu, linha 2) | GAI hoje | Proposta |
|---|---|---|
| Painel Geral | `/app/projects` (lista) + `/app/dashboard` (visão da organização, só ORG_ADMIN) | Painel Geral = lista + indicadores numa página só |
| Kick-off | Projeto › Campo › Preparação | Renomear o grupo/aba para "Kick-off" |
| Pendências - Campo | Projeto › Campo › Coordenação de campo | Renomear para "Pendências - Campo" e criar uma visão entre projetos |
| Inventário | Projeto › Inventário › Itens e avaliação / Importações | "Inventário" = itens + importação + KPIs |
| Conciliação Físico-Contábil | Projeto › Inventário › Sessões e conciliação + Contábil › Base contábil | "Conciliação Físico-Contábil" = bases + indicadores + resultado + assistida |
| Avaliação | Itens e avaliação (`ValuationBatchPanel`) | Aba própria "Avaliação" sobre a lista de itens |
| Laudo | Contábil e laudo › Laudos | "Laudo" |

**Proposta (só front, `projectNavigation.ts`):** dentro do projeto, a primeira linha de abas segue a ordem do Netlify: **Painel · Kick-off · Pendências - Campo · Inventário · Conciliação · Avaliação · Laudo**. O que não existe no Netlify vai para "Mais ▾": Unidades, Importações, Exportações, Contratos, Financeiro, Pendências patrimoniais. As rotas atuais continuam as mesmas; muda só a apresentação, como já é hoje.

---

## 2. Mapeamento por sub-aba

### 2.1 Painel Geral

**O que o Netlify tem:**
- Cabeçalho com contador "Nº 0042", Exportar Excel/CSV, backup JSON e "+ Novo projeto".
- **6 KPIs:**
  1. Valor total em contratos
  2. Quantidade de projetos
  3. Projetos em aberto (= sem data de conclusão)
  4. Ticket médio
  5. Valor em contratos abertos
  6. Quantidade de itens em contratos
- **Filtros multiselect:** Ano, Mês, Segmento, UF, Data, Status, Serviços (exige todos os marcados), Itens mín/máx e busca.
- **Atalhos de data:** "Até DD/MM", "Até data atual" e "Últimos 3 meses", aplicados a todos os anos.
- **Painel recolhível "Dashboard":**
  - Valor, quantidade e ticket médio por ano.
  - Roscas: Status (aberto/concluído) e Recorrência (por quantidade e por valor).
  - **Funil das etapas em aberto:** PLANEJAMENTO CAMPO → CAMPO → CONCILIAÇÃO / AVALIAÇÃO → CLIENTE / SANEAMENTO → LAUDO MINUTA → LAUDO FINAL.
  - Top segmentos, UF (top 6) e mapa do Brasil clicável.
- **Agrupamentos** por empresa (com logo) e por segmento, ocultos por padrão.
- **Tabela de projetos (~30 colunas):**
  - Status e Motivo, este editável na linha.
  - Valor, itens, endereços e % Concluído.
  - Despesas com técnicos.
  - Datas, dias em campo e tempos em meses.
  - Orçados, editáveis na célula.
  - Custo por placa e recorrente.
  - Também tem "Colunas ▾", linha expansível, seleção com edição e exclusão em lote.
- **Formulário único:** projeto + contrato + serviços + endereços + forma de pagamento + aditivo.

**Situação no GAI:**
- Os dados comerciais já estão no **contrato** (`contracts/contract.dto.ts:44-97`): valor, segmento, origem, recorrência, serviços, itens, aditivos, pagamento, despesas e plaqueta.
- Esses dados **não chegam** à listagem nem ao overview: `organization-overview.service.ts:211-214` devolve `null` nos totais.
- Os campos operacionais e de orçamento interno não existem em lugar nenhum.

| Item | GAI | Status | O que fazer |
|---|---|---|---|
| Página única (KPIs + filtros + gráficos + tabela) | Dividida entre `ProjectsPage` e `OrganizationOverviewPage` (só ORG_ADMIN, `DashboardPage.tsx:18`) | Parcial | Front: juntar em Projetos, liberar por permissão |
| 6 KPIs | `CommercialOverview.tsx:272-330`; totais nulos no back | Parcial | Back: totais do contrato. Front: 6 cards na ordem |
| Filtros Ano/Mês/Status/Busca | Selects simples pela data de **criação**, com botão "Aplicar" | Parcial | Back: usar a data do contrato. Front: multiselect, aplicar na hora |
| Filtros Segmento/UF/Serviços/Itens | `commercial-filters.ts` | Pronto | Front: multiselect. Back: serviços com mais de um valor |
| Atalhos "Até mês anterior / hoje / 3 meses" | — | Falta | Back: corte por dia/mês ignorando o ano |
| Gráficos por ano, roscas, top segmentos, UF, mapa | Dados já vêm (`annual`, segmentos, UF); hoje só aparecem em tabelas | Pronto | Front: gráficos no formato do Netlify |
| Funil de etapas | Só 3 etapas técnicas | Falta | Back: etapa atual do projeto (campo ou derivação). Front: funil |
| Agrupamento por empresa/segmento | Existe sem valor/itens | Parcial | Back: valor e itens. Logo da empresa: back |
| Tabela com colunas do contrato e % concluído | Colunas "Indisponível" (`OverviewDetails.tsx:40-70`) | Parcial | Back: listagem com campos do contrato, progresso e despesas. Front: "Colunas ▾", ordenação, linha expansível |
| Campos de gestão (itens localizados, valor justo, orçados, meses, despesas não reembolsáveis, público/privado, local da vistoria) | — | Falta | Back: campos novos + PATCH parcial |
| Edição na célula, edição/arquivamento em lote | — | Falta | Back + front (no GAI, excluir = arquivar) |
| Formulário único com contrato | `ProjectForm` + `ProjectContractsPage` + `ProjectUnitsPanel` | Parcial | Front: assistente com etapa "Contrato", serviços em checkboxes, custo por placa calculado |
| Backup/Importar JSON | Export XLSX | Não portar | — |

### 2.2 Kick-off

**O que o Netlify tem:**
- Lista "Kick-offs" com faixa azul. Colunas: Cliente, Data, "X de Y (Z%)" e Situação, com Concluir/Reabrir. Os em andamento ficam no topo.
- Novo kick-off pede só o cliente.
- **Corpo:** grupos (RESUMO PROJETO, ETIQUETAS e VIDA ÚTIL) em tabela editável na linha.
  - Colunas: Nº, Realizado (alterna PENDENTE/REALIZADO), Item, Grupo, Resposta e Observações.
  - Cores: pendente vermelho-rosado, realizado verde riscado, "solicitar no kickoff" azul.
- **Tipos de resposta:** cerca de 25 listas de seleção, SIM/NÃO/N/A, campos condicionais ("QUAL SISTEMA?"), multiseleção em chips (Escopo, Perfil dos bens, 27 UFs), endereços com % calculado, sequências de etiquetas antigas × N modelos, contato (nome + telefone) e intervalo de datas.
- O fornecedor "N/A" bloqueia os itens 22–27.
- **Pré-preenche** a partir do cadastro do projeto.
- **Gera e-mail ao cliente** com regras e bloco "SEGUEM PENDÊNCIAS…", editável. Gera também mensagem ao técnico por WhatsApp.
- Imprimir, Exportar Excel e filtro Situação.

**Situação no GAI:** `project-preparation/` cobre o motor:
- Modelos versionados.
- Tipos text/long_text/boolean/number/date/select/sequence/unit_allocations.
- Condições `enabled_when`.
- Estado por resposta (Pendente/Concluído/N/A).
- Aprovar/Reabrir, histórico e prévia de comunicação.

A apresentação é diferente: um `<select>` para escolher o kick-off e cards com um modal "Responder" para cada pergunta. O modelo de referência (`referenceTemplates.ts`) usa quase só texto livre.

| Item | GAI | Status | O que fazer |
|---|---|---|---|
| Lista de kick-offs com progresso e situação | `<select>` (`ProjectPreparationPage.tsx:131`) | Parcial | Front: DataPanel com Título/Data/Progresso/Situação e Aprovar-Reabrir |
| Novo kick-off | Modelo + versão + título | Pronto | Front: modelo padrão pré-selecionado, título = projeto |
| Tabela por grupo com edição na linha | Cards + modal | Parcial | Front: tabela por categoria ("N de M verificado(s)"), salvando com `PATCH answers` (lote de até 120) |
| Realizado × resposta | `state` | Parcial | Front: botão PENDENTE/REALIZADO → `state`; cores de linha |
| Opções corretas das ~25 listas | Quase tudo texto | Parcial | Front: reescrever o `referenceTemplate` com as opções do Netlify |
| Condicionais "QUAL…?" e bloqueio por N/A | `enabled_when` | Pronto | Front: mostrar aninhado e "Bloqueado" em vez de esconder |
| Multiseleção em chips | — | Falta | Back: tipo `multi_select` |
| Contato / intervalo de datas / sequências × N | — | Falta | Back: tipos novos. Alternativa só de front: duas perguntas |
| Tag "Solicitar no kickoff" / Grupo | — | Falta | Back: `hint`/`tag` por pergunta |
| Pré-preenchimento pelo projeto | — | Falta | Back: valores iniciais a partir do contrato/unidades |
| E-mail ao cliente com pendências / WhatsApp técnico | Prévia genérica, só leitura | Parcial | Back: template com regras. Front: texto editável, cópia em HTML, botão `wa.me` |
| Filtro Situação, Imprimir, Excel | — | Falta (só front) | Front: filtro local, CSS de impressão, xlsx |

### 2.3 Pendências - Campo

**O que o Netlify tem:**
- **Visão entre projetos:**
  - KPIs: Abertos, Etapas pendentes, Concluídos.
  - Tabela: Projeto, UF, Ano, Status, Etapas pendentes (pills Vistoria/Inventário) e Conclusão ou "Check list 100%".
  - Destaque amarelo/roxo arrastando a linha.
  - Alerta vermelho no menu.
- **"Check list - Campo" do projeto:**
  - 4 seções numeradas com responsável e "n/m", com 23 atividades: Coordenação projeto, Coordenação campo ×2 e Prioridade diária.
  - Checkbox de 1 clique, "X/Y Sub atividades concluídas", barra de % e "Limpar marcações".
  - Botões que geram mensagem ao técnico e ao grupo de WhatsApp. Links do APK.
  - "Editar padrão" (admin): arrastar, renomear, + atividade.

**Situação no GAI:** `field-coordination/` é mais completo por projeto:
- Etapas e tarefas com estado, prioridade, prazo, responsável e bloqueio.
- Vínculo com pendência patrimonial.
- 8 KPIs, filtros avançados e modelos versionados.

Falta a visão entre projetos (todos os endpoints são por projeto). Também faltam o check rápido e o modelo de referência das 4 seções.

| Item | GAI | Status | O que fazer |
|---|---|---|---|
| Visão entre projetos (tabela + 3 KPIs) | — | Falta | Back: resumo por organização (checklists abertos, %, concluído em). Front: tela global |
| Destaque amarelo/roxo, alerta no menu | — | Falta | Back (compartilhado) ou localStorage (só front) |
| Check list por seção com faixa azul e "n/m" | ProgressCards + tabela plana | Parcial | Front: DataPanel por etapa |
| Checkbox de 1 clique | Modal | Parcial | Front: checkbox → `PATCH tasks/:id` |
| Progresso "Sub atividades concluídas" e badge "Check list 100%" | ProgressCard, "Validar conclusão" | Pronto | Front: rótulos e badge com data |
| Modelo de referência (4 seções, 23 atividades) | Sem modelo de referência | Falta (só front) | Front: semente em FieldTemplates, como no Kick-off |
| Limpar marcações | — | Falta | Front (lote de reabrir) |
| Mensagens técnico/grupo/APK | Prévia genérica | Falta | Back: textos a partir do kick-off. APK = armazenar arquivo |
| Filtros avançados, prioridade, bloqueio | GAI superior | — | Manter, recolhidos em "Mais filtros" |

### 2.4 Inventário

**O que o Netlify tem:**
- Lista de projetos com Contrato × Inventariados × **% Encontrado** (cores) e Escopo. A marcação "iniciar campo/em andamento" é feita arrastando a linha.
- **Importar planilha física**, com lotes acrescentar/substituir/remover.
- 8 KPIs e barras.
- **Grade:**
  - Filtros por coluna (até 5), busca e "Só selecionados".
  - Colunas, ordem, formato e zoom persistidos.
  - Excluir selecionados e desfazer.
- **Agrupamento físico** por coluna.
- **Cronograma por endereço:** prevista × encontrada, data, status, contato, técnico. As sugestões vêm do kick-off.
- Exportar XLSX com abas por situação + Resumo.

**Situação no GAI:**
- Itens em `ProjectInventoryItemsPage`: colunas fixas, 5 filtros, ações por linha.
- Importação de observações em XLSX fica em Importações e exige "número do payload".
- Export `inventory_items_xlsx` é assíncrono, em Exportações.
- Os KPIs existem só no Resumo.

| Item | GAI | Status | O que fazer |
|---|---|---|---|
| Contrato × inventariados × % encontrado | Summary tem os totais | Parcial | Front: KPIs no topo. Back: confirmar a qtde do contrato no summary |
| Importar planilha na própria aba | Fluxo técnico em Importações | Parcial | Front: "Importar planilha" criando a sessão por baixo. Back: import de **itens** por XLSX e lotes substituir/remover |
| KPIs na aba | Só no Resumo | Pronto | Front: KpiGrid |
| Filtros extras (série, unidade, marca) | 5 fixos | Parcial | Front: chips "+ filtro". Back só se a API não aceitar |
| Colunas ▾, ordem, densidade | — | Falta (só front) | Front: localStorage |
| Seleção geral + desativar em lote | 1 a 1 | Parcial | Back: lote. Desfazer não se aplica (auditoria) |
| Agrupamento físico | — | Falta | Back: agregação. Front: tabela |
| Cronograma por endereço | — | Falta | Back: entidade nova. Front: grade |
| Exportar Excel na aba | Export job em outra tela | Pronto | Front: botão que dispara `inventory_items_xlsx` |

### 2.5 Conciliação Físico-Contábil

**O que o Netlify tem:**
- **Bases:**
  - Planilha 1 = Inventário, trazida da aba anterior.
  - Planilha 2 = Base contábil: qualquer layout, com **tradução de cabeçalhos SAP em inglês**.
- **12 indicadores** em quantidade e **valor residual**:
  - Saldo, conciliado e sobra contábil.
  - % conciliado contábil e físico.
  - Sobra física.
- **Grade com duas abas:**
  - **Conciliar/Desconciliar manual N↔N**, gravando o Código Investor na linha contábil.
  - **Alterar status ▾**, com NPI - COMPLEMENTO / SOFTWARE / EDIFICAÇÕES E TERRENOS, ABRIR NF e status livres.
  - **De → Para**: colunas da outra base na linha.
- **Chave principal = Código Investor.** Há regras de sugestão por placa e por série.
- **Conciliação automática** (aprovar antes de gravar), com 4 regras em ordem:
  - 01 Placa antiga = nº do ativo
  - 02 Série
  - 03 Descrição + local
  - 04 Descrição
  - Semelhança ≥ 60%, desempate pelo maior valor residual e mapeamento de colunas.
- **Validação:** sem código, duplicados e sem descrição.
- **3 agrupamentos:** por placa, contábil e físico.
- **Exportação:** Conciliados, Divergência de valor, Sobra física, Só na contabilidade e Resumo.

**Situação no GAI:**
- **Motor:** execução versionada com chave = **placa normalizada**.
  - Status: Compatível, Sobra física, Sobra contábil, Duplicidade, Placa divergente.
- **Assistida:** 4 regras equivalentes, limiares 0,92/0,85, lotes de 20, aprovar/rejeitar com motivo.
- **Base contábil:** XLSX com cabeçalhos PT fixos, sem valor residual.
- O summary **já devolve** `reconciled_items`, `physical_surplus_items` e `accounting_surplus_items` (`project-summary-response.dto.ts:76-78`), **mas o front não usa**.

| Item | GAI | Status | O que fazer |
|---|---|---|---|
| Uma tela: Bases → Indicadores → Resultado → Assistida → Consolidado | Espalhado em 3 abas + detalhe da sessão | Parcial | Front: reorganizar |
| Indicadores por quantidade | Dados no summary, sem uso | Pronto | Front: KpiGrid + barras |
| Indicadores por valor residual | — | Falta | Back: campo de valor residual/contábil e somas por status |
| Rótulos (Conciliado, Conciliado Placa/Série, regras 01–04, limiar em %) | "Compatível" etc. (`InventorySessionDetailPage.tsx:52`) | Pronto | Front |
| Regras placa/série/descrição/local | Assistida | Pronto | Front: numerar regras, resumo por regra, "Aprovar todos desta regra" |
| Código Investor como chave | Campo existe, motor usa placa | Falta | Back |
| Desempate por valor residual; lotes maiores | — | Falta | Back |
| Conciliar/Desconciliar manual N↔N | Só aprovar sugestão 1:1 | Falta | Back: vínculo/desvínculo manual. Front: seleção dupla |
| Status NPI / ABRIR NF | — | Falta | Back: classificação da sobra contábil. Front: "Alterar status ▾" |
| Tabela de resultado com "De → Para" | Só placas | Parcial | Front + back (devolver descrição/local/valor dos dois lados) |
| Validação (duplicados, sem código) | Duplicidade na execução | Parcial | Front: painel de alertas |
| Importar base contábil SAP (inglês) | Cabeçalhos PT fixos | Parcial | Back: aliases. Front: card com colunas esperadas |
| Agrupamentos (placa, contábil, físico) | — | Falta | Back + front |
| Exportação da conciliação | — | Falta | Back: `reconciliation_xlsx`. Front: botão |

### 2.6 Avaliação

**O que o Netlify tem:**
- Lista de projetos filtrada por CPC/Vistoria.
- Base trazida do inventário.
- **Agrupamento físico.**
- Barras de Quantidade/Valor por status.
- **Grade:**
  - Filtros por coluna e Status sugerido.
  - Alterar status (NPI, ABRIR NF).
  - Colunas e formato.
  - Edição na célula.
  - Desfazer.
- **"Avaliar"** nos selecionados abre uma janela com **Fonte de consulta, Valor novo e Valor usado** ("campos preenchidos serão aplicados a todos"; campo vazio não sobrescreve).
- Exportar resultado (Excel).

**Situação no GAI:** `ValuationBatchPanel` já faz o mesmo e mais:
- Modo comum ou individual, data, notas.
- Prévia → confirmação, histórico e export dos lotes.
- Backend `AssetValuationEntity`.

O que falta é forma:
- As colunas de avaliação não aparecem na lista.
- O rótulo é "Origem".
- O status aparece com o código em inglês.

| Item | GAI | Status | O que fazer |
|---|---|---|---|
| Janela "Avaliar itens selecionados" | Lote com data/notas/prévia | Parcial (front) | Front: título e textos do Netlify, data de hoje já preenchida, "Fonte de consulta", Valor novo/usado lado a lado, botão "Avaliar" na barra de seleção |
| Colunas Fonte / Valor novo / Valor usado na grade | Só no drawer | Pronto | Front: incluir na `DataTable` |
| Status em pt-BR | Código em inglês (`ProjectInventoryItemsPage.tsx:111`, `InventoryItemForm.tsx:84`) | Pronto | Front: mapa do `StatusBadge` |
| Edição na célula | Drawer | Parcial | Front: gravar como avaliação **individual** pelo lote (não PATCH, para manter o histórico) |
| KPIs/barras por status, agrupamento físico | — | Falta | Back: agregação |
| Status NPI/ABRIR NF, Status sugerido | — | Falta | Back (o mesmo item da Conciliação) |
| Exportar itens com colunas de avaliação | Export de lotes | Parcial | Back: colunas de avaliação no `inventory_items_xlsx` |
| Desfazer | Histórico imutável | Não portar | — |

### 2.7 Laudo

**O que o Netlify tem:**
- **Lista "Laudos do escritório":** Código, Cliente (+ pendências), Data-base, Escopo, Status (Rascunho/Em revisão/Emitido), Atualizado e Abrir/Duplicar/Excluir. Tem busca e filtro.
- **Editor em 2 colunas:** formulário à esquerda e **prévia A4 ao vivo** à direita, com salvamento automático.
- **Blocos do formulário:**
  1. Identificação: inclui o **Escopo em chips**, que liga e desliga seções.
  2. Vistoria e documentação.
  3. Premissas.
  4. **Quadro resumo por classe:** Qtde, Custo, VLC, VLC avaliado, depreciação atual/nova, N/A. Pode ser importado.
  5. **Fotos da vistoria.**
  6. Conclusão: totais automáticos.
  7. Responsáveis: técnico com CREA/ART, contador com CRC.
- **"Pendências antes de emitir"** com 13 checagens.
- **Documento:** capa, ficha técnica, quadro + sumário executivo, índice, seções 1–9 conforme o escopo, 2 assinaturas, anexos (Grau NBR 14.653, Glossário).
- **Exportação:** Word (.doc), impressão e PDF a qualquer momento.

**Situação no GAI:** `technical-reports/` com:
- Modelos versionados, campos de sistema e manuais, fontes de dados.
- Validação, histórico, prévia e transições.
- PDF/DOCX só da versão aprovada (`documents/`).

Pontos fracos:
- A lista mostra "Versão aprovada ID".
- Formulário e prévia ficam em abas separadas.
- Não há quadro por classe nem depreciação.
- `valuation.used_total` é sempre `null` (`report.sources.ts:516`).
- Não há fotos no laudo nem duplicar.

| Item | GAI | Status | O que fazer |
|---|---|---|---|
| Colunas e filtros da lista | Laudo/Tipo/Situação/Revisão/Versão ID | Parcial | Front: busca, filtro de status, "Atualizado", sem "Versão ID". Back: expor código/cliente/data-base na listagem |
| Status | Rascunho/Em revisão/Aprovado/Reaberto/Arquivado | Pronto | Front: "Aprovado" → "Emitido" (decisão do cliente) |
| Editor com prévia ao lado | Abas separadas | Parcial | Front: grid 2 colunas com `ReportPreview` fixo |
| Formulário em blocos | Lista genérica | Parcial | Front: agrupar campos do modelo em blocos (por convenção de chave) |
| Pendências antes de emitir | Aba "Validação prévia" | Pronto | Front: resumo no formulário e contador no botão PDF |
| Responsáveis CREA/ART/CRC, assinaturas, capa, ficha técnica | Responsáveis genéricos | Parcial | Front na prévia. Back no PDF/DOCX (`document.builder.ts`) |
| Exportar | PDF/DOCX só aprovado, mais JSON | Parcial | Front: esconder o JSON, "Visualizar impressão" no rascunho, destacar PDF/DOCX |
| Salvamento automático | Salvar com justificativa | Parcial | Front, se o back aceitar rascunho sem `reason` (verificar) |
| Escopo que liga seções | — | Falta | Back: seções condicionais no modelo |
| Quadro resumo por classe com depreciação | — | Falta | Back: agregação por classe contábil + campos de depreciação |
| Total do valor usado | Sempre `null` | Falta (bug) | Back: calcular |
| Fotos da vistoria, Duplicar laudo | — | Falta | Back |

---

## 3. Resumo dos gaps

**Só front: o GAI já tem o dado ou o fluxo.**
1. Navegação da área na ordem e com os nomes do Netlify.
2. Painel Geral: juntar a lista e o overview; gráficos e roscas com os dados que já vêm; liberar para além do ORG_ADMIN.
3. Kick-off:
   - Lista em DataPanel.
   - Tabela editável na linha por grupo.
   - Opções reais no modelo de referência.
   - Filtro Situação, impressão e Excel.
4. Pendências - Campo:
   - Checklist por etapa com checkbox de 1 clique.
   - Modelo de referência das 4 seções.
   - Badge "Check list 100%".
5. Inventário: KPIs na aba, "Colunas ▾", filtros extras, botão Exportar e importação simplificada (para observações).
6. Conciliação:
   - KPIs de quantidade (o summary já tem).
   - Rótulos Netlify e regras numeradas.
   - Reorganizar a tela.
   - "Aprovar todos desta regra".
   - Painel de alertas.
7. Avaliação: colunas de avaliação na grade, "Fonte de consulta", status em pt-BR e janela "Avaliar" no texto do Netlify.
8. Laudo: lista no padrão Netlify, editor em 2 colunas, pendências no formulário, rótulos de exportação, assinaturas na prévia.

**Precisa de backend (ordem sugerida pelo impacto para o cliente):**
1. **Totais e colunas do contrato** no overview e na listagem de projetos; ano/mês pela data do contrato.
2. **Valor residual/contábil** na base contábil e somas por status (KPIs de valor, desempate da assistida, quadro do laudo).
3. **Conciliação manual N↔N** e **Código Investor** como chave.
4. **Status da sobra contábil** (NPI - COMPLEMENTO / SOFTWARE / EDIFICAÇÕES E TERRENOS, ABRIR NF, livres).
5. **Etapa atual do projeto** (funil) e **progresso/despesas** na listagem.
6. **Resumo de campo entre projetos** (Pendências - Campo global).
7. **Kick-off:** tipos multiseleção, contato e intervalo de datas; pré-preenchimento; e-mail com regras.
8. **Agregações por campo** (agrupamento físico/contábil/por placa).
9. **Exportação da conciliação** (XLSX por situação + Resumo) e colunas de avaliação no export de itens.
10. **Laudo:** `used_total` (bug), quadro por classe com depreciação, escopo condicional, fotos, duplicar.
11. Import de itens por XLSX e tradução de cabeçalhos SAP.
12. Campos de gestão do projeto (orçados, valor justo etc.), edição em lote, cronograma por endereço, logo da empresa.

**Não portar:**
- Desfazer/refazer.
- Backup/Importar JSON.
- Grade com colunas livres.
- Sufixo "ANO_n" no nome.
- Marcação por arrastar a linha. Se o cliente pedir destaque, usar um botão.

---

## 4. Plano de implementação priorizado

Cada etapa é um commit, com lint, build e testes unitários no mesmo esquema das telas anteriores.

### Fase 1: só front (sem tocar no backend)
| # | Entrega | Arquivos principais |
|---|---|---|
| 1.1 | Navegação do projeto na ordem do Netlify (Painel · Kick-off · Pendências - Campo · Inventário · Conciliação · Avaliação · Laudo · Mais ▾) | `projectNavigation.ts`, `ProjectLayout.tsx`, testes de navegação |
| 1.2 | Avaliação: colunas Fonte/Valor novo/Valor usado, status em pt-BR, janela "Avaliar itens selecionados" | `ProjectInventoryItemsPage.tsx`, `ValuationBatchPanel.tsx`, `InventoryItemForm.tsx` |
| 1.3 | Conciliação: KPIs (summary), rótulos "Conciliado", regras 01–04, reorganização da tela, alertas | `InventorySessionDetailPage.tsx`, `AssistedReconciliationPanel.tsx` |
| 1.4 | Inventário: KPIs, "Colunas ▾", filtros extras, botão Exportar (Excel) | `ProjectInventoryItemsPage.tsx`, base contábil |
| 1.5 | Kick-off: lista em DataPanel, tabela editável por grupo, filtro Situação, imprimir/Excel, modelo de referência com as opções reais | `ProjectPreparationPage.tsx`, `referenceTemplates.ts` |
| 1.6 | Pendências - Campo: checklist por etapa com checkbox, badge 100%, modelo de referência das 4 seções | `FieldCoordinationPage.tsx`, FieldTemplates |
| 1.7 | Laudo: lista Netlify, editor 2 colunas, pendências no formulário, exportação | `ReportsPage.tsx`, `ReportDetailPage.tsx`, `ReportPreview.tsx` |
| 1.8 | Painel Geral: página única (KPIs + filtros + gráficos + tabela) com os dados atuais | `ProjectsPage.tsx`, `OrganizationOverviewPage`, `CommercialOverview`, `OverviewDetails` |

### Fase 2: backend pequeno, com grande efeito visível
- Totais e colunas do contrato no overview e na listagem de projetos (completa a 1.8).
- `valuation.used_total` (bug do laudo).
- Valor residual na base contábil + KPIs de valor da conciliação.
- Status da sobra contábil (NPI/ABRIR NF) e "Alterar status ▾".
- Colunas de avaliação no export de itens; `reconciliation_xlsx`.

### Fase 3: funcionalidades novas
- Conciliação manual N↔N e Código Investor como chave.
- Etapa do projeto e funil.
- Pendências - Campo entre projetos.
- Kick-off: multiseleção, contato e intervalo de datas, pré-preenchimento, e-mail com regras.
- Agrupamentos.
- Laudo: quadro por classe com depreciação, escopo condicional, fotos e duplicar.
- Import de itens por XLSX, tradução SAP, cronograma por endereço, campos de gestão, edição em lote.

---

## 5. Decisões a confirmar com o cliente

1. **"Em aberto"**: sem data de conclusão (Netlify) ou status Ativo (GAI)? Rascunho e pausado contam?
2. **Status do laudo**: "Aprovado" passa a se chamar "Emitido"?
3. **Exportar o laudo em rascunho**: a impressão basta, ou é preciso PDF/DOCX antes da aprovação?
4. **% do quadro resumo do laudo**: VLC avaliado da linha ÷ VLC **total** (como no Netlify) ou ÷ VLC **da linha**? Os números mudam.
5. **Etapas do projeto** (funil): campo manual, como no Netlify, ou derivado automaticamente das telas (preparação → campo → sessões → laudo)?
6. **Destaques amarelo/roxo** em Pendências - Campo: precisam ser compartilhados entre usuários?
