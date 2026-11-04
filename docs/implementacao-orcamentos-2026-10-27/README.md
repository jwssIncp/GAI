# Orçamentos com memória de cálculo — 27/10/2026

## 1. Análise prévia e referência funcional

Consultados `docs/auditoria-legado-gai-2026-10-27/`, especialmente F073–F078, os anexos e inventário funcional, os relatórios de preparação, campo, conciliação, avaliação em lote, navegação e `docs/implementacao-gestao-contratual-2026-10-27/`. O original `C:/Users/Jonathan/AppData/Local/Temp/gai-legacy-audit-20261027/paineis/orcamentos.html` foi lido nas funções de dimensionamento, precificação, despesas e parcelamento. A cópia dashboards é idêntica segundo a auditoria.

Foram examinados ProjectEntity, CompanyEntity, CompanyUnitEntity, ProjectUnitEntity, lifecycle, ContractService/entidades, DTOs comerciais, catálogo/PermissionsGuard/ProjectScopeService, componentes financeiros, políticas de parcelas e datas, export jobs, seletores e componentes React. Projetos podem ter contratos, mas não existia agregado de orçamento. Despesas e parcelas operacionais representam gastos realizados, não propostas ou recebíveis. O export job atual exige projeto e gera XLSX: não é um gerador PDF/PPTX nem contempla orçamento anterior ao projeto.

| Referência legada | Comportamento encontrado | Decisão no módulo novo |
|---|---|---|
| F073, funções save/prepararModal | Dados comerciais, sites e parâmetros em armazenamento local | Agregado SQL por organização, snapshots e versões imutáveis |
| F074, invNecessarios/prodEfetiva/diasCampo/diasProjeto | Equipe fracionária arredondada em duas casas, produtividade ajustada por endereço e ceil de dias | Pessoas-dia e equipe inteiros, duas capacidades explícitas (bens e visitas), fator publicado e memória rastreável |
| F075, totalTecnicos/fatorSugerido/subtotalRec | Diária de fallback 185, produtividades 80/60/50, fatores 0,20/0,30/0,15 e piso 21.000 com exceções por endereço | Nenhum desses valores é seed ou default comercial; configuração explícita e versionada por organização |
| F076, hospedagemCalc/totalComImposto/atualizarDespesas | Quartos ceil(equipe/2), extras floor(dias/5), transporte e alimentação, despesas/(1-imposto), impostos de fallback | Capacidade/intervalo/extras e todos os custos são parâmetros explícitos; um gross-up documentado sobre custo composto, sem regra tributária automática |
| F077, dividirSaldo/pintarParcCustom | Entrada, percentuais, saldo e residual na última parcela | Centavos com BigInt, validação de soma, três modos e datas civis pela política mensal existente |
| F078, deckHTML/docHTML/exportarModelo | Prévia HTML e preenchimento de template | Prévia React da versão aprovada, sem HTML arbitrário e sem prometer um arquivo que não existe |

As fórmulas abaixo são a política explícita `budget-cost-gross-up-v1`, não uma reprodução automática de regras comerciais do legado. Produtividade, fator por endereço, equipe mínima, dias disponíveis, custos, capacidade de quarto, extras, taxas, margem e piso dependem de autorização comercial da organização. Publicação exige `budgets:configure-prices`, referência/justificativa e confirmação na interface. Não há enquadramento tributário, taxas legais inferidas, preço de mercado ou valores oficiais pré-carregados.

## 2. Arquitetura

Monólito modular NestJS/TypeORM/MySQL: módulo `budgets` com DTOs estritos, policy pura de cálculo, entidades próprias, serviço transacional e controller. Reutiliza autenticação, catálogo, guard, escopo organizacional, entidades de referência e **apenas a função pura** monthlyDueDate do módulo anterior. Não importa serviços de pagamento/despesa nem modifica contratos.

React usa o AppLayout atual e um BudgetLayout persistente com Outlet. Navegação lateral Orçamentos; listagem, parâmetros e detalhe são rotas filhas. O detalhe mantém versão e aba na URL, reutilizando Button, ModalForm, MetricCard, DataTable, Pagination, States e seletores existentes. Nenhuma autenticação adicional.

## 3. Entidades e migration

Migration aditiva `1793600000001-create-budgets.ts`:

| Tabela | Conteúdo |
|---|---|
| budget_pricing_versions | Organização, nome, versão, vigência civil inclusiva, valores tipados em JSON, referência de aprovação, ator e instante |
| budgets | Organização, empresa, projeto opcional, número único na organização, status, revisão concorrente, versão atual e aprovada |
| budget_versions | Snapshot completo imutável: dados comerciais, empresa/projeto/unidades/endereço/responsável, parâmetros exatos, cálculo, pagamento, versão-base, nome, hash, autor, instante e justificativa |
| budget_audit_logs | Uma entrada por revisão do agregado, operação/transição, versão, ator, data e justificativa |

Há FKs de referências, FKs compostas para organização/orçamento/parâmetros/versão-base, vínculos compostos das versões atual/aprovada, unicidade de número/versão/auditoria e índice de carteira. Não há tabela de receita, despesa ou parcela financeira realizada. Valores monetários são strings decimais canônicas de duas casas nos snapshots SQL JSON; o motor usa inteiros BigInt em centavos. Percentuais usam pontos-base e fator usa quatro casas. Não são persistidos floats monetários.

O runtime real revelou que MySQL/TypeORM hidrata BIGINT como texto, enquanto a metadata de testes usa integer. As entidades novas normalizam IDs no AfterLoad, verificando inteiros seguros. Atualizações do agregado usam UPDATE explícito com organização e revisão esperada, além do bloqueio pessimista. Isso corrigiu a tentativa de reinserção na segunda gravação e mantém a seleção numérica de versões consistente. Nenhum tipo/guard/ID de módulos anteriores foi alterado.

Não há exclusão física: o arquivamento conserva todas as versões. A migration não atualiza, apaga nem recria dados existentes.

## 4. Cadastro e parâmetros

Orçamento: organização do ator (ou destino explícito autorizado), empresa, projeto opcional da mesma empresa/organização, número, elaboração, validade, segmento, serviços, bens estimados, unidades ativas da empresa, endereços adicionais, escopo, observações, restrições operacionais e responsável ativo da organização. Sem projeto é um orçamento anterior ao projeto. Empresa/projeto/número identificam o agregado e são imutáveis após criação; uma contratação posterior não é criada ou vinculada automaticamente.

Cada conjunto de preços é imutável e tem versões e vigências inclusivas que não podem se sobrepor dentro do mesmo nome/organização. São informados: moeda BRL/USD/EUR, produtividade, dias disponíveis, equipe mínima, visitas por profissional-dia, fator por endereço, diária técnica, despesas operacionais, deslocamento, transporte/dia, hospedagem/quarto-dia, alimentação/pessoa-dia, materiais, plaquetas/bem, administração, preço mínimo, capacidade de quarto, intervalo/dias extras, comissão, impostos e margem.

A versão selecionada deve estar vigente na data de elaboração. O snapshot não passa a usar parâmetros novos ou atuais posteriormente. A publicação seguinte não altera orçamentos anteriores. Taxas e custos não possuem defaults comerciais; a interface exige preenchimento explícito, inclusive zero quando esse for o parâmetro autorizado.

## 5. Fórmulas oficiais e arredondamentos

Definições: Q = bens; A = unidades selecionadas + endereços adicionais; P = produtividade por profissional-dia; F = fator de esforço; V = visitas por profissional-dia; D = dias disponíveis. A contagem representa visitas/unidades informadas; não faz geocodificação nem deduplicação física entre unidades distintas com o mesmo endereço. IDs repetidos e endereços adicionais textuais repetidos são rejeitados.

1. Esforço por bens = ceil(Q × F / P).
2. Esforço por visitas = ceil(A / V).
3. Pessoas-dia = max(esforço por bens, esforço por visitas).
4. Equipe necessária = ceil(pessoas-dia / D). Equipe adotada = max(necessária, mínima publicada), ou ajuste inteiro autorizado. Equipe ajustada menor que a necessária é rejeitada; reduzir equipe requer também prazo/produtividade compatíveis.
5. Dias de campo = ceil(pessoas-dia / equipe adotada).
6. Extras = floor(dias de campo / intervalo publicado) × dias extras publicados. Permanência = campo + extras. É uma premissa de estadia configurada, não inferência de calendário trabalhista/finais de semana.
7. Quartos = ceil(equipe / capacidade por quarto), ou zero se não houver dias de campo.

Custos em centavos:

- Técnica = equipe × dias de campo × diária.
- Operacional, deslocamento, materiais e administração = valores fixos publicados.
- Transporte = permanência × custo/dia.
- Hospedagem = quartos × permanência × custo/quarto-dia.
- Alimentação = equipe × permanência × custo/pessoa-dia.
- Plaquetas = Q × custo/bem.
- Acréscimo operacional = valor manual autorizado, se houver.
- Custo total = soma das linhas acima, cada uma com quantidade, unidade, subtotal e fórmula na memória.

Taxas são percentuais declarados sobre preço de venda. Impostos + comissão + margem alvo devem somar menos de 100%. **Preço gross-up = ceil em centavos(custo / (1 − imposto − comissão − margem)). Preço sugerido = max(gross-up, piso publicado).** Não há fator/piso fixo do legado. Um preço final manual exige autorização e justificativa e não pode violar o piso nem deixar de cobrir custos + impostos + comissão.

Impostos e comissão finais são calculados sobre o preço final, com arredondamento half-up em centavos. Resultado residual = preço final − custo − impostos − comissão. Pode diferir da margem alvo por efeito do piso, arredondamento ou ajuste autorizado; a interface distingue taxa alvo e resultado residual. Sem quantidade/esforço, custos variáveis de trabalho são zero, mas custos fixos explicitamente publicados permanecem. Limites: 500 profissionais, 3.650 dias de campo, 60 parcelas e valor monetário até 9.999.999.999.999,99. Divisores precisam ser positivos; não há equipe fracionária nem fallback silencioso de produtividade.

Mesmos dados de entrada e mesma versão de parâmetros produzem o mesmo resultado. O motor não lê relógio, banco ou estado do frontend. Data/ator são metadados da versão, não componentes monetários aleatórios. O frontend somente apresenta respostas oficiais do servidor; a prévia não persiste e salvar sempre recalcula e valida no backend.

## 6. Pagamento comercial

Plano separado de despesas/receitas realizadas. Entrada por valor **ou** percentual, com data; parcelas iguais, percentuais customizados ou valores customizados; vencimento mensal original ou datas explícitas por parcela. Na ausência de entrada, usa zero; não são criados títulos financeiros.

- Entrada percentual: half-up(preço × percentual), em centavos. Não pode exceder o preço.
- Iguais: piso(saldo / quantidade) para as anteriores; última = saldo − soma anteriores.
- Percentuais: entrada + parcelas devem somar exatamente 100%; parcelas anteriores usam half-up, última absorve o residual monetário. Percentuais customizados não aceitam entrada por valor.
- Valores: soma dos valores individuais deve fechar exatamente o saldo. Erro não vira saldo fictício zero.
- Datas: válidas, ordenadas e posteriores/iguais à elaboração; entrada não posterior ao primeiro vencimento. monthlyDueDate sempre deriva da data original: 31/01 → 28 ou 29/02 → 31/03. Não encadeia meses já limitados.
- Percentual efetivo é apresentado com quatro casas, derivado dos valores, com ajuste residual na última linha para fechar 100%. Os centavos são a fonte de verdade.
- Entrada de 100% exige zero parcelas restantes. Plano de preço zero exige zero saldo/parcelas. Condições completas são exigidas antes de salvar.

## 7. Versões, cenários, aprovação e concorrência

Estados: rascunho → revisão/arquivado; revisão → rascunho/aprovado/rejeitado; rejeitado → rascunho/arquivado; aprovado → arquivado; arquivado não reabre. Cada comando tem revisão esperada e justificativa. Aprovação/rejeição exigem autorização específica; arquivar um aprovado também exige aprovação além da edição disponível na interface.

Edição de rascunho/rejeitado cria outra versão e retorna a rascunho. Cenários são versões independentes com versão-base, nome e justificativa: permitem variar equipe, prazo, produtividade, despesas, margem e preço manual sob autorização. Antes da aprovação, consultar um cenário e enviá-lo para revisão define a versão escolhida. Aprovar consolida **somente essa versão em revisão**, rejeitando seleção trocada e validade vencida.

Após aprovado, não há edição/substituição da proposta. Novos cenários são apenas comparativos: não mudam head_version_id, approved_version_id ou o snapshot aprovado. Uma nova negociação aprovada deve ser outro orçamento explicitamente identificado; não se sobrescreve o anterior. Arquivamento preserva consulta da proposta aprovada; orçamento arquivado não prepara nova conversão.

Bloqueio pessimista por orçamento no MySQL + UPDATE com revisão impedem sobrescrita concorrente. Publicação/criação usam bloqueio da organização para serializar numeração e vigências. Cabeçalho, versão e auditoria são atômicos; falha de persistência faz rollback integral. Revisão e aprovação revalidam disponibilidade de empresa/projeto/responsável/unidades, sem refazer ou modificar a memória histórica. Queries de detalhe usam REPEATABLE READ.

## 8. APIs e permissões

Prefixo `/api/v1`:

| Método/caminho | Finalidade |
|---|---|
| GET /budgets | Carteira filtrada por organização, empresa, projeto, status, número e página (20 por página) |
| POST /budgets | Cria rascunho e primeira versão com cálculo oficial |
| GET /budgets/:id | Cabeçalho, versões completas e auditoria |
| PUT /budgets/:id/versions | Nova versão editada com revision/name/reason/base_version_id |
| POST /budgets/:id/scenarios | Cenário independente, inclusive após aprovação |
| POST /budgets/:id/transitions | Transição com revision/status/version_id/reason |
| GET /budgets/pricing | Versões de parâmetros da organização |
| POST /budgets/pricing | Publicação autorizada e imutável de parâmetros |
| POST /budgets/simulate | Prévia oficial sem persistência |
| GET /budgets/:id/proposal | Conteúdo comercial exclusivamente da versão aprovada |
| GET /budgets/:id/contract-preview | Preparação explícita somente de dados para futura conversão |

Novas chaves ORGANIZATION no seed e migration: `budgets:read`, `budgets:edit`, `budgets:configure-prices`, `budgets:approve`.

Todas as rotas exigem sessão e PermissionsGuard. Escrita exige leitura + edição; publicação exige leitura + configuração. Ajustes manuais também verificam a configuração no serviço. Transições verificam a chave correspondente ao comando, incluindo aprovação/rejeição. Org_admin mantém o bypass organizacional existente **somente com catálogo válido**. Papéis personalizados só recebem as concessões específicas; nenhuma concessão automática a ORG_USER. Remover uma chave do catálogo bloqueia a operação inclusive para o administrador.

Empresa/projeto/unidade/usuário/parâmetro/versão são validados contra a organização e o agregado correspondente. IDs estrangeiros não são reutilizados só porque existem. O ator é sempre autenticado; o responsável comercial é uma referência validada. Histórico não aceita edição/exclusão nem ator fornecido pelo navegador. PLATFORM_ADMIN pode operar APIs organizacionais com destino explícito; a interface desta homologação é focada na organização do ORG_ADMIN. Seletores reutilizados dependem das leituras específicas de empresas, unidades, projetos/usuários; não são concedidas implicitamente.

## 9. Interface e integração

- `/app/budgets`: listagem e filtros persistentes na URL; cadastro em ModalForm; orçamento pode preceder projeto.
- `/app/budgets/pricing`: consulta dos valores e publicação/versões com vigência, motivo e confirmação comercial.
- `/app/budgets/:budgetId?tab=memory|scenarios|payments|history|proposal&version=:versionId`: seleção e navegação por Link, refresh e links diretos.
- Memória: entradas e dimensionamento, linhas de custo, gross-up/piso/preço final, taxas/resultados, parâmetros/versão/fórmulas e ajuste justificado.
- Cenários: comparação de equipe, dias, produtividade, margem, custo, preço e justificativa; consulta de qualquer versão anterior.
- Pagamento: datas civis, percentuais efetivos e valores; histórico e auditoria; proposta da versão aprovada.
- Aba Orçamentos no projeto direciona à carteira com project_id na URL; o detalhe oferece links ao projeto e aos contratos relacionados, sujeitos às permissões existentes. Não cria rota duplicada de orçamento dentro do projeto.
- A prévia futura de contrato informa dados candidatos e campos pendentes (número, contratação, vigência e projeto quando ausente). Os flags creates_contract/creates_project/creates_receivables são false. Não executa criação, alteração ou vínculo automático.

## 10. Documentos e evolução de export jobs

A prévia comercial usa React com texto escapado, contendo empresa, escopo, serviços, bens, unidades/endereços, prazo, preço, condições e validade. Não usa HTML arbitrário do legado nem templates ZIP externos.

PDF/PPTX profissional **não está implementado** e nenhum download com essas extensões é oferecido. Para reaproveitar export jobs futuramente, é necessário: tipo de gerador real com MIME/extensão corretos; referência obrigatória e imutável a orçamento/versão aprovada/hash; escopo organizacional independente de project_id; permissões no pedido, processamento e download; template homologado/versionado com identidade GAI e contrato de placeholders; política de dados comerciais sensíveis; render/inspeção do PDF/PPTX; limites/filas, storage, checksum e auditoria. O processador XLSX atual não foi modificado para fingir esse contrato.

## 11. Banco e homologação local

Destino confirmado antes da migration: NODE_ENV=local, localhost:3306/gai, MySQL f10269ba8da4. Migration de orçamento é a 28ª aplicada. Nenhuma migration pendente, nenhum dado anterior apagado/recriado. Testes SQL destrutivos usam somente outro contêiner temporário em 127.0.0.1:33317/gai_validation_disposable, com credenciais sintéticas fixas e armazenamento temporário; não usam DB_* da aplicação.

Serviços usam a configuração local atual: frontend `http://localhost:5173`, API `http://localhost:3000/api/v1`, Swagger `http://localhost:3000/api/docs`. Inicialização: `powershell -ExecutionPolicy Bypass -File scripts/local-start.ps1`; esse script apenas verifica migrations e não as aplica automaticamente.

Entrar como a conta de teste ORG_ADMIN existente. Abrir Orçamentos → Parâmetros de preços, publicar somente parâmetros aprovados ou explicitamente sintéticos para homologação. Criar orçamento, escolher empresa, manter projeto vazio se ainda não existir, selecionar unidades/endereços e versão de parâmetros vigente, preencher pagamento e calcular prévia. Salvar, criar cenário, comparar, selecionar cenário, enviar para revisão e aprovar. Conferir proposta, criar cenário comparativo posterior e atualizar: a proposta deve permanecer inalterada. Testar as abas e voltar/avançar. Valores de homologação são estimativas sintéticas, sem prestação real.

Resultados, comandos e evidências estão em `testes.json`; IDs e URLs do último orçamento sintético em `runtime-local.json`; lista de arquivos desta etapa em `arquivos.json`. Capturas desktop/móvel do Playwright em `.local/budgets-playwright/`.

## 12. Limitações e decisões comerciais pendentes

Política matemática v1 é explícita e testada; as premissas comerciais e a referência da autorização são responsabilidade da organização. Não há algoritmo tributário legal, câmbio, preço de mercado, calendário de feriados/trabalho, otimização logística, garantia de capacidade por local, contrato automático, recebível, DRE ou despesa automática. Restrições operacionais são registradas para análise humana e devem ser refletidas em ajustes autorizados de prazo/equipe/produtividade/despesas.

Não há exclusão física, reabertura de arquivado ou substituição de aprovado. Empresa/projeto/número são imutáveis: orçamento anterior ao projeto permanece sem vínculo até uma futura operação explícita; seus dados podem ser preparados sem executar conversão. Prévia comercial não equivale a PDF/PPTX pronto para publicação.

Listagem paginada em 20; parâmetros até 1.000 por organização; seletor de projetos paginado/buscável; usuários até 100 no seletor, com responsável atual preservado. Histórico completo é retornado no detalhe; carteiras com histórico muito grande precisarão de paginação específica. Até 500 unidades e 100 endereços adicionais por orçamento. Não há importação de localStorage/legado ou migração inferida de preços.

Sem commit, push, deploy ou ações em produção. Contratos, inventário, conciliação, pagamentos e despesas anteriores foram preservados.
