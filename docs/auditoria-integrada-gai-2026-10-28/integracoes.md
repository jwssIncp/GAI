# Integrações entre módulos

## Atualização após a Onda 0 financeira — 28/10/2026

**GAI-010 e GAI-001: corrigidos e validados localmente.** A correção e as evidências estão em [correcoes-onda-0-financeiro-2026-10-28](../correcoes-onda-0-financeiro-2026-10-28/README.md). Na execução final houve 124 pares concorrentes (109 com barreira InnoDB; 100 de stress), sem regressão de baixa; os resumos foram validados até 1.310 registros e com decimais grandes. Leitura com lock, validação, escrita e auditoria agora compartilham a transação. O GAI-001 foi antecipado para esta onda. Não houve migration ou reparo histórico.

As reproduções originais e os resultados abaixo são o **registro histórico anterior à correção** e foram preservados. Os demais achados continuam abertos. Os dois testes independentes de exportação genérica foram reexecutados e continuam falhos; produção e aceite integrado final permanecem não liberados. Consulte o relatório da Onda 0 para contagens atuais e limites.


As verificações abaixo combinam código atual e testes reais Nest/HTTP. A execução e as limitações de cada ambiente estão em testes.md. Relacionamento existente não implica propagação automática de estado ou valores.

| Integração | Evidência atual | Contrato e limites |
| --- | --- | --- |
| Empresas → projetos | `gai-backend/src/modules/projects/application/services/project-scope.service.ts:1`; `gai-backend/src/modules/companies/application/services/companies.service.ts:1` | Escopo organizacional e vínculos de empresa/unidade. Projetos antigos sem empresa são preservados; relações inválidas são rejeitadas pelos serviços. |
| Projetos → contratos | `gai-backend/src/modules/contracts/contract.service.ts:37` | Contrato consultado com projectId/organizationId; escrita revalida lifecycle e gera revisão imutável. Projeto sem contrato continua válido. |
| Contratos ↔ orçamentos | `gai-backend/src/modules/budgets/budget.service.ts:689` | Sem conversão persistida automática. Preview retorna creates_contract/creates_project/creates_receivables=false. Não existe vínculo financeiro deduzido só por empresa/projeto. |
| Projetos → Kick-off | `gai-backend/src/modules/project-preparation/preparation.service.ts:1` | Instâncias kickoff/client-checklist independentes; snapshot de modelo, IDs estáveis, respostas auditadas e contexto de unidades. |
| Projetos → campo | `gai-backend/src/modules/field-coordination/field.service.ts:1` | Checklist por projeto, modelos publicados e revisões. Concluir campo não conclui o projeto automaticamente. |
| Inventariantes → tarefas | `gai-backend/src/modules/field-coordination/field.service.ts:1` | Diferencia usuário organizacional de técnico vinculado; não resolve por nome. Responsável deve pertencer ao escopo e ser elegível. |
| Inventário → pendências | `gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issues.service.ts:1` | Pendência por item; geração/resolução preserva histórico. Resolver pendência não altera tarefa ou observação sem ação explícita. |
| Inventário → conciliação | `gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts:1` | Usa últimas observações e placa normalizada; não altera placa mestre nem histórico de rodadas. |
| Conciliação → consolidação | `gai-backend/src/modules/assisted-reconciliation/assisted.service.ts:1` | Aceite explícito e idempotente; claims/locks evitam pareamentos concorrentes. Fontes novas/alteradas obsoletam execução anterior; decisão consolidada não é sobrescrita. |
| Avaliações → laudos | `gai-backend/src/modules/technical-reports/report.sources.ts:403` | Snapshot de avaliações selecionadas, data e desempate por ID. Moeda não informada impede total confiável; nova avaliação altera hash de fonte e validação. |
| Contratos → recebíveis | `gai-backend/src/modules/receivables/receivable.service.ts:238` | Geração explícita uma vez por origem. Principal original e aditivo positivo são origens separadas. Alterar contrato não regrava recebível já criado; aditivo negativo exige decisão de ajuste. |
| Recebíveis → caixa | `gai-backend/src/modules/receivables/cash-flow.service.ts:1` | Saldo aberto no previsto, eventos assinados no realizado; estorno negativo na data efetiva. Sem duplicar o principal no realizado. |
| Despesas → caixa | `gai-backend/src/modules/receivables/cash-flow.service.ts:166` | Soma despesa original ou parcelas previstas elegíveis, sem somar prestação novamente; baixa integral remove previsto. Saídas sem moeda ficam em UNSPECIFIED. |
| Classificações → DRE | `gai-backend/src/modules/managerial-dre/dre.service.ts:1` | Reconhecimento explícito por competência, rateios e fonte única; recebimento/estorno de caixa não cria nova receita de competência automaticamente. Fechamento é versionado. |
| Laudos → documentos | `gai-backend/src/modules/documents/documents.service.ts:55` | Somente versão aprovada para laudo; autorizações de documento e fontes revalidadas na geração e no download. Hash de snapshot e identidade visual no cache. |

## IDs, datas, valores e estados

Os incrementos usam organização + pai + filho, revisões esperadas, comandos com chave/hash e transações. Diversos fluxos MySQL serializam pela organização e usam locks antes da leitura consistente; isso reduz concorrência dentro do tenant, com possível custo de throughput ainda não medido. Os componentes financeiros novos usam inteiros escalados/BigInt e strings decimais; pagamentos antigos usam Number/toFixed. Há reprodução de total truncado e data inválida em pagamentos/despesas; ver GAI-001/002.

Não confundir created_at do projeto, contracted_on do contrato, competência DRE, vencimento e data efetiva. Campo calcula dia em America/Sao_Paulo; atraso financeiro compara dia UTC, explicitado no contrato atual. A decisão de calendário financeiro local deve ser formalizada; não foi demonstrado deslocamento por timezone de uma parcela civil persistida nos novos módulos.

## Cache e persistência de contexto

ProjectPreparation invalida chaves do projeto; FieldCoordination invalida fieldKeys; lote de avaliação invalida histórico/asset-valuations/itens/export jobs; conciliação assistida invalida registros relacionados; documentos usam cache por hash de fonte/visual/formato/opção de memória. O cache de documento aprovado deve continuar disponível como histórico mesmo após mudança do mestre, respeitadas permissões atuais.

A invalidação entre todos os módulos não é centralizada. Por exemplo, uma nova avaliação não invalida explicitamente a consulta já montada de validação do laudo em outra aba; o backend revalida antes da aprovação, mas a atualização visual imediata entre abas não está certificada. Recebíveis usam chaves finance, DRE usa dre; não se deve exigir que uma baixa gere reconhecimento de competência. Invalidação e atualização de indicadores após cada mutação transversal permanecem critérios de homologação, sem falha universal presumida.

Não há integração bancária, faturamento fiscal, envio automático de mensagens, conversão orçamento→contrato ou criação automática de recebíveis na aprovação. Essas ausências foram preservadas; não foram inventadas integrações durante a auditoria.
