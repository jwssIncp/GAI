# Migrations e schema

## Preservação e alvo

As 32 migrations anteriores foram inventariadas por caminho, tamanho e SHA-256 antes das alterações (`evidencias/migrations-before.json`). A nova migration é `1794000000001-register-generated-column-metadata.ts`. O manifesto final deve confirmar os 32 hashes originais.

Todas as operações de upgrade, reset e teste desta onda usam exclusivamente `gai-wave1-20261028-mysql`, exposto em `127.0.0.1:33337`, banco `gai_validation_disposable`, credenciais sintéticas fixas. O runner ignora credenciais `DB_*` reais. Não foram executadas migrations nos bancos 3306, 33317 ou 33327. SQLite usa somente `:memory:`.

## Reprodução e reparo

Na reprodução anterior, `QueryRunner.getTables()` falhava porque o TypeORM procurava em `typeorm_metadata` a expressão da coluna `project_field_agents.active_assignment_key`, criada diretamente por migration antiga.

A migration nova:

1. Cria a tabela de serviço, se ainda não existir, com as colunas do contrato TypeORM (`type`, `database`, `schema`, `table`, `name`, `value`).
2. Registra, se ausente, uma linha `GENERATED_COLUMN`, no schema atual, para `project_field_agents.active_assignment_key`.
3. Preserva a expressão existente: `CASE WHEN status = 'active' THEN CONCAT(organization_id, ':', project_id, ':', field_agent_id) ELSE NULL END`.

Não executa `ALTER` na coluna gerada nem no índice único; não altera alocações, pagamentos ou auditorias. A entidade passa a declarar a mesma coluna `STORED`, não selecionada e não gravável, e o índice `uq_project_field_agents_active_key`. A expressão equivalente SQLite é usada somente na sincronização do teste em memória.

O `down` remove somente o registro de metadata desse objeto/schema, mantendo a tabela de serviço e as demais linhas. Seu uso reabre a limitação original de comparação enquanto a migration gerada antiga continuar presente; não representa rollback de pagamentos nem de alocações. Não executar downgrade operacional sem análise.

## Evidências

- `reproduction-before.json`: falha anterior, versão do banco e inconsistências temporais reproduzidas com dados sintéticos.
- `schema-upgrade.json`: upgrade de um banco já migrado com dados; somente a nova migration aplicada, nenhuma pendência e hashes financeiros iguais antes/depois. A contagem **432** desse arquivo veio de `getTables()` sem escopo e inclui schemas de sistema MySQL; não é a contagem de tabelas da aplicação.
- `generated-metadata.mysql.e2e-spec.ts`: inicialização do zero com todas as 33 migrations; leitura da expressão e do índice único, ausência de pendências e registro idempotente.
- `schema-final.json`: leitura final limitada a `TABLE_SCHEMA=DATABASE()`, migrations, coluna/índice/metadata, cobertura de transformers civis e comparação apenas em memória. Os hashes incluem pagamentos, despesas, auditorias financeiras e alocações antes/depois da inspeção.

## Divergências remanescentes

O SchemaBuilder passa a produzir o diff em vez de falhar. O upgrade registrou 627 comandos sugeridos, não executados, relativos a diferenças preexistentes de índices, foreign keys e outros metadados. A contagem final e cada SQL estão em `schema-final.json`; podem variar com a versão TypeORM e o estado sintético. A verificação exige que o diff não tente remover/modificar/recriar `active_assignment_key`.

Resolver essas diferenças exige comparar cada objeto com o histórico das migrations. Não gerar ou aplicar uma migration gigante a partir desse diff. `synchronize: false` permanece na aplicação MySQL e no helper MySQL. Não foi alegada equivalência total entre entidades e schema, nem removida uma constraint para eliminar divergência superficial.

As colunas de negócio `DATE` recebem somente transformers de persistência; isso não altera seu tipo SQL. A configuração UTC também não reescreve `DATETIME` histórico. O saneamento temporal antigo e a reconciliação geral do schema continuam decisões separadas.
