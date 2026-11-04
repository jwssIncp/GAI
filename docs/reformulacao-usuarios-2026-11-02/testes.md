# Validação da reformulação de usuários

Execução local em 02/11/2026, horário de São Paulo. Metadados e logs registram timestamps UTC. Bancos de teste usam dados sintéticos. O MySQL persistente local foi usado somente para aplicação aditiva da migration e verificação das contas existentes, sem reset, seed ou troca de senha.

## Resultados

| Verificação | Aprovados | Falhas finais | Ignorados | Evidência |
| --- | ---: | ---: | ---: | --- |
| Backend unitário — 62 suítes | 442 | 0 | 0 | [log](./checks/unit-1.log), [execução](./checks/unit.json) |
| Integração/contratos SQLite — 56 suítes | 308 | 0 | 4 | [log](./checks/sqlite-1.log), [execução](./checks/sqlite.json) |
| MySQL real — usuários, perfis e invalidação, 3 suítes | 50 | 0 | 0 | [log](./checks/mysql-1.log), [execução](./checks/mysql.json) |
| Frontend geral — 52 arquivos | 319 | 0 | 0 | [log](./checks/frontend-1.log), [execução](./checks/frontend.json) |
| Chromium — usuários e regressão de perfis | 20 | 0 | 0 | [log](./checks/browser-1.log), [relatório estruturado](./playwright.json) |
| Revalidação final da rotação compartilhada — SQLite | 34 | 0 | 3 | [registro complementar](./checks/supplemental.json) |

As contagens por banco não representam cenários distintos: parte da mesma regra é executada em mais de um motor. Os três ignorados da revalidação são os mesmos cenários exclusivos de MySQL já exercitados na suíte desse banco.

O [resumo consolidado](./checks/final-summary.json) confere os códigos de saída, contagens dos logs e relatório do navegador, preservando também a indicação do timeout anterior.

Compilação Nest, TypeScript do frontend e bundle Vite: **exit code 0**, em [build.json](./checks/build.json). ESLint do backend e frontend nos arquivos envolvidos: **exit code 0**, em [lint.json](./checks/lint.json). Tipos e endpoints compartilhados do frontend tiveram também lint complementar registrado em [supplemental.json](./checks/supplemental.json). Não se afirma que o lint de todos os módulos do repositório foi executado.

O Vite informa bundle acima de 500 kB; a compilação concluiu. Algumas suítes de dashboards em jsdom emitem avisos sobre dimensões de gráficos, sem falha de asserção. Não foram alteradas configurações para ocultar esses avisos.

## Cobertura adicionada e atualizada

`user-lifecycle.e2e-spec.ts` possui 37 cenários, incluindo parametrizações: validação de entrada; criação com identificação, perfil e auditoria; rollback por concessão inválida; login/e-mail duplicados; organização ausente/inativa; isolamento organizacional; Operador; nulls; edição; validade de senha temporária; troca obrigatória; revogação de sessões e tokens; data de troca; convite com hash; consumo único; reenvio; prazo; reavaliação de organização/perfil; política comum; expiração de bloqueio; último administrador; filtros e ordenação.

Em MySQL foram executados os três cenários concorrentes dessa suíte: duplicidade de identidade; disputa entre autenticação e redefinição, com contadores de falha; e consumo concorrente de token. A suíte de perfis executou seu cenário de concessões concorrentes e remoção do último administrador entre operações diferentes. São os quatro testes deliberadamente ignorados no SQLite; não há validação de travas MySQL inferida somente do banco em memória.

A política de senha e a proteção de seed receberam testes unitários. Fachadas que passaram a delegar ao serviço transacional tiveram seus mocks atualizados; as regras de negócio foram exercitadas pela aplicação e pelo banco reais nos testes de integração. Fixtures de criação adotaram os campos obrigatórios e a primeira troca. Asserções de autorização e integridade foram preservadas.

Os 12 testes de `users.test.tsx` exercitam cadastro, perfis, organizações permitidas, validação, erro com preservação de dados, saída com alterações, edição parcial, concessão administrativa, restrição de Operador, filtros e compatibilidade do nome desconhecido/login legado. Os testes existentes de recuperação mantêm os cenários de erro e submissão pendente.

Os 20 testes Chromium incluem dez de usuários e dez de perfis. Exercitam listagem/cadastro/edição nas larguras 1440, 768 e 390, em claro/escuro; ausência de overflow da página; ativação pública; cadastro e primeira troca; saída sem salvar; proteção do último administrador; Operador e plataforma; concessão/revogação com sessão já autenticada; perfil customizado e teclado. O navegador se conecta somente à API sintética na porta 33429, via Vite na porta 5344.

## Migrations e contas preservadas

- [Migration em MySQL descartável](./checks/migration-disposable.json): schema local clonado sem registros, três contas sintéticas legadas, preservação das colunas anteriores, padrões nullable, CHECKs e segunda execução sem mudanças.
- [Aplicação no banco local](./checks/local-migration.json): somente a migration desta tarefa estava pendente. Comparação confirma preservação dos valores anteriores de usuários, organizações, perfis, permissões e concessões.
- [Idempotência local](./checks/local-migration-idempotent.json): 35 migrations aplicadas, nenhuma nova execução. Consulta final confirmou zero pendências.
- [Login real das três contas locais](./checks/local-users.json): senha conferida offline antes da autenticação, login e `/auth/me` HTTP 200, logout HTTP 204; gestão de usuários HTTP 200 para os dois administradores e HTTP 403 para o Operador. Identidades, senhas e vínculos preservados; atualizações operacionais de último acesso/sessões/auditoria são esperadas.

As capturas foram inspecionadas visualmente, incluindo cadastro desktop claro e celular escuro, além das verificações automatizadas de layout. O script operacional de provisionamento de plataforma teve compilação/lint e reutiliza a rotação exercitada nos testes; o comando de provisionamento não foi executado.

## Falhas encontradas durante a estabilização

As primeiras execuções revelaram fixtures antigas de criação, mocks de fachadas substituídas e mensagem de autenticação alterada. Foram adaptados ao novo contrato. Também foi identificada uma regressão real de transações simultâneas na conexão única SQLite durante logins paralelos de inventário; o controle por DataSource corrigiu o problema sem serializar as transações MySQL. As suítes amplas de backend foram executadas novamente e aprovadas.

Na execução final paralela do frontend houve **um timeout de 5 segundos** em `ValuationBatchPanel.test.tsx`, com 318 aprovados. O teste de avaliação patrimonial não foi alterado, nem seu prazo ampliado. A ocorrência original está preservada em [log do timeout](./checks/frontend-parallel-timeout.log) e [metadados](./checks/frontend-parallel-timeout.json); a suíte foi repetida isoladamente para distinguir falha funcional de sensibilidade a carga. O resultado dessa repetição é o da tabela final.

A repetição isolada concluiu com **319 aprovados, zero falhas**, em aproximadamente 105 segundos. A causa exata do timeout anterior não foi comprovada; o resultado é compatível com sensibilidade à carga concorrente. A ocorrência deve continuar visível ao acompanhar a estabilidade da suíte, sem classificá-la como correção funcional do módulo de avaliação.

Uma tentativa inicial MySQL atingiu uma porta descartável não iniciada. O runner foi configurado explicitamente para Wave 2/33347 e as três suítes foram efetivamente executadas com MySQL 8.0.46. Isso não foi tratado como teste aprovado antes da execução válida.

## Reprodução e isolamento

Na raiz, `node docs/reformulacao-usuarios-2026-11-02/run-checks.cjs GRUPO` aceita `unit`, `sqlite`, `mysql`, `frontend`, `build`, `lint` e `browser`. Registra comandos, código de saída, duração e logs em `checks`. Preferir execução sequencial para evitar disputa por CPU e timeouts.

O grupo MySQL exige contêiner descartável sem volume na porta loopback **33347**, banco `gai_validation_disposable` e as credenciais sintéticas fixadas no helper. Não apontar os testes para o banco persistente: o helper descarta e recria o schema de teste. O contêiner exclusivo `gai-users-validation` criado nesta execução foi parado ao final, com remoção automática. O contêiner MySQL local e o armazenamento existentes foram preservados.

A configuração SQLite exclui as suítes que, por configuração anterior do projeto, exigem MySQL/semântica financeira específica ou S3. Nesta tarefa, MySQL cobriu especificamente usuários, perfis e invalidação de sessões; não se afirma execução de toda a matriz MySQL/S3 de todos os módulos. O filtro do runner SQLite também correspondeu ao caminho Windows contendo `Users`, ampliando a execução para as 56 suítes elegíveis; a tabela reflete o que realmente foi executado.

## Limitações

Não houve envio por SES real, acesso a produção, validação de Firefox/Safari, certificação com leitores de tela ou teste de carga. Os controles de e-mail foram testados pelo provedor simulado e a ativação pela API e navegador. Nenhum segredo de conta real foi incluído nas evidências. A execução não substitui homologação no ambiente de destino.
