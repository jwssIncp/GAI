# Contas a receber e fluxo de caixa — investigação de 28/10/2026

## Diagnóstico confirmado antes da implementação

Consultados a matriz F065–F072 da auditoria, os relatórios de validação técnica e correções críticas, os relatórios de contratos e orçamentos e as entidades, serviços, DTOs, autorização e exportações atuais.

| Fonte atual | Significado confirmado | Uso correto no caixa |
|---|---|---|
| Contratos/aditivos | Valores comerciais versionados; condições de pagamento em texto livre | Referência para geração explícita; nunca recebimento automático |
| Orçamento aprovado | Snapshot imutável, incluindo plano comercial de pagamento | Referência para prévia e confirmação, sem alterar versão aprovada |
| field_agent_payments | Obrigação operacional; pending/approved/paid/cancelled; payment_date é substituída pela data efetiva na baixa | Previsto apenas aberto com data conhecida; realizado apenas paid com data efetiva |
| expenses | Gasto registrado; pending/approved/rejected/paid/cancelled; expense_date não comprova pagamento | Realizado apenas paid em paid_at; não usar expense_date como vencimento presumido |
| expense_installments | Distribuição do valor da despesa e vencimentos civis; não tem baixa individual | Agenda prevista do saldo aberto da despesa; não repetir valor integral junto com parcelas |
| expense_accountabilities/items | Agrupamento das mesmas despesas, inclusive vínculo único por expense_id | Nunca somar como movimento adicional |
| Adiantamentos/reembolsos | Não foi encontrado agregado financeiro separado com liquidação própria | Não inferir movimento a partir de nomes, metadados ou total de prestação |

Não existe saldo bancário inicial nem razão completo. Entradas menos saídas de um período devem ser chamadas de resultado líquido dos movimentos conhecidos, nunca saldo bancário. Despesas sem vencimento ou baixa individual tornam a projeção parcial. Moedas diferentes devem permanecer separadas; saídas existentes não possuem moeda explícita e não podem ser convertidas ou misturadas silenciosamente com recebíveis em moeda estrangeira.

## Restrições técnicas verificadas

- `PermissionsGuard` consulta catálogo vigente antes de autorizar ORG_ADMIN; novas permissões exigem migration e seeds, sem grants automáticos a papéis personalizados.
- `ProjectScopeService` restringe organização; validar também empresa, projeto, contrato, aditivo e versão aprovada em cada comando.
- Export jobs atuais exigem projeto, não possuem filtros persistidos e o download revalida as leituras dos domínios. Exportações organizacionais exigem extensão explícita desse mecanismo; não basta servir um XLSX diretamente e perder essa proteção.
- Datas mensais devem reutilizar `monthlyDueDate`, derivadas da data original, conservando fim de mês. Orçamentos já têm `paymentPlan` com BigInt e residual de centavos.
- MySQL hidrata BIGINT como texto; normalizar IDs de novas entidades e usar UPDATE explícito após INSERT. Os testes com metadata integer não substituem validação no runtime local.
- O workspace contém trabalho anterior extenso; nenhuma restauração global é apropriada.

## Registro da execução anterior — somente investigação

Este documento registra a análise das fontes. Não representa implementação ou homologação do módulo. Ainda precisam ser construídos o agregado de recebíveis, parcelas, recebimentos/estornos imutáveis, comandos idempotentes com bloqueio concorrente, projeção consolidada, integração de export jobs organizacionais, interface e testes solicitados. Nenhuma migration deste módulo foi criada ou aplicada nesta investigação.

## Implementação desta execução

O registro acima é histórico. Nesta execução foram adicionados um módulo NestJS `receivables`, páginas React operacionais e uma extensão organizacional dos export jobs existentes. Não são mocks nem dados demonstrativos fornecidos ao dashboard: as telas consultam MySQL por APIs autenticadas. Os dados usados nos testes são exclusivamente sintéticos.

### Entidades e migration

`1793700000001-create-receivables.ts` cria três tabelas:

| Tabela | Conteúdo e invariantes |
|---|---|
| receivables | Organização, cliente obrigatório, projeto/contrato opcionais, origem única, snapshot de referência, valor DECIMAL(15,2), moeda explícita, revisão e cancelamento |
| receivable_installments | Número, tipo, vencimento SQL DATE e valor DECIMAL; unicidade por recebível/número; vínculo composto com organização |
| receivable_events | Criação, edição, recebimento, estorno e cancelamento; revisão única; comando e hash; autor/instante, motivo e detalhes; parcela, valor assinado e data efetiva quando há movimento; um único estorno por evento |

FKs compostas impedem que parcela, evento ou reversão pertençam a recebíveis/organizações diferentes. Há índices de carteira e vencimento. Não há DELETE de eventos nem de parcelas na API. As entidades normalizam BIGINT para IDs numéricos seguros no AfterLoad.

A migration também permite `project_id=NULL` em `export_jobs` e em sua auditoria, e adiciona `finance_payload` JSON **excluído das seleções padrão**. Jobs antigos continuam vinculados aos projetos e preservam os endpoints e guards anteriores. A reversão destrutiva desta migration é recusada: histórico financeiro exige uma migration posterior explicitamente revisada.

Destino local conferido antes da aplicação: `NODE_ENV=local`, `localhost:3306/gai`, MySQL 8.0.46, hostname Docker `f10269ba8da4`. Aplicada somente a migration nova; o banco passou de 28 para 29 migrations sem pendências. Nenhum banco remoto foi acessado e nenhum dado anterior foi apagado/recriado.

### APIs

Todas usam o prefixo `/api/v1`, a sessão existente e `PermissionsGuard`.

| Método e caminho | Operação |
|---|---|
| GET /finance/sources/:kind/:id | Carregar referência autorizada de contrato, aditivo ou orçamento aprovado |
| GET /finance/receivables | Carteira paginada e filtrada |
| POST /finance/receivables/preview | Validar referências e calcular prévia, sem gravar obrigação |
| POST /finance/receivables | Confirmar prévia por hash e chave idempotente |
| GET /finance/receivables/:id | Dados, parcelas, saldos e histórico consistente |
| PUT /finance/receivables/:id | Editar descrição, documento e observações, com revisão/motivo |
| POST /finance/receivables/:id/receipts | Baixa parcial ou integral de uma parcela |
| POST /finance/receivables/:id/receipts/:eventId/reverse | Estorno integral auditável do evento selecionado |
| POST /finance/receivables/:id/cancel | Cancelamento controlado após estornos explícitos |
| GET /finance/cash-flow | Projeção, movimentos rastreáveis e indicadores calculados no backend |
| POST /finance/exports | Solicitar XLSX dos dados e filtros confirmados |
| GET /finance/exports/:id | Consultar processamento, sem expor payload ou conteúdo |
| GET /finance/exports/:id/download | Download autenticado com revalidação das leituras e checksum |

Filtros: organização autorizada, empresa, projeto, contrato, período inclusivo, status, previsto/realizado e entrada/saída. Na carteira, o período seleciona recebíveis com vencimentos no intervalo. No caixa, filtra cada movimento pela sua data de vencimento ou efetivação. Exportação de recebimentos filtra pela data efetiva, não pelo vencimento. Status refere-se à situação atual; `overdue` restringe a obrigações vencidas abertas. Parâmetros inválidos e IDs estrangeiros são rejeitados no backend.

### Permissões e escopo

Novas chaves organizacionais registradas em migration e seeds: `receivables:read`, `receivables:edit`, `receivables:receive`, `receivables:reverse`, `cash-flow:read`, `finance:export`.

ORG_ADMIN usa o bypass organizacional já existente, depois de consultar o catálogo válido, sempre restrito à própria organização. Não houve alteração no guard nem concessão a papéis personalizados. `projects:read` não autoriza valores financeiros. Geração por contrato/aditivo exige também `contracts:read`; por orçamento exige `budgets:read`. Caixa de entradas exige `receivables:read`; saídas exigem `payments:read`, `expenses:read` e `expense-installments:read`. O recorte combinado exige ambas as famílias. Um perfil pode escolher somente entradas/saídas se possuir as respectivas leituras.

Exportação exige `finance:export` e `export-jobs:create`; o download exige `export-jobs:download` e revalida **todas as permissões dos domínios incluídos no snapshot**, inclusive depois de revogação ou remoção no catálogo. O payload financeiro não aparece nas consultas normais dos jobs anteriores. O tipo financeiro não pode ser criado pelo endpoint antigo de projeto sem filtros/snapshot validados.

### Valores, parcelas e datas

Valores são strings decimais no contrato HTTP, DECIMAL nas colunas e BigInt em centavos nos cálculos. Não há soma de valores financeiros com float. Valor total e parcelas devem ser positivos. O plano reutiliza a policy exata de orçamento e a função pura `monthlyDueDate`: parcela única; entrada por valor/percentual; mensal; percentuais ou valores personalizados; vencimentos customizados. No plano igual, a última parcela absorve os centavos residuais. Nos demais planos a soma precisa fechar exatamente.

Exemplo validado: 100,01 em três parcelas = 33,33 + 33,33 + 33,35. Origem 31/01 gera 28/02 e 31/03 em 2026, e 29/02 em 2028. Datas civis persistem como YYYY-MM-DD, sem conversão por fuso. Emissão não pode ser futura; baixa deve estar entre emissão e hoje; estorno entre baixa e hoje. O cálculo de vencido usa o dia UTC atual, declarado na API.

### Geração explícita e preservação da origem

Cadastro manual requer empresa e justificativa, sem exigir orçamento. Projeto, quando informado, precisa pertencer à empresa/organização. Para origem comercial, a prévia carrega e revalida os dados reais. Cliente, projeto, valor e moeda precisam corresponder à origem.

O contrato gera seu **valor original**, não o total atual que já inclui aditivos. Cada aditivo positivo é uma origem separada; aditivo negativo não cria recebível negativo ou crédito implícito. Orçamento somente em estado aprovado, com a versão aprovada e seu plano comercial imutável. Contrato/orçamento não é alterado nem convertido automaticamente em movimento realizado. Origens antigas não são percorridas para gerar obrigações.

O hash da prévia inclui os dados e referências/revisões. Confirmação desatualizada retorna 409 e exige nova prévia. A unicidade `(organization_id, source_key)` impede repetir a geração, inclusive depois de cancelamento. Não existe vínculo estruturado entre um contrato antigo e um orçamento comercial equivalente: não é possível inferir que dois documentos distintos representam a mesma venda. O operador deve escolher uma única origem; não há conversão automática entre elas.

### Baixas, estornos, cancelamento e concorrência

Recebido líquido = soma das baixas positivas e estornos negativos. Aberto = valor original menos recebido líquido. Sem baixas é `open`; com saldo residual é `partial`; saldo zero é `paid`. Cancelado preserva valor original e histórico, com saldo exigível zero. Vencido é derivado de saldo positivo, vencimento anterior a hoje e ausência de cancelamento, nunca um estado alterado manualmente.

Cada baixa exige parcela própria, valor positivo até o saldo, data, forma, referência, motivo e autor autenticado. Referência de baixa repetida no mesmo recebível é recusada. Estorno integral cria outro evento, negativo, vinculado à baixa original; não edita nem apaga o fato original. Um evento não pode ser estornado duas vezes. Estornos aparecem na data de correção, sem reescrever meses anteriores.

Cancelamento com recebimento líquido é recusado até estornos explícitos. Descrição/documento/observações podem ser editados com auditoria; principal, origem e plano confirmados permanecem imutáveis. Não há reescalonamento silencioso ou exclusão de parcela com história.

Comandos usam transação SQL, bloqueio da organização e leitura bloqueante do recebível, revisão esperada/CAS e índice único de chave idempotente. A mesma chave/autor/conteúdo não repete efeitos e retorna a consulta atual; reutilização com conteúdo/autor diferente retorna 409. A revisão impede perda de atualização e pagamentos concorrentes não podem superar o saldo. Atualização do agregado e evento são atômicos: falha ao gravar a auditoria desfaz a alteração. O bloqueio por organização privilegia consistência e reduz paralelismo de gravação dentro de uma organização; é uma escolha conservadora inicial.

### Caixa, fórmulas e cobertura das saídas

- Previsto de entrada: saldo positivo das parcelas não canceladas, por vencimento.
- Realizado de entrada: eventos de recebimento/estorno, com sinal, pela data efetiva.
- Previsto de saída: somente obrigações **aprovadas** com data confiável: parcelas de despesas ou payment_date de pagamentos de inventariantes ainda não pagos. Pendentes não aprovadas não viram desembolso presumido.
- Realizado de saída: despesa `paid` em `paid_at`; pagamento de inventariante `paid` em `payment_date`, que o módulo original define como data efetiva ao baixar.
- Despesa com parcelas não gera também uma previsão do valor integral. Após pagamento integral, suas parcelas deixam o previsto e só a despesa aparece no realizado. Prestações não são somadas.
- Fontes sem data confiável são omitidas e contadas como limitações. Saídas não possuem contrato explícito e são excluídas do filtro por contrato. Não se presume vínculo entre um reembolso e uma diária apenas por terem o mesmo inventariante.
- Cada moeda tem agregados próprios. Saídas legadas sem moeda ficam em `UNSPECIFIED`; não são compensadas com BRL, USD ou EUR.
- Resultado realizado = entradas realizadas − saídas realizadas. Resultado projetado = resultado realizado + entradas abertas previstas − saídas abertas previstas, **dentro da mesma moeda e recorte**. Não há saldo inicial, saldo bancário, competência contábil, DRE ou tributação presumida.

O backend retorna totais, vencido, série mensal, cliente/projeto, movimentos com IDs das fontes e definições. A API declara `complete=false`, porque não é um razão bancário completo. Há limites explícitos de 10.000 recebíveis, 10.000 fontes por família e 50.000 movimentos/linhas; excesso falha com mensagem para refinar o escopo, sem truncar indicadores silenciosamente. A tabela de movimentos da tela limita a exibição a 200 linhas e informa como refinar/exportar; os indicadores usam o recorte completo validado.

### React e exportações

Rotas sob o AppLayout e a autenticação existentes: `/app/finance/receivables`, `/new`, `/:receivableId` e `/app/finance/cash-flow`. O FinanceLayout mantém navegação compartilhada entre recebíveis e caixa. Detalhes guardam a aba na URL; filtros e paginação também. Há links a partir da barra dos projetos, do contrato selecionado e da versão aprovada do orçamento, com retorno ao projeto preservando seu ID.

Cadastro exige prévia e confirmação. Baixa, edição, estorno e cancelamento usam os componentes ModalForm/Button/DataTable/MetricCard existentes e confirmação explícita. A interface apresenta erros do servidor e não muda regras financeiras no navegador.

XLSX: recebíveis, parcelas, recebimentos com estornos, previsto, realizado ou extrato filtrado. Reutiliza `ExportJobProcessorService` e `ExportWorkbookBuilderService`, sua sanitização de células, limites, checksum, expiração e auditoria. A solicitação grava um snapshot do recorte; o worker gera o arquivo desse snapshot. Filtros e limitações acompanham o workbook. Valores decimais são mantidos como texto exato. Download exige sessão e as leituras atuais, sem URL pública ou bypass de permissões.

### Homologação local

Use `scripts/local-start.ps1` para iniciar a configuração local atual. A verificação de migrations é somente leitura e não aplica mudanças automaticamente. Login de teste ORG_ADMIN já existente, sem criar autenticação nova. Abra `http://localhost:5173/app/finance/receivables`, crie um cadastro sintético, confira parcelas e confirme. Registre baixa parcial e quitação, visite Histórico, estorne um evento e atualize a página. Consulte `http://localhost:5173/app/finance/cash-flow` com o mesmo cliente/projeto, gere e baixe o XLSX.

Backend: `http://localhost:3000/api/v1/health`; frontend: `http://localhost:5173`. Os resultados e evidências finais da homologação estão nos arquivos `testes.json`, `runtime-local.json` e `arquivos.json` desta pasta.

### Resultados verificados

| Verificação | Resultado |
|---|---|
| HTTP/MySQL descartável, recebíveis + regressões de orçamento/exportações | 34 casos passaram em 3 suítes |
| HTTP final depois das validações de payload e bloqueio de origem | 18 casos de recebíveis passaram novamente |
| Policies de recebíveis/caixa e orçamento/parcelamento | 26 casos passaram |
| Catálogo/permissões e contrato de export jobs | 22 casos passaram |
| Suíte completa React | 232 casos passaram em 39 arquivos |
| Verificação final do módulo React | 8 casos passaram: 5 de navegação/formulário e 3 novos de precisão monetária |
| TypeScript, build e lint dos arquivos alterados | Backend e frontend passaram |
| Playwright real com ORG_ADMIN | Passou em 34,2 s; nenhum pageerror ou HTTP ≥400 no fluxo positivo |

São 82 casos backend distintos e 235 frontend distintos; as repetições indicadas não foram somadas novamente. A suíte completa frontend de 232 ocorreu antes dos três casos novos de apresentação exata; a execução final direcionada cobriu os oito casos do módulo. Os valores apresentados também usam BigInt na formatação, preservando centavos de agregados maiores que a precisão de Number.

O Playwright criou uma empresa/projeto/recebível SINTETICO, dividiu 100,01 em três parcelas, recebeu 10,00 parcialmente e depois quitou todas as parcelas. Estornou o primeiro evento sem apagá-lo e confirmou recebido líquido 90,01, aberto 10,00 e revisão 6. Validou refresh, URL direta de histórico, voltar/avançar, retorno ao mesmo projeto, viewport 390×844, dashboard e geração/download real de XLSX. Screenshots de histórico e caixa e o workbook baixado estão em `.local/receivables-playwright/`; seus hashes constam do manifesto.

O teste HTTP com MySQL cobre IDs estrangeiros reais, isolamento de outra organização e seus exports, falta de permissão financeira mesmo com leitura de projetos, catálogo ausente inclusive para administradores, perfil personalizado com somente leitura, geração única por orçamento/contrato/aditivo, preservação das origens, comandos concorrentes, retries, excesso de recebimento, estorno duplicado, cancelamento com saldo recebido, datas/valores inválidos, rollback de evento e ausência de duplicação de despesas parceladas após pagamento integral.

Foi feita ainda uma validação HTTP **no runtime local real** para a outra fonte de saída: um novo pagamento de inventariante SINTETICO de 3,33 passou de previsão em 01/10 para realizado em 03/10, deixando zero no previsto e exatamente uma saída no realizado. A moeda permaneceu `UNSPECIFIED`, sem compensar o saldo BRL. Evidência em `saidas-runtime-local.json`. Essa fixture foi criada após o snapshot XLSX do Playwright; arquivos já gerados mantêm seu recorte histórico.

Na conferência final, frontend e backend responderam 200, o catálogo tinha as seis chaves organizacionais e o total de concessões em papéis personalizados continuava 1, como antes. O MySQL descartável foi removido; os contêineres de desenvolvimento foram preservados. O warning de chunk Vite acima de 500 kB permanece, sem falha de build. Não houve commit, push, deploy, migration de produção ou alteração de regra de inventário.

### Arquivos e limites restantes

- Backend novo: `src/modules/receivables/{receivable.dto,receivable.entity,receivable.policy,receivable.service,receivable.controller,cash-flow.service,finance-export.service,receivables.module}.ts` e migration `1793700000001-create-receivables.ts`.
- Integrações: AppModule, seeds, test-app.helper, enum/mapa/entidades de export jobs, builder, serviço e exports do módulo do processador.
- React novo: `src/features/receivables/` com API/tipos/formatação, layout, filtros/exportação, criação, carteira, detalhe e caixa. Integrações em router, sidebar, breadcrumbs, navegação de projeto, contrato e orçamento.
- Testes: policy backend, HTTP/MySQL, navegação React, moeda e Playwright real. A relação completa com SHA-256 está em `arquivos.json`.

As limitações de dados legados descritas acima são deliberadas: projeção parcial, moedas desconhecidas separadas, ausência de baixa individual de parcela de despesa e falta de vínculo econômico estruturado entre documentos comerciais distintos. Não foram inventados saldo inicial, receitas, impostos, reembolsos ou integrações bancárias. Principal/plano financeiro confirmados não são reescritos por uma edição de metadados; correções exigem tratamento explícito preservando histórico. Não há bloqueio externo pendente para operar o módulo local.
