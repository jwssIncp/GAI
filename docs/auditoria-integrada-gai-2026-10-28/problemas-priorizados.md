# Problemas priorizados

<!-- ONDA-1-STATUS -->
## Atualização da Onda 1 — 29/10/2026

Implementação e validação local concluídas; **produção não liberada**. [Relatório da Onda 1](../correcoes-onda-1-integridade-2026-10-28/README.md). GAI-002/003/004/008/009 corrigidas e validadas; GAI-011 corrigida para novas operações UTC, com histórico pendente de análise; GAI-012 parcialmente remediada (7 alertas backend e 1 frontend em --omit=dev). GAI-001/010 preservadas e revalidadas; GAI-005/006/007 continuam abertas.

Padrão 683/683, MySQL 307/307, S3 7/7, frontend 247/247, navegador 2/2; zero skips nas rodadas finais. Cobertura original e lint global aprovados. Não somar reexecuções. **O texto anterior abaixo é histórico preservado**, incluindo a atualização da Onda 0 e as reproduções originais.
<!-- /ONDA-1-STATUS -->


## Atualização após a Onda 0 financeira — 28/10/2026

**GAI-010 e GAI-001: corrigidos e validados localmente.** A correção e as evidências estão em [correcoes-onda-0-financeiro-2026-10-28](../correcoes-onda-0-financeiro-2026-10-28/README.md). Na execução final houve 124 pares concorrentes (109 com barreira InnoDB; 100 de stress), sem regressão de baixa; os resumos foram validados até 1.310 registros e com decimais grandes. Leitura com lock, validação, escrita e auditoria agora compartilham a transação. O GAI-001 foi antecipado para esta onda. Não houve migration ou reparo histórico.

As reproduções originais e os resultados abaixo são o **registro histórico anterior à correção** e foram preservados. Os demais achados continuam abertos. Os dois testes independentes de exportação genérica foram reexecutados e continuam falhos; produção e aceite integrado final permanecem não liberados. Consulte o relatório da Onda 0 para contagens atuais e limites.


São 12 ocorrências com evidência, separadas de riscos e pendências. O achado GAI-010 é crítico por corrupção reproduzida do estado de quitação e possibilidade de nova baixa; não se afirmou transferência bancária duplicada real. Código da aplicação não foi corrigido durante a auditoria.

## GAI-010 — CRÍTICO — Aprovação concorrente sobrescreve baixa de pagamento e permite nova baixa

- Natureza: Defeito confirmado por HTTP/MySQL.
- Local: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:564`; `gai-backend/src/modules/payments-expenses/infrastructure/persistence/typeorm-payments-expenses.repository.ts:71`.
- Evidência: Em 5 de 15 corridas, approve e mark-as-paid responderam 200, mas GET terminou approved com paid_at preenchido. Uma nova mark-as-paid foi aceita (200) sem estorno. SQL e logs de auditoria confirmam persistência; evidencias/payment-race.json.
- Reprodução: Criar pagamento pending sintético; disparar POST approve e POST mark-as-paid simultaneamente por Promise.all; consultar GET; repetir em pagamentos independentes. Selecionar caso cuja baixa respondeu paid mas estado final é approved; repetir baixa.
- Impacto: Registro de quitação perde seu estado final; caixa pode recolocar pagamento no previsto e operador pode pagar novamente. Corrupção de estado foi demonstrada; transferência bancária/perda monetária real não foi executada.
- Correção recomendada: Ler, revalidar estado e projeto e gravar dentro da mesma transação com lock ou comparação atômica de versão/estado. Proteger todas as transições concorrentes e definir idempotência de baixa sem mudar silenciosamente a permissão de baixar pendente.
- Testes/aceite: HTTP MySQL concorrente approve×paid, edit×paid e cancel×paid; quando baixa retorna sucesso, estado não pode regredir. Segunda baixa exige negativa/idempotência sem novo efeito. Auditoria deve refletir uma sequência serializável.
- Onda: 0.

## GAI-001 — ALTO — Resumo financeiro soma apenas os primeiros 100 pagamentos

- Natureza: Defeito confirmado por HTTP.
- Local: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:220`.
- Evidência: 101 pagamentos de 1.00 → total_count=101 e total_pending=100.00. evidencias/finance-reproduction.json.
- Reprodução: Criar 101 pagamentos de 1.00 no projeto sintético; GET /projects/:id/payments/summary.
- Impacto: Cards financeiros subestimam valores; quantidade e total divergem e podem induzir decisões incorretas.
- Correção recomendada: Agregação SQL exata por estado/escopo, independente de paginação, usando DECIMAL/centavos.
- Testes/aceite: 0, 1, 100, 101 e múltiplas páginas; todos os estados; comparar soma exata de detalhes com summary e dashboard.
- Onda: 1.

## GAI-002 — MÉDIO — Datas civis impossíveis são normalizadas silenciosamente

- Natureza: Defeito confirmado por HTTP.
- Local: `gai-backend/src/modules/payments-expenses/application/services/payments-expenses-scope.service.ts:44`.
- Evidência: expense_date=2026-02-30 recebe 201 e persiste 2026-03-02. evidencias/finance-reproduction.json.
- Reprodução: POST /projects/:id/expenses com amount=1.00 e expense_date=2026-02-30.
- Impacto: Despesa entra em mês diferente, alterando filtros, prestação e competência informada.
- Correção recomendada: Validação civil estrita com formato/limites/round-trip, erro 400 e nenhuma gravação. Não reprocessar histórico automaticamente.
- Testes/aceite: Fevereiro bissexto/não bissexto, 30/31 em meses curtos, datas fora de faixa, pagamento e despesa, ausência de efeitos em erro.
- Onda: 1.

## GAI-011 — MÉDIO — Timestamps da aplicação e do MySQL ficam três horas divergentes

- Natureza: Inconsistência confirmada no ambiente MySQL auditado.
- Local: `gai-backend/src/app.module.ts:123`; `gai-backend/data-source.ts:1`; `gai-backend/src/modules/payments-expenses/infrastructure/persistence/field-agent-payment.entity.ts:8`.
- Evidência: Caso sintético: created_at SQL 18:35:21 e updated_at SQL 21:35:21 na mesma operação; API retorna created_at 21:35Z e updated_at 00:35Z do dia seguinte. MySQL NOW=UTC_TIMESTAMP; host São Paulo e driver sem timezone explícito. payment-race.json contém SQL e relógios.
- Reprodução: No host America/Sao_Paulo e MySQL UTC, criar e alterar pagamento; comparar instantes da API com NOW/UTC_TIMESTAMP e DATETIME bruto.
- Impacto: Trilha temporal pode parecer futura/fora de ordem, com risco de recortes e investigação incorretos. Não foi demonstrada alteração de DATE civil por esse mecanismo.
- Correção recomendada: Definir contrato UTC consistente entre driver, sessão MySQL e defaults; preservar semântica das datas civis. Planejar qualquer normalização de histórico separadamente.
- Testes/aceite: Criar/atualizar e ler nas combinações TZ=UTC/São Paulo e servidor UTC; igualdade de instante em milissegundos e datas civis invariantes.
- Onda: 1.

## GAI-003 — ALTO — Comando backend completo padrão não passa com as suítes atuais

- Natureza: Falha confirmada de qualidade/runner.
- Local: `gai-backend/package.json:98`; `gai-backend/test/integration/test-app.helper.ts:117`.
- Evidência: Runner padrão: 76 falhas, 638 pass e 7 skips; serviços MySQL executados no helper SQLite causam REPEATABLE READ/NOW incompatíveis. Reexecução MySQL deixa somente duas expectativas desatualizadas.
- Reprodução: node node_modules/jest/bin/jest.js --runInBand no backend, sem GAI_TEST_MYSQL_DISPOSABLE=1.
- Impacto: CI/teste local não representa corretamente os contratos e bloqueia um gate confiável de release.
- Correção recomendada: Separar explicitamente suites unitárias/SQLite das suites MySQL e provisionar alvo descartável nos checks; não mascarar erros com skip indiscriminado.
- Testes/aceite: Comandos documentados e CI com todos os casos pertinentes executados no motor correto, sem usar DB_* real e sem testes omitidos silenciosamente.
- Onda: 1.

## GAI-004 — MÉDIO — Dois testes de exportação genérica contradizem o novo contrato financeiro

- Natureza: Expectativa de teste desatualizada confirmada.
- Local: `gai-backend/test/integration/technical-validation/security-storage.e2e-spec.ts:588`; `gai-backend/src/modules/export-jobs/application/services/export-jobs.service.ts:72`.
- Evidência: finance_xlsx e dre_xlsx retornam 409 por desenho no endpoint genérico; suite exige 403/201 para todos os tipos. As rotas especializadas possuem testes positivos e negativos próprios.
- Reprodução: Executar security-storage.e2e-spec.ts em MySQL e conferir os dois casos parametrizados.
- Impacto: Regressão global vermelha sem comprovar falha de autorização; testes deixam de expressar contrato vigente.
- Correção recomendada: Testar negativa 409 do endpoint genérico e permissões/filtros/download nas rotas financeiras específicas, preservando testes negativos de conteúdo.
- Testes/aceite: Suite inteira verde após revisão de contrato, sem enfraquecer assertivas de fonte e revogação.
- Onda: 1.

## GAI-005 — MÉDIO — Layouts e links globais descartam o contexto do projeto

- Natureza: Defeito de navegação confirmado no código e caracterizado em navegador.
- Local: `gai-frontend/src/features/budgets/BudgetLayout.tsx:19`; `gai-frontend/src/features/receivables/ReceivablesPage.tsx:55`.
- Evidência: Aba Orçamentos abre com project_id; clicar Orçamentos no sublayout remove o filtro. Lista→detalhe de recebível também não transporta query. Testes zz-navigation registram lostContext no desktop/mobile.
- Reprodução: Abrir projeto → Orçamentos; confirmar project_id na URL; clicar Orçamentos no menu interno; conferir query removida e ausência das abas do projeto.
- Impacto: ORG_ADMIN pode perder filtro/retorno ao navegar módulos relacionados; amplia lista fora do contexto esperado, ainda dentro da própria organização.
- Correção recomendada: Propagar escopo de navegação e oferecer retorno ao projeto nos layouts/detalhes, com links estáveis após refresh e histórico.
- Testes/aceite: Navegação ponta a ponta projeto→orçamento/parâmetros/detalhe e projeto→recebível/detalhe/caixa/DRE; back/forward, refresh e mobile sem perda do project_id.
- Onda: 3.

## GAI-006 — ALTO — Extração documental bloqueia famílias com mais de 1.000 registros

- Natureza: Limitação funcional confirmada por código.
- Local: `gai-backend/src/modules/technical-reports/report.sources.ts:109`.
- Evidência: Scoped take(1001) rejeita fonte >1.000; seleção não oferece lista arbitrária de itens e algumas seleções ocorrem depois da carga limitada. Não há truncamento silencioso.
- Reprodução: Em projeto sintético com 1.001 itens ou histórico de avaliações acima do teto, capturar família correspondente no laudo.
- Impacto: Projetos patrimoniais maiores podem não emitir documento completo; capacidade não pode ser homologada em escala real apenas com 60/180 linhas.
- Correção recomendada: Decidir recorte documental explícito ou extração paginada com snapshot consistente e limites claros de memória/páginas. Não remover limite sem estratégia.
- Testes/aceite: 1.000/1.001 e volume representativo de produção, inclusive múltiplas avaliações históricas; conteúdo integral, estabilidade de hash, autorização e limite de render.
- Onda: 2.

## GAI-007 — ALTO — Terraform ECS não habilita o modo exigido para documentos em produção

- Natureza: Inconsistência de configuração declarada confirmada.
- Local: `gai-backend/src/modules/documents/documents.service.ts:176`; `infra/terraform/ecs.tf:1`.
- Evidência: Serviço em NODE_ENV=production exige DOCUMENT_STORAGE=database; task definition em fonte não define a variável. Não foi inspecionada uma task AWS efetiva.
- Reprodução: Aplicar em ambiente de teste a mesma configuração declarada, com NODE_ENV=production sem DOCUMENT_STORAGE, e solicitar geração autorizada: gate responde 503.
- Impacto: Caminho declarativo de release deixa geração documental indisponível. Não significa que todos os endpoints ou um ambiente AWS existente tenham sido testados.
- Correção recomendada: Decidir e configurar armazenamento documental, retenção/backup/capacidade e variável correspondente; homologar antes de liberar, mantendo fail-closed.
- Testes/aceite: Boot/config de produção isolados e fluxo autorizado de gerar/baixar; configuração ausente permanece negativa segura; teste de retenção e recuperação.
- Onda: 5.

## GAI-008 — MÉDIO — Lint global backend tem 83 erros e CI não cobre a homologação real

- Natureza: Falha confirmada de gate de qualidade.
- Local: `.github/workflows/ci.yml:1`; `gai-backend/package.json:15`.
- Evidência: 82 prettier/prettier + 1 no-control-regex em quatro arquivos; frontend tem um aviso. CI chama --fix, audit ||true e não executa Playwright/MySQL/S3 reais.
- Reprodução: ESLint global sem --fix e leitura do workflow de CI.
- Impacto: Pipeline não está integralmente verde e pode alterar working tree ao verificar; ausência de gates reais reduz proteção de regressão.
- Correção recomendada: Resolver dívida sem misturar com mudança de negócio, separar lint de formatação automática e declarar suites reais isoladas. Definir política de advisories atualizada.
- Testes/aceite: Lint sem mutação com exit 0 e checks de integração executados por pipeline, sem adicionar duplicação de contagem.
- Onda: 4.

## GAI-009 — MÉDIO — SchemaBuilder não compara schema por falta de typeorm_metadata

- Natureza: Falha confirmada de introspecção TypeORM.
- Local: `gai-backend/src/migrations/1740800000001-protect-active-field-agent-assignments.ts:1`; `gai-backend/data-source.ts:1`.
- Evidência: QueryRunner.getTables/SchemaBuilder.log geram ER_NO_SUCH_TABLE para typeorm_metadata/GENERATED_COLUMN active_assignment_key; consulta raw confirmou schema de aplicação e 32 migrations. schema.json preserva erro.
- Reprodução: Aplicar migrations em schema novo e chamar getTables ou SchemaBuilder.log com metadata atual.
- Impacto: Geração/comparação automática de migration pode falhar; não comprova corrupção das tabelas nem impede as consultas normais que passaram.
- Correção recomendada: Alinhar estratégia de colunas geradas/metadata com TypeORM por migration revisada ou ferramenta de diff explicitamente compatível; não usar synchronize em base real.
- Testes/aceite: Base nova + introspecção e diff sem erro; coluna gerada e unicidade de vínculo ativo preservadas; upgrade em cópia histórica.
- Onda: 4.

## GAI-012 — ALTO — Dependências de produção e transitivas têm alertas atuais de segurança

- Natureza: Advisories confirmados no lockfile; exploração no GAI não confirmada.
- Local: `gai-backend/package-lock.json:1`; `gai-frontend/package-lock.json:1`; `.github/workflows/ci.yml:1`.
- Evidência: npm audit --omit=dev --package-lock-only retornou 20 entradas backend (2 critical, 13 high, 3 moderate, 2 low) e 5 frontend high. Contagens são pacotes/efeitos na árvore do npm, não vulnerabilidades independentes ou explorações confirmadas. JSON normalizado preservado; detalhes em dependencias-seguranca.md.
- Reprodução: Executar npm audit de leitura sobre os dois lockfiles; comparar versões e alcance de cada advisory, depois inspecionar a imagem de release e caminhos efetivamente usados.
- Impacto: Risco conhecido em componentes de parsing/HTTP; não se comprovou exploração, vazamento ou execução remota no GAI. Alguns alertas dependem de adaptadores Node/RSC/build/peers opcionais e podem não ser alcançáveis pelo SPA/produção.
- Correção recomendada: Triar alcance, atualizar/substituir dependências de forma revisada e testar regressões; não executar audit fix --force nem declarar aplicação vulnerável a todos os advisories sem avaliar uso. CI deve tratar alertas conforme política explícita.
- Testes/aceite: SCA atual sobre lock e imagem real; importação XLSX/HTTP/upload regressivas; justificar alertas não alcançáveis e remover bloqueios critical/high aplicáveis antes de produção.
- Onda: 1.


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
