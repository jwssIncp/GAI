# Conciliação Físico-Contábil Assistida — GAI

27/10/2026 · America/Sao_Paulo. Implementação local integrada à sessão de inventário, com sugestões, decisões e histórico persistidos. A conciliação por placa permanece disponível. Não houve commit, push, deploy, acesso a produção ou regravação de placas/dados históricos.

## 1. Análise do mecanismo atual

Consultados [README da auditoria](../auditoria-legado-gai-2026-10-27/README.md), [matriz F020–F029](../auditoria-legado-gai-2026-10-27/matriz-comparativa.md), [inventário funcional](../auditoria-legado-gai-2026-10-27/inventario-funcional.md), validação técnica, correções críticas e relatórios posteriores de Preparação, navegação e Coordenação de Campo. Inspecionados InventoryOperationsService, entidades, parser/importação contábil, sessões/rodadas/observações, histórico de placas, snapshots, guard/scope, dashboard e InventorySessionDetailPage.

As cópias `paineis/conciliacao_fisico_contabil_3.html` e `dashboards/conciliacao_fisico_contabil_3.html` são idênticas: SHA-256 `ae3427e33a124cc37de9e9a2ac272270bcab35fa5acdc6221c4bc3086eacc634`. Foram examinadas as regras 1–4, o alerta de descrição e a aprovação que modificava matrizes. O legado escolhia candidatos por valor, utilizava fallback de 60% e mutava códigos. Esses comportamentos não foram transportados. `_2`, `_02` e `_avaliacao2` têm papéis diferentes, documentados na auditoria; não são versões intercambiáveis desse fluxo.

O `reconcile` atual seleciona a última observação por item da sessão, ordenando por `capturedAt DESC, id DESC`. Compara a placa observada com `newInventoryPlate ?? plate` normalizada da base contábil ativa. Classifica `matched`, `physical_surplus`, `accounting_surplus` e `duplicate`; duplicidade física ou múltiplos registros contábeis por placa bloqueiam a consolidação. Gera `runNumber` sob lock de sessão, persiste evidências e mantém o envelope `{run_number, records}`. Esse algoritmo não foi substituído.

A consolidação atual registra `accepted/corrected/rejected`, ator/data, notas e snapshot, com unicidade por reconciliation. Seu caminho de gravação foi extraído para `recordConsolidation`, compartilhado pela operação existente e pela aprovação assistida. Permanecem os bloqueios de duplicidade e reconsolidação, sem alterar os registros consolidados anteriores.

Campos efetivamente comparáveis:

| Campo | Físico | Contábil | Política |
|---|---|---|---|
| Placa | Observação mais recente | `newInventoryPlate ?? plate` | Mesma normalização da conciliação existente |
| Série | `observedSerialNumber` | Novo campo opcional `serial_number` | Somente origem explícita; sem inferência a partir de códigos/metadados |
| Descrição | Cadastro mestre do item | Descrição contábil original | A observação não tem descrição própria; essa limitação está indicada na interface |
| Localização | `locationText` da observação | `location` contábil original | Igualdade textual normalizada, sem inferir equivalência por substring |
| Unidade/setor | Textos da observação | Sem campos tipados equivalentes | Não usados como evidência de igualdade |

Série contábil não existia no esquema anterior. Foi acrescentada como coluna nullable, sem backfill. Importação XLSX aceita `serial_number` e `numero_serie` (também cabeçalhos com espaços/acentos normalizados). Coluna de série ausente em reimportação preserva a série já cadastrada. Código base/investor, notas e metadados antigos continuam com seus significados. PATCH e formulário contábil permitem preencher explicitamente a série, com limite de 100 caracteres e auditoria existente. `inventoryDescription`/`inventoryLocation` não substituem a fonte contábil original na comparação.

Foi reproduzido e corrigido um caso de PATCH: o serviço enviava campos omitidos como `undefined` ao domínio, que os registrava como alterações. Com o fallback nullable da nova série, isso apagaria sua informação ao editar outro campo. O domínio agora ignora `undefined`, preservando campos omitidos; `null` continua sendo uma limpeza explícita autorizada. A regressão unitária falhou antes da correção e passou depois; a integração confirma resposta e banco com série/placa/localização preservadas ao alterar somente descrição, e descrição/placa preservadas ao editar somente série. Não houve correção retroativa de registros.

## 2. Regras de comparação implementadas

O motor retorna todos os candidatos admitidos no lote, sem consumir automaticamente candidatos ou desempatar por dinheiro. Ordenação estável por IDs. Nenhuma aprovação automática.

1. Placa normalizada igual: regra `exact_plate`, indicador 1.
2. Série normalizada igual: `exact_serial`, indicador 0,98; placas diferentes geram alerta explícito.
3. Descrição com similaridade mínima e localização normalizada igual: `description_location`.
4. Descrição com limiar mais rigoroso: `description`.

Texto utiliza Jaccard sobre conjuntos de palavras normalizadas, removendo acentos, pontuação e uma lista curta de conectivos. Exige pelo menos duas palavras úteis de cada lado para sugerir somente por descrição. Não é análise semântica ou probabilidade estatística. Indicadores fixos de placa/série expressam prioridade da regra, não confiança probabilística.

Configuração versão 1: texto ≥ **0,92**; texto com local igual ≥ **0,85**; alerta de descrição abaixo de **0,25** quando placa ou série coincide. Limites configuráveis no formulário/API: texto entre 0,80 e 1, local entre 0,75 e 1 e alerta entre 0 e 0,50; limiar com local não pode exceder o textual. Cada execução guarda uma cópia imutável da configuração e seu próprio ID. `version` identifica o algoritmo; ID da execução e seus parâmetros identificam a configuração utilizada. Parâmetro ausente usa defaults explícitos, nunca fallback por valor falsy.

Cada candidato guarda fontes lado a lado, regra, coincidências, divergências, campos ausentes, similaridade textual, indicador e alertas. A descrição divergente não rejeita automaticamente: um administrador pode justificar abreviações e classificações administrativas legítimas.

Duplicidades de placa e série são contadas sobre todas as últimas observações da sessão e sobre toda a base contábil, para as chaves envolvidas nos candidatos. Também são detectadas em candidatos encontrados somente por texto. Duplicidade material e observações `not_found/duplicated` bloqueiam aprovação até correção/reinventário e nova execução. Múltiplos candidatos e candidato contábil compartilhado no lote ficam sinalizados; revisão humana com justificativa resolve a escolha, sujeita ao vínculo 1:1 em todo o projeto. Sem candidatos, persiste um registro explícito, sem inventar par contábil.

## 3. Estrutura de dados e migration

Migration: `gai-backend/src/migrations/1793300000001-create-assisted-reconciliation.ts`.

| Tabela | Responsabilidade |
|---|---|
| `assisted_reconciliation_runs` | Escopo, configuração, hash completo das fontes, cursor/lote, resumo, autoria/data |
| `assisted_reconciliation_candidates` | Par físico/contábil, snapshots, evidências, alertas, status e revisão |
| `assisted_reconciliation_decisions` | Decisão imutável, motivo, ator/data, revisão, hash, resultado idempotente e reconciliation criada |
| `assisted_reconciliation_claims` | Reserva aprovada com unicidade de item físico e de registro contábil por projeto |

Adiciona `inventory_accounting_items.serial_number` nullable e o índice `(project_id,session_id,inventory_item_id,captured_at,id)` das observações, voltado aos predicados de projeto/sessão/item e comparação temporal da seleção correlacionada da última evidência. Índices de runs/candidatos/histórico atendem escopo, paginação e unicidade; FKs compostas vinculam candidatos e decisões ao escopo da execução. Todos os IDs também são conferidos nos serviços. Não adiciona índices especulativos de normalização nem migra códigos antigos para série. O EXPLAIN local está em runtime-local.json: na base sintética pequena, o otimizador escolheu índices existentes; o ganho do índice composto em volume grande não foi medido.

Destino local explicitamente verificado antes da aplicação: `NODE_ENV=local`, `localhost:3306/gai`, servidor Docker `f10269ba8da4`. Somente essa migration estava pendente e foi aplicada. Resultado: **25 migrations aplicadas, nenhuma pendente**. A validação descartável aplicou o conjunto completo em banco distinto. Não houve rollback, reset, exclusão de dados locais ou migration de produção. `down` existe para ambiente descartável e é destrutivo; não foi usado no banco de desenvolvimento.

## 4. APIs

Prefixo: `/api/v1/projects/:projectId/inventory-sessions/:sessionId/assisted-reconciliation`.

| Método e sufixo | Contrato |
|---|---|
| POST `/runs` | `{after_item_id?: number, config?: MatchingConfig}`; gera e persiste lote de sugestões |
| GET `/runs` | Execuções paginadas, mais recentes primeiro |
| GET `/runs/:runId/candidates` | Candidatos paginados, filtro de status, configuração, resumo e indicador `stale` |
| POST `/candidates/:id/decisions` | `{revision, source_hash, action, reason, command_key}`; aprova ou rejeita |
| GET `/candidates/:id/history` | Histórico paginado, ator/data/motivo/versão/reconciliation |

Página padrão 20, máximo 100. IDs estrangeiros não são aceitos no comando: o serviço resolve item, contábil e rodada do snapshot gerado e valida novamente suas fontes. DTOs validam tipos, enum, revisão e limites. Cliente React possui contratos TypeScript próprios. Conflitos de fontes/revisão/vínculo retornam 409; recursos fora do pai retornam 404 e organização não autorizada retorna 403.

## 5. Permissões

Catálogo organizacional registrado na migration e no seed declarativo:

- `assisted-reconciliation:read`: execuções, candidatos e histórico.
- `assisted-reconciliation:generate`: geração, além de read.
- `assisted-reconciliation:review`: revisão, além de read e `consolidations:create`.

ORG_ADMIN possui as permissões organizacionais válidas pelo resolver existente, permanecendo restrito aos projetos da própria organização. ORG_USER/perfis personalizados dependem de concessões explícitas. Não houve concessão de novas chaves a perfis customizados: permanece **uma concessão** no banco local. O guard não foi afrouxado; chaves ausentes continuam negadas inclusive para administradores. Projeto/sessão/rodada/itens são checados no serviço, além do guard.

## 6. Fluxo de revisão e integração com consolidação

Gerar → comparar → conferir regra/alertas/fontes → justificar → aprovar ou rejeitar. Ambas exigem motivo de pelo menos cinco caracteres. Uma decisão final não é editada; reconsideração usa nova execução, mantendo o histórico. Uma aprovação consolidada não é reaberta ou substituída por essa API.

Aprovação ocorre em uma única transação: lock do projeto; verificação de revisão, estado e fontes; verificação de consolidações prévias; reserva única dos dois itens; criação de nova reconciliation versionada com snapshot assistido; chamada de `recordConsolidation`; atualização CAS da revisão e gravação da decisão/histórico. A nova reconciliation é `matched` para placa e `plate_divergence` para as demais regras. A aprovação não chama o algoritmo por placa nem altera suas execuções anteriores. Qualquer bloqueio desfaz toda a transação. Rejeição grava decisão sem criar consolidação ou reserva.

Idempotência utiliza chave por organização/projeto e fingerprint de campos em ordem fixa, incluindo ator. Mesmo comando retorna o resultado persistido, inclusive com JSON reordenado; reutilizar a chave com outro conteúdo retorna 409. Lock do projeto serializa decisões concorrentes; revisão CAS e índices únicos reforçam a proteção. A consolidação existente também respeita reservas assistidas, impedindo que uma nova execução por placa contorne o vínculo aprovado.

Hashes SHA-256 consideram fontes completas em ordem estável: sessão, rodadas, observações, cadastro físico e registros contábeis, inclusive exclusões lógicas. Alterações, novas observações/importações e mudanças de lifecycle tornam uma execução obsoleta. Na revisão MySQL, leitura protegida por locks compartilhados/next-key em transação REPEATABLE READ fecha a janela de mudança das fontes. A detecção é conservadora: alterações em campos sem efeito no score também podem exigir nova execução. Snapshots e decisões antigas permanecem consultáveis.

## 7. Interface integrada

Painel na própria `InventorySessionDetailPage`, abaixo das conciliações versionadas. Sem rota alternativa, barra duplicada ou nova autenticação. URL existente: `/app/projects/:projectId/inventory/sessions/:sessionId`. `ProjectLayout`, `Outlet`, barra superior e identidade do projeto permanecem montados.

Usa DataTable, Pagination, ModalForm, Button, LoadingState/ErrorState e classes visuais existentes. Contém configuração de próxima execução, seleção paginada de runs, resumo do lote, candidatos prováveis/ambíguos/sem par, status, comparação lado a lado, alertas de descrição, versões, decisão justificada e histórico. Exibe fontes obsoletas e bloqueia decisão; backend sempre revalida. Leitura sem review remove ações de decisão. Aprovação atualiza a listagem normal de conciliações por React Query.

Capturas desktop/móvel verificadas em `.local/assisted-playwright/`. Nenhuma regra de inventário, financeiro, preparação ou coordenação foi substituída.

## 8. Testes e resultados

Resultados e limitações estão em [testes.json](testes.json); evidência sanitizada de runtime em [runtime-local.json](runtime-local.json).

- MySQL 8 descartável e testes unitários: suíte final **51 testes em nove suítes passaram**, cobrindo matching, aprovação/rejeição, snapshots, idempotência inclusive com JSON reordenado, concorrência, dados obsoletos, múltiplos candidatos, candidato compartilhado, duplicidades, dados incompletos, paginação/cursor, RBAC, tenant/IDs estrangeiros, catálogo e regressões da importação/conciliação existentes.
- A regressão de PATCH inclui preservação de campos omitidos na resposta e no banco, além da limpeza explícita por `null`.
- Frontend completo: **205 testes em 32 arquivos passaram**. Inclui quatro testes novos do painel e regressão de sessão/árvore de rotas persistente.
- Playwright Chromium real, sem interceptar APIs: **passou** com ORG_ADMIN; criou projeto/base XLSX/observação sintéticos, gerou candidato por série com placas diferentes, aprovou, atualizou, confirmou histórico/persistência, navegou para Itens e voltou e recarregou em viewport 390×844. Zero erros HTTP/JavaScript no fluxo aprovado.
- TypeScript e builds backend/frontend passaram; lint dos arquivos alterados passou. Vite mantém o aviso de bundle acima de 500 kB. O lint global preexistente do backend não é declarado corrigido por esta entrega.

Ensaios durante reload/build do backend perderam uma leitura de histórico e uma tentativa de login por conexão recusada; outra execução excedeu o timeout padrão de cinco segundos para consultas encadeadas após refresh durante verificações concorrentes. O teste agora verifica health do proxy/backend antes do login e usa espera por conteúdo de até quinze segundos, sem sleeps ou mocks. A última execução com servidor estável passou em **16,8 segundos**, sem erros HTTP/JavaScript. Não foi considerado sucesso apenas por renderização isolada ou pelas suítes com mocks.

## 9. Arquivos modificados

[arquivos.json](arquivos.json) contém a lista exata e SHA-256. Grupos principais:

- Backend: novo diretório `src/modules/assisted-reconciliation/`, migration, registro de módulo/entidades/seed.
- Base contábil: entidade/domínio/repository/DTOs/parser/service para série explícita, preservando importação e auditoria existentes.
- Inventário: extração do caminho transacional compartilhado de consolidação e export de InventoryOperationsService.
- Frontend: `assistedApi.ts`, `AssistedReconciliationPanel.tsx`, integração na sessão, tipo/schema/formulário da série contábil.
- Testes: matching unitário, integração HTTP/MySQL, painel React e `e2e/assisted-reconciliation-real.spec.ts`.

O workspace já continha muitas alterações anteriores; nenhuma restauração global foi realizada. Scripts e logs descartáveis ficam em `.local`, ignorado pelo Git.

## 10. Riscos e limitações

Geração síncrona processa **20 itens físicos por lote**, com leitura contábil por keyset em páginas de 250. Limites explícitos: 20.000 registros contábeis ativos e 2.000 pares por lote. Ao exceder, retorna conflito e não grava resultado truncado. Bases maiores exigirão processamento assíncrono futuro, não implementado nesta etapa. O cálculo não carrega integralmente as duas bases em memória, mas ainda faz comparações O(20 × contábil) e hashes completos; não houve teste de carga de grande escala.

Ambiguidades de candidatos compartilhados são apresentadas dentro do lote; a reserva 1:1 é global ao projeto e revalidada na aprovação, inclusive entre sessões e execuções diferentes. Não existe exceção autorizada de um contábil para vários físicos nesta entrega. Duplicidades materiais exigem correção da fonte; não são resolvidas por simples escolha na interface.

Jaccard não reconhece sinônimos, abreviações ou semântica; locais textuais iguais não provam identidade. Série antiga sem coluna explícita permanece não comparável até importação/edição autorizada. Unidade/setor contábil continuam ausentes. Novas configurações não alteram runs anteriores. Não foram criados avaliação em lote, orçamento ou laudos.

## 11. Homologação local

Frontend `http://localhost:5173`; API `http://localhost:3000/api/v1`; Swagger `http://localhost:3000/api/docs`. Serviços locais permanecem iniciados.

1. Entrar como `org.admin`, recarregando a sessão para obter as chaves novas do catálogo.
2. Abrir projeto sintético, aba Inventário e sua sessão. Exemplo validado: [projeto 12 / sessão 5](http://localhost:5173/app/projects/12/inventory/sessions/5).
3. No painel assistido, conferir execução, comparar fontes e consultar a justificativa/histórico já persistidos. A evidência aprovada também aparece nas conciliações versionadas.
4. Para novo ensaio, criar projeto sintético e itens; importar XLSX com `placa`, `descricao_01`, `numero_serie`, `localizacao`. Registrar observações pela sessão/rodada real, com inventariante vinculado. Gerar e revisar.
5. Editar uma fonte em ensaio separado: a execução anterior deve indicar obsolescência e rejeitar nova decisão até gerar outra execução. Duplicar série/placa em dados sintéticos deve bloquear aprovação.

Inicialização: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-start.ps1`. O script verifica migrations pendentes, sem aplicá-las automaticamente.

Playwright: em `gai-frontend`, definir `GAI_ASSISTED_REAL=1`, `GAI_E2E_LOGIN=org.admin` e `GAI_E2E_PASSWORD` com a senha local e executar `node node_modules/@playwright/test/cli.js test e2e/assisted-reconciliation-real.spec.ts`. O teste depende do stack local e do XLSX já instalado no backend. Não utiliza credenciais ou banco de produção.
