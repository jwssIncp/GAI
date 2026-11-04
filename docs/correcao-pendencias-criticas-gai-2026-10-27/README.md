# GAI — correção das pendências críticas

27/10/2026 · America/Sao_Paulo.

**Correções implementadas e verificadas localmente. Prontidão condicionada para liberação em produção.** V01, V02, V03 e V08 foram corrigidos, assim como os oito diagnósticos TypeScript dos mocks e o fluxo de storage. PUT, HEAD e GET reais passaram em MinIO descartável; isso comprova a integração S3 compatível nesse ambiente, sem representar homologação em AWS. O lint completo do backend continua bloqueado por 175 erros preexistentes em seis arquivos fora desta correção.

Referências: [validação técnica anterior](../validacao-tecnica-gai-2026-10-27/README.md) e todos os nove documentos da [auditoria do legado](../auditoria-legado-gai-2026-10-27/README.md), incluindo inventário, matriz, anexos e manifestos. A validação anterior permanece como registro histórico; as reproduções permissivas foram convertidas em regressões negativas. Evidências desta entrega: [testes.json](testes.json), [arquivos.json](arquivos.json) e [referencias.json](referencias.json). Logs completos ficam em `.local/critical-fixes-20261027/`.

O diretório já continha alterações staged, unstaged, arquivos novos, artefatos de build e dependências rastreadas. Nenhuma restauração global foi feita. A relação de arquivos desta entrega distingue o trabalho atual desse estado preexistente. Não houve commit, push, deploy, acesso a bucket de produção, migration de produção ou implementação de funcionalidade do legado.

## 1. Problemas corrigidos

| Problema | Correção e evidência |
|---|---|
| V01 — resumo financeiro | `/projects/:id/summary` e o alias `/dashboard` só acrescentam `financial` se `include_financial=true` **e** houver `payments:read` e `expenses:read`. Sem uma delas, retornam 200 com os demais dados permitidos, sem consultar o agregado financeiro. Testes HTTP exercitam nenhuma leitura, cada leitura isolada, ambas, ORG_ADMIN e PLATFORM_ADMIN. |
| V02 — catálogo permissivo | Toda chave exigida precisa existir no catálogo atual, com escopo reconhecido, antes de qualquer bypass administrativo. Chave desconhecida, catálogo incompleto e combinação conhecida/desconhecida negam acesso inclusive a administradores. Concessão antiga não contorna ausência no catálogo. O teste também confronta metadata dos controllers com os seeds. |
| V03 — conteúdo de exportações | Criação, retry, emissão de URL e download binário exigem leitura dos domínios contidos no arquivo, além da permissão operacional da rota. Jobs existentes permanecem intactos; o download revalida permissões atuais, inclusive depois de revogação. A interface mantém o histórico, filtra opções de criação e remove ações sem autorização de conteúdo. A API continua sendo a autoridade. |
| V08 — parcelas | Calendário derivado sempre da origem: fim de mês permanece fim de mês; demais dias são mantidos ou limitados ao último dia válido. Sem deriva por encadeamento. Nenhuma parcela existente é recalculada. Divisão decimal e soma permanecem iguais. |
| Persistência de vencimentos | A nova verificação criar→persistir→consultar reproduziu um dia a menos por conversão local de `Date` para SQL `DATE`. Novas parcelas agora persistem data civil como string `YYYY-MM-DD`. Não houve migration, alteração de schema ou regravação histórica. Os três casos de round-trip falhavam antes e passaram após a correção. |
| TypeScript — oito diagnósticos anteriores | Corrigidos somente os mocks: tipos dos overrides/spreads; `findScopesByKeys`; erro de driver com `code`; matcher de conflito incompatível. Nenhum contrato de produção foi relaxado para satisfazer mocks. |
| V04–V07 — storage | Signer proprietário substituído por adapter AWS SDK SigV4, com configuração explícita, verificação do objeto real, limite global, checksum SHA-256 e download restrito ao estado uploaded. Confirmação sem objeto, declaração divergente e conteúdo incompatível são rejeitados. Importação pendente deixou de obter URL de download. |

Os testes também preservam autenticação, RBAC, escopo de organização/projeto e relações pai/filho. Não foi reproduzido vazamento entre tenants nos caminhos exercitados. Isso não constitui prova de todos os endpoints ou de dados históricos inconsistentes.

## 2. Permissões efetivas

O guard, o resumo e a autorização de conteúdo compartilham `hasAllPermissions`, que consulta o catálogo antes do bypass. ORG_ADMIN mantém acesso implícito às permissões **organizacionais válidas**, restrito pelos serviços à própria organização. PLATFORM_ADMIN mantém o alcance das permissões **válidas** e os escopos admitidos pelos serviços. Usuários organizacionais dependem das concessões efetivas e do escopo correspondente. Nenhum papel recebe acesso por chave inexistente.

| Tipo de exportação | Leituras adicionais obrigatórias |
|---|---|
| `inventory_items_xlsx` | `inventory-items:read` |
| `inventory_accounting_items_xlsx` | `inventory-accounting-items:read` |
| `pending_issues_xlsx` | `inventory-pending-issues:read` |
| `payments_xlsx` | `payments:read` |
| `expenses_xlsx` | `expenses:read` |
| `project_backup_xlsx` | `projects:read` e todas as cinco leituras acima |

O mapa foi confrontado com as fontes e abas do workbook atual. Tipos futuros precisam declarar suas leituras; tipo não mapeado é negado. Não foram criadas novas permissões nem alterados perfis no banco. O sincronismo do catálogo deve ser verificado no rollout: catálogo incompleto agora resulta em negativa, como solicitado.

## 3. Contratos/API e compatibilidade

- Resumo: preservados envelope, status e campos obrigatórios. O bloco financeiro opcional passa a ser omitido quando não autorizado, inclusive em chamada direta à API. O acesso aos agregados patrimoniais/contábeis obrigatórios não foi alterado nesta etapa.
- Exportações: JSON, arquivos, IDs e histórico preservados. Operações antes permissivas podem responder **403** por falta de leitura do conteúdo. URL de exportação continua apontando para endpoint autenticado, que revalida o acesso no download.
- Parcelas: `due_date` de novas parcelas é data civil, coerente com a coluna SQL `DATE`, o formato de data documentado e a consulta posterior. A resposta imediata da geração deixa de serializar esse campo como timestamp UTC; consumidores que exigiam `T00:00:00.000Z` precisam aceitar `YYYY-MM-DD`. O frontend existente já usa string. Valores e estados permanecem iguais.
- Upload: mantidos os endpoints e o fluxo solicitar URL→PUT→confirmar. A URL agora usa `X-Amz-*`/SigV4, com MIME e comprimento assinados; o cliente deve enviar exatamente os bytes e `Content-Type` declarados. Não são necessários cabeçalhos proprietários `X-GAI-*`.
- Checksum, quando informado, deve ser SHA-256 hexadecimal de 64 caracteres. Na confirmação, o servidor calcula e persiste o digest dos bytes reais, mesmo sem checksum enviado pelo cliente. Não aceita tamanho diferente do autorizado.
- Downloads de imagem, anexo, evidência e importação exigem uploaded e autorização de organização/recurso antes de acessar storage. Cada emissão verifica novamente existência, tamanho, MIME e hash e assina a versão verificada do objeto.
- Erros de storage: declaração/configuração de requisição inválida **400**; objeto ausente **404**; arquivo pendente/divergência de integridade/MIME/versionamento **409**; autorização de upload expirada **410**; falha remota genérica **503**, sem repassar mensagens internas do provedor. Autenticação/autorização continuam **401/403** conforme a rota.
- Conciliação, envelope `{run_number, records}`, regras de inventário, cache e tratamento de erros corrigidos na validação anterior permanecem preservados e cobertos pela regressão.

## 4. Storage: implementação e configuração

O Terraform declara bucket privado de assets no AWS S3, versionamento, criptografia AES256, bloqueio de acesso público e CORS. A configuração local declara S3, mas o antigo signer implementava somente HMAC próprio. Não foi encontrada implementação de gateway que dependa de `X-GAI-*`. A investigação confirma **S3 como destino previsto pelo código/infraestrutura declarados**, sem afirmar qual configuração está ativa em produção.

O novo adapter usa `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`, ambos fixados em `3.1069.0`, com cadeia padrão de credenciais AWS e role da task no ECS. Configuração ausente/inválida interrompe a inicialização. Produção usa endpoint regional AWS; não aceita endpoint customizado nem segredo/endpoint de fallback. Endpoint HTTP só é aceito em loopback fora de produção para testes isolados.

Antes de confirmar, executa HEAD e GET da versão encontrada, lê os bytes com limite, confere tamanho e MIME, calcula SHA-256 integral e compara as declarações. Exige versionamento para fixar a versão no download e evitar que um PUT repetido troque o conteúdo de uma URL já emitida. Download posterior detecta substituição por hash diferente. Confirmação verifica expiração antes e depois da leitura. Os quatro fluxos de upload agora validam/assinam antes de salvar o registro pendente, evitando registros órfãos em requisições inválidas.

Configurações a preparar **antes de qualquer rollout**:

| Variável/requisito | Configuração |
|---|---|
| `STORAGE_PROVIDER` | `s3`, explícito |
| `STORAGE_BUCKET`, `AWS_REGION` | Destinos explícitos do ambiente autorizado |
| `STORAGE_MAX_SIZE_BYTES` | Obrigatório; exemplo/Terraform usam 50 MiB. Adapter aceita limite entre 1 byte e 100 MiB. Limites menores específicos de imagem/evidência continuam aplicáveis. |
| `STORAGE_ALLOWED_MIME_TYPES` | Lista explícita dentre os tipos suportados. Exemplo/Terraform não incluem `application/octet-stream`; habilitação desse tipo genérico exige decisão consciente do ambiente. |
| `STORAGE_PRESIGNED_URL_TTL_SECONDS` | Obrigatório, 1–3600 s; exemplo/Terraform usam 300 s. TTL específico de imagem precisa respeitar o teto global. |
| `STORAGE_FORCE_PATH_STYLE` | `false` para AWS; `true` no serviço loopback isolado |
| `STORAGE_ENDPOINT_URL` | Vazio/ausente para AWS; customização somente fora de produção |
| Bucket | Versionamento habilitado; privado; IAM com PUT, HEAD/GET e `s3:GetObjectVersion`. Terraform recebeu a permissão de versão. |

`.env.example` e a task definition declarada em Terraform foram atualizados. O `.env` local do usuário não foi modificado: ainda precisa ser adaptado, pois a configuração antiga não satisfaz os novos requisitos. Terraform não foi aplicado; a ferramenta Terraform não está disponível neste ambiente para `fmt/validate`. O pipeline deve receber a configuração efetiva da task antes de publicar a nova imagem; não se presume que atualizar somente o código injete essas variáveis em uma task já registrada.

Incompatibilidades deliberadas: URLs proprietárias antigas não são suportadas pelo adapter; registros antigos sem checksum confiável, com digest incompatível, objeto ausente ou sem versionamento não obtêm download. Pendências expiradas não são confirmadas tardiamente: precisam de nova autorização/upload. Nenhum backfill ou conversão de registros históricos foi executado. A estratégia de recuperação de arquivos históricos precisa de levantamento e execução separados, com acesso autorizado.

## 5. Testes e resultados

| Verificação | Resultado final |
|---|---|
| Backend — unitários, contratos e integração SQLite | **465 aprovados**, 7 opt-in de S3 não executados nessa modalidade; 98 arquivos encontrados. Resultado consolidado da suíte completa com a última execução do arquivo de regressão ajustado. |
| Frontend — Vitest | **179 aprovados em 28 arquivos**, incluindo a restrição de ações/opções de exportação por conteúdo. |
| MySQL real descartável | **66 aprovados em 14 arquivos**, com migrations reais e fixtures sintéticos. |
| Storage real isolado | **7 aprovados**, incluindo PUT, HEAD, GET, MIME assinado, expiração efetiva, objeto ausente, conteúdo incompatível, substituição/versionamento e ciclo HTTP Nest completo de imagem. Reexecução aprovada com exit code nativo 0. |
| Migrations | **22 aplicadas** desde schema descartável em MySQL **8.0.46**, sem alteração de migrations nesta entrega. Não foi repetido rollback integral. |
| TypeScript backend, incluindo testes | **Aprovado**, `tsc --noEmit --incremental false`; oito diagnósticos anteriores eliminados. |
| TypeScript frontend | **Aprovado** pelo build (`tsc -b`), incluindo testes de `src`. |
| Builds backend/frontend | **Aprovados**. Frontend mantém aviso de chunk acima de 500 kB. |
| ESLint dos 40 arquivos TypeScript backend desta entrega | **0 erros e 0 avisos**; rechecagem dos últimos testes alterados também sem erros. |
| ESLint completo backend | **175 erros preexistentes em seis arquivos**, listados abaixo; nenhum erro nos arquivos desta entrega. Execução sem `--fix` global. |
| ESLint frontend | **0 erros**, 1 aviso preexistente de hooks em `OverviewDetails.tsx`. |
| `git diff --check` dos arquivos desta entrega | **Aprovado**. |

Os 7 testes S3 são separados dos testes com mocks; não se conta simulação como homologação de storage. Os 66 casos MySQL reexecutam uma parte dos casos backend; não representam 66 cenários adicionais distintos. Playwright não foi reexecutado nesta etapa; a aprovação anterior de Chromium pertence à validação anterior.

Cobertura exercitada: autenticação, RBAC e catálogo, negativas financeiras e de exportação, revogação de permissões, backup sem cada uma das leituras necessárias, isolamento organizacional e IDs pai/filho, inventário, imagens/evidências, conciliação, importação, pagamentos/despesas, prestação de contas, idempotência, parcelas, centavos e exportações XLSX reais. Calendário cobre janeiro, fevereiro, ano bissexto, dias 29/30/31, fim de mês, virada de ano e 1/2/12/24/36 parcelas. Teste histórico conserva vencimento sintético antigo mesmo após tentativa de regeneração, que continua retornando 409.

Falhas investigadas durante a execução:

1. Três novas verificações de round-trip falharam por perda de um dia na persistência SQL DATE. Correção de produção descrita acima; SQLite e MySQL passaram depois.
2. A suíte completa teve uma falha no novo fixture histórico: expectativa de decimal string com SQLite retornando número. O teste passou a comparar o valor textual de ambos, sem mudar serialização ou cálculo de produção. A reexecução do arquivo aprovou os 25 casos; `testes.json` mantém a tentativa anterior e a consolidação por última execução.
3. Repetir a suíte S3 no mesmo serviço encontrava `BucketAlreadyOwnedByYou` no setup. O fixture passou a tolerar exclusivamente esse erro do SDK, mantendo a falha para demais erros. As reexecuções com os mesmos containers passaram. O destino permanece fixo em loopback com credenciais sintéticas.
4. O novo teste de interface inicialmente usava o usuário padrão em vez do fixture restrito. O helper foi corrigido; a suíte frontend final passou. Nenhum contrato de produção foi alterado para esses fixtures.

Arquivos com erros preexistentes no lint completo:

| Arquivo em `gai-backend/` | Erros |
|---|---:|
| `src/modules/project-dashboard/application/dto/organization-overview-query.dto.ts` | 14 |
| `src/modules/project-dashboard/application/services/organization-overview.service.ts` | 78 |
| `src/modules/project-dashboard/presentation/organization-overview.controller.ts` | 14 |
| `src/scripts/seed/ensure-platform-admin.ts` | 1 |
| `test/unit/modules/organization-scope-services.spec.ts` | 18 |
| `test/unit/modules/project-dashboard/organization-overview.spec.ts` | 50 |

Há problemas de formatação, regras de acesso/retorno inseguro de tipos e `no-control-regex` nesses arquivos. Eles não foram reformatados ou refatorados nesta entrega. O status global de lint, portanto, **não é verde**.

## 6. Infraestrutura isolada e reprodução

Foram criados exclusivamente para esta execução:

- MySQL `gai-fixes-mysql-20261027`, loopback `127.0.0.1:33317`, banco `gai_validation_disposable`, dados em tmpfs. O helper opt-in ignora `DB_*` da aplicação e usa destino/credenciais sintéticos fixos.
- MinIO `gai-fixes-storage-20261027`, loopback `127.0.0.1:33318`, bucket `gai-isolated-tests`, versionamento habilitado e dados em tmpfs. O fixture não consulta AWS profiles, bucket da aplicação ou credenciais de produção.

Imagens usadas: `mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b` e `minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`. Ao final, ambos os containers descartáveis foram removidos, eliminando os tmpfs; o `gai-mysql` preexistente foi preservado.

Com os serviços descartáveis disponíveis nas portas fixas, os comandos principais são:

```powershell
# gai-backend
npm.cmd test -- --runInBand
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build
node node_modules/eslint/bin/eslint.js "src/**/*.ts" "test/**/*.ts"

$env:GAI_TEST_MYSQL_DISPOSABLE='1'
npm.cmd test -- --runInBand test/integration/auth test/integration/technical-validation test/integration/inventory-operations test/integration/export-jobs test/integration/payments-expenses test/integration/import-sessions test/integration/inventory-item-images test/integration/project-dashboard
Remove-Item Env:GAI_TEST_MYSQL_DISPOSABLE

$env:GAI_TEST_S3_DISPOSABLE='1'
npm.cmd test -- --runInBand test/integration/storage/s3-isolated.e2e-spec.ts
Remove-Item Env:GAI_TEST_S3_DISPOSABLE

# gai-frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

**O opt-in MySQL recria o schema descartável.** Ele não deve ser adaptado para apontar para banco com dados reais. Os comandos não habilitam storage fake na aplicação: o fake é injetado exclusivamente pelo helper de testes; a suíte S3 opt-in injeta o adapter real.

## 7. Arquivos alterados

São **48 arquivos de código, testes, dependências, configuração e infraestrutura**, listados individualmente com SHA-256 em [arquivos.json](arquivos.json), além dos quatro documentos desta pasta. Principais grupos:

- Backend: guard e helper de permissões; summary e contexto do ator; serviço/controller/mapa de exportações; calendário, persistência e serviço de parcelas; porta, adapter e políticas de storage; quatro fluxos de arquivos; códigos de erro; dependências e exemplo de ambiente.
- Testes: regressões de autorização/storage/calendário; storage real opt-in; fake explícito e helper; quatro fixtures de upload; mocks TypeScript corrigidos.
- Frontend: página de exportações, mapa de leituras e teste de autorização visual. Sem alteração de estilos ou identidade visual.
- Infra: variáveis da task e permissão IAM para leitura de versão de objeto.

Builds também atualizaram artefatos locais gerados, inclusive `dist`/cache de TypeScript quando presentes; não compõem a lista de fontes desta entrega. Dependências e artefatos que já estavam alterados na entrada não foram restaurados a partir de HEAD.

## 8. Riscos residuais, homologação e prontidão

1. **AWS ainda não homologado.** Não foi disponibilizado um bucket AWS isolado com credenciais de teste explicitamente autorizadas. O ambiente disponível permitiu MinIO real. Antes de liberar storage, executar PUT/HEAD/GET contra S3 isolado e validar task role, `GetObjectVersion`, região, versionamento, criptografia, CORS no navegador e configuração efetiva. Não considerar os testes MinIO como validação da infraestrutura AWS.
2. **Configuração é pré-requisito de inicialização.** Aplicar conscientemente as novas variáveis no ambiente de destino e validar o limite/MIMEs necessários aos arquivos existentes. O código falha de forma fechada se a configuração estiver incompleta; não houve alteração de ambiente remoto.
3. **Arquivos históricos.** Registros antigos podem conter metadados sem objeto ou checksum arbitrário. Permanecem preservados, mas downloads podem ser bloqueados. Levantar esses registros e definir revalidação/reupload com autorização própria; esta entrega não executa backfill nem mantém bypass para eles.
4. **Inspeção de formato limitada.** SHA-256 cobre todos os bytes, mas a detecção de formato usa assinatura/prefixo e metadados, não parser completo nem antivírus. XLSX e ZIP compartilham assinatura; JSON é inspecionado pelo prefixo. Não se declara validação semântica completa desses formatos. `application/octet-stream`, se habilitado explicitamente, não recebe detecção de formato.
5. **Custo e concorrência.** Confirmação e emissão de download leem o objeto inteiro para verificar integridade. Limites e timeouts estão aplicados; não houve teste de carga, varredura de malware, validação de lifecycle/limpeza de versões abandonadas ou prova de toda intercalação concorrente. URLs S3 já concedidas funcionam como credencial temporária até expirar; revogação de sessão não revoga automaticamente uma URL emitida.
6. **Dívida de lint.** Os 175 erros backend e o aviso frontend preexistentes precisam de tratamento separado para pipeline global totalmente verde. Bundle frontend mantém aviso de tamanho. Terraform ainda requer validação por ferramenta e revisão no ambiente de infraestrutura.

As regras de V01/V02/V03/V08 foram implementadas conforme autorização desta solicitação; não há nova política pendente para concluir essas correções. Limites/MIMEs de produção e a recuperação histórica precisam de decisão operacional antes da liberação correspondente. A base está preparada para avançar no desenho e implementação dos novos módulos, preservadas essas condições; **storage AWS e liberação em produção continuam condicionados à homologação e configuração descritas acima**.
