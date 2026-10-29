# Riscos residuais e próxima onda

A correção local de GAI-010 e GAI-001 não constitui liberação para produção ou aceite final da homologação integrada. Os demais achados da auditoria permanecem abertos e precisam de critérios próprios de aceite.

- GAI-002: validação civil de datas ainda normaliza datas impossíveis. Não foi feita correção silenciosa de competência ou histórico.
- GAI-011: alinhamento de timezone entre instantes da aplicação e defaults SQL continua pendente. A suíte verifica coerência do instante de baixa com sua auditoria, não certifica todos os timestamps do sistema.
- GAI-003/004: o runner padrão ainda mistura drivers para outras suítes MySQL; as duas expectativas independentes de exportação genérica continuam pendentes, com resultados explicitados em `testes.md`.
- GAI-005/006/007/008/009/012: navegação/contexto, recortes grandes de laudos, configuração documental, lint global/CI, introspecção de schema e triagem de dependências não foram resolvidos nesta onda.
- Auditoria e eventual remediação de pagamentos históricos suspeitos devem ser planejadas em modo somente leitura e submetidas a autorização separada. O bloqueio preventivo por metadados não é diagnóstico universal de todos os estados legados possíveis.
- A fórmula individual antiga de pagamentos ainda usa `Number/toFixed`; esta onda remove essa conversão do **somatório do resumo**, sem reprocessar cálculos históricos ou redefinir arredondamento do domínio.
- Despesas usam outro agregado e outra disciplina de escrita; não receberam a proteção de concorrência dos pagamentos. Recomenda-se avaliar suas intercalações em onda própria, sem afirmar falha reproduzida que esta execução não demonstrou.
- Os locks duram até o commit. Contenção, deadlock por futuras escritas que invertam a ordem e timeout operacional devem ser monitorados. Não se implementou retry automático opaco; uma falha de transação não grava baixa ou auditoria parcial. A amostra de stress não estima capacidade produtiva.
- O banco de teste usa tmpfs e parâmetros reduzidos de flush exclusivamente para velocidade. Isso não certifica recuperação de desastre, durabilidade após queda, AWS, balanceador, ThrottlerGuard global, autenticação de infraestrutura ou operação bancária real.

Uma implantação futura deve atualizar todos os escritores para a mesma disciplina transacional; instâncias antigas podem continuar gravando agregados obsoletos. Nenhuma implantação foi realizada ou autorizada por esta entrega.

Próxima onda: tratar GAI-002/011, separar formalmente os runners SQLite/MySQL/S3, corrigir os testes das rotas especializadas sem enfraquecer RBAC e executar a homologação compartilhada no ambiente autorizado. Manter os bloqueios de infraestrutura, dependências e restauração do relatório original.
