# Arquivos e impactos

| Arquivo no backend | Alteração |
| --- | --- |
| `src/modules/payments-expenses/application/services/payments-expenses.service.ts` | Encaminha edição/aprovação/baixa/cancelamento ao callback executado sob lock; revalida escopo e projeto; conflitos 409; resumo por agregação. |
| `src/modules/payments-expenses/domain/entities/field-agent-payment.ts` | Rejeita mutação de pagamento baixado ou com metadados de baixa; preserva a máquina de estados; valores anteriores corretos na auditoria de edição e valor da baixa. |
| `src/modules/payments-expenses/domain/entities/payment-state-conflict.ts` | Erro de domínio específico para conflito de estado. |
| `src/modules/payments-expenses/domain/ports/payments-expenses.repository.port.ts` | Contrato da mutação transacional e do resumo exato. |
| `src/modules/payments-expenses/infrastructure/persistence/typeorm-payments-expenses.repository.ts` | Locks projeto/pagamento, leitura e escrita com manager transacional, proteção contra save de agregado antigo, auditoria atômica e SUM/COUNT sem paginação. |
| `test/integration/test-app.helper.ts` | Opt-in fixo `GAI_TEST_MYSQL_WAVE0=1` seleciona somente 127.0.0.1:33327; opção explícita de reutilização do schema permite segunda instância sem reset. |
| `test/integration/payments-expenses/payment-integrity.mysql.e2e-spec.ts` | Suíte HTTP/MySQL, duas instâncias, barreiras reais, rollback SQL, repetição, isolamento, resumo e stress. |
| `test/unit/modules/payments-expenses/payments-expenses.spec.ts` | Regressões das regras de baixa, preservação dos dados e snapshots monetários. |

As seis fontes preexistentes alteradas foram copiadas antes da edição para `evidencias/antes/`; seus hashes estão em `evidencias/baseline.json`. Não se restaurou nenhuma fonte a partir do Git, cujo workspace já continha alterações extensas do usuário. Dois arquivos TypeScript são novos. Scripts e artefatos desta correção ficam nesta pasta; saídas de build não sobrescrevem o `dist` anterior.

## APIs

URLs, DTOs de entrada/saída e permissões permanecem os mesmos. As rotas `PATCH /projects/:projectId/payments/:id` e `POST .../approve|mark-as-paid|cancel` passam a responder **409 CONFLICT** para conflitos de estado, em lugar do 500 gerado pelo erro genérico anterior. Não foi adicionada chave obrigatória, campo de versão, etapa de aprovação ou estorno.

`GET /projects/:projectId/payments/summary` mantém as cinco propriedades e strings monetárias com duas casas. Sua quantidade e seus valores agora consideram a população completa. A auditoria nova contém snapshot de valor adicional; os eventos anteriores ficam intactos.

## Módulos relacionados

O resumo de projetos, overview organizacional, exportações e caixa consultam os pagamentos persistidos e passam a observar estados que não podem mais ser sobrescritos por essas mutações concorrentes. Seus contratos de leitura não foram alterados. A regressão cobre esses consumidores, prestação de contas e seus parcelamentos.

Recebíveis preservam revisão, `command_key`, recibos e estornos próprios. O caixa mantém previsto/realizado conforme o estado e os eventos das fontes; baixar pagamento não cria receita. A DRE continua dependendo de reconhecimento explícito por competência. Nenhum vínculo, lançamento de competência, recebível ou reembolso é criado automaticamente pela correção.

Nenhum arquivo frontend, permissão, seed produtivo, migration ou dependência foi modificado. Não houve commit, push, deploy, `release:prod` ou migração em banco persistente.

## Preservação final

As instâncias HTTP temporárias foram encerradas pelos próprios harnesses. O container `gai-wave0-20261028-mysql` permanece em execução para preservar os dados do tmpfs; não foi removido nem parado. Os dumps das fases anterior, regressão, aceite e smoke adicional estão em `evidencias/*-synthetic.sql`, com hashes em `delivery-qa.json`. A leitura final confirmou MySQL 8.0.46, `REPEATABLE-READ`, 32 migrations existentes e 102 tabelas, sem alteração de schema nesta correção. A validação dos links do relatório, sintaxe dos sete scripts e preservação dos campos originais dos achados terminou sem erros.
