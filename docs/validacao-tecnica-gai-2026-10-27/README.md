# GAI — validação técnica antes da evolução funcional

Data: 27/10/2026, America/Sao_Paulo.

**Prontidão condicionada.** O núcleo passa pelos testes executáveis de regressão, inclusive fluxos críticos em MySQL real. A ampliação de acesso financeiro, exportações e arquivos depende das decisões de autorização e storage descritas abaixo. Os testes de reprodução que passam documentam comportamentos atuais; não representam aprovação dessas políticas.

Foram feitas correções de contratos, serialização e cache. Nenhuma política de autorização, regra financeira, calendário de parcelas ou funcionalidade do legado foi implementada. Não houve commit, push ou deploy.

## Escopo e evidências

Todos os nove arquivos de `docs/auditoria-legado-gai-2026-10-27/` foram consultados: README, inventário, matriz Markdown/CSV/JSON, anexos GAI/legado, manifesto e verificação. Os anexos foram usados como índices de rastreabilidade, confrontados com o código e testes atuais. Os oito hashes de artefatos declarados em `verificacao.json` continuam iguais. O índice completo está em [referencias.json](referencias.json).

O diretório de trabalho já continha alterações staged, unstaged e arquivos não rastreados, incluindo overview organizacional e uma migration. Eles foram preservados; a lista desta entrega está abaixo. A versão examinada é o diretório de trabalho local, não um estado presumido de produção.

Os testes usaram SQLite em memória e um novo container `gai-validation-20261027`, MySQL 8.0.46, porta loopback 33317, banco `gai_validation_disposable`, dados sintéticos e `/var/lib/mysql` em tmpfs. O helper opt-in tem destino e credenciais sintéticas fixos e não usa `DB_*` para escolher o banco. `dropSchema` e migrations da suíte atuam exclusivamente nesse destino. O container e o volume do banco local preexistente não foram usados para os testes.

Não foram usados usuários reais, endpoints do legado, buckets ou dados de produção. Nenhuma URL de storage foi acessada: os testes exercitam somente geração de URL e metadados da API. A suíte Playwright intercepta as APIs; os testes Nest/Supertest com MySQL exercitam o backend real.

Ao final, o container descartável foi parado e removido, eliminando seu tmpfs. O `gai-mysql` preexistente permaneceu saudável. Artefatos Playwright rastreados que estavam sem alterações na entrada foram restaurados após a suíte; os resultados desta execução estão nos logs locais e no resumo desta entrega.

## 1. Problemas efetivamente reproduzidos

| ID | Reprodução e impacto | Estado |
|---|---|---|
| V01 — alta | Um usuário organizacional restrito a **somente `projects:read`** recebe 403 ao listar pagamentos/despesas, mas 200 em `/projects/:id/summary?include_financial=true` e no alias `/dashboard`, com despesa sintética de **100.00** e total financeiro **100.00**. Sem o flag, o bloco financeiro é omitido. Isso contorna a separação de leitura financeira dentro do mesmo tenant. | Política preservada; proposta A1. |
| V02 — alta | `PermissionsGuard` autoriza ORG_ADMIN para chave inexistente e para combinação de chave organizacional conhecida com chave inexistente. ORG_USER sem concessão recebe negativa; PLATFORM_ADMIN tem bypass incondicional. | Política preservada; proposta A2. |
| V03 — alta | Usuário com apenas `export-jobs:create/read/download`, sem `expenses:read`, solicita `expenses_xlsx`, baixa o XLSX autenticado e encontra a descrição e o valor da despesa sintética. O caminho de exportação não aplica a leitura do domínio exportado. | Política preservada; proposta A3. |
| V04 — alta | Signer emite HMAC próprio `X-GAI-Method/Expires/Signature`, sem os parâmetros de SigV4. Configuração local declara S3 e usa endpoint `.invalid`; Terraform declara bucket de assets S3. O signer não é compatível com S3 padrão. Ausência de configuração também produz URL usando endpoint e segredo de fallback. | Adapter/configuração não alterados; proposta A4. |
| V05 — alta | Imagem, anexo de despesa, evidência e arquivo de importação são confirmados sem qualquer PUT ou verificação de existência do objeto. Imagem/anexo/evidência aceitam checksum arbitrário e alteração de tamanho de 10 para 11 bytes. A importação bloqueia tamanho declarado divergente, mas aceita checksum sem verificar conteúdo. Depois da confirmação, a API gera URLs de download para objetos nunca enviados. | Integridade do binário não comprovada; proposta A4. |
| V06 — média | Arquivo de importação ainda `pending_upload` já recebe URL de download 200. Imagens, anexos e evidências pendentes recebem 409. | Diferença de lifecycle preservada; proposta A4. |
| V07 — média | API aceita declaração de anexo de despesa de **200 MiB** com `application/octet-stream`; nenhum binário foi enviado. O limite de imagens/evidências não se aplica a esse fluxo. | Capacidade atual, sem presumir limite de negócio desejado; proposta A5. |
| V08 — média | Parcelas iniciadas em **31/01/2026** vencem em 31/01, **03/03**, 31/03. Em 2028, o segundo vencimento é **02/03**. Partindo de 29/02/2028, seguem 29/03 e 29/04. As três parcelas somam 100.00 e nova geração sequencial recebe 409. | Calendário atual preservado; proposta A6. |
| V09 — corrigida | Backend retorna `{run_number, records}`, enquanto o cliente declarava `InventoryReconciliation[]` e um mock retornava `[]`. A tela atual ignora o retorno e relê a listagem; não foi demonstrado crash dessa tela pelo tipo errado. | Tipo e mock alinhados; DTO e schema OpenAPI explícitos, sem mudar o JSON. |
| V10 — corrigida | Em MySQL, `MAX(finished_at)` chega como `Date`; o repository do summary aceitava apenas string/número e retornava `null`. O teste de exportação real falhou em `recent_activity.last_export_finished_at`. | `Date` agora é serializado em ISO; regressões MySQL e unitárias passaram. |
| V11 — corrigida | Criação, atualização e desativação de item invalidavam o resumo, mas deixavam o dashboard analítico em cache. Três testes falharam antes da correção. O cliente usa `staleTime` de 30 segundos. | Invalidação por projeto adicionada, preservando caches de outros projetos e as chaves existentes. |
| V12 — corrigida | `ValidationPipe` retorna `message: string[]`, mas os contratos frontend/Swagger declaravam somente string. | Tipos e documentação aceitam ambas as formas; `ApiError` normaliza arrays para texto e mantém status, código e detalhes. O backend preserva o JSON de erro atual. |

Reproduções: [security-storage.e2e-spec.ts](../../gai-backend/test/integration/technical-validation/security-storage.e2e-spec.ts), [permissions-negative.spec.ts](../../gai-backend/test/unit/modules/auth/permissions-negative.spec.ts), [storage-signer-validation.spec.ts](../../gai-backend/test/unit/common/storage-signer-validation.spec.ts), [project-summary-dates.spec.ts](../../gai-backend/test/unit/modules/project-dashboard/project-summary-dates.spec.ts), [inventoryCache.test.tsx](../../gai-frontend/src/features/inventory-items/inventoryCache.test.tsx).

O protocolo oficial exige autenticação própria do S3, por exemplo os parâmetros SigV4 descritos pela [AWS](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-query-string-auth.html). A conclusão de incompatibilidade deriva desse contrato e do signer local; não de uma tentativa contra bucket remoto. Um eventual gateway privado que valide `X-GAI-*` não foi encontrado nem homologado.

## 2. Suspeitas não confirmadas e controles que passaram

- **Vazamento entre organizações:** não reproduzido nas listagens, summaries, sessões, reconciliações, imagens, evidências, importações e exportações exercitadas. Usuários da organização A não receberam dados de B. Trocas de IDs pai/filho foram negadas com 403/404 conforme o serviço. Isso não constitui prova universal de todos os endpoints ou de dados históricos inconsistentes.
- **Endpoint atual usando chave de permissão não cadastrada:** não identificado. O teste lê metadata real dos controllers, inclusive chaves calculadas do lifecycle, e confronta com `PERMISSION_SEEDS`. V02 é reproduzível no guard com chave desconhecida e afeta futuras rotas ou catálogo de banco incompleto. O catálogo de produção não foi consultado.
- **Download anônimo pela API:** não reproduzido. Os caminhos testados exigem sessão; ausência de token gera 401 e ausência de permissão gera 403. O binário de exportação também exige autenticação, respeita expiração e valida projeto/organização.
- **Duplicação sequencial/idempotência de operações:** os casos existentes de observações/importações, reinventory, consolidação e geração sequencial de parcelas passaram. Não foi feito teste de carga nem prova de todas as intercalações concorrentes.
- **Perda de centavos nos casos testados:** não reproduzida. A distribuição de 100.00 em três parcelas é 33.34/33.33/33.33; a suíte existente cobre também frações pequenas e outros valores. A anomalia de V08 é de calendário.
- **Objeto público, aceitação de assinatura expirada, upload real de conteúdo inválido ou vazamento de URL entre usuários:** não verificados no serviço de storage. Foram testados parâmetros de expiração e estados da API, sem exercer um verificador remoto.
- **Exploração em produção:** não investigada. As conclusões são reproduções locais sintéticas e leitura de código/infraestrutura declarada.

## Papéis e contratos de autorização

| Papel/contexto | Comportamento validado |
|---|---|
| PLATFORM_ADMIN | Bypass de permissões no guard e acesso entre organizações nos serviços que o permitem; ainda sujeito a vínculo pai/filho, existência e lifecycle. O overview organizacional tem restrição específica de ORG_ADMIN, já coberta pela suíte existente. |
| ORG_ADMIN | Bypass de permissões organizacionais; negativa para permissão cadastrada de plataforma; escopo limitado à própria organização. Chave desconhecida é permissiva, conforme V02. |
| ORG_USER/usuário organizacional com perfil customizado | Sem bypass administrativo: depende das permissões efetivas. Os testes HTTP reduzem o perfil `Operador` a conjuntos mínimos de permissões. O enum ORG_USER é também exercitado diretamente no guard. Um perfil customizado não precisa ter chave sistêmica ORG_USER para ser um usuário organizacional válido. |

Principais contratos exercitados:

| Operação | Permissão de entrada e verificação adicional |
|---|---|
| Summary e alias dashboard | `projects:read` + escopo do projeto; sem autorização financeira adicional atualmente. |
| Executar/listar conciliação | `reconciliations:create/read` + projeto/sessão; POST 201 com envelope versionado; GET paginado com filtro de run. Consolidação mantém snapshot e bloqueios existentes. |
| Upload/confirmar evidência | `inventory-observations:create` + organização/projeto/sessão/rodada/observação + estado aceito. |
| Baixar evidência | `inventory-sessions:read` + hierarquia + status uploaded. |
| Baixar imagem | `inventory-item-images:download` + organização/item/projeto + status uploaded; inclui rota global por ID na suíte existente. |
| Baixar anexo | `expenses:download-attachment` + despesa/projeto/organização + status uploaded. |
| Arquivo de importação | `import-files:create/download` + sessão/projeto/organização; download atualmente não exige uploaded. |
| Exportar/baixar XLSX | `export-jobs:create/download` + projeto/organização + estado/expiração; sem exigência de leitura do domínio do arquivo. |

## 3. Storage: resultado técnico

| Aspecto | Resultado |
|---|---|
| Signer e configuração | Protocolo customizado incompatível com S3 padrão; endpoint local inválido. Configuração resumida sem segredos em [storage-config.json](storage-config.json). |
| Integridade/existência | Confirmação registra afirmações do cliente. A porta `StorageSigner` oferece apenas criação de URLs; não há HEAD, leitura de checksum ou verificação de conteúdo nesses fluxos. |
| Expiração | URLs usam TTL configurado, normalmente 300 s; teste com relógio fixo verifica assinatura e timestamp. Enforcement real não homologado. Export jobs usam endpoint autenticado e expiração própria; não passam pelo signer. |
| Tamanho | DTOs rejeitam tamanho zero/negativo; imagens/evidências rejeitam declaração acima de 10 MiB no padrão testado, inclusive na confirmação de imagem. Importação compara tamanho declarado ao confirmar. Anexos aceitam declaração de 200 MiB. Bytes reais não são medidos. |
| MIME | Imagem/evidência aplicam lista permitida na API; isso não verifica os bytes. Anexo genérico aceita MIME sem essa lista. |
| Autorização | API verifica permissões e escopo conforme tabela anterior. URL de storage concedida não reconsulta sessão por si só; revogação e validade dependem do verificador remoto. |
| Exportações | XLSX real gerado, baixado e analisado nos testes; conteúdo fica no banco e tem endpoint autenticado. Não confundir esse resultado com homologação de object storage. |

## 4. Testes e resultados

Os resultados finais por arquivo/caso, resultados iniciais relevantes e a distinção entre suítes estão em [testes.json](testes.json). Logs completos e saídas originais permanecem em `.local/technical-validation-20261027/`.

| Verificação | Resultado |
|---|---|
| Backend antes das alterações | 92 arquivos, 385 testes aprovados. |
| Backend final completo — unitários, contratos e integração SQLite | 96 arquivos, 410 testes aprovados. |
| Frontend final Vitest | 28 arquivos, 178 testes aprovados, incluindo contrato, erros e regressões de cache. |
| Playwright Chromium, API simulada | 55 aprovados; zero falhas, skips ou casos instáveis. Não executado `homologation-real.spec.ts` contra o ambiente local preexistente. |
| MySQL crítico | 14 arquivos distintos, 56 testes aprovados, considerando a última execução de cada arquivo. Autenticação/RBAC, multi-tenancy, inventário/evidências, conciliação, pagamentos, prestação, parcelas, importação e exportação. A revalidação de cinco arquivos aprovou 29 testes e substitui seus resultados anteriores; os nove restantes já haviam passado. |
| Migrations MySQL | 22 aplicadas desde schema descartável; sem pendências. Última migration revertida e reaplicada; índice de storage_key confirmado integral, ASCII/ascii_bin. [migrations.json](migrations.json). Rollback de todas as migrations não foi executado. |
| Builds backend e frontend | Aprovados. Frontend com aviso de bundle maior que 500 kB, sem falha de build. |
| ESLint dos arquivos alterados | Aprovado, sem `--fix` global. |
| TypeScript frontend | Build e checagem de tipos aprovados. |
| TypeScript backend incluindo todos os testes | **Não passou**: oito diagnósticos preexistentes em quatro arquivos de mocks, detalhados abaixo. O build de produção passa; Jest usa transformação isolada e não substitui essa checagem. |

Os oito diagnósticos remanescentes estão em `test/unit/modules/branch-coverage.spec.ts` (cinco spreads de tipo never), `domain-entities.spec.ts` (mock sem `findScopesByKeys`), `field-agents/brazilian-contact.spec.ts` (propriedade code de Error) e `projects/update-project.use-case.spec.ts` (propriedade response de Partial<ConflictException>). Esses quatro arquivos não foram modificados nesta entrega. Não se declara o repositório inteiramente aprovado em TypeScript com testes incluídos.

Falhas durante a preparação também foram examinadas: o seed SQLite tentava recriar papéis já inseridos pelas migrations; o helper MySQL precisava do mesmo `bigNumberStrings:false` do app; e o fixture do dashboard referenciava inventariante inexistente, aceito pelo schema SQLite mas rejeitado pelas FKs reais. Foram corrigidos somente os fixtures/helper. A falha de datas em MySQL revelou V10 e gerou correção de produção. Expectativas de 403/404 dos novos testes foram ajustadas ao contrato real de negativa de cada serviço.

## 5. Alterações propostas que exigem aprovação

| Proposta | Correção concreta proposta | Impacto a aprovar e aceite |
|---|---|---|
| A1 — leitura financeira | Quando `include_financial=true`, exigir leitura dos dois domínios agregados (`payments:read` e `expenses:read`) ou aprovar uma permissão explícita de resumo financeiro. Frontend deve solicitar esse bloco conforme a autorização efetiva. | Decidir entre negar a solicitação completa ou omitir o bloco. Usuários atuais com apenas projects:read perderão os totais. Aprovar também o acesso aos valores da base patrimonial/contábil e aos indicadores financeiros obrigatórios, hoje tratados como parte da leitura do projeto. |
| A2 — catálogo fail-closed | Exigir presença de todas as chaves no catálogo antes do bypass de ORG_ADMIN. Definir explicitamente se PLATFORM_ADMIN também deve falhar para chave desconhecida. Manter teste de catálogo dos controllers. | Banco com permissões não sincronizadas passará a negar rotas. Aceite: desconhecida nunca concede privilégio; permissões válidas e distinção plataforma/organização preservadas. |
| A3 — exportação por domínio | Na criação **e no download**, autorizar o tipo de exportação pelos domínios lidos; payments exige payments:read, expenses exige expenses:read e backup exige os domínios incluídos. Revalidar quando permissões forem revogadas. | Perfis com apenas export-jobs deixarão de obter arquivos financeiros/backups completos. Aprovar tratamento de jobs já existentes e download após revogação. |
| A4 — storage verificável | Confirmar S3 como serviço alvo e substituir/complementar signer com adapter SigV4; validar configuração sem fallback permissivo fora do ambiente de desenvolvimento. Confirmar objeto por HEAD/metadados e checksum confiável antes de uploaded; alinhar download de importação ao lifecycle aprovado. | Gateway privado, se existente, precisará de contrato de transição. Definir retry, confirmação tardia/expirada, objetos pendentes antigos e tratamento de checksum ausente. Exige ambiente isolado com PUT/HEAD/GET reais antes de liberar arquivos; não foi implementado aqui. |
| A5 — política de arquivos | Definir limite de bytes e MIME por finalidade, validar conteúdo real e vincular tamanho/checksum ao objeto autorizado. | Pode recusar arquivos hoje aceitos. Aprovar formatos, limites, exceções e migração de metadados existentes. |
| A6 — calendário | Escolher preservar último dia do mês ou limitar ao dia válido mais próximo, em lugar do overflow de setUTCMonth. | Modifica vencimentos financeiros; não recalcular parcelas persistidas sem decisão explícita. Aceite inclui 31/jan, fevereiro bissexto, fim de mês e centavos. |

Também permanece a regra atual de permitir baixa de pagamento pendente e concentração de criação/aprovação/baixa em perfis administrativos. A regressão preservou esse comportamento; exigir aprovação prévia ou segregação de funções é mudança de negócio, não ajuste de teste.

## 6. Correções realizadas e arquivos

Arquivos de produção alterados/criados nesta entrega:

- `gai-backend/src/common/swagger/error-response.dto.ts`: documenta erros string/array.
- `gai-backend/src/modules/inventory-operations/application/inventory-reconciliation-response.dto.ts`: DTOs do envelope e registros existentes.
- `gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts`: tipos explícitos do retorno e snapshot com os mesmos campos/valores.
- `gai-backend/src/modules/inventory-operations/presentation/inventory-operations.controller.ts`: schema OpenAPI de POST 201.
- `gai-backend/src/modules/project-dashboard/infrastructure/persistence/typeorm-project-summary.repository.ts`: serialização de Date retornada por MySQL.
- `gai-frontend/src/api/endpoints.ts`, `src/types/api.ts`: contrato de conciliação e mensagens de erro, incluindo autoria nullable de registros de conciliação.
- `gai-frontend/src/api/http.ts`: normalização textual dos erros de validação.
- `gai-frontend/src/features/inventory-items/inventoryItemsQueries.ts`, `src/features/project-dashboard/projectDashboardQueries.ts`: invalidação do cache analítico por projeto, mantendo a estrutura das chaves anteriores.

Arquivos de testes/suporte alterados ou criados:

- `gai-backend/test/integration/test-app.helper.ts`: opção MySQL descartável, seed compatível com migrations e tipos dos repositories.
- `gai-backend/test/integration/project-dashboard/project-dashboard.e2e-spec.ts`: fixture com inventariante real em vez de FK inexistente.
- `gai-backend/test/integration/technical-validation/security-storage.e2e-spec.ts`: reproduções negativas e contratos HTTP.
- `gai-backend/test/unit/modules/auth/permissions-negative.spec.ts`: papéis, chave ausente e catálogo real dos controllers.
- `gai-backend/test/unit/common/storage-signer-validation.spec.ts`: protocolo e fallback, sem rede.
- `gai-backend/test/unit/modules/project-dashboard/project-summary-dates.spec.ts`: datas de drivers diferentes.
- `gai-frontend/src/features/inventory-operations/InventorySessionDetailPage.test.tsx`: mock do envelope real.
- `gai-frontend/src/features/inventory-operations/reconciliationContract.test.tsx`: contrato, erros e cache da conciliação.
- `gai-frontend/src/api/http.test.ts`: compatibilidade de erros.
- `gai-frontend/src/features/inventory-items/inventoryCache.test.tsx`: regressões de atualização do dashboard.

Os documentos desta pasta e os logs em `.local/technical-validation-20261027/` completam a entrega. [arquivos.json](arquivos.json) relaciona os arquivos autorais, hashes e deltas de status. Builds/testes também regeneraram saídas `dist`, caches e `tsbuildinfo`; elas não representam implementação funcional adicional. Dependências, lockfiles, .env e migrations existentes não foram editados por esta tarefa.

## 7. Riscos residuais e prontidão

- Resolver V01/V02/V03 antes de ampliar os públicos financeiros, o catálogo de permissões ou as exportações.
- Resolver/homologar V04–V07 antes de depender de uploads/downloads como evidência íntegra, especialmente laudos e documentos profissionais.
- Aprovar V08 antes de evoluir calendário, recebíveis ou projeções financeiras.
- Corrigir os oito diagnósticos de mocks para tornar a checagem TypeScript global com testes um gate confiável. Os testes atuais e o build não cobrem esse gate.
- Não houve homologação de storage remoto, auditoria do estado de produção, carga, stress de concorrência, migração de dados legados ou rollback integral das migrations. A passagem das suítes não elimina esses limites.
- A invalidação de conciliação e a de itens/dashboard têm regressões específicas; não se declara uma prova exaustiva de dependências de cache de todos os módulos. Atualização de permissão durante sessão e cache de dados sensíveis também merece cobertura dedicada na futura alteração de autorização.
- Precisão de agregações monetárias muito grandes, variações de timezone de servidor, conteúdo malicioso de arquivos e políticas de retenção dependem de testes/decisões adicionais conforme os próximos módulos.

**Estado final:** base adequada para planejamento e desenvolvimento isolado de incrementos independentes, com contratos existentes melhor definidos. Liberação funcional dos módulos que dependem de finanças, novas permissões e arquivos permanece condicionada às decisões e aos critérios de aceite acima. Nenhuma funcionalidade do legado foi iniciada.
