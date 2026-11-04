# GAI Auditoria integrada em 28 de outubro de 2026

<!-- ONDA-1-STATUS -->
## Atualização da Onda 1 — 29/10/2026

Implementação e validação local concluídas; **produção não liberada**. [Relatório da Onda 1](../correcoes-onda-1-integridade-2026-10-28/README.md). GAI-002/003/004/008/009 corrigidas e validadas; GAI-011 corrigida para novas operações UTC, com histórico pendente de análise; GAI-012 parcialmente remediada (7 alertas backend e 1 frontend em --omit=dev). GAI-001/010 preservadas e revalidadas; GAI-005/006/007 continuam abertas.

Padrão 683/683, MySQL 307/307, S3 7/7, frontend 247/247, navegador 2/2; zero skips nas rodadas finais. Cobertura original e lint global aprovados. Não somar reexecuções. **O texto anterior abaixo é histórico preservado**, incluindo a atualização da Onda 0 e as reproduções originais.
<!-- /ONDA-1-STATUS -->


## Atualização após a Onda 0 financeira — 28/10/2026

**GAI-010 e GAI-001: corrigidos e validados localmente.** A correção e as evidências estão em [correcoes-onda-0-financeiro-2026-10-28](../correcoes-onda-0-financeiro-2026-10-28/README.md). Na execução final houve 124 pares concorrentes (109 com barreira InnoDB; 100 de stress), sem regressão de baixa; os resumos foram validados até 1.310 registros e com decimais grandes. Leitura com lock, validação, escrita e auditoria agora compartilham a transação. O GAI-001 foi antecipado para esta onda. Não houve migration ou reparo histórico.

As reproduções originais e os resultados abaixo são o **registro histórico anterior à correção** e foram preservados. Os demais achados continuam abertos. Os dois testes independentes de exportação genérica foram reexecutados e continuam falhos; produção e aceite integrado final permanecem não liberados. Consulte o relatório da Onda 0 para contagens atuais e limites.


**Não apto para aceite final de homologação integrada nem para produção neste estado.** Há um bloqueio crítico confirmado em pagamentos: aprovação concorrente pode sobrescrever uma baixa bem-sucedida, e a API admite nova baixa sem estorno. A base permite continuar investigação e homologação exploratória exclusivamente com dados sintéticos; isso não é aprovação de uso financeiro real.

## Resultado funcional das 98 capacidades

| Estado atual | Quantidade |
| --- | ---: |
| IMPLEMENTADA | 42 |
| PARCIAL | 27 |
| AUSENTE | 12 |
| INCOMPATÍVEL POR DECISÃO | 10 |
| NÃO VERIFICADA | 7 |
| Total | 98 |

Cada ID F001–F098 foi preservado e recebeu análise própria em [matriz-funcional-atualizada.md](matriz-funcional-atualizada.md) e [CSV](matriz-funcional-atualizada.csv), com estado anterior/atual, backend, frontend, evidência, testes, lacunas e prioridade. IMPLEMENTADA significa fluxo persistido e interface correspondente no escopo descrito; não certifica paridade integral, ausência de bugs ou produção. As exclusões incompatíveis mantêm as justificativas arquiteturais originais, não novas decisões de negócio.

Ausências: tolerância monetária físico-contábil; adiantamentos/saldo por técnico; solicitação/liquidação de reembolso do cliente; documentos cadastrais do inventariante; atualização de pagamentos em lote; atividades e jornada/retroativos; CRM e cursos/inscritos/etapas. Parcialidades relevantes: conversão orçamento→contrato, caixa com saídas sem moeda, composição fotográfica de laudos, totalização normativa de avaliações, PPTX e importação DRE. APK/offline, backend legado, restore e assinatura/motor normativo permanecem não verificados ou não comprovados conforme cada ID. Nenhum desses novos módulos foi iniciado.

## Achados que mudam a prontidão

São 12 ocorrências documentadas: **1 crítica, 5 altas e 6 médias**. [Problemas priorizados](problemas-priorizados.md) contém evidência, arquivo, reprodução, impacto, correção e testes para cada uma. [Plano de correções](plano-correcoes.md) define ondas, dependências e aceite.

- **GAI-010, crítico:** 5/15 corridas HTTP/MySQL entre aprovação e baixa terminaram approved após resposta paid=200. SQL confirmou paid_at e auditorias; segunda baixa aceita sem estorno. Não houve transferência bancária real.
- **GAI-001, alto:** 101 pagamentos de 1.00 retornam total_count=101 e soma=100.00 no resumo.
- **GAI-002/011, médios:** data impossível 2026-02-30 vira 2026-03-02; timestamps MySQL/aplicação apresentaram diferença de três horas no ambiente auditado.
- **GAI-003/004/008:** runner backend padrão e lint global falham; dois testes de exportação precisam refletir o contrato atual.
- **GAI-005/006:** links globais perdem contexto do projeto e extração de laudo limita famílias a 1.000 registros.
- **GAI-007/009:** configuração ECS não habilita modo documental exigido; diff TypeORM falha sem typeorm_metadata para coluna gerada.

## Evidência executada agora

| Verificação | Resultado |
| --- | --- |
| Backend completo no runner padrão | 638 aprovados, 76 falhos, 7 ignorados |
| HTTP/integracão MySQL descartável | 272 aprovados, 2 falhos, 7 S3 ignorados nessa execução |
| S3 real local em MinIO exclusivo | 7 aprovados |
| Casos backend consolidados sem contar reexecuções | 721 casos: 719 aprovados, 2 falhos |
| Vitest frontend completo | 247 aprovados |
| TypeScript backend e frontend | Aprovados |
| Builds Nest e Vite com saída isolada | Aprovados; bundle frontend com aviso de tamanho |
| ESLint backend/frontend sem auto fix | 83 erros backend; frontend zero erros e um aviso |
| Migrations e schema novo MySQL | 32 aplicadas, nenhuma pendente; 101 entidades/tabelas + migrations |
| Playwright Chromium, API/MySQL reais | 11 aprovados, 0 falhos, 0 ignorados |
| PDF/DOCX sintéticos 1/60/180 linhas | 6 nativos estruturalmente válidos; PDF 2/5/12 páginas, amostra visual revisada |

Os 719 aprovados consolidados não tornam npm test verde: o comando padrão falhou por misturar suítes MySQL no SQLite. Também não substituem as reproduções adicionais que descobriram GAI-001/002/010/011. Os dois casos de navegação caracterizam um defeito atual; aprovação do teste de reprodução não é aceite da regra defeituosa. Método de contagem, comandos, falhas de preparação e resultados por cenário estão em [testes.md](testes.md).

## Arquitetura, segurança e preservação

26 módulos, 312 endpoints e 161 permissões foram inventariados. Metadados não exigem chaves ausentes do seed. Controles de sessão, escopo organizacional, catálogo fail-closed, permissões de fonte, download e snapshots foram confrontados com código e testes HTTP. Não foi confirmado vazamento de dados entre organizações nas verificações executadas. A corrida financeira foi encontrada por teste adicional do módulo antigo e não pode ser descartada por suites gerais verdes nos módulos novos.

Arquivos da aplicação e alterações locais anteriores foram preservados; a entrega e scripts/evidências ficam nesta pasta. Sem commit, push, deploy, migrations em produção, envio de mensagens ou edição de dados reais. Usaram-se SQLite em memória, MySQL 33317, API 33319, frontend 33320 e MinIO 33318 exclusivos da auditoria. Ambiente existente 3306/3000/5173/9000 não foi usado para as escritas de teste. Logs e backups sintéticos são evidência local, não dados de cliente.

## Pendências para produção

Corrigir e revalidar Onda 0 e bloqueios obrigatórios; homologar AWS real (MinIO não substitui IAM/CORS/versões/criptografia), modo documental/retencão, upgrade de cópia histórica e restore; validar DOCX em Word/render canônico, carga/volume representativos, timezone e fluxos de negócio ausentes do escopo aprovado. Migração antiga contém reconstrução destrutiva e outra é irreversível; isso exige baseline e recuperação operacional antes de release. Não foi declarada homologação do storage AWS.

## Documentos da entrega

1. [Inventário e arquitetura](inventario-atual.md), com [rotas e permissões](rotas-permissoes.md).
2. [Matriz das 98 capacidades](matriz-funcional-atualizada.md) e [CSV](matriz-funcional-atualizada.csv).
3. [Integrações](integracoes.md) e [Segurança/RBAC](seguranca-rbac.md).
4. [Auditoria financeira](auditoria-financeira.md) e [patrimonial](auditoria-patrimonial.md).
5. [Frontend e navegação](frontend-navegacao.md).
6. [Documentos/storage](documentos-storage.md) e [banco/migrations](banco-migrations.md).
7. [Testes](testes.md), [problemas](problemas-priorizados.md) e [plano](plano-correcoes.md).

Evidências JSON/logs, manifesto de fontes, cópias de suites, configurações e scripts de reprodução acompanham os documentos. Relatórios anteriores foram usados para localizar hipóteses; o parecer acima se apoia no código atual e nas execuções desta auditoria.

A varredura atual de dependências também requer atenção: [dependencias-seguranca.md](dependencias-seguranca.md) registra 20 entradas backend e 5 frontend reportadas pelo npm. São alertas sobre a árvore resolvida, com alcance ainda em triagem; não foram classificados como explorações confirmadas. GAI-012 integra a Onda 1.
