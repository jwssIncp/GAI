# Relatório de homologação integrada do GAI

Data da execução: 27–28/08/2026  
Ambiente: local, descartável e isolado de produção  
Parecer: **PARTIAL — ambiente e núcleo operacional aptos a continuar a homologação; aceite integrado ainda bloqueado pelo object storage. NOT READY FOR PRODUCTION.**

Este documento registra a execução prática contra MySQL 8, API, frontend e MinIO reais. Não foram criadas funcionalidades de negócio nem alteradas regras funcionais indefinidas.

## 1. Ambiente utilizado

- Workspace: `GAI`, com `gai-backend` e `gai-frontend`.
- Recursos Docker exclusivos, identificados por `gai.environment=homologation`.
- MySQL em `localhost:3307`, banco principal `gai_homologation` e banco de contraprova `gai_homologation_fresh`.
- Backend em `http://localhost:3001/api/v1`.
- Frontend Vite em `http://localhost:5173`, com `VITE_API_BASE_URL=http://localhost:3001/api/v1`.
- MinIO em `localhost:9000`, console em `localhost:9001`, bucket `gai-homologation`.
- Os contêineres preexistentes `gai-app` e `gai-mysql` não foram alterados.

## 2. Versões

| Componente | Versão |
| --- | --- |
| Host Node.js | 24.18.0 |
| npm | 11.16.0 |
| Docker | 29.5.3 |
| Backend container | Node 22 Alpine |
| MySQL | 8.0.46 |
| MinIO | RELEASE.2025-09-07 |
| Vite | 6.4.3 |
| Frontend | 0.1.0 |

## 3. MySQL

O backend foi executado contra MySQL real, sem SQLite e sem `synchronize`. O banco principal terminou com 59 tabelas, 189 FKs, PK em todas as tabelas, 22 índices `UNIQUE`, 57 colunas `AUTO_INCREMENT`, 13 colunas `DECIMAL`, 40 colunas JSON e 4 colunas enum. A coluna `inventory_observation_evidence.storage_key` foi confirmada como ASCII/`ascii_bin` para manter o índice de 1.024 caracteres dentro do limite do InnoDB.

Após reinício do MySQL e do backend permaneceram 21 migrations, 4 itens, 2 avaliações e 1 consolidação. Não foi observada corrupção de IDs ou FKs.

## 4. Migrations

- A primeira execução limpa reproduziu `ER_TOO_LONG_KEY` na migration `1741400000001`, devido ao `UNIQUE` sobre `VARCHAR(1024)` em `utf8mb4`.
- A migration foi corrigida cirurgicamente para usar ASCII apenas na chave opaca de storage e recebeu guardas para retomar com segurança após DDL parcialmente aplicado pelo MySQL.
- Uma segunda base totalmente vazia executou as 21/21 migrations, em ordem, com código de saída 0, produzindo as mesmas 59 tabelas.
- Foi exercitado `UP → DOWN → UP` das três migrations recentes, cobrindo operações de inventário/evidência, prestações e lacunas correlatas.
- Um retry sobre estado de DDL parcial foi coberto por teste de regressão.
- Dados funcionais criados sobreviveram ao restart. Entretanto, não foi executado um snapshot legado independente, anterior às migrations recentes, com toda a fixture solicitada. Essa evidência permanece parcial para produção.

## 5. Seeds

O seed foi executado duas vezes e permaneceu idempotente: 123 permissions, 1 organização inicial, 3 usuários e 3 assignments, sem IDs menores ou iguais a zero.

A comparação sistemática entre controllers, catálogo, seed e frontend encontrou uma permission frontend inexistente (`organizations:create`). Ela foi alinhada à permission real `organizations:write`. Depois da correção, nenhuma permission efetivamente usada pelo backend/frontend ficou ausente do seed.

Possíveis permissions órfãs/legadas, não removidas: `assets:read`, `assets:write`, `inventory-accounting-items:create` e `payments:export`.

## 6. Backend

O backend iniciou limpo contra MySQL, aplicou configuração real, expôs as rotas esperadas e compilou com sucesso. O build terminou com código 0. Violações previsíveis observadas durante os fluxos foram devolvidas como 400/401/403/404/409; os dois 500 de domínio reproduzidos foram investigados e corrigidos.

## 7. Frontend

O frontend comunicou-se com a API real, sem route mocks no smoke integrado. Login, dashboard, deep link, refresh, nova aba e logout passaram em Chromium. `tsc`/build, ESLint e Vitest passaram. O bundle gerado teve 1.371,30 kB de JavaScript (381,44 kB gzip) e 59,58 kB de CSS (10,71 kB gzip), com warning de chunk acima de 500 kB. Dependências de planilha, gráficos e o grande grafo de rotas/componentes são candidatos para análise posterior; não foi aplicado code splitting antes do aceite.

## 8. Object storage

**BLOCKED.** O MinIO e o bucket reais estavam saudáveis, mas as URLs produzidas pelo backend usam um esquema HMAC próprio com cabeçalhos `X-GAI-*`, e não AWS Signature V4. PUT e GET contra MinIO retornaram 403.

Mais grave: a confirmação de upload foi aceita mesmo após o PUT falhar, pois não houve verificação da existência do objeto. Portanto, expiração e metadata foram exercitadas no backend, mas upload/download binário, MIME/tamanho efetivos e isolamento do objeto não foram comprovados. A correção exige decisão/implementação de integração S3 compatível e ficou fora do escopo cirúrgico desta rodada.

## 9. Autenticação

Login real e `/auth/me` passaram. Foram confirmados login válido, rejeição sem sessão (401), logout, refresh e deep link. O smoke real pós-restart passou em 14,6 s. A senha incorreta e expiração possuem cobertura automatizada existente, mas a expiração temporal não foi aguardada manualmente nesta execução.

## 10. RBAC

Usuário autorizado obteve 2xx; usuário autenticado sem permission recebeu 403; usuário de outra organização recebeu 403/404 conforme a política; requisição sem sessão recebeu 401. O seed usa permissions, sem criação artificial de roles. A correção da tela de organizações recebeu teste de regressão.

## 11. Multi-tenancy

Foram criadas Organization A/Project A e Organization B/Project B. Acesso cruzado conhecido a projeto/empresa foi bloqueado com 403 e recursos de projeto alheio não foram expostos. Dentro da mesma organização, item e sessão de outro projeto retornaram 404. Os services aplicam os mesmos escopos aos IDs dependentes; contudo, nem cada uma das 18 famílias da lista foi chamada individualmente com ID cruzado nesta rodada. O resultado global é PARTIAL, sem vazamento reproduzido.

## 12. Projetos

O fluxo Organization → Company → Project foi executado e persistiu. Acesso cruzado foi bloqueado. Estado: READY.

## 13. Inventariantes

Unidade, inventariante e vínculo foram criados no projeto real e usados pelos fluxos de inventário/financeiro. Persistência confirmada. A matriz conserva PARTIAL por não haver E2E visual dedicado a cada cadastro.

## 14. Itens

Item real foi criado com ID gerado pelo banco. A placa mestre `ABC001` permaneceu intacta enquanto observações registraram `ABC002`, `ABC003` e `ABC004`; o histórico observado não sobrescreveu o cadastro mestre.

## 15. Inventário

Foram executados criar/iniciar sessão, rodada 1, observação, retomada e finalização usando API e MySQL reais. O replay da mesma idempotency key retornou o mesmo registro; reutilização em contexto diferente retornou 409. Cadeia e dados continuaram disponíveis após refresh, novo login e restart.

## 16. Reinventário

Rodadas 2 e 3 foram criadas. A cadeia `prior_observation_id` permaneceu 1 → 2 → 3, sem mutação das observações anteriores. Transições create/start/finish e create/start/cancel passaram; transições inválidas retornaram 409.

## 17. Evidências

Metadata de evidência foi criada, listada e vinculada ao tenant/projeto/observação. O mapeamento incorreto de `evidenceSnapshot` foi corrigido para `evidence_snapshot`. O fluxo binário e o comportamento append-only de dois objetos não puderam ser homologados por causa do bloqueio do storage; uma evidência chegou a ser falsamente marcada como enviada. Estado: BLOCKED.

## 18. Importação física

Um XLSX real com duas linhas produziu 1 criação e 1 erro por linha, com contadores corretos. Replay/reprocessamento não duplicou observações. Um XLSX real de 5.000 linhas e 900.925 bytes recebeu HTTP 201; todas as 5.000 linhas foram rejeitadas de forma controlada por referirem itens inexistentes.

## 19. Base contábil

XLSX real com duas linhas foi importado com 2/2 sucessos e vínculo ao projeto correto. Estado: READY para o cenário exercitado.

## 20. Conciliação

Duas execuções concorrentes geraram `run_number` 1 e 2 e preservaram o histórico. O banco registrou, em cada run, `matched`, `physical_surplus` e `accounting_surplus`. A classificação proposital de duplicidade não foi materializada no fixture desta rodada; por isso o domínio fica PARTIAL.

## 21. Consolidação

A primeira tentativa real revelou 500 por mapeamento de coluna `evidenceSnapshot`; a correção alinhou a entity a `evidence_snapshot`. Na repetição concorrente, uma chamada retornou 201 e a outra 409 `RECONCILIATION_ALREADY_CONSOLIDATED`, com exatamente uma linha no banco. Snapshot, ator e data foram persistidos. O bloqueio específico de item classificado como duplicado não foi exercitado e mantém o estado PARTIAL.

## 22. Avaliação

Duas avaliações append-only foram persistidas e auditadas. Valores `1234567890123.45/999999999999.99` e `0.01/0.00` foram lidos sem artefato de ponto flutuante.

## 23. Despesas

Despesas reais foram criadas, vinculadas ao projeto e usadas em pagamentos/prestações. IDs foram gerados com valor maior que zero. O comprovante binário permanece BLOCKED pelo storage.

## 24. Prestação

Três despesas foram adicionadas e a prestação fechou com total calculado no servidor de `110.01`. Alteração após fechamento retornou 409. Na disputa da mesma despesa entre duas prestações, o banco inicialmente devolveu um 500 bruto; a violação exata da constraint agora é traduzida para 409 `EXPENSE_ALREADY_ACCOUNTED`, comprovado em MySQL e teste unitário.

## 25. Parcelas

Foram validados em MySQL real `100.00/3`, `10.00/6`, `0.01/3` e `1000000.99/12`. Em todos os casos, a soma decimal exata das parcelas coincidiu com o valor original.

## 26. Dashboard

O dashboard real refletiu os dados criados (item, inventariado e progresso) e permaneceu disponível após refresh/restart. Nem todos os agregados da lista foram comparados individualmente a uma query SQL de contraprova, portanto a matriz o marca PARTIAL.

## 27. Exportação

O job `project_backup_xlsx` terminou com sucesso. O download autenticado retornou HTTP 200, 19.043 bytes, MIME XLSX e assinatura ZIP `50 4B 03 04`.

## 28. Concorrência

| Cenário | Resultado real |
| --- | --- |
| Mesma observação/idempotency key | 201/201 como criação + replay; uma linha lógica |
| Reinventário simultâneo | Rodadas 2/3, sem `round_number` duplicado |
| Reconciliação simultânea | Runs 1/2, histórico preservado |
| Mesma consolidação | 201 + 409; uma consolidação |
| Mesma despesa em duas prestações | 200 + 409; integridade preservada |

Não permaneceu erro bruto de driver nos casos concorrentes reproduzidos.

## 29. Auditoria

Foram consultadas diretamente as tabelas de audit. Há registros para sessão (create/start/finish/cancel), reinventário, observações/import, evidência create/confirm, reconciliação, consolidação, avaliações, prestação, parcelas, pagamentos e despesas. As duas avaliações e a consolidação possuem ator/snapshot. Campos before/after foram avaliados apenas onde já fazem parte do modelo.

## 30. Segurança

- CORS respondeu para a origem exata do frontend, com credentials, Authorization, multipart e métodos previstos; não foi aberto wildcard.
- Logs apresentaram correlation IDs e contexto de ator.
- `Authorization` apareceu como `[Redacted]`; não foram encontrados senha, bearer token, credenciais ou segredo presigned nos logs inspecionados.
- RBAC, isolamento de organização e isolamento cross-project passaram nos IDs exercitados.
- O falso positivo de confirmação de upload é um risco de integridade P1.

## 31. npm audit

Nenhum `audit fix --force` foi aplicado.

| Projeto/escopo | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Backend, todas as dependências | 1 | 12 | 1 | 2 |
| Backend, produção | 1 | 11 | 1 | 2 |
| Frontend, todas as dependências | 1 | 7 | 3 | 0 |
| Frontend, produção | 0 | 2 | 0 | 0 |

Classificação dos achados critical/high mais relevantes:

| Pacote/caminho | Escopo e exploitabilidade provável | Atualização |
| --- | --- | --- |
| `xlsx@0.18.5` | Runtime backend; parseia XLSX fornecido pelo usuário. Prototype pollution/ReDoS, exposição relevante. | Sem correção publicada pelo npm audit; exige substituição/mitigação planejada, potencialmente breaking. |
| `multer@2.0.x` via `@nestjs/platform-express` | Runtime de upload; DoS em input multipart. | `2.1.1` disponível na cadeia; avaliar atualização compatível e regressão de uploads. |
| `typeorm@0.3.30` e cadeias transitivas | Parte runtime e parte CLI/migration; avisos high incluem dependências de tooling/SQLite. | Revisar release suportada; não atualizar automaticamente. |
| `tar@6.2.1` via `sqlite3/node-gyp` | Critical principalmente no caminho de instalação/tooling; menor exposição no container em execução, mas afeta supply chain/CI. | `sqlite3@6` é major; breaking e requer campanha separada. |
| `react-router(-dom)@7.18.1` | Produção frontend; advisory high ligado a React Server Components. Esta aplicação é SPA e não usa RSC, reduzindo a exploitabilidade observada. | Correção disponível; atualizar com regressão de rotas. |
| `vitest@2.1.9` | Critical em servidor/UI de desenvolvimento, que não é publicado nem foi exposto. | `4.1.11` é major; breaking. |
| `postcss@8.5.16` e Vite transitivo | Build/dev; não é serviço runtime do browser. | Atualização controlada da toolchain. |

## 32. Coverage

Coverage backend obtido na suite completa:

| Métrica | Resultado | Gate 80% |
| --- | ---: | --- |
| Statements | 84,62% | PASS |
| Lines | 84,96% | PASS |
| Functions | 78,24% | FAIL |
| Branches | 65,96% | FAIL |

O gate solicitado não foi fechado. Os testes adicionados cobrem os defeitos desta rodada, mas elevar branches de ~66% para 80% exigiria uma campanha ampla, incompatível com a regra de não ampliar/refatorar esta homologação. Estado: P1 para produção.

## 33. Lint

- Frontend: ESLint completo, exit 0.
- Backend: arquivos novos/modificados e novo código passaram no lint incremental.
- O arquivo legado completo `expense-accountabilities.service.ts` ainda apresenta 21 ocorrências históricas de `no-unnecessary-type-assertion`, fora das linhas introduzidas nesta rodada. Não foi aplicado autofix amplo.

## 34. Testes

| Suite | Resultado |
| --- | --- |
| Backend build | PASS |
| Backend unit/integration/e2e/contract, suite completa | 91 suites, 367 testes, todos PASS |
| Frontend Vitest | 24 arquivos, 150 testes, todos PASS |
| Frontend ESLint | PASS |
| Frontend build/TypeScript | PASS |
| Playwright suite completa | 47 PASS, 8 FAIL, 1 SKIP durante contenção simultânea |
| Reexecução isolada dos 8 failures | 8/8 PASS em 25,9 s |
| Smoke Playwright contra stack real | 1/1 PASS; repetição pós-restart 1/1 PASS em 16,6 s |

Os oito failures não foram reproduzidos isoladamente e coincidiram com migrations/testes backend concorrendo pelos recursos locais. Mesmo assim, a exigência de uma suite Playwright completa e ininterrupta 100% estável ainda não possui evidência nesta rodada.

## 35. Performance

- Dashboard, 30 chamadas controladas: mínimo 126,87 ms; p50 169,54 ms; p95 296,48 ms; máximo 365,57 ms; média 184,97 ms.
- XLSX físico de 5.000 linhas: HTTP 201 em 70.996 ms; duração registrada no banco 69.348 ms.
- Memória do container antes/depois: aproximadamente 556,7/547,7 MiB. Não houve telemetria do pico durante o parsing.
- O parsing síncrono dentro da requisição HTTP é P2: funcional, porém lento e sujeito a timeout sob carga. Não foi introduzido worker sem requisito aprovado.

## 36. Problemas encontrados

| ID | Severidade | Problema | Situação |
| --- | --- | --- | --- |
| HOM-P0-01 | P0 | Migration falhava no MySQL com `ER_TOO_LONG_KEY` e podia deixar DDL parcial | CORRIGIDO |
| HOM-P0-02 | P0 | Consolidação retornava 500 por coluna `evidenceSnapshot` divergente | CORRIGIDO |
| HOM-P1-01 | P1 | Concorrência de prestação vazava `ER_DUP_ENTRY` como 500 | CORRIGIDO |
| HOM-P1-02 | P1 | Frontend verificava permission inexistente `organizations:create` | CORRIGIDO |
| HOM-P1-03 | P1 | Presigned URL incompatível com MinIO/S3 e confirmação aceita objeto inexistente | ABERTO/BLOCKED |
| HOM-P1-04 | P1 | Coverage functions 78,24% e branches 65,96% | ABERTO |
| HOM-P1-05 | P1 | `xlsx@0.18.5` high em caminho runtime sem fix direto | ABERTO |
| HOM-P1-06 | P1 | Falta contraprova completa de migrations recentes sobre snapshot legado | ABERTO |
| HOM-P2-01 | P2 | Suite Playwright completa teve flakiness sob contenção | ABERTO |
| HOM-P2-02 | P2 | Import de 5.000 linhas levou ~71 s no request HTTP | ABERTO |
| HOM-P2-03 | P2 | Cenário real de duplicidade/bloqueio de consolidação não executado | ABERTO |
| HOM-P2-04 | P2 | Smoke real de remuneração não concluído | ABERTO |
| HOM-P3-01 | P3 | Quatro permissions possivelmente órfãs/legadas | DOCUMENTADO |
| HOM-P3-02 | P3 | Chunk frontend de 1,37 MB | DOCUMENTADO |

Não há P0 aberto ao final da execução.

## 37. Correções realizadas

1. Chave de storage ASCII/`ascii_bin` e migration resumível após DDL parcial, com testes de schema/retry.
2. Mapeamento de `InventoryConsolidationEntity.evidenceSnapshot` para `evidence_snapshot`, com teste de metadata.
3. Tradução estrita de `ER_DUP_ENTRY` da constraint `uq_expense_accountability_items_expense` para 409 de domínio, sem engolir outros erros, com teste de regressão.
4. Permission da página de organizações alinhada a `organizations:write`, com teste de componente.
5. Smoke Playwright real, opt-in por `GAI_REAL_E2E=1`, para login, dashboard, deep link, refresh, nova aba e logout.

## 38. Pendências

Para encerrar a homologação integrada: corrigir a integração S3/MinIO e impedir confirmação sem objeto; repetir evidências, fotos e comprovantes; criar fixture real de duplicidade; executar remuneração; e repetir Playwright completo sem workloads concorrentes.

Para produção: além do anterior, fechar coverage nas quatro métricas, decidir mitigação/substituição de `xlsx`, tratar a cadeia de uploads vulnerável, validar migrations sobre snapshot legado representativo e revisar as demais vulnerabilidades high/critical.

Itens funcionais explicitamente bloqueados continuam sem implementação: setores, documentos de inventariantes, categorias de despesas, formas de pagamento, aprovação de duplicidades e RFID/NFC/QR.

## 39. Matriz de prontidão

| Domínio | Backend | Frontend | MySQL | Storage | RBAC | Tenant | E2E real | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth | READY | READY | READY | READY | READY | READY | READY | READY |
| Organizations | READY | READY | READY | READY | READY | PARTIAL | PARTIAL | PARTIAL |
| Companies | READY | READY | READY | READY | READY | READY | PARTIAL | PARTIAL |
| Projects | READY | READY | READY | READY | READY | READY | READY | READY |
| Units | READY | READY | READY | READY | READY | PARTIAL | PARTIAL | PARTIAL |
| Field Agents | READY | READY | READY | READY | READY | PARTIAL | PARTIAL | PARTIAL |
| Links | READY | READY | READY | READY | READY | PARTIAL | PARTIAL | PARTIAL |
| Items | READY | READY | READY | READY | READY | READY | READY | READY |
| Photos | READY | READY | READY | BLOCKED | READY | PARTIAL | BLOCKED | BLOCKED |
| Plates | READY | READY | READY | READY | READY | READY | READY | READY |
| Inventory Sessions | READY | READY | READY | READY | READY | READY | READY | READY |
| Rounds | READY | READY | READY | READY | READY | READY | READY | READY |
| Observations | READY | READY | READY | READY | READY | READY | READY | READY |
| Evidence | READY | READY | READY | BLOCKED | READY | PARTIAL | BLOCKED | BLOCKED |
| Reinventory | READY | READY | READY | READY | READY | READY | READY | READY |
| Physical Import | READY | READY | READY | PARTIAL | READY | PARTIAL | READY | PARTIAL |
| Accounting Import | READY | READY | READY | READY | READY | PARTIAL | READY | PARTIAL |
| Reconciliation | READY | READY | READY | READY | READY | PARTIAL | PARTIAL | PARTIAL |
| Consolidation | READY | READY | READY | READY | READY | PARTIAL | PARTIAL | PARTIAL |
| Valuation | READY | READY | READY | READY | READY | PARTIAL | READY | PARTIAL |
| Expenses | READY | READY | READY | READY | READY | READY | READY | READY |
| Receipts | READY | READY | READY | BLOCKED | READY | PARTIAL | BLOCKED | BLOCKED |
| Accountabilities | READY | READY | READY | READY | READY | READY | READY | READY |
| Installments | READY | READY | READY | READY | READY | READY | READY | READY |
| Payments | READY | READY | READY | READY | READY | PARTIAL | READY | PARTIAL |
| Remuneration | READY | READY | READY | READY | READY | PARTIAL | PARTIAL | PARTIAL |
| Dashboard | READY | READY | READY | READY | READY | READY | PARTIAL | PARTIAL |
| Exports | READY | READY | READY | READY | READY | PARTIAL | READY | PARTIAL |
| Audit | READY | PARTIAL | READY | READY | READY | PARTIAL | READY | PARTIAL |

## 40. Recomendação de release

**Prontidão para homologação:** PARTIAL. A stack integrada, MySQL, migrations, seeds e os fluxos centrais estão aptos a continuar a homologação, e não há P0 aberto. O aceite formal de toda a aplicação ainda não deve ser assinado enquanto os três fluxos binários de storage estiverem BLOCKED.

**Prontidão para produção:** NOT READY. Permanecem P1 de storage/integridade, coverage, dependência XLSX e evidência de migration legada, além de vulnerabilidades a tratar.

### Checklist final

1. Todas as migrations executam em MySQL 8? **SIM — 21/21 em duas bases.**
2. Rollback funciona? **SIM — UP/DOWN/UP das três recentes.**
3. Seeds funcionam? **SIM — inclusive rerun idempotente.**
4. Backend inicia limpo? **SIM.**
5. Frontend comunica com backend? **SIM.**
6. Login real funciona? **SIM.**
7. RBAC funciona? **SIM nos perfis/casos exercitados.**
8. Multi-tenant funciona? **SIM nos IDs exercitados; matriz abrangente parcial.**
9. Cross-project isolation funciona? **SIM nos IDs exercitados.**
10. Inventário funciona? **SIM.**
11. Refresh funciona? **SIM.**
12. Reinventário funciona? **SIM, até a rodada 3.**
13. Evidências funcionam? **NÃO integralmente; somente metadata.**
14. Storage funciona? **NÃO; PUT/GET reais retornam 403.**
15. Placa mestre permanece intacta? **SIM.**
16. Importação física funciona? **SIM.**
17. Conciliação funciona? **SIM para matched/sobras; duplicidade não exercitada.**
18. Consolidação funciona? **SIM para item elegível e concorrência; bloqueio por duplicidade pendente.**
19. Despesas funcionam? **SIM, exceto comprovante binário.**
20. Prestação funciona? **SIM.**
21. Parcelas somam exatamente? **SIM nos quatro casos.**
22. Dashboard reflete os dados? **SIM para os agregados conferidos.**
23. Concorrência está protegida? **SIM nos cinco casos críticos exercitados.**
24. Erros concorrentes retornam 409? **SIM para consolidação e prestação; observação usa replay idempotente.**
25. Auditoria está sendo gravada? **SIM.**
26. Coverage >= 80% nas quatro métricas? **NÃO; functions 78,24% e branches 65,96%.**
27. Frontend tests estão 100%? **SIM no Vitest (150/150); ver ressalva do Playwright.**
28. Playwright está estável? **PARTIAL; failures sob contenção passaram 8/8 isolados e o smoke real passou, mas faltou uma execução completa limpa 100%.**
29. npm audit foi executado? **SIM, backend e frontend, total e production.**
30. Existem vulnerabilidades críticas? **SIM no backend/tooling e frontend/dev; produção backend ainda reporta 1 critical na cadeia auditada.**
31. Existem P0? **NÃO abertos; dois foram corrigidos.**
32. Existem P1? **SIM.**
33. O sistema está pronto para homologação? **PARTIAL: pronto para continuar, não para aceite integrado final.**
34. O sistema está pronto para produção? **NÃO.**
