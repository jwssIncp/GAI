const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'evidencias');
const original=JSON.parse(fs.readFileSync(path.join(root,'docs/auditoria-legado-gai-2026-10-27/matriz-comparativa.json'),'utf8'));
const inventory=require('./evidencias/inventory.json');
const groups={
 project:['projects/application/services/project-scope.service.ts','projects/ProjectsPage.tsx','projects/'],
 overview:['project-dashboard/application/services/organization-overview.service.ts','dashboard/OrganizationOverviewPage.tsx','project-dashboard/'],
 commercial:['contracts/commercial.service.ts','dashboard/OverviewDetails.tsx','contracts/'],
 contract:['contracts/contract.service.ts','contracts/ProjectContractsPage.tsx','contracts/'],
 item:['inventory-operations/application/inventory-operations.service.ts','inventory-items/ProjectInventoryItemsPage.tsx','inventory-operations/'],
 itemcrud:['inventory-items/application/use-cases/create-inventory-item.use-case.ts','inventory-items/ProjectInventoryItemsPage.tsx','inventory-items/'],
 import:['import-sessions/application/services/import-sessions.service.ts','import-sessions/ProjectImportSessionsPage.tsx','import-sessions/'],
 export:['export-jobs/application/services/export-jobs.service.ts','export-jobs/ProjectExportJobsPage.tsx','export-jobs/'],
 assisted:['assisted-reconciliation/assisted.service.ts','inventory-operations/AssistedReconciliationPanel.tsx','assisted-reconciliation/'],
 match:['assisted-reconciliation/matching.policy.ts','inventory-operations/AssistedReconciliationPanel.tsx','assisted-reconciliation/'],
 valuation:['inventory-operations/application/valuation-batch.service.ts','inventory-items/ValuationBatchPanel.tsx','valuation-batches/'],
 expense:['payments-expenses/application/services/payments-expenses.service.ts','finance/ProjectFinancePage.tsx','payments-expenses/'],
 accountability:['expense-accountabilities/expense-accountabilities.service.ts','accountabilities/ProjectAccountabilitiesPage.tsx','inventory-operations/'],
 agent:['field-agents/presentation/field-agents.controller.ts','field-agents/FieldAgentsPage.tsx','field-agents/'],
 preparation:['project-preparation/preparation.service.ts','project-preparation/ProjectPreparationPage.tsx','project-preparation/'],
 field:['field-coordination/field.service.ts','field-coordination/FieldCoordinationPage.tsx','field-coordination/'],
 receivable:['receivables/receivable.service.ts','receivables/ReceivablesPage.tsx','receivables/'],
 cash:['receivables/cash-flow.service.ts','receivables/CashFlowPage.tsx','receivables/'],
 dre:['managerial-dre/dre.service.ts','dre/DreReportPage.tsx','managerial-dre/'],
 budget:['budgets/budget.service.ts','budgets/BudgetDetailPage.tsx','budgets/'],
 pricing:['budgets/budget.policy.ts','budgets/BudgetPricingPage.tsx','budgets/'],
 report:['technical-reports/report.service.ts','technical-reports/ReportDetailPage.tsx','technical-reports/'],
 sources:['technical-reports/report.sources.ts','technical-reports/ReportDetailPage.tsx','technical-reports/'],
 document:['documents/documents.service.ts','documents/DocumentExportActions.tsx','documents/'],
 visual:['documents/document-templates.service.ts','documents/DocumentVisualEditor.tsx','documents/'],
 auth:['auth/presentation/guards/permissions.guard.ts','auth/usePermissions.ts','auth/'],
};
// One explicit decision per original capability. I=implemented in local scope;
// P=partial, A=absent, D=incompatible decision, N=not verified.
const decisions=`
1|I|project|Cadastro persistido, auditoria e transições explícitas; projetos antigos sem contrato continuam válidos.
2|I|contract|Contrato tipado por projeto; revisões e aditivos imutáveis, moeda e valores exatos. Não gera orçamento automaticamente.
3|I|overview|Filtros operacionais e comerciais combinados por EXISTS; serviço, segmento, recorrência e faixa de ativos no mesmo recorte. Datas operacionais e contratuais têm semânticas distintas explícitas.
4|I|overview|Mapa por unidades e agrupamentos por empresa/status; EXISTS evita multiplicação por unidades. Mapa não é endereço contratual.
5|I|commercial|Totais original/atual, ticket arredondado e recorrência separados por moeda; desconhecidos continuam null e snapshots persistem.
6|P|commercial|Indicadores operacionais e contagens de campo disponíveis; não foi encontrada evolução temporal unificada das etapas da carteira.
7|P|budget|Orçamentos têm histórico e estados; conversão apenas retorna preview_only e creates_contract=false. Funil anual e conversão efetiva não estão completos.
8|P|export|Backup XLSX protegido cobre conjunto limitado; sem restauração integral JSON do painel e dos novos domínios.
9|P|visual|Logo PNG da organização pode compor modelo visual versionado; busca externa e cadastro de logo por empresa não localizados.
10|I|itemcrud|CRUD de item e detalhe por projeto persistidos com status, escopo e auditoria; UI consome endpoints.
11|P|import|Payload físico materializa observação idempotente; não há remoção arbitrária de todas as linhas de um lote físico como no legado.
12|P|valuation|Lote existe para avaliações; edição de células/colunas e schema livre de inventário não foram implementados.
13|P|item|Filtros e paginação existem; seleção entre páginas é explícita no lote de avaliação, sem equivalência universal nas tabelas.
14|P|overview|Agregações fixas por status/unidade/UF; não há pivot livre por colunas arbitrárias.
15|D|item|Mestre e histórico de placas são preservados; não portar substituição/limpeza massiva de códigos das bases sem regra auditável.
16|D|item|Histórico SQL não admite rollback de matriz bruta local capaz de desfazer decisões de outros usuários.
17|I|export|Jobs geram XLSX real de inventário e base contábil com download autorizado e auditoria; não implica ZIP integral.
18|P|field|Tarefas com responsáveis, prazo e ordem existem na coordenação; cronograma geral editável/Gantt e histórico de planejamento equivalentes não localizados.
19|N|import|API recebe payloads idempotentes; cliente offline completo e backend legado conc-db não estão disponíveis para verificar sincronização ponta a ponta.
20|I|item|Conciliação por placa normalizada gera registros e sobras a partir das últimas observações, preservando fontes.
21|A|match|Não há comparação monetária físico-contábil por tolerância absoluta; matching compara identificadores, texto e local.
22|P|match|Motor por placa, série e descrição/local persistido e explicável. Usa Jaccard de tokens; Dice e desempate monetário específicos do legado não existem.
23|I|assisted|Revisão explícita, rejeição e aprovação com comando idempotente; aprovação integra a consolidação normal e preserva decisão anterior.
24|I|assisted|Ambiguidades e duplicidades bloqueiam aprovação; claims impedem muitos-para-um entre execuções.
25|I|match|Alerta de descrição incompatível em coincidência de placa/série com limiar configurado e evidência exibida na revisão.
26|P|assisted|Listagem de candidatos, fontes e sobras disponível; agrupamentos/pivots arbitrários dos dois lados não existem.
27|D|item|Desconciliar por mutação direta de códigos violaria snapshots e decisões já preservadas; fluxo livre do legado não é adotado.
28|N|assisted|Motor assistido atual existe; card Conciliação 02 original não define comportamento verificável. Não assumir equivalência pelo nome.
29|P|item|Observações da sessão são usadas diretamente; não há cópia de matrizes IndexedDB entre namespaces do legado.
30|I|item|Avaliação manual exige fonte/data e valor novo ou usado; histórico por item persistido e mestre preservado.
31|I|valuation|Prévia com seleção explícita/filtros, confirmação atômica e histórico por item; conflito de fontes e idempotência cobertos.
32|P|valuation|Seleciona itens reais do projeto e filtros; importação de planilha paralela para avaliação não existe.
33|N|valuation|Valores e método são informados pelo usuário; não há evidência de motor normativo CPC automatizado nem no material legado disponível.
34|I|expense|Despesa por projeto/inventariante com estados, aprovação, baixa e auditoria persistidos; reembolso é capacidade separada.
35|I|expense|Anexos possuem autorização, confirmação verificável e download; código S3 existe. Homologação AWS real continua pendente e não é inferida desta classificação local.
36|P|expense|Contrato comercial e despesa existem em domínios separados; classificação tipada reembolsável/não reembolsável por regra contratual não localizada.
37|A|expense|Não há livro de adiantamentos/depósitos por inventariante; saldo adiantamentos menos despesas não pode ser calculado com origem confiável.
38|I|accountability|Parcelamento distribui centavos e usa calendário civil mensal; reenvio não recalcula parcelas antigas.
39|I|accountability|Prestação agrega despesas elegíveis, impede vínculo repetido e recalcula total no fechamento; não equivale a recebimento do cliente.
40|A|receivable|Recebível genérico não implementa solicitação de reembolso vinculada à prestação fechada e sua liquidação específica.
41|P|expense|Filtros por inventariante e totais existem; depósitos, saldo de adiantamentos e gráfico de reembolso não existem. Resumo de pagamentos trunca em 100 registros (GAI-001).
42|P|export|Backup XLSX não inclui binários de comprovantes e nem todos os novos módulos; não é backup restaurável completo.
43|D|expense|Documento fictício não é comprovante; somente arquivo efetivamente enviado e verificado integra evidência.
44|I|agent|Cadastro, contatos, busca, documento e status persistidos com validação e escopo organizacional.
45|I|agent|Vínculo explícito inventariante/projeto ativo, IDs e lifecycle revalidados; nenhuma associação por nome.
46|A|agent|Não localizado upload de documentos cadastrais pessoais do inventariante; anexos de despesa e imagens de ativo não o substituem.
47|D|auth|Identidade/autorização são separadas do cadastro técnico; não guardar senha de técnico em dados locais de cadastro.
48|I|expense|Domínio calcula dias vezes diária mais adicional menos desconto e rejeita negativo; utiliza Number/toFixed e requer limites monetários adicionais (risco registrado).
49|P|expense|Aprovação/baixa/cancelamento existem, mas corrida HTTP/MySQL confirmou baixa bem-sucedida sobrescrita por aprovação e segunda baixa aceita sem estorno (GAI-010 crítico). Reabertura livre não é contrato de negócio; baixa de pendente é permitida explicitamente.
50|P|cash|Caixa agrega saídas por mês/projeto, mas não implementa consolidado organizacional por técnico com todos os componentes de remuneração.
51|A|expense|Não há endpoint ou UI para alterar datas e status de pagamentos em lote com previsão separada.
52|I|export|Exportação de pagamentos XLSX inclui componentes e valor final; download revalida payments:read e escopo.
53|D|expense|Total manual contraditório aos componentes não é aceito; manter cálculo de domínio e trilha de auditoria.
54|I|preparation|Kick-off tem modelo publicado, respostas tipadas, data, responsável, aprovação e histórico por projeto.
55|I|preparation|Checklist do cliente usa instância e respostas independentes do Kick-off, sem compartilhamento de estado.
56|I|preparation|Condições, N/A justificado e sequência compatível com quantidade são validados também na API.
57|I|preparation|Alocação reutiliza unidades vinculadas e calcula participação com uma casa decimal; IDs estrangeiros são rejeitados.
58|I|preparation|Modelos editam texto/ordem/visibilidade; progresso conta apenas perguntas aplicáveis e snapshots não reinterpretam respostas antigas.
59|I|preparation|Prévia autorizada de ata/texto de comunicação com dados de projeto; não envia e-mail e não comprova entrega.
60|P|field|Tarefas podem referenciar pendências reais e revalidar resolução; estados não são sincronizados automaticamente e planejamento operacional amplo permanece parcial.
61|I|field|Modelos/grupos/tarefas versionados, usuários e inventariantes vinculados, prazos, aprovação, conclusão e reabertura auditada.
62|D|field|Conclusão verifica todas as tarefas/etapas obrigatórias aplicáveis; não reproduzir atalho de considerar só as duas primeiras faixas.
63|I|field|Prévia de mensagens para técnico/grupo com dados e permissões atuais; nenhuma entrega externa é assumida.
64|N|import|APK e fonte do aplicativo móvel legado não estão no escopo disponível. Importação de payload não comprova aplicativo offline homologado.
65|I|receivable|Geração explícita de principal e aditivo positivo com origem única, snapshot e confirmação; não automática na aprovação contratual.
66|P|cash|Agenda reúne parcelas de despesas aprovadas e pagamentos previstos; moeda das saídas é UNSPECIFIED, faltam baixas por parcela e vencimentos em parte das fontes.
67|I|receivable|Baixas parciais/totais, estorno referenciado, saldo, atraso e comandos idempotentes persistem eventos imutáveis.
68|P|cash|Totais e tabela mensal esperado/realizado existem; sem saldo bancário inicial, gráfico equivalente ou soma entre moedas conhecidas e saídas sem moeda.
69|I|dre|DRE gerencial por competência, plano de contas, rateios, comparação anual e fechamento/reabertura versionados; cobertura incompleta é sinalizada.
70|P|pricing|Orçamento estima impostos/comissão/margem e custos com parâmetros explícitos; ponto de equilíbrio corporativo e histórico completo de custos não localizados.
71|I|receivable|Prévia comercial de entrada/parcelas distribui centavos sem criar fatos financeiros; confirmação explícita e hash são separados.
72|P|dre|Contas e lançamentos podem ser criados/ajustados com histórico; importador de planilha DRE não existe.
73|I|budget|Orçamento avulso ou vinculado a projeto mantém versões, cenários e aprovação do snapshot escolhido.
74|I|pricing|Dimensionamento por produtividade, dias, equipe, endereços e justificativa de ajustes com arredondamento no servidor.
75|I|pricing|Parâmetros publicados e piso explícito governam preço; não há defaults comerciais ocultos autorizados por documentação.
76|I|pricing|Memória de custos, quartos, extras, impostos, comissão, margem e plaquetas calculada em inteiros escalados e congelada por versão.
77|I|pricing|Plano igual/por percentuais/por valores, entrada e residual de centavos persistidos no snapshot comercial.
78|P|document|Propostas PDF/DOCX nativos e versionados existem; geração PPTX e manipulação de slides do template legado não existem.
79|I|report|Laudo tem narrativa, escopo, modelo publicado, identificação, revisão e aprovação imutável por projeto.
80|I|report|Modelos/textos/campos dinâmicos publicados por versão; edições futuras não alteram documentos aprovados.
81|P|sources|Extrai tabelas contábeis, conciliações e avaliações; moeda das avaliações não é informada e valuation.used_total permanece null, sem depreciação normativa automática.
82|P|document|Imagens de itens existem; DocumentBlock não possui fotos/legendas de ativos, apenas logo visual. Composição fotográfica do laudo não implementada.
83|I|report|Validação estruturada bloqueia aprovação conforme regras publicadas, campos, responsáveis, fontes e alterações; requisitos profissionais são configuráveis e não equivalem a certificação normativa.
84|I|document|Renderização PDF real e DOCX OOXML editável, download privado vinculado à versão; não usa HTML renomeado como Word.
85|N|report|Não foi encontrado motor normativo ou assinatura digital/verificação de conselho. Textos CPC/CREA/ART não comprovam validade normativa.
86|P|report|Revisões/históricos e hashes existem em vários domínios; sem comparação/restauração universal de todo o sistema.
87|N|export|Servidor legado de restauração não disponível; GAI não oferece restore integral/selecionado testado. Backup XLSX não comprova recuperação.
88|D|auth|Autenticação é de servidor, sessões revogáveis e permissões efetivas; JSON local de contas e flags não são mecanismo de autorização.
89|D|auth|Sem espelhamento global sharedStore; domínio SQL e escopo organizacional substituem monkey patch de chaves globais.
90|N|auth|Backend legado Netlify não consta dos arquivos disponíveis; não é possível certificar ACL/schema/retenção dele usando o backend GAI.
91|D|project|Não transportar purgas/reparos automáticos em boot para dados de cliente; seed de teste é explícito e isolado.
92|A|project|Não há módulo de atividades com iniciar/pausar/encerrar e intervalos por responsável/projeto.
93|A|project|Não há jornada, almoço, ociosidade, calendário e consolidado de horas; timestamps de login não substituem apontamento.
94|A|project|Não há solicitação de apontamento retroativo e aprovação correspondente; aprovação financeira tem outra semântica.
95|A|project|Não há leads inbound, estágios de contato e histórico CRM tipado.
96|A|project|Não há outbound, listas, conexão/convites e metas de cursos por responsável.
97|A|project|Não há inscritos/funil por empresa/curso ou LMS; contratos patrimoniais não implementam esse domínio.
98|A|project|Não há etapas/prazos/arquivos de cursos; coordenação de campo atende projeto patrimonial e não substitui esse fluxo.
`.trim().split('\n').map(l=>{const [n,s,g,...note]=l.split('|');return {n:+n,s,g,note:note.join('|')};});
const state={I:'IMPLEMENTADA',P:'PARCIAL',A:'AUSENTE',D:'INCOMPATÍVEL POR DECISÃO',N:'NÃO VERIFICADA'};
function fileRef(f){if(!fs.existsSync(path.join(root,f)))return null;const s=fs.readFileSync(path.join(root,f),'utf8'),idx=s.search(/export (?:async )?(?:class|function)|@Controller/);return f+':'+(idx<0?1:s.slice(0,idx).split('\n').length);}
const rows=original.map((o,i)=>{const d=decisions[i];if(!d||d.n!==i+1||o.id!=='F'+String(d.n).padStart(3,'0'))throw Error('IDs mismatch');const g=groups[d.g];
 const b=fileRef('gai-backend/src/modules/'+g[0]);
 let front=fileRef('gai-frontend/src/features/'+g[1]);
 if(!front){const candidates=inventory.manifest.filter(x=>x.file.startsWith('gai-frontend/src/features/'+g[1].split('/')[0]+'/')&&x.file.endsWith('.tsx')&&!x.file.includes('.test.'));front=candidates.map(x=>fileRef(x.file)).filter(Boolean).join('; ');}
 const tests=inventory.tests.filter(x=>x.file.startsWith('gai-backend/test/')&&x.file.includes(g[2])).map(x=>x.file);
 return {id:o.id,nome:o.funcionalidade,modulo_legado:o.modulo_legado,estado_anterior:o.classificacao,estado_atual:state[d.s],backend_responsavel:d.s==='A'?'Não localizado; ver inventário e domínio relacionado '+d.g:b,frontend_correspondente:d.s==='A'?'Não localizado':front,evidencia_implementacao:d.note,testes_existentes:d.s==='A'?'Sem teste específico desta capacidade ausente':tests.join('; ')||'Sem suíte específica localizada; consultar inventário',lacunas_remanescentes:d.s==='I'?'Ver limites expressos na evidência; classificação funcional local não representa homologação AWS/produção.':d.note,prioridade:o.prioridade,criterio_original:o.criterios_aceite};
});
const counts=rows.reduce((a,r)=>(a[r.estado_atual]=(a[r.estado_atual]||0)+1,a),{});
const headers=Object.keys(rows[0]),quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(__dirname,'matriz-funcional-atualizada.csv'),'\ufeff'+[headers,...rows.map(r=>headers.map(h=>r[h]))].map(r=>r.map(quote).join(';')).join('\r\n')+'\r\n');
const link=r=>r?String(r).split('; ').map(f=>'`'+f+'`').join('; '):'Não localizado';
fs.writeFileSync(path.join(__dirname,'matriz-funcional-atualizada.md'),'# Reavaliação individual das 98 capacidades\n\nData: 28/10/2026. Matriz original preservada; nenhuma linha foi inferida apenas do relatório anterior. Evidências são do código atual e das suítes referidas em testes.md. IMPLEMENTADA indica fluxo backend persistido + frontend correspondente no escopo descrito, não paridade irrestrita nem certificação de produção. A coluna de testes identifica arquivos existentes, não afirma que todos passaram; consultar resultados por ambiente. Ausências foram confrontadas com o inventário completo de módulos/rotas/catálogo. INCOMPATÍVEL POR DECISÃO mantém as exclusões arquiteturais justificadas na matriz original; não constitui nova decisão comercial.\n\n'+Object.entries(counts).map(([s,n])=>'- '+s+': '+n).join('\n')+'\n\n'+rows.map(r=>`## ${r.id} — ${r.nome}\n\n- Módulo legado: ${r.modulo_legado}.\n- Estado anterior: **${r.estado_anterior}**. Estado atual: **${r.estado_atual}**. Prioridade: **${r.prioridade}**.\n- Backend: ${link(r.backend_responsavel)}.\n- Frontend: ${link(r.frontend_correspondente)}.\n- Evidência e delimitação: ${r.evidencia_implementacao}\n- Testes existentes: ${link(r.testes_existentes)}.\n- Lacunas: ${r.lacunas_remanescentes}\n- Aceite original confrontado: ${r.criterio_original}.\n`).join('\n'));
fs.writeFileSync(path.join(out,'capabilities.json'),JSON.stringify({counts,rows},null,2));console.log(JSON.stringify(counts));
