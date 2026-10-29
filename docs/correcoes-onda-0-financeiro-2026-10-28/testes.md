# Testes e reprodução

## Ambiente isolado

MySQL 8/InnoDB no container novo `gai-wave0-20261028-mysql`, porta fixa **33327**, database `gai_validation_disposable`. Credenciais são exclusivamente sintéticas. O modo de testes ignora `DB_*`; nunca usa a porta 3306. O banco anterior da auditoria, porta 33317, e seu MinIO 33318 foram preservados.

O datadir usa tmpfs; os parâmetros `innodb_flush_log_at_trx_commit=2` e `sync_binlog=0` servem somente para testes rápidos. Locks/rollback/isolamento são reais, mas este ambiente não comprova durabilidade após queda. As migrations existentes foram aplicadas em bases novas desse container. Nenhuma migration nova foi criada.

Na reprodução anterior à correção, a API escutou em 127.0.0.1:33329. Na suíte de aceite, duas instâncias Nest em portas loopback efêmeras compartilham o schema e possuem pools diferentes. A segunda usa `reuseDisposableDatabase`, sem reset ou seed adicional. HTTP, autenticação, permissões, controllers, domínio e TypeORM são reais. O storage do helper é fake e não é usado como prova de armazenamento nesta onda.

## Antes e depois

| Cenário | Antes | Aceite após a correção |
| --- | --- | --- |
| Script HTTP original, aprovação/baixa simultâneas | 0/15 regressões nesta nova amostra livre; auditoria original preservada tinha 5/15 | 15 pares livres, sem regressão |
| Baixa entra na fila antes de aprovação, com barreira MySQL | 15/15 terminaram `approved` após baixa 200 | Baixa 200, aprovação 409, linha final `paid`, uma auditoria de baixa |
| Aprovação antes de baixa | Gravação de agregado anterior desprotegida | Dois 200, trilha `pending → approved → paid` |
| Duas baixas / duas aprovações | Sem garantia entre leitura e gravação | Um sucesso e um 409; um evento correspondente |
| Edição e baixa, nos dois sentidos | Mesmo caminho desprotegido | Edição anterior preservada no valor baixado; edição posterior rejeitada |
| Cancelamento e baixa, nos dois sentidos | Mesmo caminho desprotegido | Cancelamento anterior bloqueia baixa; baixa anterior bloqueia cancelamento |
| 101 pagamentos × 1.00 | Quantidade 101, pendente 100.00 | Quantidade 101, pendente 101.00 |
| 1.205 pagamentos, quatro estados | Limitado aos primeiros 100 | Pendente 112.01; aprovado 9999999999999.99; pago 0.20; cancelado 0.30 |
| 1.310 pagamentos, DECIMAL grande | Soma em JS e página limitada | Aprovado 1059999999999998.94, conferido com SQL |
| Falha real de insert da auditoria | Não bastava para impedir a corrida original | Trigger SQL rejeita evento; pagamento e trilha revertidos; retentativa completa uma baixa |

Os limites 0, 1 e 100 também são verificados. Após nova baixa, os totais mudam imediatamente de pendente para pago, sem cache intermediário. Projetos e organizações diferentes mantêm totais independentes.

O smoke `smoke-related.cjs` também foi executado duas vezes, sem reset do schema: cada execução verificou 16 chamadas HTTP de negócio, além da autenticação e criação dos fixtures. Abriu/vinculou/fechou uma prestação de contas de 25.50, gerou três parcelas de 8.50 e conferiu que o fechamento não duplicou a saída no caixa. Com um pagamento baixado de 33.33, o caixa tinha 33.33 realizado e 25.50 previsto; após baixa da despesa, ficou 58.83 realizado e 0.00 previsto, com dois movimentos. Resumo financeiro do projeto e listagem/overview organizacionais permaneceram coerentes. Evidências: `related-http.json` e `related-http.log`; a saída estruturada é da segunda execução, projeto 16, e o log preserva a primeira, projeto 15. Esses smokes não são somados como definições Jest.

## Concorrência efetivamente exercitada

Uma terceira conexão executa `SELECT ... FOR UPDATE` sobre o pagamento e segura a transação. As requisições HTTP são iniciadas uma a uma; antes de liberar a linha, o teste exige que `performance_schema.data_lock_waits` apresente o número esperado de transações aguardando. A ordem de espera é controlada e as duas ordens principais são testadas. Na execução final, `data_locks` também registra os modos S/X e as esperas.

A bateria final contém **124 pares**: 109 com barreira InnoDB (9 combinações de borda e 100 pares de stress alternando a ordem) e 15 pares livres que repetem o cenário original. Cada par é validado individualmente; não existe tolerância percentual ou média de sucesso. Quando uma baixa responde 200, a linha final e o último evento devem continuar coerentes com `paid`. Ator, data, valor e referências são comparados com o SQL. Os 100 pagamentos do stress também precisam aparecer uma vez cada no caixa realizado, sem saída prevista residual, e coerentes no resumo do projeto/dashboard.

Contagem de todas as tentativas desta onda: 30 pares antes da correção (15 livres sem reprodução nesta amostra e 15 com barreira, todos com falha); depois, 466 pares distribuídos nas duas tentativas intermediárias de 109 pares, na regressão completa de 124 e no aceite final de 124. Nenhuma dessas 466 corridas posteriores apresentou perda de baixa; as falhas de fixture dos comandos intermediários continuam reportadas separadamente. Somente os últimos 124 compõem a bateria final de aceite. O primeiro comando de construção da suíte falhou antes de iniciar corridas, por fixture inválido.

Pagamentos diferentes conseguem concluir enquanto outra linha permanece bloqueada, inclusive no mesmo projeto e em outro tenant. Leituras/escritas cruzadas de organizações e troca indevida de projeto são rejeitadas. Um operador sintético mantém leitura e perde apenas a permissão de aprovação para verificar RBAC negativo.

Mesma chave de cabeçalho e cabeçalhos distintos não duplicam baixa: o contrato de pagamentos não implementa replay por chave, e a repetição recebe 409. Estorno de pagamento não existe (rota inexistente 404; cancelamento de `paid` 409). Recebíveis têm comandos e estornos próprios, verificados pela suíte de regressão correspondente.

## Resultados e arquivos

As contagens finais estão no [README](README.md) e em `evidencias/acceptance.json`. As populações de unidade, integração e frontend são reportadas separadamente. A consolidação da integração substitui somente a suíte de integridade reexecutada e não soma suas definições duas vezes.

- `unit-jest.json` / `unit.log`: 58 arquivos em `test/unit`, 376 testes aprovados.
- `integrity-jest.json` / `integrity.log`: execução final completa da Onda 0, 12 testes aprovados, incluindo 100 pares de stress.
- `concurrency-after.json`: respostas HTTP, linha SQL, eventos, esperas/locks e consumidores financeiros de cada cenário final.
- `regression-jest.json` / `regression.log`: comando de integração completo, com resultados brutos preservados.
- `integration-consolidated.json`: casos da integração sem duplicar a suíte reexecutada, com nomes e estados.
- `frontend-vitest.json`: frontend completo, 247 aprovados.
- `backend-checks.json`: TypeScript incluindo testes, build Nest em diretório isolado e lint dos oito arquivos alterados; todos exit 0 na versão final.
- `eslint-changed.json`: diagnóstico final de lint, sem `--fix` global.
- `source-preservation.json`: verificação dos 1.080 arquivos da auditoria anterior; somente seis fontes preexistentes intencionalmente alteradas, nenhuma ausente.
- `baseline-synthetic.sql`, `regression-synthetic.sql`, `final-synthetic.sql` e `related-synthetic.sql`: snapshots dos dados exclusivamente sintéticos. O teste de proteção histórica introduz de propósito uma linha inconsistente por SQL; ela não representa uma baixa HTTP bem-sucedida da aplicação corrigida e não é apagada dos fixtures.

## Falhas preservadas e limites de interpretação

As primeiras três execuções da nova suíte tiveram erros de fixture, registrados sem apagar seus resultados: (1) campo `organization_id` inexistente no DTO de criação de field agent, 11 falhos; (2) DTO inválido de organização, 10 aprovados e 1 falho; (3) CNPJ de fixture inválido, 10 aprovados e 1 falho. O comando de integração completo ainda encontrou o fixture da empresa obrigatória ausente no segundo tenant. Esses fixtures foram corrigidos de acordo com os contratos reais e a suíte final foi reexecutada integralmente. As verificações concorrentes já aprovadas nessas tentativas não são usadas para esconder a falha de cada comando. Os JSON/logs `integrity-*-fixture-errors` e a execução completa da regressão permanecem disponíveis.

O lint inicial encontrou uma asserção de tipo desnecessária e formatação do teste em edição. Os arquivos foram corrigidos e a validação final passou; `eslint-initial.json` e `backend-initial-checks.json` preservam a tentativa.

Os dois testes conhecidos em `technical-validation/security-storage.e2e-spec.ts` foram reexecutados: `requires every content read for dre_xlsx including backups` e o equivalente `finance_xlsx`. Continuam esperando 403 e recebendo 409 na rota de exportação genérica. O serviço exige as rotas especializadas com filtros. Isso é GAI-004, independente dos locks e da soma de pagamentos; não foi alterado indiscriminadamente. As suítes próprias de DRE/recebíveis/exportação especializada compõem a regressão. O comando completo continua falho e não foi apresentado como verde.

Não se reexecutou a integração S3 real nem Playwright nesta onda: não houve alteração de storage ou UI. A auditoria anterior possui esses resultados, separados dos atuais. Não houve teste em produção, certificação AWS/ALB/ThrottlerGuard global, restore de base histórica ou benchmark de capacidade produtiva.

## Comandos reproduzíveis

Executar da raiz do workspace, com dependências locais já disponíveis e somente o container descartável exclusivo na porta 33327. **O helper de integração derruba/recria esse schema de testes**; não apontar serviços persistentes para essa porta e não executar duas suítes destrutivas simultaneamente.

```powershell
node docs/correcoes-onda-0-financeiro-2026-10-28/run.cjs unit
node docs/correcoes-onda-0-financeiro-2026-10-28/run.cjs regression
node docs/correcoes-onda-0-financeiro-2026-10-28/run.cjs integrity
node docs/correcoes-onda-0-financeiro-2026-10-28/checks.cjs backend
node docs/correcoes-onda-0-financeiro-2026-10-28/checks.cjs frontend
node docs/correcoes-onda-0-financeiro-2026-10-28/smoke-related.cjs
node docs/correcoes-onda-0-financeiro-2026-10-28/finish.cjs
```

`finish.cjs` exige 12/12 no aceite, 124 pares/109 barreiras/zero incoerências e checks aprovados antes de atualizar os estados da auditoria. `probe.cjs` é uma caracterização **da versão anterior**, com expectativa explícita de defeito; não é teste de aceite a executar contra a correção. O dump e as fontes em `evidencias/antes` preservam a reprodução, sem instruir restauração automática de código ou dados históricos.
