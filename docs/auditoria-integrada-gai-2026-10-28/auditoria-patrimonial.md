# Auditoria patrimonial

O desenho separa cadastro mestre, observação de campo, rodadas, conciliação, consolidação e avaliações. Os testes de regressão exercitam persistência e preservação dessas fontes; não foi feita reescrita de mestre/histórico nesta auditoria.

| Objeto | Verificação e evidência |
| --- | --- |
| Itens e placas | `gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts:1`; importações/observações não substituem a placa mestre. Histórico de placas, rodadas e linhagem de reinventário são entidades próprias. |
| Sessões e rodadas | Retomada após refresh, cancelamento, rodadas de reinventário e bloqueios de lifecycle têm casos HTTP. `gai-backend/test/integration/inventory-operations/inventory-operation-gaps.e2e-spec.ts`; `gai-backend/test/integration/inventory-operations/inventory-operations.e2e-spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.entity.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/inventory-operation.policy.spec.ts`; `gai-backend/test/unit/modules/inventory-operations/valuation.policy.spec.ts` |
| Pendências | Escopo projeto/item, resolução e geração são persistidos. Tarefa pode exigir pendência resolvida; resolver uma não sincroniza a outra. |
| Conciliação básica | Placa normalizada e última observação; envelope versionado e consulta paginada. Não há tolerância monetária físico-contábil. |
| Sugestões assistidas | `gai-backend/src/modules/assisted-reconciliation/matching.policy.ts:1`; placa, série e Jaccard textual/local, limiares e alertas; não é Dice/desempate monetário completo do legado. |
| Revisão/consolidação | `gai-backend/src/modules/assisted-reconciliation/assisted.service.ts:1`; comandos idempotentes, claims um-a-um, bloqueio de ambiguidades, rejeição com histórico e respeito a decisões já consolidadas. |
| Avaliações individuais e lote | `gai-backend/src/modules/inventory-operations/application/valuation-batch.service.ts:1`; preview não grava valores, confirmação atômica acrescenta histórico por item e revalida membership/fontes. Limite configurado de 1 a 500 itens, default 100. |
| Laudos/snapshots | `gai-backend/src/modules/technical-reports/report.sources.ts:1`; captura tabelas e hashes, sem conversão em total monetário quando moeda não é conhecida. Aprovação congela versão; reabertura explícita mantém aprovação anterior. |

## Obsolescência e imutabilidade

Sugestão histórica retorna stale quando o hash atual diverge; aprovação revalida edições, novas observações, adições e exclusão lógica. Nova avaliação ou fonte retificada altera o hash de captura do laudo; validate/review/approve reconsultam fontes e aplicam a política stale_sources do modelo. Bloquear ou avisar é configurável por modelo publicado. Não se deve exigir regravação automática de documento aprovado: ele representa o snapshot histórico.

Versões aprovadas contêm conteúdo, fonte, visual, revisão e hash. Edição direta após aprovação é rejeitada; reabrir exige motivo. Download de versão antiga continua sujeito à autorização atual das fontes. Um arquivo histórico válido não significa que seus dados sejam os mais recentes.

As consultas de validação frontend podem ficar montadas enquanto outra aba altera fontes; backend revalida antes de aprovar, mas a atualização visual transversal imediata não foi certificada para todas as mutações. Esse limite não deve ser confundido com falta de proteção do snapshot no servidor.

## Limitações de uso patrimonial

Fonte documental é limitada a 1.000 registros por família antes de seleção posterior; o DTO não fornece recorte arbitrário por lista de itens. Projetos ou históricos maiores podem não emitir laudo completo (GAI-006). O bloqueio é explícito, sem truncamento silencioso. Avaliações não possuem moeda confiável para total global; valuation.used_total permanece null. Não há cálculo normativo CPC/vida útil/valor justo automático nem assinatura digital comprovada; responsabilidade técnica é informada e validada conforme regra, sem consulta de conselho.

Fotos existem como evidência de item, mas DocumentBlock só prevê texto/tabela e logo institucional; fotos/legendas de ativos ainda não são composição do laudo. Nenhum módulo de atividades, CRM ou curso foi criado para preencher lacunas da matriz.
