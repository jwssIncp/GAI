# Auditoria financeira

## Atualização após a Onda 0 financeira — 28/10/2026

**GAI-010 e GAI-001: corrigidos e validados localmente.** A correção e as evidências estão em [correcoes-onda-0-financeiro-2026-10-28](../correcoes-onda-0-financeiro-2026-10-28/README.md). Na execução final houve 124 pares concorrentes (109 com barreira InnoDB; 100 de stress), sem regressão de baixa; os resumos foram validados até 1.310 registros e com decimais grandes. Leitura com lock, validação, escrita e auditoria agora compartilham a transação. O GAI-001 foi antecipado para esta onda. Não houve migration ou reparo histórico.

As reproduções originais e os resultados abaixo são o **registro histórico anterior à correção** e foram preservados. Os demais achados continuam abertos. Os dois testes independentes de exportação genérica foram reexecutados e continuam falhos; produção e aceite integrado final permanecem não liberados. Consulte o relatório da Onda 0 para contagens atuais e limites.


## Conclusão

Há fluxo persistido de contratos/aditivos, orçamentos, recebíveis, eventos de caixa e DRE gerencial, com separação explícita entre competência e liquidação. Foi confirmada corrupção de estado financeiro em corrida entre aprovação e baixa de pagamento (GAI-010 crítico), além de resumo limitado aos primeiros 100 registros, aceitação de datas civis inexistentes e timestamps MySQL incoerentes no ambiente auditado. Não foram corrigidos nem foram alterados dados reais/históricos.

## Valores e arredondamento

Contratos usam cents/money com BigInt; orçamento, recebíveis, caixa e DRE usam decimal/scaled com inteiros escalados. Parcelas distribuem residual de centavos e preservam o total. Orçamento exige soma de impostos+comissão+margem inferior a 100%, piso e parâmetros publicados, sem criar despesa de forma automática. `gai-backend/src/modules/contracts/contract.policy.ts:9`; `gai-backend/src/modules/budgets/budget.policy.ts:128`; `gai-backend/src/modules/receivables/receivable.policy.ts:38`; `gai-backend/src/modules/managerial-dre/dre.policy.ts:1`.

Pagamentos antigos recalculam com Number e toFixed, e summaries também acumulam Number (`gai-backend/src/modules/payments-expenses/domain/entities/field-agent-payment.ts:191`). Não foi reproduzido erro de centavo dentro dos limites monetários persistíveis nesta auditoria; isso é risco técnico, não perda financeira confirmada. Validar limites de daily_total/final_amount no domínio e agregados grandes antes de migrar cálculos. DECIMAL(15,2) é o contrato SQL monetário predominante, enquanto partes comerciais armazenam strings dentro de snapshots JSON.

## Parcelas, contratos e recebíveis

Fim do mês usa política monthlyDueDate, com clamp civil e centavos preservados; parcelas existentes não são recalculadas. Contratos têm principal original e aditivos versionados; recebível vincula origem e hash de snapshot, com deduplicação inclusive após cancelamento. Geração é explícita e requer confirmação da prévia. Aditivo negativo não gera recebível negativo automaticamente. Orçamento e contrato são origens distintas; sem vínculo comercial, o sistema não consegue deduzir que representam o mesmo fato econômico. Exige conferência operacional para não gerar ambos indevidamente; não foi classificado como duplicação automática confirmada.

Baixa parcial reduz saldo aberto e registra evento; estorno referencia recebimento anterior, é negativo na data efetiva e não apaga histórico. Cancelar exige estornar recebimentos. Chaves de comando com conteúdo/autor divergente e revisão antiga são rejeitadas. Testes de concorrência e rollback estão na suíte MySQL de receivables. `gai-backend/src/modules/receivables/receivable.service.ts:117`; `gai-backend/test/integration/receivables/receivables.e2e-spec.ts`; `gai-backend/test/unit/modules/receivables/receivable.policy.spec.ts`.

## Despesas, pagamentos e prestação

Despesas têm aprovação/rejeição/baixa/cancelamento e comprovantes; pagamentos têm componentes e vínculo ao técnico. Prestação agrupa despesas, não cria novo desembolso. Caixa usa despesa original e parcelas previstas até a baixa integral; não duplica a prestação. Não há baixa individual de parcela de despesa, livro de adiantamentos ou fluxo específico de solicitar/receber reembolso do cliente. Total de prestação fechada e vínculos são preservados pelo serviço; backfill ou reinterpretação de pagamentos antigos não foi executado.

**GAI-001, alto:** criar 101 pagamentos distintos de 1.00 e consultar GET /projects/:id/payments/summary retorna total_count=101 e total_pending=100.00. Causa: pageSize:100 e soma somente all.items (`gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:220`). Prova em evidencias/finance-reproduction.json; não é erro de arredondamento.

**GAI-002, médio:** POST de despesa com expense_date=2026-02-30 retorna 201 e expense_date=2026-03-02. parseDate valida formato e NaN, mas não compara a data serializada com a entrada (`gai-backend/src/modules/payments-expenses/application/services/payments-expenses-scope.service.ts:44`). Afeta competência/filtros e período de prestação. Prova HTTP preservada no mesmo JSON.

## Corrupção concorrente de estado de pagamento

**GAI-010, crítico:** 5/15 pares approve/mark-as-paid simultâneos responderam 200 nas duas operações, mas o GET persistido voltou a approved, ainda com paid_at. Uma nova baixa respondeu 200 sem estorno. Leitura/revalidação ficam fora da transação que salva a entidade sem CAS/versão; uma escrita stale pode sobrescrever a quitação. Prova real MySQL/HTTP e auditorias: evidencias/payment-race.json. Isso é bloqueio de produção, embora nenhum dinheiro real tenha sido movimentado. Onda 0 deve proteger transições sem mudar silenciosamente a regra de permitir baixa de pending.

**GAI-011, médio:** SQL e API do mesmo cenário mostram created_at e updated_at separados artificialmente por três horas, devido à combinação servidor UTC/driver local/default SQL. Datas civis não foram afetadas por esse mecanismo demonstrado; instantes de auditoria foram. Alinhar timezone e validar histórico antes de qualquer remediação.

## Caixa e DRE

Caixa separa expected/actual e moeda. Saídas antigas sem moeda ficam em UNSPECIFIED, sem compensação com BRL/USD/EUR; isso evita inventar saldo, mas impede um resultado financeiro consolidado da organização. Despesas sem vencimento e pagamentos aprovados sem data são informados como cobertura incompleta. O resultado não representa saldo bancário. A tabela de movimentos mostra os primeiros 200 com aviso/refino/exportação, sem alteração do total calculado no servidor.

DRE reconhece fontes explicitamente por competência e conta/rateio, preserva versões e fechamento/reabertura com motivo. Baixa/estorno de caixa não gera novo reconhecimento; prestação e proposta comercial não são fatos econômicos inferidos. Classificações incompletas e fontes alteradas são sinalizadas; não declarar lucro definitivo com cobertura incompleta. Histórico de contas é preservado em versões. Não há DRE contábil oficial, cálculo tributário normativo ou integração bancária homologada.

Campos civis novos são strings DATE e eventos usam instantes DATETIME. Campo adota São Paulo, enquanto atraso de recebível/caixa usa dia UTC. Definir política financeira de fuso é pendência de negócio; não alterar datas antigas sem plano. Testes específicos de grandes valores, fim de mês, parcial/estorno, moedas e cobertura estão referidos em testes.md e na matriz funcional.
