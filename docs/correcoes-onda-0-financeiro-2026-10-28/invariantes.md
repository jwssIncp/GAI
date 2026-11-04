# Invariantes e contratos preservados

| Estado atual | Edição | Aprovação | Baixa | Cancelamento |
| --- | --- | --- | --- | --- |
| pending | Permitida | approved | paid | cancelled |
| approved | 409 | 409 | paid | cancelled |
| paid | 409 | 409 | 409 | 409 |
| cancelled | 409 | 409 | 409 | Permitido pelo contrato anterior |
| Qualquer estado com metadados de baixa incompatíveis | 409 | 409 | 409 | 409 |

A repetição de cancelamento preserva o comportamento anterior; não equivale a uma nova baixa. A baixa direta de `pending` permanece válida. A segregação entre aprovação e baixa não foi modificada.

1. Uma baixa que responde sucesso termina em `paid`; aprovação concorrente não a desfaz.
2. Exatamente uma auditoria de baixa acompanha cada baixa aceita pelo agregado. Estado, valor, ator, data e referências correspondem à operação confirmada.
3. Uma baixa repetida, simultânea ou posterior recebe 409 e não gera um segundo efeito ou evento.
4. Duas aprovações concorrentes produzem uma aprovação e um conflito. Aprovação seguida de baixa pode produzir dois sucessos, com trilha serial `pending → approved → paid`. Baixa seguida de aprovação produz sucesso e conflito.
5. Todas as mutações do pagamento usam o mesmo lock de linha e a mesma fronteira transacional. Edição anterior pode mudar o valor que será baixado; edição posterior é rejeitada. Cancelamento anterior bloqueia a baixa; cancelamento posterior à baixa é rejeitado.
6. Falha na inserção SQL da auditoria reverte o pagamento; uma retentativa posterior pode completar uma única baixa.
7. Requisições rejeitadas preservam `paid_at`, `paid_by_id`, data efetiva, valor e eventos existentes.
8. Organizações, projetos e pagamentos diferentes não compartilham um lock exclusivo global. A autorização e os vínculos do pagamento são revalidados na transação.
9. Quantidade e somas do resumo abrangem a mesma população, independentemente do tamanho da página. O total decimal do MySQL permanece exato, inclusive acima da precisão de centavos de `Number`.

Pagamentos não possuem contrato de `command_key` ou `Idempotency-Key`. O teste com o mesmo cabeçalho demonstra ausência de duplicação financeira, com resposta 409 à repetição; **não demonstra replay de resposta 200 por chave**, nem transforma um cabeçalho ignorado em funcionalidade implementada. O contrato idempotente e os estornos existentes em recebíveis são exercitados na regressão própria desse módulo.

As invariantes se aplicam às escritas da aplicação corrigida, sem afirmar que SQL administrativo arbitrário ou uma versão antiga ainda ativa do serviço obedeçam ao protocolo. Não se executaram reparos em registros históricos. Havendo rollout posterior autorizado, todas as instâncias escritoras precisam receber a correção antes de considerar a proteção integral.
