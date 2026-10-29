# Avaliação Patrimonial em Lote — GAI

27/10/2026 · America/Sao_Paulo. Implementado e homologado localmente com ORG_ADMIN, MySQL e Chromium reais, usando exclusivamente dados sintéticos. Avaliações individuais e em lote compartilham `asset_valuations`; os cadastros mestres, observações, conciliações, consolidações e avaliações anteriores permanecem preservados. Não houve commit, push, deploy ou acesso a produção.

## 1. Análise do registro existente

Consultados a [auditoria e matriz F030–F033](../auditoria-legado-gai-2026-10-27/README.md), inventário funcional, relatórios de [Preparação](../implementacao-preparacao-projetos-2026-10-27/README.md), [Coordenação de Campo](../implementacao-coordenacao-campo-2026-10-27/README.md), [Conciliação Assistida](../implementacao-conciliacao-assistida-2026-10-27/README.md), validação técnica, correções críticas e navegação. Inspecionados InventoryOperationsService, AssetValuationEntity, controllers/DTOs, InventoryItems/repository/filtros/status, ItemEvidencePanels, React Query, componentes, scope/guard, migrations e exportação.

O registro individual existente exige fonte, data e pelo menos um valor novo/usado. Valores são strings decimais não negativas, até 13 dígitos inteiros e duas casas; zero é válido. Notas são opcionais, até 4.000 caracteres. Cada avaliação gera registro histórico, ator, criação e audit log. `asset-valuations:create/read` são permissões próprias; avaliação monetária não altera o status operacional `evaluated` nem os valores mestres do cadastro.

O legado foi usado somente como referência. Examinado `avaliarLinhas` nas variantes `_2` e `_avaliacao2`: aplicava valores informados às matrizes, ignorava vazios e mantinha snapshots de navegador. Não foram copiadas mutações/IndexedDB nem presumida metodologia CPC, depreciação, vida útil ou valor justo.

SHA-256 das fontes consultadas:

- `conciliacao_fisico_contabil_2.html`: `9bcb59fc4e40fd626cc699700546249c974b6e4e29c91c1733ca7d4b56e7159f`.
- `conciliacao_fisico_contabil_avaliacao2.html`: `64dc1fafd6f789dde98f1a7e0e075f9e2d048cfb07412fe685aa4f45f4c49c2f`.

## 2. Arquitetura implementada

Extensão do InventoryOperationsModule, com `ValuationBatchService` e controller próprios para seleção/prévia/confirmação/consulta. Não foi criado outro módulo de ativos ou outra tabela de avaliações.

`valuationValues` centraliza a política e `InventoryOperationsService.recordValuation` compartilha gravação/auditoria entre o endpoint individual e o lote. Ambos verificam projeto mutável e item do mesmo projeto/organização, existente, não excluído/inativo/removido. A criação individual agora participa do mesmo lock de projeto/item usado para proteger a revalidação do lote.

Foram corrigidos pontos necessários à integridade temporal: fonte somente com espaços é recusada; data deve ser civil real `YYYY-MM-DD`, dentro do intervalo aceito pelo MySQL; novas avaliações persistem SQL DATE como string, evitando o dia anterior por conversão de fuso. Novos registros recebem timestamp explícito da aplicação. Na interface, datas de avaliação usam formatação civil também no histórico individual, sem converter meia-noite UTC para o dia anterior. Dados históricos não foram recalculados ou regravados.

## 3. Endpoints e contratos

Prefixo `/api/v1/projects/:projectId/valuation-batches`.

| Método / sufixo | Função |
|---|---|
| POST `/selection` | Resolve seleção no servidor, devolvendo projeto, limite, quantidade e itens atuais/última avaliação |
| POST `/preview` | Valida proposta e persiste prévia imutável, sem criar avaliações |
| POST `/:id/confirm` | Revalida fontes e aplica atomicamente; reenvio idempotente |
| GET `/` | Operações paginadas, mais recentes primeiro, e limite configurado |
| GET `/:id` | Consulta posterior de prévia ou resultado, com linhas, snapshots, autoria, contagens e IDs das avaliações |

Exemplo de seleção explícita:

```json
{"selection":{"kind":"ids","ids":[198,220]}}
```

Alternativa por filtros:

```json
{"selection":{"kind":"filters","filters":{"search":"SINTETICO","status":"pending"},"exclude_ids":[]}}
```

Prévia aceita `selection`, `mode: common|individual`, `common: {source,valuation_date,new_value?,used_value?,notes?}`, `command_key` e, no modo individual, `values: [{inventory_item_id,new_value?,used_value?}]`. Fonte, data e notas são comuns nos dois modos; o modo individual permite valores diferentes por item. Sua lista deve corresponder exatamente à seleção, sem duplicações, faltantes ou IDs adicionais.

Confirmação: `{revision:1,preview_hash,command_key}` retornados pela prévia. Não recebe outra lista ou novos valores: mudanças exigem gerar nova prévia. DTOs validam formatos, enums, tipos e limites; o serviço revalida existência, relacionamentos e política.

Erros de fontes/estado/seleção retornam 409; DTO inválido, 400; recurso fora do projeto, 404; acesso não autorizado, 401/403. O envelope existente de erros mantém `code/message/details`; detalhes de falha em lote contêm `summary` e os itens afetados com motivo. Falha inesperada de gravação retorna 500 com motivo seguro e confirmação de rollback, sem expor SQL.

## 4. Entidades e migration

Migration `1793400000001-create-valuation-batches.ts`:

| Estrutura | Necessidade |
|---|---|
| `asset_valuation_batches` | Identidade da operação, escopo, autoria, proposta/seleção, fingerprint, hash da prévia, revisão, expiração e aplicação |
| `asset_valuation_batch_rows` | Snapshot/proposta por item e referência à avaliação individual criada; permite consultar resultado sem depender de memória do navegador |
| `asset_valuations.batch_operation_id` nullable | Liga cada avaliação histórica à operação, preservando registros individuais anteriores |

Não há duplicação da tabela de avaliações. Linhas da operação guardam a proposta e o resultado da operação, não uma segunda avaliação independente. FKs compostas vinculam operação/organização/projeto; validação de item é feita também pelo serviço. Unicidades protegem comando por organização/projeto, item por operação e avaliação por operação/item. Registros anteriores com `batch_operation_id=NULL` permanecem válidos. Índices atendem listagem por projeto e consultas/uniquidade por operação.

Destino confirmado antes da aplicação: `NODE_ENV=local`, `localhost:3306/gai`, servidor Docker `f10269ba8da4`. Somente essa migration estava pendente e foi aplicada. Banco local: **26 migrations aplicadas, nenhuma pendente**. Não houve reset, rollback, exclusão ou recriação de dados de desenvolvimento. `down` é destrutivo e reservado a bancos descartáveis; não foi executado no banco local.

## 5. Permissões

Nova chave organizacional, na migration e seed: `asset-valuations:batch-create`.

- Selecionar/resolver, gerar e confirmar exigem `inventory-items:read`, `asset-valuations:read`, `asset-valuations:create` e `asset-valuations:batch-create`.
- Consultar operações/resultados exige leitura dos itens e das avaliações.
- Somente o autor da prévia pode confirmá-la. Outro usuário autorizado pode gerar sua própria prévia; não existe aprovação por terceiros nesta etapa.
- Exportação exige a ação específica de export-jobs e, adicionalmente, `asset-valuations:read` e `inventory-items:read`. O serviço revalida essas leituras na criação, retentativa, emissão de URL e download, pelo mapa de conteúdo existente.

ORG_ADMIN recebe as chaves organizacionais válidas pelo resolver existente e continua restrito à própria organização. Perfis personalizados dependem de concessões explícitas. Guard/autenticação não foram relaxados. A única concessão customizada preexistente no banco local permaneceu **uma**, sem novos grants. Catálogo ausente nega a operação inclusive para administrador, coberto por teste.

## 6. Seleção entre páginas

Checkboxes mantêm IDs explícitos ao paginar; seleção de página acrescenta IDs sem duplicar. A ação “Selecionar todos dos filtros” envia os filtros ao servidor e recebe a seleção completa dentro do limite, incluindo itens de páginas não carregadas. Filtros suportados são os existentes da tela: busca, status, placa antiga/nova e descrição; semântica alinhada ao repository atual.

No modo por filtros, o backend refaz a consulta na prévia e confirmação. Inclusões/remoções na população filtrada bloqueiam a confirmação. No modo por IDs, revalida cada ID e seu conteúdo/histórico; itens externos à seleção não invalidam o lote. Exclusões por ID são suportadas na API e também precisam pertencer ao projeto.

Alteração manual após “todos dos filtros” fixa os IDs resolvidos em seleção explícita. Para adotar novamente os filtros atuais, o usuário aciona “Selecionar todos dos filtros” outra vez. A interface informa o contrato atual. Limpar ou desmarcar remove itens; quantidade permanece visível. A seleção transitória não é restaurada após refresh/saída da tela; prévias e resultados persistidos são consultáveis em “Operações anteriores”. Trocar o projeto remonta o workspace e elimina seleção de outro projeto.

## 7. Transações, concorrência e idempotência

`BATCH_VALUATION_MAX_ITEMS`: padrão **100**, configurável de 1 a **500**, documentado em `.env.example`. Exceder o limite bloqueia a seleção inteira, sem truncar ou criar um lote parcial. Não há processamento de grandes lotes nem política de sucesso parcial nesta entrega.

Uma prévia vale por **30 minutos**. Guarda itens/identificadores/descrição/status, última avaliação por data e proposta. O hash de cada fonte inclui cadastro completo, última avaliação e ID do registro inserido mais recentemente, detectando também nova avaliação retroativa. Snapshot/proposta nunca são editados; ajustes geram nova operação.

Confirmação usa transação única, lock do projeto e leitura protegida dos itens no MySQL. A criação individual também usa o lock do projeto: uma avaliação concorrente torna a prévia anterior obsoleta. A seleção é refeita, hashes comparados e o lifecycle validado antes da primeira gravação. Cada item gera sua própria avaliação e audit log; revisão CAS da operação marca aplicação somente depois de todas as gravações.

Se qualquer item falhar, todas as avaliações, audit logs e referências de resultado desse lote são revertidos. A prévia permanece disponível para nova tentativa, desde que vigente e sem mudança das fontes. A resposta da tentativa informa zero processados/aprovados, rejeição integral e os motivos conhecidos. Tentativas falhas não constituem um job persistido com estado próprio; seu erro é apresentado na resposta, enquanto resultados aplicados permanecem consultáveis.

`command_key` e fingerprint canônica incluindo ator protegem a criação da prévia. Mesmo comando retorna a operação existente; conteúdo/ator diferente usando a mesma chave gera conflito. Confirmação reenvia chave/hash/revisão originais; após aplicação retorna os mesmos IDs históricos sem duplicar. Lock, CAS e unicidades reforçam concorrência e integridade. Duas prévias da mesma fonte não aplicam silenciosamente em paralelo: a segunda identifica o histórico criado pela primeira e exige nova prévia.

## 8. Telas, componentes e exportação

Recurso integrado à página existente `/app/projects/:projectId/inventory-items`. Não foi criada rota de avaliação paralela, nova autenticação ou barra de projeto duplicada. ProjectLayout/Outlet e navegação persistente permanecem intactos.

`ValuationBatchPanel` oferece seleção, ação “Avaliar selecionados”, valores comuns ou tabela de valores por item, fonte/data/notas, prévia, confirmação explícita, resultado por item/contagens, histórico de operações, erros e estados de carregamento. O resultado abre o histórico individual pelo drawer já existente. React Query invalida histórico de avaliações, itens e operações após aplicar.

ModalForm, DataTable, Pagination, Button e estados/tokens visuais são os existentes. Tabelas mantêm rolagem horizontal, inclusive em modal/mobile. A identificação acessível do seletor de modo foi validada no navegador real.

Novo tipo do mecanismo existente de exportação: `valuation_batches_xlsx`. Exporta **todas as operações aplicadas do projeto autorizado**, identificadas por ID de operação/item/avaliação, com snapshots, fonte, data, valores, notas e resultado. Não exporta prévias, dados atuais em lugar dos snapshots ou outras organizações. Utiliza fila/processador, orçamento máximo de linhas, XLSX, neutralização de fórmulas, checksum, expiração e download autenticado existentes. O botão informa que a exportação abrange o projeto; filtro de uma única operação não foi implementado.

## 9. Testes e resultados

[testes.json](testes.json), [runtime-local.json](runtime-local.json) e logs/capturas em `.local/valuation-*` registram as evidências.

- Backend: **59 testes em sete suítes passaram** no MySQL descartável e unitários, incluindo avaliação individual/lote, valores comuns/individualizados, fonte/data/moeda, seleção entre páginas/filtros, IDs inválidos/duplicados/estrangeiros, tenants, idempotência, concorrência, rollback, preservação, catálogo e regressões de conciliação/exportação.
- Confirmação final de datas/timestamps e fluxo completo do lote: **25 testes em duas suítes passaram**, com sobreposição à regressão anterior; os números não devem ser somados como casos distintos.
- Frontend completo: **211 testes em 34 arquivos passaram**, incluindo seleção/prévia/confirmação, RBAC, formatação civil e regressões existentes.
- TypeScript, builds backend/frontend e lint dos arquivos alterados passaram. Vite mantém o aviso existente de bundle acima de 500 kB; o lint global preexistente do backend não é declarado corrigido.
- Playwright real ORG_ADMIN: **passou em 26,4 segundos**, sem mocks de API e sem erros HTTP/JavaScript. Criou 23 itens sintéticos; selecionou entre páginas; verificou que a prévia não cria avaliações; aplicou valores comuns e individualizados; conferiu refresh, resultado e histórico individual pelo botão no mobile; baixou e analisou o XLSX de quatro linhas; navegou entre Itens e Visão geral; comprovou preservação dos valores mestres por API.

O primeiro ensaio de regressão começou durante o reinício inicial do MySQL descartável; foi repetido com banco estável. A revisão visual também reproduziu data civil exibida com um dia a menos, corrigida e coberta por testes e asserção real de 27/10/2026. Capturas desktop/mobile finais foram inspecionadas; testes isolados ou só renderização não foram considerados prova suficiente.

## 10. Arquivos modificados

A lista exata com SHA-256 está em [arquivos.json](arquivos.json). Grupos principais:

- InventoryOperations: política compartilhada, service/DTO/controller de lote, entidades da operação, registro no módulo e extensão da entidade histórica existente.
- Migration, seed e exemplo da variável de limite.
- Exportações: novo tipo, mapa de permissões de conteúdo e workbook sobre snapshots aplicados.
- Frontend: painel/API de lote, seleção na página de itens, tipos, formatação civil do histórico e opções/permissões de exportação.
- Testes: unitários, HTTP/MySQL, React e Playwright real.

Alterações anteriores de Preparação, Campo, Conciliação e correções locais foram preservadas. Não houve restauração global do workspace, commit, push ou deploy.

## 11. Limitações e riscos

Atomicidade síncrona, limite padrão 100 e teto 500. Processamento assíncrono de milhares de itens, sucesso parcial e importação de planilha individualizada não foram implementados. A seleção filtra/limita no SQL e não carrega milhares de itens no cliente; cada item faz consultas limitadas ao histórico mais recente. Não houve benchmark de grandes volumes.

Fonte/data/notas são comuns no modo individual; somente os valores diferem por item. Valor não informado fica NULL no novo registro, sem copiar valores antigos ou apagar registros anteriores. Não existem cálculos normativos, depreciação, vida útil ou determinação automática de valor justo.

Prévia é conservadora: mudança de qualquer campo do cadastro ou nova avaliação pode exigir outra prévia. Permissões/lifecycle atuais continuam prevalecendo, inclusive em retentativas. Somente o autor confirma sua prévia. Histórico antigo e timestamps de ensaios sintéticos anteriores não foram regravados; as correções temporais valem para novas gravações/apresentação de datas de avaliação.

Exportação inclui operações aplicadas de todo o projeto dentro do limite de linhas existente; ainda não filtra uma única operação. Não foram iniciados contratos, orçamento ou laudos.

## 12. Homologação local

Frontend `http://localhost:5173`; API `http://localhost:3000/api/v1`; Swagger `http://localhost:3000/api/docs`. Serviços continuam ativos.

1. Entrar como `org.admin`, recarregando a sessão para obter a nova chave do catálogo.
2. Abrir [Itens do projeto sintético 16](http://localhost:5173/app/projects/16/inventory-items).
3. Em “Operações anteriores”, consultar operações **6** (valores comuns) e **7** (individualizados). Ambas têm dois itens aprovados. O item B22 mantém as duas avaliações históricas; seus valores mestres continuam `999.99/333.33`.
4. Consultar exportações do projeto: job **11** finalizado, tipo “Resultados de avaliações em lote XLSX”. O arquivo contém quatro linhas e IDs das duas operações.
5. Para novo ensaio, selecionar itens/página/filtros, preencher fonte/data e pelo menos um valor, gerar prévia, conferir e confirmar. Em outro ensaio sintético, alterar um item ou criar avaliação individual após a prévia: a confirmação deve bloquear o lote inteiro e pedir nova prévia.

Iniciar stack: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-start.ps1`. O script apenas verifica migrations; não aplica automaticamente.

Playwright: em `gai-frontend`, configurar `GAI_VALUATIONS_REAL=1`, `GAI_E2E_LOGIN=org.admin` e `GAI_E2E_PASSWORD` com a senha local; executar `node node_modules/@playwright/test/cli.js test e2e/valuation-batches-real.spec.ts`. Usa a empresa sintética 2 e o XLSX instalado no backend. O teste aguarda health antes do login. Nunca apontar esse ensaio para produção.
