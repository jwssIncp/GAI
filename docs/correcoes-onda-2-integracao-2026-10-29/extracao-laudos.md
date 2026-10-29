# Extração integral de laudos — GAI-006

## Reprodução e finalidade do limite anterior

`evidencias/reproduction-extraction.json` registra HTTP 400 ao criar um laudo sintético com 1.001 itens. O extrator anterior usava `take(1001)` e recusava mais de 1.000 por família. Portanto, o achado era bloqueio explícito, não geração silenciosamente truncada. O renderer já tinha limites próprios de entrada, tempo, heap, páginas e arquivo; remover somente o `take` deixaria a aplicação sem controle de materialização.

A mesma função carregava unidades, inventário, base contábil, observações, conciliações, consolidações, histórico assistido, avaliações e pendências. O filtro de lote de avaliação era aplicado depois da carga limitada. Muitas avaliações históricas podiam bloquear um recorte que selecionaria poucas linhas.

## Estratégia implementada

O serviço mantém o contrato de snapshot e usa páginas de 250 registros com `id > cursor`, ordenação crescente e escopo de organização/projeto em toda consulta. Sessão e lote, quando aplicáveis, são filtros SQL. A quantidade lida é comparada à contagem do mesmo recorte; uma divergência aborta a operação. Não há novo teto arbitrário de quantidade.

Antes da primeira página, MySQL calcula contagem e uma estimativa em bytes usando `JSON_OBJECT`/`OCTET_LENGTH`, incluindo escaping e margem por registro. Isso impede que uma página com JSON/TEXT muito grande seja materializada antes da proteção. O teste com JSON de 5 MiB exige HTTP 413 e **zero chamadas de busca de página de inventário**. A contagem de bytes real também é conferida durante a leitura.

| Proteção | Comportamento |
| --- | --- |
| Página | Até 250 entidades por consulta, cursor estável |
| Fam?lias paginadas/proje??o de unidades | Até 4 MiB de representação serializada/estimada por captura; excedente retorna `TECHNICAL_REPORT_SOURCE_LIMIT` / 413 |
| Snapshot materializado | Até 2 MiB, reservando espaço ao conteúdo autoral no limite de entrada do renderer; excedente retorna `TECHNICAL_REPORT_SNAPSHOT_LIMIT` / 413 |
| Extração | Orçamento de 15 segundos; erro `TECHNICAL_REPORT_SOURCE_TIMEOUT` / 503 |
| Consulta de estimativa MySQL | Hint de tempo máximo; timeout 3024 convertido em erro explícito |
| Falha | Transação não salva laudo, versão ou comando parcial |

São limites de processamento, não promessa de RSS de 4 MiB. Entidades, arrays, hashes canônicos e strings exigem memória adicional. A materialização final é necessária ao snapshot JSON existente e fica limitada em bytes. Unidades são resolvidas em lotes e com projeção dos campos usados, eliminando uma consulta por vínculo. O cálculo da última execução não usa spread de array em `Math.max`.

## Consistência e histórico

As capturas continuam dentro das transações `REPEATABLE READ` do serviço de laudos. As escritas mantêm o lock organizacional antes da primeira leitura consistente e a comparação de revisão existente. Removi o `pessimistic_read` das consultas de fonte: leituras com lock no MySQL poderiam enxergar o estado mais recente, misturando-o à visão consistente já estabelecida.

Um teste altera um item de página posterior enquanto a captura ocorre e agenda uma inserção concorrente. O primeiro snapshot mantém os valores/quantidade da visão inicial; uma captura seguinte vê 1.002 itens e outro hash. Não se afirma que todos os escritores ficam bloqueados: a garantia usada é uma visão consistente de leitura.

Permanecem as referências e hashes de registros, seleção, versão, validação e auditoria. O algoritmo canônico e o identificador do motor não foram substituídos. Seleção de última avaliação mantém data civil e desempate por ID; histórico usado na proveniência continua completo. Avaliações sem moeda seguem com total indisponível, sem assumir BRL ou modificar cálculos financeiros.

Nenhum laudo histórico/aprovado foi regravado, e não foi criada migration. PDF/DOCX continuam consumindo a versão aprovada preservada. Atualização de fontes exige o comando explícito existente em uma revisão editável.

## Volume e capacidade

Os resultados por volume, tempo, bytes e memória estão em `evidencias/mysql/report-volume.json`. Os testes conferem 0, 1, 999, 1.000, 1.001, 2.500 e 5.000 itens contra SQL, sem duplicidade/omissão, ordem estável, hash repetível das fontes e persistência do snapshot. Há também 1.001 unidades, registros contábeis, pendências, observações e conciliações, com suas consolidações, e 2.500 avaliações históricas para um item.

O tempo dos cenários de inventário inclui duas capturas, leitura de conferência SQL e persistência. RSS/heap são do processo Jest/Nest compartilhado e não representam pico exclusivo de uma chamada. As evidências distinguem isso de tempo de renderização.

Não foi adicionada fila distribuída ou módulo novo. Os volumes aceitos cabem no mecanismo atual e excedentes são recusados integralmente, com resposta recuperável. Uma necessidade comercial acima desses orçamentos exige evolução própria de processamento assíncrono, armazenamento e retenção, em vez de aprovar documentos parciais.
