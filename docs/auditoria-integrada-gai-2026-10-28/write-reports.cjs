const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'evidencias');
const read=(name,fallback=null)=>fs.existsSync(path.join(out,name))?JSON.parse(fs.readFileSync(path.join(out,name),'utf8')):fallback;
const inv=read('inventory.json'),rbac=read('rbac-runtime.json'),caps=read('capabilities.json'),dup=read('duplicates.json',[]);
const write=(name,s)=>fs.writeFileSync(path.join(__dirname,name),s.trim()+'\n');
const ref=(file,needle='')=>{const p=path.join(root,file);if(!fs.existsSync(p))throw Error('Missing reference '+file);const s=fs.readFileSync(p,'utf8'),i=needle?s.indexOf(needle):0;return '`'+file+':'+(i<0?1:s.slice(0,i).split('\n').length)+'`';};
const b=(file,needle)=>ref('gai-backend/src/modules/'+file,needle),f=(file,needle)=>ref('gai-frontend/src/'+file,needle);
const related=(term)=>inv.tests.filter(t=>t.file.startsWith('gai-backend/test/')&&t.file.includes(term)).map(t=>'`'+t.file+'`').join('; ');
const table=(heads,rows)=>'| '+heads.join(' | ')+' |\n| '+heads.map(()=>'---').join(' | ')+' |\n'+rows.map(r=>'| '+r.map(v=>String(v??'').replaceAll('|','\\|').replaceAll('\n',' ')).join(' | ')+' |').join('\n');
const modules=fs.readdirSync(path.join(root,'gai-backend/src/modules'));
const classes=(mod,kind)=>inv.classes.filter(x=>x.file.startsWith('gai-backend/src/modules/'+mod+'/')&&x.kind===kind);
const inventoryRows=modules.map(mod=>[mod,classes(mod,'module').map(c=>c.name).join(', '),classes(mod,'controller').map(c=>c.name).join(', '),classes(mod,'service').map(c=>c.name).join(', ')||'Use cases/serviços no inventário detalhado',classes(mod,'entity').length,rbac.routes.filter(r=>r.file.startsWith('gai-backend/src/modules/'+mod+'/')).length]);
write('inventario-atual.md',`# Inventário e arquitetura atuais

Inventário realizado antes de qualquer alteração de implementação. Foram lidos ${inv.manifest.length} arquivos textuais nos diretórios de backend, frontend, documentação, infraestrutura, scripts e CI, com manifesto SHA-256 em [evidencias/inventory.json](evidencias/inventory.json). Esse manifesto é um censo; a revisão humana foi dirigida aos contratos, políticas, persistência, interfaces e cenários críticos descritos nos demais relatórios. Não significa prova formal de todos os caminhos de cada linha. Nenhum AGENTS.md foi localizado pelo inventário inicial.

## Composição

NestJS 11, TypeScript 5.7, TypeORM 0.3 e mysql2 no backend; React 19, React Router 7, React Query 5, Axios, React Hook Form/Zod, Tailwind e Vite 6 no frontend. Jest/ts-jest, Supertest, Vitest/Testing Library e Playwright compõem os testes. Versões declaradas e dependências completas estão em inventory.json, deps. Os números instalados vêm dos lockfiles; não foi feita atualização nem instalação de dependências nesta auditoria. Node observado: 24.18.0.

São 26 diretórios de módulos, 38 classes de controller, 312 endpoints Nest extraídos por reflexão, 161 permissões de seed e 32 migrations. O censo textual identifica 45 classes em arquivos de serviço e 106 classes em arquivos que contêm entidades; estas últimas incluem bases auxiliares e não são contagem de tabelas. A contagem física e as entidades TypeORM efetivas estão em banco-migrations.md. Também há casos de uso individuais, repositories, DTOs, políticas e ports, listados no manifesto.

${table(['Módulo','Módulos Nest','Controllers','Serviços','Classes em arquivos de entidade','Endpoints'],inventoryRows)}

## Organização arquitetural

Os módulos originais separam presentation, application, domain e infrastructure, com ports e repositories. Os incrementos recentes usam arquivos mais planos, serviços transacionais e políticas puras. Não há evidência de dependência Nest circular que impeça os testes inicializarem. A heterogeneidade aumenta o custo de manutenção, mas não prova incompatibilidade funcional.

O AppModule registra explicitamente entidades e módulos (${ref('gai-backend/src/app.module.ts','@Module')}); o helper de testes mantém uma lista paralela (${ref('gai-backend/test/integration/test-app.helper.ts','export async function createTestApp')}). Essa duplicação exige controle de deriva. O data-source de CLI usa glob de entidades e migrations e synchronize=false; o helper usa SQLite/synchronize ou MySQL/migrations conforme opt-in. Portanto, uma suíte SQLite não certifica o schema MySQL.

Frontend: router.tsx controla navegação global; projectRoutes.tsx agrupa recursos do projeto sob ProjectLayout. Há layouts separados de orçamento/finanças/DRE, com contexto via query string. Inventário completo de componentes e testes: inventory.json → manifest/tests. Rotas, ações e permissões: [rotas-permissoes.md](rotas-permissoes.md). São registros dos decorators efetivos, inclusive aliases de autorização; não inferências pelo nome do botão.

## Duplicações e partes incompletas

${dup.map((g,i)=>`${i+1}. Corpos equivalentes: ${g.map(x=>ref(x.file,x.name)).join('; ')}. Normalização remove apenas espaços; achado estático, sem recomendação de unir domínios indiscriminadamente.`).join('\n')}

Fora dessas duplicações exatas, validadores de data, escopo, erros e versões se repetem com diferenças de semântica. A data civil de despesas diverge da validação estrita de orçamentos/avaliações e gerou defeito reproduzível (GAI-002).

Existem placeholders globais para catálogo, itens, imagens, base contábil, pendências, pagamentos, despesas, importações, exportações, perfil e configurações, além de projects/:id/area (${f('router/router.tsx','catalog-assets')}; ${f('router/projectRoutes.tsx','path: "area"')}). Os fluxos de projeto correspondentes em geral são reais; um placeholder global não deve ser contado como módulo funcional adicional. Catálogo possui backend CRUD, mas a rota global é placeholder. Não há prova de que todo endpoint tenha uso por interface; endpoints administrativos/API-only não são automaticamente código morto.

## Integrações e infraestrutura

S3 via AWS SDK/SigV4; SES como adapter de e-mail; MySQL/RDS; ECS/Fargate/ECR/ALB; frontend em S3/CloudFront; Terraform e GitHub Actions. Configuração é evidência declarativa, não comprovação de deployment. Artefatos documentais PDF/DOCX usam bytes privados no banco, não S3. Não há CRM, atividades/jornada ou cursos nos módulos registrados. Não foram criados novos módulos.

Relatórios anteriores foram lidos como contexto, com cópia textual em evidencias/reports-read.txt. Afirmações antigas como bypass de chave desconhecida, falta de verificação de upload e calendário com overflow foram confrontadas com código/testes atuais; não foram repetidas como falhas atuais sem nova prova.
`);
write('rotas-permissoes.md',`# Catálogo efetivo de rotas e permissões

Extração por reflexão Nest em inspect-runtime.cjs; 312 endpoints, 161 permissões de seed, zero chaves de rota ausentes no seed. As permissões de fonte exigidas dentro dos serviços também devem ser consideradas; ver seguranca-rbac.md. Rotas públicas são health/login/reset; me/logout exigem sessão. Organizations usa SessionAuthGuard + RolesGuard/PLATFORM_ADMIN, sem decorator de permissão por chave. Guards e permissões são os metadados atuais, não uma certificação de toda lógica interna.

${table(['Método','Rota /api/v1','Permissões efetivas no decorator','Guards','Controller e método'],rbac.routes.map(r=>[r.verb,r.path,r.permissions.join(', ')||'Sessão/papel ou público conforme guards',r.guards.join(', '),r.controller+'.'+r.method]))}

## Catálogo

${table(['Chave','Escopo','Descrição'],rbac.catalog.map(p=>[p.key,p.scope,p.description||p.name||'']))}
`);
write('integracoes.md',`# Integrações entre módulos

As verificações abaixo combinam código atual e testes reais Nest/HTTP. A execução e as limitações de cada ambiente estão em testes.md. Relacionamento existente não implica propagação automática de estado ou valores.

${table(['Integração','Evidência atual','Contrato e limites'],[
 ['Empresas → projetos',b('projects/application/services/project-scope.service.ts')+'; '+b('companies/application/services/companies.service.ts'),'Escopo organizacional e vínculos de empresa/unidade. Projetos antigos sem empresa são preservados; relações inválidas são rejeitadas pelos serviços.'],
 ['Projetos → contratos',b('contracts/contract.service.ts','private async project'),'Contrato consultado com projectId/organizationId; escrita revalida lifecycle e gera revisão imutável. Projeto sem contrato continua válido.'],
 ['Contratos ↔ orçamentos',b('budgets/budget.service.ts','async proposal'),'Sem conversão persistida automática. Preview retorna creates_contract/creates_project/creates_receivables=false. Não existe vínculo financeiro deduzido só por empresa/projeto.'],
 ['Projetos → Kick-off',b('project-preparation/preparation.service.ts'),'Instâncias kickoff/client-checklist independentes; snapshot de modelo, IDs estáveis, respostas auditadas e contexto de unidades.'],
 ['Projetos → campo',b('field-coordination/field.service.ts'),'Checklist por projeto, modelos publicados e revisões. Concluir campo não conclui o projeto automaticamente.'],
 ['Inventariantes → tarefas',b('field-coordination/field.service.ts'),'Diferencia usuário organizacional de técnico vinculado; não resolve por nome. Responsável deve pertencer ao escopo e ser elegível.'],
 ['Inventário → pendências',b('inventory-pending-issues/application/services/inventory-pending-issues.service.ts'),'Pendência por item; geração/resolução preserva histórico. Resolver pendência não altera tarefa ou observação sem ação explícita.'],
 ['Inventário → conciliação',b('inventory-operations/application/inventory-operations.service.ts'),'Usa últimas observações e placa normalizada; não altera placa mestre nem histórico de rodadas.'],
 ['Conciliação → consolidação',b('assisted-reconciliation/assisted.service.ts'),'Aceite explícito e idempotente; claims/locks evitam pareamentos concorrentes. Fontes novas/alteradas obsoletam execução anterior; decisão consolidada não é sobrescrita.'],
 ['Avaliações → laudos',b('technical-reports/report.sources.ts','valuation.used_total'),'Snapshot de avaliações selecionadas, data e desempate por ID. Moeda não informada impede total confiável; nova avaliação altera hash de fonte e validação.'],
 ['Contratos → recebíveis',b('receivables/receivable.service.ts','Original principal'),'Geração explícita uma vez por origem. Principal original e aditivo positivo são origens separadas. Alterar contrato não regrava recebível já criado; aditivo negativo exige decisão de ajuste.'],
 ['Recebíveis → caixa',b('receivables/cash-flow.service.ts'),'Saldo aberto no previsto, eventos assinados no realizado; estorno negativo na data efetiva. Sem duplicar o principal no realizado.'],
 ['Despesas → caixa',b('receivables/cash-flow.service.ts','const limitations'),'Soma despesa original ou parcelas previstas elegíveis, sem somar prestação novamente; baixa integral remove previsto. Saídas sem moeda ficam em UNSPECIFIED.'],
 ['Classificações → DRE',b('managerial-dre/dre.service.ts'),'Reconhecimento explícito por competência, rateios e fonte única; recebimento/estorno de caixa não cria nova receita de competência automaticamente. Fechamento é versionado.'],
 ['Laudos → documentos',b('documents/documents.service.ts','private async source'),'Somente versão aprovada para laudo; autorizações de documento e fontes revalidadas na geração e no download. Hash de snapshot e identidade visual no cache.']
])}

## IDs, datas, valores e estados

Os incrementos usam organização + pai + filho, revisões esperadas, comandos com chave/hash e transações. Diversos fluxos MySQL serializam pela organização e usam locks antes da leitura consistente; isso reduz concorrência dentro do tenant, com possível custo de throughput ainda não medido. Os componentes financeiros novos usam inteiros escalados/BigInt e strings decimais; pagamentos antigos usam Number/toFixed. Há reprodução de total truncado e data inválida em pagamentos/despesas; ver GAI-001/002.

Não confundir created_at do projeto, contracted_on do contrato, competência DRE, vencimento e data efetiva. Campo calcula dia em America/Sao_Paulo; atraso financeiro compara dia UTC, explicitado no contrato atual. A decisão de calendário financeiro local deve ser formalizada; não foi demonstrado deslocamento por timezone de uma parcela civil persistida nos novos módulos.

## Cache e persistência de contexto

ProjectPreparation invalida chaves do projeto; FieldCoordination invalida fieldKeys; lote de avaliação invalida histórico/asset-valuations/itens/export jobs; conciliação assistida invalida registros relacionados; documentos usam cache por hash de fonte/visual/formato/opção de memória. O cache de documento aprovado deve continuar disponível como histórico mesmo após mudança do mestre, respeitadas permissões atuais.

A invalidação entre todos os módulos não é centralizada. Por exemplo, uma nova avaliação não invalida explicitamente a consulta já montada de validação do laudo em outra aba; o backend revalida antes da aprovação, mas a atualização visual imediata entre abas não está certificada. Recebíveis usam chaves finance, DRE usa dre; não se deve exigir que uma baixa gere reconhecimento de competência. Invalidação e atualização de indicadores após cada mutação transversal permanecem critérios de homologação, sem falha universal presumida.

Não há integração bancária, faturamento fiscal, envio automático de mensagens, conversão orçamento→contrato ou criação automática de recebíveis na aprovação. Essas ausências foram preservadas; não foram inventadas integrações durante a auditoria.
`);
write('seguranca-rbac.md',`# Segurança e autorização

O catálogo atual contém 161 permissões; os 312 endpoints foram inspecionados por metadados Nest. Não foi encontrada chave exigida em decorator que esteja ausente no seed. Isso não certifica sincronização do catálogo de produção; o seed e o banco do ambiente precisam coincidir. O catálogo e cada método/rota estão em rotas-permissoes.md e evidencias/rbac-runtime.json.

## Política efetiva

${table(['Perfil','Comportamento verificado no código'],[
 ['PLATFORM_ADMIN','Pode atravessar organizações nos serviços de escopo; bypass de permissão ocorre somente após validar existência e escopo de todas as chaves. Continua sujeito a IDs pai/filho, lifecycle e conteúdo. OrganizationOverview exige especificamente ORG_ADMIN com organizationId e não é dashboard de plataforma.'],
 ['ORG_ADMIN','Bypass somente de chaves cadastradas com escopo ORGANIZATION; limitado à organização do usuário. Não ganha permissão de plataforma e não autoriza chave inexistente.'],
 ['ORG_USER / perfis personalizados','Exige cada permissão efetiva com escopo correto. Ter projects:read não concede finanças, documentos, aprovação ou exportação. Permissões de fontes são adicionais quando necessário.'],
 ['Sem sessão / sessão revogada','Rotas protegidas usam SessionAuthGuard. Login e reset são públicos por contrato; logout/me requerem sessão. Desativação e revogação invalidam autorização efetiva.']
])}

Evidências centrais: ${b('auth/application/services/permission-access.ts','export async function hasAllPermissions')}; ${b('auth/presentation/guards/permissions.guard.ts')}; ${b('projects/application/services/project-scope.service.ts')}; ${b('organizations/presentation/organizations.controller.ts','@Roles')}. Testes: ${related('auth/')}; ${related('permissions-negative')}. Nenhum vazamento crítico foi confirmado nas verificações executadas; isso não substitui pentest.

## Operações e fontes

Leitura/criação/edição/aprovação/conclusão/export/download possuem chaves separadas nos novos módulos. ORG_ADMIN é administrador da própria organização, portanto não implementa segregação entre aprovador e criador. Pagamento pode ser baixado de pending ou approved por regra explícita de domínio; exigir aprovação prévia ou outro ator é decisão de negócio, não correção implícita nesta auditoria.

Resumo financeiro exige payments:read e expenses:read; overview comercial verifica contracts:read e permissões de fontes operacionais; caixa exige as fontes conforme direção; DRE protege leitura de fontes e exportação; laudos exigem permissões de cada família capturada. ${b('technical-reports/report.sources.ts','SOURCE_PERMISSIONS')}; ${b('receivables/cash-flow.service.ts','const required')}; ${b('export-jobs/domain/export-content-permissions.ts')}.

Downloads de export jobs repetem permissões de conteúdo e expiração. Documentos repetem autorização de versão/fonte, organização e pai, inclusive memória de cálculo interna; aplicam private,no-store e nosniff. URLs S3 são capacidades temporárias: revogar a permissão impede emitir nova URL, mas uma URL já assinada continua válida até seu TTL; o objeto é vinculado à versão verificada. Não foi prometida revogação retroativa de URL S3 emitida.

## Negativas HTTP e limites

As suítes reais cobrem sessão ausente, usuário sem grants, catálogo removido, organização estrangeira, IDs pai/filho substituídos, fontes revogadas, exportações e documentos privados. Consultar testes.md para resultados por motor. Os dois testes de exportação que continuam falhando esperam 403 no endpoint genérico, mas recebem 409 porque finance_xlsx/dre_xlsx exigem endpoint especializado com filtros; não houve retorno de dados financeiros nessas respostas.

Storage real local: PUT/HEAD/GET, checksum, MIME, substituição/versionamento e expiração foram exercitados no MinIO exclusivo. Isso não comprova IAM/CORS/criptografia/AWS efetivos. Testes de storage de várias suítes HTTP usam FakeStorage, explicitamente separado da integração S3 real.

Não houve inspeção de sessões/dados reais, varredura ofensiva externa, auditoria de secrets em contas, teste de carga, nem prova de todos os estados de concorrência. Configurações .env não foram copiadas para os relatórios. Nenhum e-mail/mensagem externa foi enviado.
`);
write('auditoria-financeira.md',`# Auditoria financeira

## Conclusão

Há fluxo persistido de contratos/aditivos, orçamentos, recebíveis, eventos de caixa e DRE gerencial, com separação explícita entre competência e liquidação. Foi confirmada corrupção de estado financeiro em corrida entre aprovação e baixa de pagamento (GAI-010 crítico), além de resumo limitado aos primeiros 100 registros, aceitação de datas civis inexistentes e timestamps MySQL incoerentes no ambiente auditado. Não foram corrigidos nem foram alterados dados reais/históricos.

## Valores e arredondamento

Contratos usam cents/money com BigInt; orçamento, recebíveis, caixa e DRE usam decimal/scaled com inteiros escalados. Parcelas distribuem residual de centavos e preservam o total. Orçamento exige soma de impostos+comissão+margem inferior a 100%, piso e parâmetros publicados, sem criar despesa de forma automática. ${b('contracts/contract.policy.ts','export function cents')}; ${b('budgets/budget.policy.ts','export function paymentPlan')}; ${b('receivables/receivable.policy.ts','export function balance')}; ${b('managerial-dre/dre.policy.ts')}.

Pagamentos antigos recalculam com Number e toFixed, e summaries também acumulam Number (${b('payments-expenses/domain/entities/field-agent-payment.ts','private recalculate')}). Não foi reproduzido erro de centavo dentro dos limites monetários persistíveis nesta auditoria; isso é risco técnico, não perda financeira confirmada. Validar limites de daily_total/final_amount no domínio e agregados grandes antes de migrar cálculos. DECIMAL(15,2) é o contrato SQL monetário predominante, enquanto partes comerciais armazenam strings dentro de snapshots JSON.

## Parcelas, contratos e recebíveis

Fim do mês usa política monthlyDueDate, com clamp civil e centavos preservados; parcelas existentes não são recalculadas. Contratos têm principal original e aditivos versionados; recebível vincula origem e hash de snapshot, com deduplicação inclusive após cancelamento. Geração é explícita e requer confirmação da prévia. Aditivo negativo não gera recebível negativo automaticamente. Orçamento e contrato são origens distintas; sem vínculo comercial, o sistema não consegue deduzir que representam o mesmo fato econômico. Exige conferência operacional para não gerar ambos indevidamente; não foi classificado como duplicação automática confirmada.

Baixa parcial reduz saldo aberto e registra evento; estorno referencia recebimento anterior, é negativo na data efetiva e não apaga histórico. Cancelar exige estornar recebimentos. Chaves de comando com conteúdo/autor divergente e revisão antiga são rejeitadas. Testes de concorrência e rollback estão na suíte MySQL de receivables. ${b('receivables/receivable.service.ts','async orgLock')}; ${related('receivables/')}.

## Despesas, pagamentos e prestação

Despesas têm aprovação/rejeição/baixa/cancelamento e comprovantes; pagamentos têm componentes e vínculo ao técnico. Prestação agrupa despesas, não cria novo desembolso. Caixa usa despesa original e parcelas previstas até a baixa integral; não duplica a prestação. Não há baixa individual de parcela de despesa, livro de adiantamentos ou fluxo específico de solicitar/receber reembolso do cliente. Total de prestação fechada e vínculos são preservados pelo serviço; backfill ou reinterpretação de pagamentos antigos não foi executado.

**GAI-001, alto:** criar 101 pagamentos distintos de 1.00 e consultar GET /projects/:id/payments/summary retorna total_count=101 e total_pending=100.00. Causa: pageSize:100 e soma somente all.items (${b('payments-expenses/application/services/payments-expenses.service.ts','async paymentSummary')}). Prova em evidencias/finance-reproduction.json; não é erro de arredondamento.

**GAI-002, médio:** POST de despesa com expense_date=2026-02-30 retorna 201 e expense_date=2026-03-02. parseDate valida formato e NaN, mas não compara a data serializada com a entrada (${b('payments-expenses/application/services/payments-expenses-scope.service.ts','parseDate')}). Afeta competência/filtros e período de prestação. Prova HTTP preservada no mesmo JSON.

## Caixa e DRE

Caixa separa expected/actual e moeda. Saídas antigas sem moeda ficam em UNSPECIFIED, sem compensação com BRL/USD/EUR; isso evita inventar saldo, mas impede um resultado financeiro consolidado da organização. Despesas sem vencimento e pagamentos aprovados sem data são informados como cobertura incompleta. O resultado não representa saldo bancário. A tabela de movimentos mostra os primeiros 200 com aviso/refino/exportação, sem alteração do total calculado no servidor.

DRE reconhece fontes explicitamente por competência e conta/rateio, preserva versões e fechamento/reabertura com motivo. Baixa/estorno de caixa não gera novo reconhecimento; prestação e proposta comercial não são fatos econômicos inferidos. Classificações incompletas e fontes alteradas são sinalizadas; não declarar lucro definitivo com cobertura incompleta. Histórico de contas é preservado em versões. Não há DRE contábil oficial, cálculo tributário normativo ou integração bancária homologada.

Campos civis novos são strings DATE e eventos usam instantes DATETIME. Campo adota São Paulo, enquanto atraso de recebível/caixa usa dia UTC. Definir política financeira de fuso é pendência de negócio; não alterar datas antigas sem plano. Testes específicos de grandes valores, fim de mês, parcial/estorno, moedas e cobertura estão referidos em testes.md e na matriz funcional.
`);
write('auditoria-patrimonial.md',`# Auditoria patrimonial

O desenho separa cadastro mestre, observação de campo, rodadas, conciliação, consolidação e avaliações. Os testes de regressão exercitam persistência e preservação dessas fontes; não foi feita reescrita de mestre/histórico nesta auditoria.

${table(['Objeto','Verificação e evidência'],[
 ['Itens e placas',b('inventory-operations/application/inventory-operations.service.ts')+'; importações/observações não substituem a placa mestre. Histórico de placas, rodadas e linhagem de reinventário são entidades próprias.'],
 ['Sessões e rodadas','Retomada após refresh, cancelamento, rodadas de reinventário e bloqueios de lifecycle têm casos HTTP. '+related('inventory-operations/')],
 ['Pendências','Escopo projeto/item, resolução e geração são persistidos. Tarefa pode exigir pendência resolvida; resolver uma não sincroniza a outra.'],
 ['Conciliação básica','Placa normalizada e última observação; envelope versionado e consulta paginada. Não há tolerância monetária físico-contábil.'],
 ['Sugestões assistidas',b('assisted-reconciliation/matching.policy.ts')+'; placa, série e Jaccard textual/local, limiares e alertas; não é Dice/desempate monetário completo do legado.'],
 ['Revisão/consolidação',b('assisted-reconciliation/assisted.service.ts')+'; comandos idempotentes, claims um-a-um, bloqueio de ambiguidades, rejeição com histórico e respeito a decisões já consolidadas.'],
 ['Avaliações individuais e lote',b('inventory-operations/application/valuation-batch.service.ts')+'; preview não grava valores, confirmação atômica acrescenta histórico por item e revalida membership/fontes. Limite configurado de 1 a 500 itens, default 100.'],
 ['Laudos/snapshots',b('technical-reports/report.sources.ts')+'; captura tabelas e hashes, sem conversão em total monetário quando moeda não é conhecida. Aprovação congela versão; reabertura explícita mantém aprovação anterior.']
])}

## Obsolescência e imutabilidade

Sugestão histórica retorna stale quando o hash atual diverge; aprovação revalida edições, novas observações, adições e exclusão lógica. Nova avaliação ou fonte retificada altera o hash de captura do laudo; validate/review/approve reconsultam fontes e aplicam a política stale_sources do modelo. Bloquear ou avisar é configurável por modelo publicado. Não se deve exigir regravação automática de documento aprovado: ele representa o snapshot histórico.

Versões aprovadas contêm conteúdo, fonte, visual, revisão e hash. Edição direta após aprovação é rejeitada; reabrir exige motivo. Download de versão antiga continua sujeito à autorização atual das fontes. Um arquivo histórico válido não significa que seus dados sejam os mais recentes.

As consultas de validação frontend podem ficar montadas enquanto outra aba altera fontes; backend revalida antes de aprovar, mas a atualização visual transversal imediata não foi certificada para todas as mutações. Esse limite não deve ser confundido com falta de proteção do snapshot no servidor.

## Limitações de uso patrimonial

Fonte documental é limitada a 1.000 registros por família antes de seleção posterior; o DTO não fornece recorte arbitrário por lista de itens. Projetos ou históricos maiores podem não emitir laudo completo (GAI-006). O bloqueio é explícito, sem truncamento silencioso. Avaliações não possuem moeda confiável para total global; valuation.used_total permanece null. Não há cálculo normativo CPC/vida útil/valor justo automático nem assinatura digital comprovada; responsabilidade técnica é informada e validada conforme regra, sem consulta de conselho.

Fotos existem como evidência de item, mas DocumentBlock só prevê texto/tabela e logo institucional; fotos/legendas de ativos ainda não são composição do laudo. Nenhum módulo de atividades, CRM ou curso foi criado para preencher lacunas da matriz.
`);

const schema=read('schema.json');
write('banco-migrations.md',`# Banco de dados e migrations

## Ambiente e método

Somente o alvo sintético fixo 127.0.0.1:33317/gai_validation_disposable foi usado. O MySQL existente da porta 3306 não recebeu migrations, rollback, seeds ou escrita da auditoria. O helper ignora DB_* nesse modo, usa credenciais sintéticas, dropSchema=true e migrationsRun=true. A suíte foi serializada. O primeiro container sofreu timeouts de DDL em disco; foi preservado e parado. A execução final usou outro container exclusivo com datadir em tmpfs; não extrapolar sua latência/durabilidade para produção.

As 32 migrations foram aplicadas em schemas descartáveis durante os testes. A comparação posterior foi somente leitura, synchronize=false/migrationsRun=false. Resultado: ${schema?schema.entity_tables:'pendente'} entidades/tabelas TypeORM; ${schema?schema.database_tables:'pendente'} tabelas SQL incluindo migrations; ${schema?schema.migrations.length:'pendente'} migrations registradas; pendências=${schema?schema.pending_migrations:'não verificado'}. Colunas ausentes: ${schema?schema.missing.length:'não verificado'}; divergências de nulabilidade/precisão/escala verificadas: ${schema?schema.differences.length:'não verificado'}. Evidência: [evidencias/schema.json](evidencias/schema.json).

Isso não significa igualdade completa de defaults, tipos, índices e FKs de todo o metadata. QueryRunner.getTables e SchemaBuilder.log falham ao procurar typeorm_metadata para colunas geradas criadas por SQL bruto (GAI-009). A comparação foi então feita por information_schema, sem criar a tabela faltante e sem executar sugestões de schema. O catálogo físico completo de colunas/índices/FKs/checks está no JSON; limitações de comparação são explícitas.

## Migrations inventariadas

${table(['Arquivo','Tabelas criadas em SQL estático','FKs em texto','CHECKs','Rollback'],inv.migrations.map(m=>[ref(m.file),m.tables.join(', ')||'Alteração de schema/índice',m.foreign_keys,m.checks,m.file.includes('1739700000001')?'Irreversível explicitamente':'down definido; não executado']))}

## Integridade estrutural

O schema possui FKs e índices para escopo/filhos, vínculos ativos protegidos por coluna gerada, chaves únicas de snapshots/revisões e comandos idempotentes. No catálogo físico, contar constraints únicas por nome/tabela; linhas de information_schema em FKs/índices compostos representam colunas, não múltiplas constraints. Recebíveis e artefatos documentais têm CHECKs explícitos; muitas outras invariantes são de aplicação, não constraints SQL.

DECIMAL(15,2) predomina para valores; datas civis usam DATE e instantes DATETIME(3), enquanto snapshots comerciais/DRE usam JSON com strings decimais. Existem tabelas próprias para auditoria, revisões de modelos/contratos/orçamentos/laudos/DRE, eventos financeiros, comandos e operações de lote. Arquivamento/desativação não deve apagar snapshots; entidades originais usam soft delete em vários domínios. JSON polimórfico e referências sem FK exigem validação da aplicação, exercitada por testes de troca de pai/tenant. Não foi afirmado que toda relação entre organizações seja garantida apenas pelo banco.

## Upgrade e rollback

${ref('gai-backend/src/migrations/1739600000001-migrate-to-numeric-ids-and-rbac.ts','public async up')} derruba tabelas de organizações/autenticação para migrar IDs. ${ref('gai-backend/src/migrations/1739700000001-decouple-user-authorization.ts','public down')} rejeita rollback explicitamente. Portanto, cadeia completa não oferece rollback reversível universal, e execução sobre uma base antiga com dados exige estratégia de preservação/restauração antes de liberar. Isso é risco condicional confirmado pelo código; não houve perda em banco real nesta execução.

Schema novo foi validado; upgrade de uma cópia histórica representativa, contagens/checksums antes/depois, restore de backup e recuperação de desastre continuam pendentes. Nunca executar down global como prova de segurança no banco existente. MySQL DDL não é transação de dados comum; rollback lógico da aplicação não torna uma cadeia destrutiva reversível.

Produção usa ${ref('gai-backend/scripts/data-source.prod.cjs')} e script release:prod encadeia migration/permissões/admin. Nenhum desses comandos de release foi executado. Comprovar baseline de migrations do ambiente de destino e sincronização das 161 permissões antes de homologação compartilhada.
`);

const docsInspection=read('documentos-render/inspection.json',[]);
write('documentos-storage.md',`# Documentos e storage

## Geração nativa e conteúdo

PDF é gerado por pdfmake e verificado por pdf-lib; DOCX é pacote OOXML gerado pela biblioteca docx, com tabelas nativas, títulos, cabeçalho/rodapé e campos PAGE/NUMPAGES. Não é HTML com extensão Word. ${b('documents/document.render.ts','export async function renderDocument')}; ${b('documents/document.builder.ts')}. Snapshot aprovado e identidade visual versionada são a fonte; alteração posterior de modelo não deve modificar o arquivo histórico.

Foram geradas novas fixtures sintéticas pelo renderer atual, com 1, 60 e 180 linhas e descrições longas. Um clone separado foi usado para cada formato, reproduzindo a separação de objetos do worker: pdfmake pode transformar internamente células recebidas por referência. As tentativas de preparação e ajustes do harness não foram rotuladas como falhas da API de produção.

${table(['Arquivo sintético','Bytes','Páginas PDF / partes XML válidas','Última linha','Validação'],docsInspection.map(d=>[d.file,d.size,d.pages??d.xml_parts_valid,d.last_row_present?'Preservada':'Não verificada',d.pages?'PDF parseável e sem texto fora da margem de 20 pt':'Relacionamentos internos válidos e tabela/campos nativos']))}

Os 19 PNGs das páginas PDF foram gerados; inspeção visual amostral de capa, tabela curta, linhas longas intermediárias e página final não mostrou cortes/sobreposição. A checagem de limites horizontais e presença da última linha cobriu todos os PDFs. Fontes/acentos portugueses foram verificados. Não é garantia universal para qualquer conteúdo. Evidências em evidencias/documentos-render/inspection.json e PNGs/arquivos de teste; arquivos gerados via download autenticado pelo Playwright ficam em evidencias/documentos e evidencias/playwright.

## Versões, permissões, hash e cache

Laudo exige versão aprovada; orçamento avulso pode gerar documento rotulado como não aprovado. Proposta usa a versão comercial selecionada. Memória interna fica excluída por padrão e exige permissão adicional. Geração e download reconsultam permissões de documento e fontes, organização e IDs de pai/versão. Cache usa engine, organização, fonte/hash, modelo visual/hash, formato e opção de memória. Bytes têm SHA-256, tamanho e limite verificados; arquivo corrompido é negado. Cache-Control private,no-store e nosniff são aplicados. ${b('documents/documents.service.ts','async download')}; ${b('documents/documents.controller.ts','function deliver')}.

Worker limita duas renderizações concorrentes por processo, entrada de 3 MB, 30 segundos e arquivo de 10 MB; renderer PDF valida até 500 páginas. Cache/coalescência é local ao processo mais índice único SQL; não há fila distribuída. São limites explícitos, não teste de carga.

## Armazenamento e expiração

Artefatos documentais são mediumblob privado no banco; não usam S3. Não foi localizada política de expiração/limpeza desses blobs; retenção e crescimento precisam de decisão operacional. Export jobs são outro mecanismo e têm expiração/limpeza própria. Não confundir validade de URL assinada de evidência com retenção de PDF aprovado.

Em NODE_ENV=production, DocumentsService recusa geração salvo DOCUMENT_STORAGE=database. A definição ECS atual não declara essa variável: o caminho declarativo não habilita geração documental (GAI-007). Isso não foi observado numa AWS implantada; é inconsistência confirmada entre configuração de fonte e gate do serviço. Definir e homologar modo, backup, retenção e capacidade antes de liberar, sem alterar o gate na auditoria.

Imagens/anexos/evidências usam adapter AWS SDK SigV4, PUT autorizado, confirmação com HEAD/leitura/hash/MIME e download preso à versão do objeto. Os 7 testes MinIO reais passaram, incluindo expiração e substituição; outras suítes usam FakeStorage explicitamente. IAM GetObjectVersion, versionamento, CORS e criptografia estão declarados em Terraform; **homologação AWS real não comprovada e permanece pendente**. Nenhum deploy, PUT em bucket AWS ou alteração de infraestrutura remota foi realizado.

## Limitações visuais

DOCX foi validado estruturalmente, mas não foi homologado em Word nem renderizado pelo renderer canônico da skill nesta estação; o runtime empacotado necessário não estava disponível por ferramenta. Não se usou o LibreOffice desktop do usuário como substituto. Paginação Word pode variar por aplicação, versão e substituição de fontes; PAGE/NUMPAGES dependem de atualização pelo editor. PDF incorpora Roboto; opção Times usa fontes padrão, com cobertura Unicode mais limitada. DOCX declara fontes, sem comprovação de incorporação/instalação no cliente.

Somente logo PNG institucional está previsto no modelo visual; DocumentBlock não compõe fotos/legendas de ativos. Não há assinatura digital, motor normativo certificado ou PDF/A comprovado. A captura de fontes de laudo limita 1.000 registros por família (GAI-006). Tabelas longas testadas não eliminam esse limite de extração no serviço.
`);

const back=read('backend-jest.json'),mysql=read('mysql-jest.json'),storage=read('storage-jest.json'),front=read('frontend-vitest.json'),pw=read('playwright.json'),blint=read('backend-eslint.json',[]),flint=read('frontend-eslint.json',[]);
const lintCounts=a=>({errors:a.reduce((s,x)=>s+x.errorCount,0),warnings:a.reduce((s,x)=>s+x.warningCount,0)});
const summary=a=>a?`${a.numPassedTests} aprovados; ${a.numFailedTests} falhos; ${a.numPendingTests} ignorados; ${a.numTotalTests} executáveis declarados`:'Ainda não concluído';
const canonical=new Map();
for(const report of [back,mysql,storage].filter(Boolean)){const seen=new Map();for(const r of report.testResults)for(const t of r.assertionResults){const base=r.name+'|'+t.fullName,n=seen.get(base)||0;seen.set(base,n+1);canonical.set(base+'|'+n,{file:r.name,title:t.fullName,status:t.status});}}
const canonicalCounts=[...canonical.values()].reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{});
fs.writeFileSync(path.join(out,'tests-consolidated.json'),JSON.stringify({method:'arquivo+título+ocorrência; resultado MySQL substitui SQLite do mesmo caso e S3 real substitui skip; nenhuma soma de reexecuções',declared_cases:canonical.size,counts:canonicalCounts,cases:[...canonical.values()]},null,2));
const pwSpecs=[];function collectPw(suites){for(const s of suites||[]){for(const spec of s.specs||[])pwSpecs.push({file:s.file,title:spec.title,ok:spec.ok,tests:spec.tests});collectPw(s.suites);}}if(pw)collectPw(pw.suites);
write('testes.md',`# Testes executados e limites

## Resultados desta execução

${table(['Verificação','Resultado','Evidência'],[
 ['Jest backend completo, runner padrão SQLite',summary(back),'evidencias/backend-jest.json; backend-tests.log'],
 ['HTTP/integracão MySQL descartável, 42 arquivos',summary(mysql),'evidencias/mysql-jest.json; mysql-checks.json; mysql-tests.log'],
 ['S3 real local, MinIO isolado',summary(storage),'evidencias/storage-jest.json; storage-tests.log'],
 ['Vitest frontend completo',summary(front),'evidencias/frontend-vitest.json; frontend-checks.json'],
 ['TypeScript backend incluindo testes','APROVADO','backend-checks.json → backend-typescript, exit 0'],
 ['TypeScript frontend app + configuração Node','APROVADO','frontend-checks.json → dois checks exit 0'],
 ['Build backend Nest','APROVADO após corrigir apenas configuração do harness','backend-build-final.log e evidencias/build-backend; saída isolada'],
 ['Build frontend Vite','APROVADO; aviso de chunk 1.727,55 kB (gzip 481,90 kB)','frontend-build.log; saída isolada'],
 ['ESLint global backend, sem --fix',`${lintCounts(blint).errors} erros; ${lintCounts(blint).warnings} avisos`,'backend-eslint.json'],
 ['ESLint global frontend',`${lintCounts(flint).errors} erros; ${lintCounts(flint).warnings} aviso`,'frontend-eslint.json'],
 ['Migrations em base nova','32 registradas; nenhuma pendente; persistência HTTP verificada','schema.json; mysql-jest.json'],
 ['Comparação schema/entidades','101 tabelas de entidade + migrations; nenhuma coluna ausente nem divergência de nulabilidade/precisão/escala no comparador','schema.json; diff completo bloqueado por typeorm_metadata ausente'],
 ['Playwright Chromium com API/MySQL reais',pw?`${pw.stats.expected} aprovados; ${pw.stats.unexpected} falhos; ${pw.stats.skipped} ignorados`:'PENDENTE de consolidação final','evidencias/playwright.json; playwright.log; PNGs/traces'],
 ['Reproduções financeiras HTTP novas','CONFIRMADAS: truncamento em 100 pagamentos e rollover de data inválida','finance-reproduction.json/log; reproduce-finance.cjs'],
 ['Documentos com 1/60/180 linhas','6 arquivos nativos; PDF 2/5/12 páginas; DOCX com XML/relacionamentos válidos','documentos-render/inspection.json']
])}

## Contagem sem duplicação

Não somar 721 + 281 + 7 como se fossem testes distintos. Backend completo contém os testes HTTP novamente executados em MySQL e os casos S3 inicialmente ignorados. A consolidação usa arquivo + título + número de ocorrência para preservar casos parametrizados com títulos repetidos; substitui a execução SQLite pela MySQL do mesmo caso, depois o skip de S3 pela execução real. Resultado de evidência combinada: **${canonical.size} casos declarados; ${canonicalCounts.passed||0} aprovados e ${canonicalCounts.failed||0} falhos**, em evidencias/tests-consolidated.json. Isso não transforma o comando padrão npm test em verde: ele falhou e precisa de correção no runner. Frontend e Playwright são populações separadas e não foram somados ao backend.

## Falhas e diagnóstico

O runner padrão inclui suítes recentes que usam REPEATABLE READ, NOW() e concorrência MySQL no helper SQLite. Surgem 500 por limitação de driver, e não há equivalência de locks. A execução final MySQL aprovou esses fluxos e deixou duas expectativas de exportação desatualizadas: security-storage.e2e-spec.ts enumera finance_xlsx/dre_xlsx no endpoint genérico e espera 403, mas o serviço retorna 409, exigindo fluxo especializado com filtros. Não foi comprovado vazamento nessa negativa. Não se alteraram testes para encobrir resultados.

ESLint backend: 82 prettier/prettier e 1 no-control-regex, em quatro arquivos: organization-overview.controller.ts (14), ensure-platform-admin.ts (1), organization-scope-services.spec.ts (18), organization-overview.spec.ts (50). Relatórios anteriores citavam 175 erros; a contagem atual é 83, sem equivalência linha a linha com aquele momento. Frontend mantém um aviso em OverviewDetails.tsx. Nenhum --fix foi executado. CI atual chama lint com --fix no backend, npm audit com ||true e não declara Playwright/MySQL/S3 reais; portanto não representa toda a homologação integrada.

## Preparação do ambiente e tentativas não conclusivas

Primeiro esbuild foi impedido de ler configuração pela sandbox; repetição autorizada aprovou frontend. Build Nest isolado precisou de caminho relativo, typeRoots e excludes relativos corretos; falhas dessas tentativas são de configuração da auditoria, não erros de build do produto. Container MySQL em disco excedeu timeouts e contaminou tentativas seguintes com DDL inacabado; elas não foram somadas, e logs foram preservados. Execução final em tmpfs foi serializada. O harness Playwright precisou de imports ESM/caminhos próprios, empresa sintética 1, health local e cwd do Tailwind; essas falhas de preparação não são classificadas como defeitos de interface. Testes originais e fontes permaneceram intactos.

Os testes de navegador reutilizam nove specs reais em cópias isoladas, mais dois casos novos de navegação desktop/mobile. Portas 33319/33320 e outputs foram redirecionados para a auditoria; não usam page.route/mock de API. A API usa módulos reais Nest, MySQL com as migrations e seed sintético; storage de testes é FakeStorage para as suítes de negócio, com integração MinIO independente. A API de teste não replica todos os aspectos do AppModule de produção, especialmente ThrottlerGuard global, ALB/CORS/TLS/SES e infraestrutura AWS.

## Playwright por cenário

${table(['Arquivo','Cenário','Estado'],pwSpecs.map(s=>[s.file,s.title,s.ok?'APROVADO':s.tests?.map(t=>t.status).join(', ')||'NÃO CONCLUÍDO']))}

## Não executado ou ainda não certificado

Upgrade de cópia com dados históricos, rollback/restore de desastre, teste de carga/stress e todas as intercalações concorrentes, cobertura percentual nova, AWS real e IAM/CORS efetivos, entrega SES, DOCX no Word/render canônico, offline/APK, assinatura digital, motor normativo e importação completa do legado. Sem varredura atual de advisories de dependências: lockfiles foram inventariados, mas relatório antigo de npm audit não é prova atual. Não foi feito deploy, release:prod, acesso destrutivo ao banco existente, commit ou push.
`);

write('frontend-navegacao.md',`# Frontend e navegação

## Estrutura e interfaces reais

Router global reúne autenticação, overview, organizações/usuários/perfis/empresas, projetos, orçamentos, recebíveis/caixa/DRE e inventariantes. Rotas do projeto ficam sob ProjectLayout e oferecem resumo, dashboard, contratos, preparação, campo, inventário, base contábil, pendências, financeiro, prestação, imports, exports e laudos. ${f('router/router.tsx')}; ${f('router/projectRoutes.tsx')}; ${f('features/projects/ProjectLayout.tsx')}.

PermissionGate/ProtectedRoute controlam menu e rotas; autorização real continua no backend. As telas dos módulos novos usam loading/erro, formulários, validação e tabelas conectadas a APIs reais. As listas/históricos têm contratos de paginação; a tabela de movimentos de caixa exibe no máximo 200 com aviso explícito e possibilidade de exportação/refino. Não declarar responsividade completa só porque existe breakpoint CSS.

247 testes Vitest passaram. Playwright desta auditoria usa backend real e MySQL sintético em 33319, frontend em 33320, viewport desktop 1440×1000 e mobile 390×844, além dos viewports das nove suítes de negócio reaproveitadas. Resultados finais por cenário, falhas e evidências estão em testes.md e evidencias/playwright.json. Os erros de health/CSS ocorridos durante configuração do harness foram isolados da avaliação do produto.

## Contexto do projeto

As abas internas preservam projectId e o layout montado; refresh e links diretos devem refazer consulta com sessão do navegador. Sessão usa sessionStorage, portanto uma nova aba não deve ser presumida autenticada. Voltar/avançar deve preservar rota e parâmetros.

Há perda de contexto ao transitar por layouts globais: abas do projeto apontam /app/budgets?project_id=..., enquanto os NavLinks de BudgetLayout apontam /app/budgets e /app/budgets/pricing sem query. Em recebíveis, o link da lista para detalhe também omite project_id. DRE possui Retornar ao projeto quando o parâmetro está presente. ${f('features/budgets/BudgetLayout.tsx','to="/app/budgets"')}; ${f('features/receivables/ReceivablesPage.tsx','to={"/app/finance/receivables/"')}; ${f('features/dre/DreLayout.tsx')}. GAI-005 documenta a quebra da navegação integrada; não corrigida nesta auditoria.

O novo teste de navegação registra e afirma o comportamento de perda do filtro para reproduzir o defeito; esse teste passando não significa que o comportamento seja aceito. O critério futuro é preservar filtro e oferecer retorno ao projeto em todas as telas relacionadas. O spec original project-navigation-real.spec.ts pressupõe que todas as abas tenham href /projects/:id, mas novas abas globais violam essa premissa; precisa atualização para expressar contexto funcional, sem classificar todo link global como proibido.

## Rotas incompletas e limites

Há placeholders globais e a rota area; inventário-atual.md identifica os caminhos. Eles não contam como capacidade implementada. O backend de catálogo existe, mas a tela global ainda é placeholder. Orçamentos mostram intenção de conversão, sem contrato/projeto/recebível criado automaticamente. Laudos não compõem fotografias de ativos, apesar de existirem imagens no detalhe do item.

Listas com IDs numéricos manuais, retorno a projeto em layouts globais, indicadores de fonte obsoleta entre abas, estados de erro e textos de limitação são critérios de homologação funcional. A auditoria não garante toda combinação de filtro/modal em desktop/mobile apenas pela visita de rota. Evidência atual e lacunas permanecem explícitas na matriz e nos testes.
`);
