# Testes — Onda 1

Os resultados finais abaixo têm exit code 0, zero falhas e zero skips. npm audit permanece com exit 1, informado separadamente como risco residual; não é apresentado como aprovado. Detalhes estruturados em [final-validation.json](evidencias/final-validation.json).

| Execução | Suítes | Aprovados | Falhos | Ignorados | Evidência |
|---|---:|---:|---:|---:|---|
| unit | 60 | 430 | 0 | 0 | [JSON](evidencias/unit-jest.json), unit.log, unit-result.json |
| sqlite | 53 | 253 | 0 | 0 | [JSON](evidencias/sqlite-jest.json), sqlite.log, sqlite-result.json |
| default | 113 | 683 | 0 | 0 | [JSON](evidencias/default-jest.json), default.log, default-result.json |
| coverage | 113 | 683 | 0 | 0 | [JSON](evidencias/coverage-jest.json), coverage.log, coverage-result.json |
| mysql | 45 | 307 | 0 | 0 | [JSON](evidencias/mysql-jest.json), mysql.log, mysql-result.json |
| s3 | 1 | 7 | 0 | 0 | [JSON](evidencias/s3-jest.json), s3.log, s3-result.json |
| Frontend Vitest | 88 grupos reportados | 247 | 0 | 0 | [JSON](evidencias/frontend-vitest.json) |
| Playwright API real | 2 fluxos | 2 | 0 | 0 | [JSON](evidencias/e2e/playwright.json) |

Unitários no padrão: 430 em 60 arquivos; SQLite/contratos: 253 em 53 arquivos. A lista MySQL também executa contratos HTTP compartilhados no motor real. O total backend deduplicado por arquivo + nome completo + ocorrência é **812**, sem somar coverage/default, unitários anteriores ou regressões dirigidas.

## Comandos

Em checkout limpo, executar npm ci em gai-backend e gai-frontend. Neste workspace preexistente, os comandos foram executados em evidencias/workspace/gai-backend e gai-frontend para preservar módulos já modificados. O script validate.cjs registra comandos exatos, duração e exit code em cada *-result.json.

```powershell
# gai-backend; npm.cmd no PowerShell com ExecutionPolicy restrita
npm.cmd test
npm.cmd run test:unit
npm.cmd run test:integration:sqlite
npm.cmd run test:integration:mysql
npm.cmd run test:integration:s3
npm.cmd run test:cov
npm.cmd run test:e2e:real
npm.cmd run lint
npm.cmd run build
node node_modules/typescript/bin/tsc --noEmit --incremental false
# gai-frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Para repetir nesta entrega: node docs/correcoes-onda-1-integridade-2026-10-28/validate.cjs seguido de sync, unit, sqlite, default, coverage, mysql, s3, frontend, backend-checks, frontend-checks ou e2e. sync copia também specs/ e .prettierrc, sem copiar .env nem node_modules originais. **Não executar mysql, e2e, smoke-related ou inspeção simultaneamente**: compartilham o banco sintético 33337; mysql/e2e recriam schema por desenho. O runner padrão ignora flags MySQL externas e usa SQLite em memória.

## Serviços de teste

MySQL exclusivo gai-wave1-20261028-mysql, versão 8.0.46, porta 127.0.0.1:33337, banco gai_validation_disposable e senha sintética gai-validation-only. Inicialização reproduzível em host sem esse contêiner:

```powershell
docker run -d --name gai-wave1-20261028-mysql -p 127.0.0.1:33337:3306 --tmpfs /var/lib/mysql:rw,size=1g -e MYSQL_ROOT_PASSWORD=gai-validation-only -e MYSQL_DATABASE=gai_validation_disposable mysql:8.0.46 --innodb-flush-log-at-trx-commit=2 --sync-binlog=0
```

Aguardar mysqladmin ping antes do runner. S3 compatível usa o serviço isolado existente em 33318, credenciais gai-validation/gai-validation-only e paths aleatórios no bucket gai-isolated-tests. Foram feitos PUT/HEAD/GET reais, versionamento e verificações de integridade/assinatura; objetos anteriores não foram apagados. O workflow define os mesmos alvos e fixa a imagem MinIO pelo digest observado, mas a execução remota não foi realizada.

## Coberturas críticas

- 430 casos unitários do padrão, incluindo 50 casos novos de calendário/DTOs/políticas/transformer/instantes.
- Datas civis inválidas: 400 em pagamento e despesa, sem nova linha ou auditoria; limites, bissextos, projetos/alocações e filtros. UTC: quatro zonas Node, servidor +09:00, conexões do pool +00:00, SQL/API/auditoria e virada de mês.
- Onda 0: 124 pares concorrentes (109 comprovados por barreira InnoDB, 100 de stress); duas instâncias Nest/pools no mesmo processo; approve/paid/edit/cancel, segunda baixa, escopo, falha de auditoria com rollback, somas de 0/1/100/101/1205/1310 pagamentos e decimais grandes.
- 16 passos HTTP assertivos da regressão relacionada: parcelas, fechamento de prestação, auditoria, previsto/realizado antes/depois da baixa, resumo e visão organizacional. Não são contados como 16 cenários Jest. DRE também é coberta pela suíte MySQL e navegador.
- Autorização: login/JWT real, 401 sem sessão, 403 sem permissões, organizações diferentes, remoção de cada leitura financeira, negativa genérica 409, nenhuma criação de job indevida, downloads autenticados e revogação de conteúdo.
- Navegador Chromium: recebível → parcelas → recebimentos parciais/totais → estorno → caixa → XLSX → refresh; DRE → classificação/competência → fechamento/reabertura → exportação. API 33339 e Vite 33340 são iniciados pelo harness, com dados sintéticos, sem reutilizar os serviços do usuário.
- Metadata: banco novo com 33 migrations e upgrade aditivo sobre dados; getTables/schema log funcionam; índice gerado preservado; nenhuma sugestão do diff aplicada.

## Falhas intermediárias preservadas

1. Baseline unitário amplo anterior: 445 testes; esse grupo incluía contratos que agora têm seleção própria. Lint backend: 83 erros (82 formatação, um no-control-regex); frontend: um aviso.
2. Preflight: 33 asserções passaram, mas afterAll falhou por pasta de evidência ausente e deixou conexões abertas. A rodada **não** foi aprovada. Corrigida criação de diretório; processos exclusivos foram identificados e encerrados. initial-preflight-jest.json preserva o resultado.
3. Primeira cópia isolada sem .prettierrc produziu diagnósticos de formatação artificiais; original continuava com 83. Copiada configuração, sem reformatar o projeto inteiro. initial-backend-eslint.json preservado.
4. Frontend: 246 pass / 1 falho por mock que substituía o construtor URL. Corrigido o mock e a espera pelo formulário; todas as asserções mantidas.
5. Padrão multiprojeto sem timeout global herdado causou hooks de 5s; rodada interrompida e não contada. Timeout original de 60s aplicado no nível global.
6. MySQL com metadata BIGINT real: 284 pass / 23 falhos, zero skips; novas inserções retornavam IDs como texto em alguns módulos. Corrigidas normalizações de orçamento/contrato/documentos e mapeadores de inventário. Regressão dirigida posterior: **56/56** em seis arquivos, sem remoção de asserções. intermediate-mysql-jest.json e id-regression-jest.json preservados.
7. npm ls expôs cópia JS-YAML antiga/invalid sob Swagger; rodadas backend interrompidas antes da instalação final. Swagger 11.4.7 resolveu a árvore e npm ls passou nos dois projetos. Runs interrompidos não são aprovados/contados.
8. Primeira cobertura: 645 pass, 1 falho e cinco arquivos sem carregar por specs/*.yaml ausentes na cópia. Limiar de cobertura já atendido, mas rodada reprovada. Incluídas todas as fixtures; execução completa refeita.
9. A tentativa anterior de consultar processos teve revisão automática indisponível por limite de uso; não foi executada nem contornada. Após a retomada, a consulta foi autorizada e os processos da tarefa puderam ser identificados. Não há ação pendente por esse bloqueio.

Logs com ERROR de falhas SQL/auditoria deliberadamente injetadas fazem parte dos cenários de rollback. Aprovação depende dos resultados/assertivas e exit code, não da ausência de mensagens ERROR no log.

## Limites

Não houve CI remoto, build/scan da imagem Docker, teste em produção ou validação de AWS/ALB/ECS/SES. O build da aplicação e a consistência de empacotamento vendor/workflow foram conferidos separadamente em packaging-ci.json. As contagens finais não apagam resultados intermediários nem são somadas a eles.

## Conferência adicional de exportação

Uma assertiva nova de filtro exato inicialmente consultou financePayload sem selecioná-lo; a coluna é select:false por desenho. O teste foi corrigido para addSelect e mantém a conferência exata de project_id, além das verificações de tipo, organização e solicitante. O resultado intermediário foi preservado; a rodada final completa deve estar aprovada antes de gerar este relatório. Não houve alteração no endpoint para satisfazer essa assertiva.

## Ajustes do harness de navegador

A primeira tentativa não iniciou testes porque /health foi registrado depois do handler 404 do app de teste; o controller de saúde existente agora é incluído antes de app.init, por opção exclusiva do harness. Na tentativa seguinte, recebíveis passaram, mas DRE excedeu 15s na navegação inicial com compilação a frio do Vite; trace e resultado 1 pass/1 fail permanecem em intermediate-e2e-cold-start. O runner passou a compilar o frontend e servir o build via preview, mantendo timeouts/assertivas e fixando a base relativa da API isolada. Os dois fluxos finais passaram sem retries nem skips.

## Conferência final dos caminhos de importação

A revisão das 24 colunas DATE acrescentou aquisição contábil ao DTO e aos limites do parser. PATCH inválido deve manter a data anterior; XLSX inválido deve produzir erros de linha sem novos itens. Na importação física, o parser preserva texto inválido e a API exige instante com fuso explícito. Foram acrescentados três casos unitários do parser e mantidas todas as asserções anteriores, com negativas/round-trip adicionais por HTTP. As rodadas interrompidas antes desse fechamento estão documentadas em additional-import-validation.json.
