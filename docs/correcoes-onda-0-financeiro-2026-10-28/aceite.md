# Aceite local da Onda 0

| Critério | Resultado e evidência |
| --- | --- |
| Reproduzir GAI-010 antes de corrigir | Cumprido. Script livre original e 15/15 falhas com barreira InnoDB, SQL e auditorias preservados. |
| Fixar invariantes sem mudar regras válidas | Cumprido. Baixa de pending/approved preservada; paid não admite aprovação, edição, baixa adicional ou cancelamento. Estorno de pagamento e replay por chave não existem no contrato. |
| Sincronizar todas as mutações relevantes | Cumprido. Projeto S → pagamento X, validação após lock e um EntityManager até o commit; criação não aceita ID existente. |
| Garantir trilha coerente e rollback | Cumprido. Um evento por baixa, ator/data/valor/referências conferidos; trigger SQL força falha de auditoria, sem efeito parcial; retentativa completa apenas uma baixa. |
| Concorrência HTTP real em MySQL 8 | Cumprido. Aceite final com 124 pares, 109 barreiras e 100 pares de stress; zero resultado incoerente, duas instâncias/pools. |
| Projetos/organizações distintos e RBAC | Cumprido. Pagamentos independentes avançam sob lock de outra linha; tenant cruzado e permissão ausente rejeitados. |
| Corrigir resumo completo e decimal | Cumprido. 0/1/100/101/1.205/1.310 registros, quatro estados, escopo e atualização após commit; SUM grande exato. |
| Regressão de consumidores financeiros | Cumprido no escopo local. Caixa após stress tem 100 saídas realizadas distintas e nenhuma prevista; resumo/dashboard coerentes. Suítes de DRE (20), recebíveis/caixa (18), export jobs (4) e project dashboard (3) aprovadas. Smoke adicional fecha prestação de contas e confere overview/parcelas/caixa por HTTP real. |
| Reexecutar as duas falhas antigas | Cumprido quanto à reexecução. Continuam falhas independentes de expectativa da rota genérica; não foram alteradas ou omitidas. |
| Unidade, frontend, TypeScript/build/lint | Cumprido. 376 testes em test/unit, 247 frontend, TypeScript, build isolado e lint dos oito arquivos alterados aprovados. |
| Preservação de ambientes e alterações | Cumprido. Somente schema descartável 33327; sem migration nova, banco real, remediação histórica, commit, push ou deploy; fontes anteriores e dumps preservados. |
| Documentar e atualizar a auditoria | Cumprido. Relatório desta pasta, status de GAI-010/001 atualizados e reproduções antigas intactas. |

O aceite é **local e restrito às duas correções**. O comando de integração completo registrou 283 aprovados/3 falhos/7 ignorados, incluindo um fixture posteriormente corrigido. Com a substituição explícita da suíte reexecutada, há 284 aprovados/2 falhos/7 ignorados, sem dupla contagem. Isso não autoriza produção nem representa uma suíte global verde.

Os limites de infraestrutura, históricos, outros achados e rollout estão em [riscos-e-proxima-onda.md](riscos-e-proxima-onda.md).
