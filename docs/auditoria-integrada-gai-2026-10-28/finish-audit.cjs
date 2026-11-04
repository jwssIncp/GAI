const fs=require('node:fs'),path=require('node:path');
require('./capabilities.cjs');require('./write-reports.cjs');
const root=path.resolve(__dirname,'../..'),ev=path.join(__dirname,'evidencias');
const read=n=>JSON.parse(fs.readFileSync(path.join(ev,n),'utf8'));
const write=(n,s)=>fs.writeFileSync(path.join(__dirname,n),s.trim()+'\n');
const ref=(p,needle)=>{const s=fs.readFileSync(path.join(root,p),'utf8'),i=needle?s.indexOf(needle):0;return '`'+p+':'+(i<0?1:s.slice(0,i).split('\n').length)+'`';};
const b=(p,n)=>ref('gai-backend/src/modules/'+p,n),f=(p,n)=>ref('gai-frontend/src/'+p,n);
const race=read('payment-race.json'),caps=read('capabilities.json'),consolidated=read('tests-consolidated.json');
const issues=[
 {id:'GAI-010',severity:'CRÍTICO',kind:'Defeito confirmado por HTTP/MySQL',title:'Aprovação concorrente sobrescreve baixa de pagamento e permite nova baixa',location:b('payments-expenses/application/services/payments-expenses.service.ts','private async paymentTransition')+'; '+b('payments-expenses/infrastructure/persistence/typeorm-payments-expenses.repository.ts','async savePaymentWithAudit'),evidence:`Em ${race.approved_after_successful_paid} de ${race.cases.length} corridas, approve e mark-as-paid responderam 200, mas GET terminou approved com paid_at preenchido. Uma nova mark-as-paid foi aceita (200) sem estorno. SQL e logs de auditoria confirmam persistência; evidencias/payment-race.json.`,repro:'Criar pagamento pending sintético; disparar POST approve e POST mark-as-paid simultaneamente por Promise.all; consultar GET; repetir em pagamentos independentes. Selecionar caso cuja baixa respondeu paid mas estado final é approved; repetir baixa.',impact:'Registro de quitação perde seu estado final; caixa pode recolocar pagamento no previsto e operador pode pagar novamente. Corrupção de estado foi demonstrada; transferência bancária/perda monetária real não foi executada.',fix:'Ler, revalidar estado e projeto e gravar dentro da mesma transação com lock ou comparação atômica de versão/estado. Proteger todas as transições concorrentes e definir idempotência de baixa sem mudar silenciosamente a permissão de baixar pendente.',tests:'HTTP MySQL concorrente approve×paid, edit×paid e cancel×paid; quando baixa retorna sucesso, estado não pode regredir. Segunda baixa exige negativa/idempotência sem novo efeito. Auditoria deve refletir uma sequência serializável.',wave:0},
 {id:'GAI-001',severity:'ALTO',kind:'Defeito confirmado por HTTP',title:'Resumo financeiro soma apenas os primeiros 100 pagamentos',location:b('payments-expenses/application/services/payments-expenses.service.ts','async paymentSummary'),evidence:'101 pagamentos de 1.00 → total_count=101 e total_pending=100.00. evidencias/finance-reproduction.json.',repro:'Criar 101 pagamentos de 1.00 no projeto sintético; GET /projects/:id/payments/summary.',impact:'Cards financeiros subestimam valores; quantidade e total divergem e podem induzir decisões incorretas.',fix:'Agregação SQL exata por estado/escopo, independente de paginação, usando DECIMAL/centavos.',tests:'0, 1, 100, 101 e múltiplas páginas; todos os estados; comparar soma exata de detalhes com summary e dashboard.',wave:1},
 {id:'GAI-002',severity:'MÉDIO',kind:'Defeito confirmado por HTTP',title:'Datas civis impossíveis são normalizadas silenciosamente',location:b('payments-expenses/application/services/payments-expenses-scope.service.ts','parseDate'),evidence:'expense_date=2026-02-30 recebe 201 e persiste 2026-03-02. evidencias/finance-reproduction.json.',repro:'POST /projects/:id/expenses com amount=1.00 e expense_date=2026-02-30.',impact:'Despesa entra em mês diferente, alterando filtros, prestação e competência informada.',fix:'Validação civil estrita com formato/limites/round-trip, erro 400 e nenhuma gravação. Não reprocessar histórico automaticamente.',tests:'Fevereiro bissexto/não bissexto, 30/31 em meses curtos, datas fora de faixa, pagamento e despesa, ausência de efeitos em erro.',wave:1},
 {id:'GAI-011',severity:'MÉDIO',kind:'Inconsistência confirmada no ambiente MySQL auditado',title:'Timestamps da aplicação e do MySQL ficam três horas divergentes',location:ref('gai-backend/src/app.module.ts','TypeOrmModule.forRoot')+'; '+ref('gai-backend/data-source.ts')+'; '+b('payments-expenses/infrastructure/persistence/field-agent-payment.entity.ts','UpdateDateColumn'),evidence:'Caso sintético: created_at SQL 18:35:21 e updated_at SQL 21:35:21 na mesma operação; API retorna created_at 21:35Z e updated_at 00:35Z do dia seguinte. MySQL NOW=UTC_TIMESTAMP; host São Paulo e driver sem timezone explícito. payment-race.json contém SQL e relógios.',repro:'No host America/Sao_Paulo e MySQL UTC, criar e alterar pagamento; comparar instantes da API com NOW/UTC_TIMESTAMP e DATETIME bruto.',impact:'Trilha temporal pode parecer futura/fora de ordem, com risco de recortes e investigação incorretos. Não foi demonstrada alteração de DATE civil por esse mecanismo.',fix:'Definir contrato UTC consistente entre driver, sessão MySQL e defaults; preservar semântica das datas civis. Planejar qualquer normalização de histórico separadamente.',tests:'Criar/atualizar e ler nas combinações TZ=UTC/São Paulo e servidor UTC; igualdade de instante em milissegundos e datas civis invariantes.',wave:1},
 {id:'GAI-003',severity:'ALTO',kind:'Falha confirmada de qualidade/runner',title:'Comando backend completo padrão não passa com as suítes atuais',location:ref('gai-backend/package.json','"testRegex"')+'; '+ref('gai-backend/test/integration/test-app.helper.ts','databaseOptions'),evidence:'Runner padrão: 76 falhas, 638 pass e 7 skips; serviços MySQL executados no helper SQLite causam REPEATABLE READ/NOW incompatíveis. Reexecução MySQL deixa somente duas expectativas desatualizadas.',repro:'node node_modules/jest/bin/jest.js --runInBand no backend, sem GAI_TEST_MYSQL_DISPOSABLE=1.',impact:'CI/teste local não representa corretamente os contratos e bloqueia um gate confiável de release.',fix:'Separar explicitamente suites unitárias/SQLite das suites MySQL e provisionar alvo descartável nos checks; não mascarar erros com skip indiscriminado.',tests:'Comandos documentados e CI com todos os casos pertinentes executados no motor correto, sem usar DB_* real e sem testes omitidos silenciosamente.',wave:1},
 {id:'GAI-004',severity:'MÉDIO',kind:'Expectativa de teste desatualizada confirmada',title:'Dois testes de exportação genérica contradizem o novo contrato financeiro',location:ref('gai-backend/test/integration/technical-validation/security-storage.e2e-spec.ts','it.each(Object.values(ExportJobType))')+'; '+b('export-jobs/application/services/export-jobs.service.ts','Use a exportação financeira'),evidence:'finance_xlsx e dre_xlsx retornam 409 por desenho no endpoint genérico; suite exige 403/201 para todos os tipos. As rotas especializadas possuem testes positivos e negativos próprios.',repro:'Executar security-storage.e2e-spec.ts em MySQL e conferir os dois casos parametrizados.',impact:'Regressão global vermelha sem comprovar falha de autorização; testes deixam de expressar contrato vigente.',fix:'Testar negativa 409 do endpoint genérico e permissões/filtros/download nas rotas financeiras específicas, preservando testes negativos de conteúdo.',tests:'Suite inteira verde após revisão de contrato, sem enfraquecer assertivas de fonte e revogação.',wave:1},
 {id:'GAI-005',severity:'MÉDIO',kind:'Defeito de navegação confirmado no código e caracterizado em navegador',title:'Layouts e links globais descartam o contexto do projeto',location:f('features/budgets/BudgetLayout.tsx','to="/app/budgets"')+'; '+f('features/receivables/ReceivablesPage.tsx','to={"/app/finance/receivables/"'),evidence:'Aba Orçamentos abre com project_id; clicar Orçamentos no sublayout remove o filtro. Lista→detalhe de recebível também não transporta query. Testes zz-navigation registram lostContext no desktop/mobile.',repro:'Abrir projeto → Orçamentos; confirmar project_id na URL; clicar Orçamentos no menu interno; conferir query removida e ausência das abas do projeto.',impact:'ORG_ADMIN pode perder filtro/retorno ao navegar módulos relacionados; amplia lista fora do contexto esperado, ainda dentro da própria organização.',fix:'Propagar escopo de navegação e oferecer retorno ao projeto nos layouts/detalhes, com links estáveis após refresh e histórico.',tests:'Navegação ponta a ponta projeto→orçamento/parâmetros/detalhe e projeto→recebível/detalhe/caixa/DRE; back/forward, refresh e mobile sem perda do project_id.',wave:3},
 {id:'GAI-006',severity:'ALTO',kind:'Limitação funcional confirmada por código',title:'Extração documental bloqueia famílias com mais de 1.000 registros',location:b('technical-reports/report.sources.ts','if (rows.length > 1000)'),evidence:'Scoped take(1001) rejeita fonte >1.000; seleção não oferece lista arbitrária de itens e algumas seleções ocorrem depois da carga limitada. Não há truncamento silencioso.',repro:'Em projeto sintético com 1.001 itens ou histórico de avaliações acima do teto, capturar família correspondente no laudo.',impact:'Projetos patrimoniais maiores podem não emitir documento completo; capacidade não pode ser homologada em escala real apenas com 60/180 linhas.',fix:'Decidir recorte documental explícito ou extração paginada com snapshot consistente e limites claros de memória/páginas. Não remover limite sem estratégia.',tests:'1.000/1.001 e volume representativo de produção, inclusive múltiplas avaliações históricas; conteúdo integral, estabilidade de hash, autorização e limite de render.',wave:2},
 {id:'GAI-007',severity:'ALTO',kind:'Inconsistência de configuração declarada confirmada',title:'Terraform ECS não habilita o modo exigido para documentos em produção',location:b('documents/documents.service.ts','process.env.DOCUMENT_STORAGE')+'; '+ref('infra/terraform/ecs.tf'),evidence:'Serviço em NODE_ENV=production exige DOCUMENT_STORAGE=database; task definition em fonte não define a variável. Não foi inspecionada uma task AWS efetiva.',repro:'Aplicar em ambiente de teste a mesma configuração declarada, com NODE_ENV=production sem DOCUMENT_STORAGE, e solicitar geração autorizada: gate responde 503.',impact:'Caminho declarativo de release deixa geração documental indisponível. Não significa que todos os endpoints ou um ambiente AWS existente tenham sido testados.',fix:'Decidir e configurar armazenamento documental, retenção/backup/capacidade e variável correspondente; homologar antes de liberar, mantendo fail-closed.',tests:'Boot/config de produção isolados e fluxo autorizado de gerar/baixar; configuração ausente permanece negativa segura; teste de retenção e recuperação.',wave:5},
 {id:'GAI-008',severity:'MÉDIO',kind:'Falha confirmada de gate de qualidade',title:'Lint global backend tem 83 erros e CI não cobre a homologação real',location:ref('.github/workflows/ci.yml')+'; '+ref('gai-backend/package.json','"lint"'),evidence:'82 prettier/prettier + 1 no-control-regex em quatro arquivos; frontend tem um aviso. CI chama --fix, audit ||true e não executa Playwright/MySQL/S3 reais.',repro:'ESLint global sem --fix e leitura do workflow de CI.',impact:'Pipeline não está integralmente verde e pode alterar working tree ao verificar; ausência de gates reais reduz proteção de regressão.',fix:'Resolver dívida sem misturar com mudança de negócio, separar lint de formatação automática e declarar suites reais isoladas. Definir política de advisories atualizada.',tests:'Lint sem mutação com exit 0 e checks de integração executados por pipeline, sem adicionar duplicação de contagem.',wave:4},
 {id:'GAI-009',severity:'MÉDIO',kind:'Falha confirmada de introspecção TypeORM',title:'SchemaBuilder não compara schema por falta de typeorm_metadata',location:ref('gai-backend/src/migrations/1740800000001-protect-active-field-agent-assignments.ts')+'; '+ref('gai-backend/data-source.ts'),evidence:'QueryRunner.getTables/SchemaBuilder.log geram ER_NO_SUCH_TABLE para typeorm_metadata/GENERATED_COLUMN active_assignment_key; consulta raw confirmou schema de aplicação e 32 migrations. schema.json preserva erro.',repro:'Aplicar migrations em schema novo e chamar getTables ou SchemaBuilder.log com metadata atual.',impact:'Geração/comparação automática de migration pode falhar; não comprova corrupção das tabelas nem impede as consultas normais que passaram.',fix:'Alinhar estratégia de colunas geradas/metadata com TypeORM por migration revisada ou ferramenta de diff explicitamente compatível; não usar synchronize em base real.',tests:'Base nova + introspecção e diff sem erro; coluna gerada e unicidade de vínculo ativo preservadas; upgrade em cópia histórica.',wave:4}
];
const depBack=read('dependencies-backend.json'),depFront=read('dependencies-frontend.json');
issues.push({id:'GAI-012',severity:'ALTO',kind:'Advisories confirmados no lockfile; exploração no GAI não confirmada',title:'Dependências de produção e transitivas têm alertas atuais de segurança',location:ref('gai-backend/package-lock.json')+'; '+ref('gai-frontend/package-lock.json')+'; '+ref('.github/workflows/ci.yml'),evidence:'npm audit --omit=dev --package-lock-only retornou 20 entradas backend (2 critical, 13 high, 3 moderate, 2 low) e 5 frontend high. Contagens são pacotes/efeitos na árvore do npm, não vulnerabilidades independentes ou explorações confirmadas. JSON normalizado preservado; detalhes em dependencias-seguranca.md.',repro:'Executar npm audit de leitura sobre os dois lockfiles; comparar versões e alcance de cada advisory, depois inspecionar a imagem de release e caminhos efetivamente usados.',impact:'Risco conhecido em componentes de parsing/HTTP; não se comprovou exploração, vazamento ou execução remota no GAI. Alguns alertas dependem de adaptadores Node/RSC/build/peers opcionais e podem não ser alcançáveis pelo SPA/produção.',fix:'Triar alcance, atualizar/substituir dependências de forma revisada e testar regressões; não executar audit fix --force nem declarar aplicação vulnerável a todos os advisories sem avaliar uso. CI deve tratar alertas conforme política explícita.',tests:'SCA atual sobre lock e imagem real; importação XLSX/HTTP/upload regressivas; justificar alertas não alcançáveis e remover bloqueios critical/high aplicáveis antes de produção.',wave:1});
fs.writeFileSync(path.join(ev,'issues.json'),JSON.stringify(issues,null,2));
write('problemas-priorizados.md',`# Problemas priorizados

São ${issues.length} ocorrências com evidência, separadas de riscos e pendências. O achado GAI-010 é crítico por corrupção reproduzida do estado de quitação e possibilidade de nova baixa; não se afirmou transferência bancária duplicada real. Código da aplicação não foi corrigido durante a auditoria.

${issues.map(i=>`## ${i.id} — ${i.severity} — ${i.title}\n\n- Natureza: ${i.kind}.\n- Local: ${i.location}.\n- Evidência: ${i.evidence}\n- Reprodução: ${i.repro}\n- Impacto: ${i.impact}\n- Correção recomendada: ${i.fix}\n- Testes/aceite: ${i.tests}\n- Onda: ${i.wave}.\n`).join('\n')}

## Riscos, limites e decisões ainda não confirmados como defeito universal

1. **Upgrade/rollback, risco alto condicionado:** migration de IDs derruba tabelas e a seguinte é irreversível; dano depende do baseline do destino. Não houve perda real. Exigir cópia histórica, backup/restore e reconciliação antes de executar release.
2. **AWS, pendência de produção:** S3/SES/IAM/CORS/TLS e operação real não homologados nesta auditoria. MinIO não substitui AWS.
3. **Moeda/cobertura, limitação de negócio:** saídas e avaliações sem moeda, despesas sem vencimento, baixa de parcela de despesa ausente; não há saldo bancário definitivo. Não inventar BRL, zero ou reclassificação histórica.
4. **Fontes econômicas, decisão de negócio:** contrato e orçamento podem ser origens independentes sem vínculo de equivalência. Conferir antes de gerar ambos; não foi provado que todo par represente obrigação duplicada.
5. **Concorrência além do achado:** pagamentos e despesas originais compartilham padrão de leitura fora da transação; outras corridas ainda precisam de reprodução própria. Não generalizar os 5/15 pagamentos para todos os serviços.
6. **Number/toFixed e limites:** dívida monetária antiga, sem erro de centavo persistível reproduzido. Casos de overflow/agregação grande exigem testes; não afirmar prejuízo sem prova.
7. **DOCX/retencão:** estrutura validada, paginação Word e retenção de blobs não homologadas; engine normativo/assinatura e fotos em laudos não existem.
8. **Calendário:** dia UTC financeiro difere da política São Paulo do campo. Definir regra de negócio e não reescrever histórico automaticamente.
9. **Cobertura de UI/permissões:** visitas de rota e suites selecionadas não provam todas as combinações de filtros, modais, papéis e telas. Rotas placeholder e módulos ausentes estão na matriz; não são bugs de um módulo implementado.
`);

write('plano-correcoes.md',`# Plano de correções em ondas

Plano para execução posterior; nenhuma correção de implementação foi feita nesta auditoria. As ondas distinguem bloqueios obrigatórios de evolução de escopo. Critérios devem ser verificados sobre a revisão corrigida, sem reusar relatórios antigos como prova.

## Onda 0 — integridade financeira crítica

**Obrigatória antes de aceite integrado/produção: GAI-010.** Tornar transições de pagamento serializáveis e impedir regressão de paid após baixa bem-sucedida. Dependência: preservar regra atual de baixa de pending/approved enquanto a decisão de negócio não mudar; não confundir conserto de corrida com segregação de funções. Aceite: corridas reais approve×paid/edit×paid/cancel×paid produzem sequência válida ou conflito, nunca sucesso de paid seguido de approved; repetição não cria segunda baixa sem estorno; trilha e caixa coerentes. Auditar registros suspeitos em modo somente leitura e preparar eventual remediação histórica para autorização separada.

## Onda 1 — segurança, integridade e teste confiável

**Obrigatórias: GAI-001, GAI-002, GAI-011, GAI-003 e GAI-004.** Agregar todos os pagamentos sem limite de página; validar datas estritamente; alinhar timezone de instantes; separar motores de teste; atualizar expectativas de exportações nas rotas corretas. Dependência: Onda 0 para validar totais sem estado corrompido. Aceite: 101 pagamentos somam 101.00, datas impossíveis recebem 400 sem escrita, instantes não saltam três horas, todos os casos backend rodam no motor correto, fontes/tenant/download revogado continuam negados e CI fica verde sem ocultar suites.

Revalidar todo o catálogo de 161 permissões no ambiente de homologação, incluindo chave ausente, ORG_ADMIN próprio tenant e custom roles com grants mínimos. Não há correção de vazamento crítico comprovado a aplicar indiscriminadamente; preservar os controles que passaram.

## Onda 2 — integrações funcionais

**Obrigatória se escopo de homologação inclui projetos grandes: GAI-006.** Decidir recortes/snapshots paginados e volume representativo do laudo. Aceite: projeto/histórico acima de 1.000 registros gera recorte completo autorizado ou seleção explícita suportada, sem truncamento/hash instável. Revalidar inventário→conciliação→consolidação→avaliação→laudo após mutações.

**Decisões condicionais:** vínculo orçamento/contrato, geração de recebíveis e política para aditivos negativos, moeda das saídas/avaliações, baixa individual de parcela, prestação→reembolso e alocação DRE. Aceite depende de contrato de negócio explícito; não ligar tudo automaticamente nem reclassificar fatos antigos sem plano.

## Onda 3 — experiência do usuário

**Obrigatória para requisito de navegação integrada: GAI-005.** Preservar project_id e retorno ao projeto em orçamento, parâmetros, proposta, recebível/detalhe, caixa e DRE. Aceite: desktop/mobile com refresh, deep link e histórico sem perder contexto; novo teste deve exigir comportamento correto, substituindo a caracterização do defeito atual. Revalidar permissões visuais, loading/erro, filtros e atualização de indicadores. Placeholders devem ficar claramente fora do escopo homologado ou receber evolução em outra entrega autorizada.

## Onda 4 — desempenho e dívida técnica

**Obrigatórias para pipeline verde/gestão de schema: GAI-008 e GAI-009.** Lint sem --fix, dívida corrigida, introspecção de colunas geradas funcional. Aceite: nenhuma coluna removida automaticamente pelo diff; vínculo ativo único preservado; todos os checks globais passam. Bundle principal de 1,73 MB, locks por organização, consultas N+1, extração documental, retention de blobs e duplicações de escopo pedem medição antes de refatoração. Futuro: code splitting, orçamento de performance e carga realista, sem prometer ganho não medido.

## Onda 5 — homologação de infraestrutura e produção

**Obrigatórias: GAI-007 e pendências AWS/upgrade/restore/DOCX.** Configurar modo documental explicitamente; comprovar backup, retenção e capacidade SQL; aplicar migrations e catálogo apenas em ambiente autorizado com baseline conhecido. Homologar S3 AWS com IAM mínimo, versionamento/GetObjectVersion, criptografia, CORS, PUT/HEAD/GET e expiração. Homologar e-mail, TLS/ALB/CloudFront, logs e observabilidade. Aceite: fluxo real autorizado de gerar/baixar, revogação/tenant negativos, restore de cópia histórica e rollback operacional documentado, sem cadeia down destrutiva.

A liberação depende da Onda 0 e dos bloqueios obrigatórios das ondas anteriores, aceite funcional assinado e nenhuma ocorrência crítica aberta. Esta auditoria não autoriza commit, push, deploy, migration de produção ou alteração de dados reais.

## Melhorias futuras e funcionalidades fora desta correção

Atividades/horas, jornada/retroativos, CRM inbound/outbound, cursos/inscritos/etapas, adiantamentos, reembolso específico, documentos de inventariantes, lote de pagamentos, pivot/edição de planilha livre, PPTX, fotos/legendas de laudos, importador DRE, assinatura e motor normativo. Priorizar pela matriz original e decisões de negócio; não são implementados nesta execução e não devem ser disfarçados de correção obrigatória do núcleo atual.
`);

const counts=caps.counts,pwFile=path.join(ev,'playwright.json'),pw=fs.existsSync(pwFile)?read('playwright.json'):null;
const criticalCount=issues.filter(i=>i.severity==='CRÍTICO').length,highCount=issues.filter(i=>i.severity==='ALTO').length,mediumCount=issues.filter(i=>i.severity==='MÉDIO').length;
write('README.md',`# GAI Auditoria integrada em 28 de outubro de 2026

**Não apto para aceite final de homologação integrada nem para produção neste estado.** Há um bloqueio crítico confirmado em pagamentos: aprovação concorrente pode sobrescrever uma baixa bem-sucedida, e a API admite nova baixa sem estorno. A base permite continuar investigação e homologação exploratória exclusivamente com dados sintéticos; isso não é aprovação de uso financeiro real.

## Resultado funcional das 98 capacidades

| Estado atual | Quantidade |
| --- | ---: |
| IMPLEMENTADA | ${counts.IMPLEMENTADA} |
| PARCIAL | ${counts.PARCIAL} |
| AUSENTE | ${counts.AUSENTE} |
| INCOMPATÍVEL POR DECISÃO | ${counts['INCOMPATÍVEL POR DECISÃO']} |
| NÃO VERIFICADA | ${counts['NÃO VERIFICADA']} |
| Total | 98 |

Cada ID F001–F098 foi preservado e recebeu análise própria em [matriz-funcional-atualizada.md](matriz-funcional-atualizada.md) e [CSV](matriz-funcional-atualizada.csv), com estado anterior/atual, backend, frontend, evidência, testes, lacunas e prioridade. IMPLEMENTADA significa fluxo persistido e interface correspondente no escopo descrito; não certifica paridade integral, ausência de bugs ou produção. As exclusões incompatíveis mantêm as justificativas arquiteturais originais, não novas decisões de negócio.

Ausências: tolerância monetária físico-contábil; adiantamentos/saldo por técnico; solicitação/liquidação de reembolso do cliente; documentos cadastrais do inventariante; atualização de pagamentos em lote; atividades e jornada/retroativos; CRM e cursos/inscritos/etapas. Parcialidades relevantes: conversão orçamento→contrato, caixa com saídas sem moeda, composição fotográfica de laudos, totalização normativa de avaliações, PPTX e importação DRE. APK/offline, backend legado, restore e assinatura/motor normativo permanecem não verificados ou não comprovados conforme cada ID. Nenhum desses novos módulos foi iniciado.

## Achados que mudam a prontidão

São ${issues.length} ocorrências documentadas: **${criticalCount} crítica, ${highCount} altas e ${mediumCount} médias**. [Problemas priorizados](problemas-priorizados.md) contém evidência, arquivo, reprodução, impacto, correção e testes para cada uma. [Plano de correções](plano-correcoes.md) define ondas, dependências e aceite.

- **GAI-010, crítico:** ${race.approved_after_successful_paid}/${race.cases.length} corridas HTTP/MySQL entre aprovação e baixa terminaram approved após resposta paid=200. SQL confirmou paid_at e auditorias; segunda baixa aceita sem estorno. Não houve transferência bancária real.
- **GAI-001, alto:** 101 pagamentos de 1.00 retornam total_count=101 e soma=100.00 no resumo.
- **GAI-002/011, médios:** data impossível 2026-02-30 vira 2026-03-02; timestamps MySQL/aplicação apresentaram diferença de três horas no ambiente auditado.
- **GAI-003/004/008:** runner backend padrão e lint global falham; dois testes de exportação precisam refletir o contrato atual.
- **GAI-005/006:** links globais perdem contexto do projeto e extração de laudo limita famílias a 1.000 registros.
- **GAI-007/009:** configuração ECS não habilita modo documental exigido; diff TypeORM falha sem typeorm_metadata para coluna gerada.

## Evidência executada agora

| Verificação | Resultado |
| --- | --- |
| Backend completo no runner padrão | 638 aprovados, 76 falhos, 7 ignorados |
| HTTP/integracão MySQL descartável | 272 aprovados, 2 falhos, 7 S3 ignorados nessa execução |
| S3 real local em MinIO exclusivo | 7 aprovados |
| Casos backend consolidados sem contar reexecuções | ${consolidated.declared_cases} casos: ${consolidated.counts.passed||0} aprovados, ${consolidated.counts.failed||0} falhos |
| Vitest frontend completo | 247 aprovados |
| TypeScript backend e frontend | Aprovados |
| Builds Nest e Vite com saída isolada | Aprovados; bundle frontend com aviso de tamanho |
| ESLint backend/frontend sem auto fix | 83 erros backend; frontend zero erros e um aviso |
| Migrations e schema novo MySQL | 32 aplicadas, nenhuma pendente; 101 entidades/tabelas + migrations |
| Playwright Chromium, API/MySQL reais | ${pw?`${pw.stats.expected} aprovados, ${pw.stats.unexpected} falhos, ${pw.stats.skipped} ignorados`:'Em execução; consultar testes.md antes de encerrar a auditoria'} |
| PDF/DOCX sintéticos 1/60/180 linhas | 6 nativos estruturalmente válidos; PDF 2/5/12 páginas, amostra visual revisada |

Os 719 aprovados consolidados não tornam npm test verde: o comando padrão falhou por misturar suítes MySQL no SQLite. Também não substituem as reproduções adicionais que descobriram GAI-001/002/010/011. Os dois casos de navegação caracterizam um defeito atual; aprovação do teste de reprodução não é aceite da regra defeituosa. Método de contagem, comandos, falhas de preparação e resultados por cenário estão em [testes.md](testes.md).

## Arquitetura, segurança e preservação

26 módulos, 312 endpoints e 161 permissões foram inventariados. Metadados não exigem chaves ausentes do seed. Controles de sessão, escopo organizacional, catálogo fail-closed, permissões de fonte, download e snapshots foram confrontados com código e testes HTTP. Não foi confirmado vazamento de dados entre organizações nas verificações executadas. A corrida financeira foi encontrada por teste adicional do módulo antigo e não pode ser descartada por suites gerais verdes nos módulos novos.

Arquivos da aplicação e alterações locais anteriores foram preservados; a entrega e scripts/evidências ficam nesta pasta. Sem commit, push, deploy, migrations em produção, envio de mensagens ou edição de dados reais. Usaram-se SQLite em memória, MySQL 33317, API 33319, frontend 33320 e MinIO 33318 exclusivos da auditoria. Ambiente existente 3306/3000/5173/9000 não foi usado para as escritas de teste. Logs e backups sintéticos são evidência local, não dados de cliente.

## Pendências para produção

Corrigir e revalidar Onda 0 e bloqueios obrigatórios; homologar AWS real (MinIO não substitui IAM/CORS/versões/criptografia), modo documental/retencão, upgrade de cópia histórica e restore; validar DOCX em Word/render canônico, carga/volume representativos, timezone e fluxos de negócio ausentes do escopo aprovado. Migração antiga contém reconstrução destrutiva e outra é irreversível; isso exige baseline e recuperação operacional antes de release. Não foi declarada homologação do storage AWS.

## Documentos da entrega

1. [Inventário e arquitetura](inventario-atual.md), com [rotas e permissões](rotas-permissoes.md).
2. [Matriz das 98 capacidades](matriz-funcional-atualizada.md) e [CSV](matriz-funcional-atualizada.csv).
3. [Integrações](integracoes.md) e [Segurança/RBAC](seguranca-rbac.md).
4. [Auditoria financeira](auditoria-financeira.md) e [patrimonial](auditoria-patrimonial.md).
5. [Frontend e navegação](frontend-navegacao.md).
6. [Documentos/storage](documentos-storage.md) e [banco/migrations](banco-migrations.md).
7. [Testes](testes.md), [problemas](problemas-priorizados.md) e [plano](plano-correcoes.md).

Evidências JSON/logs, manifesto de fontes, cópias de suites, configurações e scripts de reprodução acompanham os documentos. Relatórios anteriores foram usados para localizar hipóteses; o parecer acima se apoia no código atual e nas execuções desta auditoria.
`);

const financialPath=path.join(__dirname,'auditoria-financeira.md');let financial=fs.readFileSync(financialPath,'utf8');
financial=financial.replace('## Caixa e DRE',`## Corrupção concorrente de estado de pagamento

**GAI-010, crítico:** ${race.approved_after_successful_paid}/${race.cases.length} pares approve/mark-as-paid simultâneos responderam 200 nas duas operações, mas o GET persistido voltou a approved, ainda com paid_at. Uma nova baixa respondeu 200 sem estorno. Leitura/revalidação ficam fora da transação que salva a entidade sem CAS/versão; uma escrita stale pode sobrescrever a quitação. Prova real MySQL/HTTP e auditorias: evidencias/payment-race.json. Isso é bloqueio de produção, embora nenhum dinheiro real tenha sido movimentado. Onda 0 deve proteger transições sem mudar silenciosamente a regra de permitir baixa de pending.

**GAI-011, médio:** SQL e API do mesmo cenário mostram created_at e updated_at separados artificialmente por três horas, devido à combinação servidor UTC/driver local/default SQL. Datas civis não foram afetadas por esse mecanismo demonstrado; instantes de auditoria foram. Alinhar timezone e validar histórico antes de qualquer remediação.

## Caixa e DRE`);fs.writeFileSync(financialPath,financial);
fs.appendFileSync(path.join(__dirname,'testes.md'),`\n## Regressão financeira adicional descoberta na auditoria\n\nA bateria race-payments.cjs criou ${race.cases.length} pagamentos distintos exclusivamente no MySQL sintético e executou approve/mark-as-paid simultâneos. ${race.approved_after_successful_paid} casos tiveram regressão de paid para approved; inspect-payment-race.cjs confirmou SQL/auditorias e uma segunda baixa 200 sem estorno. Esses casos são reproduções de falha, não testes de aceite aprovados, e não foram somados às ${consolidated.declared_cases} definições da suíte existente. A amostra não estima incidência em produção. SQL e relógios também comprovam GAI-011.\n`);
const depRows=(name,d)=>d.installed.map(x=>`| ${name} | ${x.name} | ${x.version} | ${x.severity} | ${x.direct?'Direta no grafo consultado':'Transitiva'} | ${x.advisories.length?x.advisories.map(a=>'['+a.title+']('+a.url+')').join('; '):'Efeito herdado de dependência; ver JSON'} |`).join('\n');
write('dependencias-seguranca.md',`# Dependências e advisories atuais

Consulta de leitura realizada em 28/10/2026 com npm audit --omit=dev --json --package-lock-only, sem instalação, upgrade ou audit fix. A primeira tentativa restrita falhou no endpoint de advisories; a repetição autorizada retornou relatórios atuais. Evidências originais, normalizadas e resumo por versão: evidencias/npm-audit-*-normalized.json e dependencies-*.json. Exit code 1 reflete os alertas encontrados na consulta concluída.

Backend: ${depBack.metadata.vulnerabilities.total} entradas de pacotes/efeitos (${depBack.metadata.vulnerabilities.critical} critical, ${depBack.metadata.vulnerabilities.high} high, ${depBack.metadata.vulnerabilities.moderate} moderate, ${depBack.metadata.vulnerabilities.low} low). Frontend: ${depFront.metadata.vulnerabilities.total} entradas high. Não somar essas entradas como CVEs únicos: npm inclui efeitos herdados e múltiplos advisories por pacote. O grafo pode incluir peers opcionais/transitivos mesmo quando uma dependência está também em devDependencies. A imagem de release não foi construída nem varrida nesta auditoria; não se conclui que todos os pacotes da árvore estejam carregados ou exploráveis em produção.

| Árvore | Pacote | Versão no lock | Severidade npm | Relação | Advisories diretos |
| --- | --- | --- | --- | --- | --- |
${depRows('Backend',depBack)}
${depRows('Frontend',depFront)}

## Alcance e prioridade

As páginas dos advisories críticos de [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) e [node-tar](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) foram consultadas diretamente, assim como [SheetJS prototype pollution](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6). Isso confirma advisories e faixas reportadas, não exploração na aplicação.

XLSX.read é usado em parsers de importação contábil/física do backend, portanto a triagem de arquivos não confiáveis é prioritária (${b('inventory-accounting-items/application/services/accounting-import-parser.service.ts')}; ${b('import-sessions/application/services/physical-observation-import-parser.service.ts')}). Limites/autorizações reduzem exposição, mas não equivalem a parser corrigido. O relatório npm não oferece correção simples do pacote xlsx publicado nessa árvore; avaliar distribuição oficial/substituição e regressões sem atualização forçada.

Alertas de proxy-addr dependem da política de proxies confiáveis; main.ts não configura trust proxy explicitamente. Alertas de tar aparecem também via ferramentas/peer sqlite3; confirmar presença e uso na imagem. O frontend é SPA com createBrowserRouter; advisory de React Router RSC não comprova que essa aplicação execute RSC. Vários alertas Axios descrevem adaptadores Node/HTTP2, enquanto o navegador usa seu adapter; separar alcance por ambiente. Nenhuma demonstração ofensiva desses advisories foi executada contra usuários ou serviços externos.

**GAI-012 é ALTO como bloqueio de triagem/remediação de dependências, não um novo incidente crítico confirmado.** Aceite: SCA atual de lock e imagem, avaliação de alcance documentada, atualização segura dos componentes aplicáveis e regressão completa de upload/importação/HTTP. CI hoje usa npm audit ... || true; definir política explícita antes de produção. Não foi feita atualização de package.json, lockfiles ou node_modules pela auditoria.
`);
let tests=fs.readFileSync(path.join(__dirname,'testes.md'),'utf8');
tests=tests.replace('Sem varredura atual de advisories de dependências: lockfiles foram inventariados, mas relatório antigo de npm audit não é prova atual.','A varredura atual npm audit de produção foi concluída e encontrou 20 entradas backend e 5 frontend; exploração não foi verificada. Detalhes em dependencias-seguranca.md.');
tests+='\n## Dependências de produção\n\nConsulta npm audit atual sobre lockfiles concluída: 20 entradas backend (2 critical/13 high/3 moderate/2 low) e 5 high frontend. Não são contagens de CVEs únicos nem prova de alcance em produção. GAI-012 exige triagem; nenhuma atualização de dependência foi feita. Evidências: npm-audit-backend-normalized.json e npm-audit-frontend-normalized.json.\n';fs.writeFileSync(path.join(__dirname,'testes.md'),tests);
fs.appendFileSync(path.join(__dirname,'seguranca-rbac.md'),'\n## Dependências\n\nA consulta atual encontrou alertas de dependências, com alcance ainda em triagem (GAI-012). Ver [dependencias-seguranca.md](dependencias-seguranca.md). Ausência de vazamento nos testes RBAC não elimina risco dos componentes de parsing/HTTP.\n');
fs.appendFileSync(path.join(__dirname,'plano-correcoes.md'),'\n## Complemento obrigatório da Onda 1\n\nGAI-012: triagem/remediação dos advisories atuais, com análise do grafo efetivamente incluído na imagem de release. Aceite exige tratar critical/high aplicáveis ou documentar tecnicamente não alcance/mitigação antes de produção, sem confundir contagem npm de pacotes/efeitos com CVEs únicos.\n');
fs.appendFileSync(path.join(__dirname,'README.md'),'\nA varredura atual de dependências também requer atenção: [dependencias-seguranca.md](dependencias-seguranca.md) registra 20 entradas backend e 5 frontend reportadas pelo npm. São alertas sobre a árvore resolvida, com alcance ainda em triagem; não foram classificados como explorações confirmadas. GAI-012 integra a Onda 1.\n');
console.log(JSON.stringify({capabilities:counts,issues:issues.length,critical:criticalCount,playwright:pw?.stats}));
