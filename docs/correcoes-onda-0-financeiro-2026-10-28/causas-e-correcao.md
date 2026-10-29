# Causas e correção da Onda 0

## GAI-010: agregado carregado antes da transação

O controller encaminhava aprovação, edição, baixa e cancelamento ao serviço. O serviço consultava `findPaymentById`, validava o estado em memória e somente depois chamava `savePaymentWithAudit`. Esse método abria uma transação para `save()` do pagamento e inserção da auditoria, sem proteger a leitura anterior. Duas transações podiam gravar cópias diferentes do mesmo agregado. A atomicidade entre uma gravação e sua auditoria não impedia uma gravação posterior baseada em estado antigo.

A auditoria original registrou 5 regressões em 15 pares HTTP. O script original foi executado novamente contra outro MySQL 8: essa amostra livre teve 0/15 regressões, o que evidencia o caráter não determinístico e não invalida o defeito. Em seguida, a barreira InnoDB reproduziu **15/15 regressões**. A conexão de controle segurou a linha; a baixa entrou na fila primeiro, seguida da aprovação. Antes de liberar, `performance_schema.data_lock_waits` comprovou dois escritores esperando. Ambos responderam 200 e a linha terminou `approved`, apesar da baixa bem-sucedida. Os dados SQL e eventos de cada caso estão em `evidencias/deterministic-before.json`; o script livre está em `race-original.cjs` e sua saída em `evidencias/payment-race-before.json`.

## Disciplina de escrita adotada

Cada edição, aprovação, baixa e cancelamento agora entra em `mutatePaymentWithAudit`. O repository abre a transação e usa **o mesmo EntityManager** para:

1. Ler o projeto existente com lock compartilhado, por ID. A ordem projeto → pagamento coincide com o ciclo de vida do projeto, que adquire lock exclusivo no projeto.
2. Ler o pagamento com `pessimistic_write` (`SELECT ... FOR UPDATE`), filtrando ID, projeto e organização do projeto.
3. Revalidar organização do ator, política de mutação do projeto e regra de estado, **depois dos locks**.
4. Persistir o agregado e sua auditoria; confirmar ambos juntos. Exceções revertem ambos.

No MySQL/InnoDB, a leitura com lock vê a versão atual confirmada, inclusive sob `REPEATABLE READ`. A requisição que espera reavalia o estado efetivamente deixado pela anterior. Nenhum objeto carregado antes da transação é aceito como autorização para a transição. `savePaymentWithAudit` fica restrito a criação (ID novo); tentar usá-lo para um pagamento existente lança erro. Não existem mutexes em memória, filas locais ou alterações artificiais de timeout como mecanismo de integridade.

O lock compartilhado do projeto permite escrita em pagamentos diferentes do mesmo projeto e impede que o projeto mude de estado durante a mutação. O lock exclusivo do pagamento serializa somente sua linha. Os testes usam duas instâncias Nest e dois pools de conexão independentes, dentro do mesmo processo de testes; não se afirma que foram dois processos do sistema operacional. As garantias vêm do InnoDB e são compartilhadas por instâncias da aplicação que utilizem esses caminhos.

O caminho SQLite mantém compatibilidade dos testes comuns, sem pretender reproduzir locks MySQL. A suíte específica exige os dois opt-ins de banco descartável e nunca roda em SQLite como evidência da concorrência.

## Estado e trilha

`PaymentStateConflict` distingue conflitos de estado das demais falhas e o serviço os traduz para HTTP 409. Uma requisição rejeitada não grava auditoria. O formato de sucesso, as permissões e as regras válidas permanecem preservados. O domínio também rejeita mutações quando encontra `paid_at` ou `paid_by_id` em um registro de estado incoerente; a leitura continua disponível. Esse bloqueio não faz remediação histórica.

A auditoria gravada na transação mantém organização, projeto, pagamento, ator e data. A baixa registra estado anterior/posterior, data efetiva, ator/instante de baixa e valor. Criação, aprovação e cancelamento também passam a guardar o valor como snapshot na auditoria nova. Edições registram os valores reais anteriores/posteriores de `daily_total` e `final_amount`, em vez de `before: null`. Nenhum evento antigo é reescrito ou excluído.

Não existe transferência bancária, tabela separada de desembolso ou estorno de `FieldAgentPayment` nesse contrato. O efeito financeiro existente é a linha em `paid`, acompanhada de `MARK_PAYMENT_AS_PAID`. O estorno de recebíveis é outro domínio e permanece separado. Nenhuma operação de estorno de pagamento foi inventada.

## GAI-001: resumo limitado à primeira página

`paymentSummary` solicitava `listPayments(page=1, pageSize=100)`, somava os itens retornados com `Number` e usava a contagem total da consulta paginada. Por isso a quantidade abrangia 101 registros e o dinheiro somente 100.

A nova operação `summarizePayments` executa **uma consulta SQL** com `COUNT(*)` e `SUM(CASE WHEN status ... THEN final_amount ELSE 0 END)`, por organização e projeto. Não usa `LIMIT`, paginação ou materialização das entidades. Todos os totais e a contagem são obtidos no mesmo snapshot de leitura. No MySQL, `SUM(DECIMAL)` permanece decimal; a formatação das strings não converte o total para `Number`. O `ROUND(..., 2)` também permite compatibilidade com testes SQLite, sem atribuir a esse driver as garantias financeiras verificadas no MySQL.

Os critérios de elegibilidade preservam o comportamento anterior de `listPayments`: mesmo escopo organizacional/projeto, todos os estados e `withDeleted`. Não há endpoint de exclusão de pagamentos neste módulo. Não se alterou a política de históricos soft-deleted. O endpoint de resumo continua sem filtros de listagem e não recebeu cache. Leituras após confirmação da baixa refletem a nova distribuição dos estados.

Não houve migration, alteração de schema ou atualização de saldos históricos.
