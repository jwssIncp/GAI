# Reprodução e ambiente preservado

A auditoria não alterou implementação, lockfiles ou dados reais. O manifesto final `evidencias/source-preservation.json` compara 1.080 arquivos textuais inventariados e não encontrou alterações. Lockfiles não integram esse manifesto textual; os comandos npm usados foram somente de auditoria/leitura, sem instalação ou atualização.

API de testes na porta 33319 e Vite na 33320 foram encerrados e a indisponibilidade foi verificada por conexão. Os serviços anteriores nas portas 3000/5173 não foram usados para escrita nem encerrados.

Os containers exclusivos `gai-audit-20261028-mysql-fast` e `gai-audit-20261028-s3` permanecem ativos em loopback nas portas 33317/33318, preservando o conjunto sintético. Usam armazenamento em memória: parar/remover esses containers descarta seu estado volátil. Há exportação SQL em `evidencias/dados-sinteticos.sql` e cópia dos objetos/metadados locais em `evidencias/storage-sintetico/`, com resultado/hash em `synthetic-preservation.json`. O container inicial lento foi preservado parado. Nenhum volume do ambiente existente foi removido.

As credenciais presentes nos scripts são exclusivamente as fixtures públicas de teste já usadas pelo repositório. Não representam credenciais de cliente ou AWS. As cópias SQL e S3 são dados sintéticos e servem para inspeção futura; a recuperação dessas cópias não foi executada como teste de desastre.

## Comandos e efeitos

- `node run-checks.cjs backend` executa Jest padrão, TypeScript, build isolado e lint sem fix. O runner padrão permanece falho conforme `testes.md`.
- `node run-checks.cjs frontend` executa Vitest, TypeScript app/config, build isolado e lint.
- `node run-mysql.cjs tests` usa exclusivamente 127.0.0.1:33317/gai_validation_disposable. **O helper recria o schema descartável para os testes. Não executar para consultar ou reabrir o conjunto sintético preservado.** Fazer backup antes de uma nova execução e usar um ambiente descartável apropriado.
- `node run-mysql.cjs server` também recria o schema do helper e insere seed; não é um comando de retomada do banco preservado.
- `inspect-schema.cjs` é somente leitura do schema sintético, sem synchronize ou migrationsRun.
- `reproduce-finance.cjs` usa SQLite em memória e demonstra total truncado/data inválida.
- `race-payments.cjs` cria novos pagamentos no servidor sintético em 33319 e demonstra a corrida. `inspect-payment-race.cjs` lê SQL/auditorias desse alvo e tenta uma segunda baixa sintética; não usar em dados existentes de cliente.
- `inspect-documents.cjs` cria fixtures locais com o renderer atual e valida PDF/OOXML.
- `prepare-browser.cjs` copia as nove suítes reais e adapta somente imports/ESM, portas, empresa sintética e diretórios de saída. Os arquivos originais permanecem intactos.
- `run-browser.cjs` executa onze cenários contra as portas exclusivas. O servidor Vite precisa de cwd do frontend para carregar Tailwind; o harness API fornece health próprio e usa módulos reais Nest/MySQL. Não substitui AppModule/infra de produção.
- `finish-audit.cjs` reconstrói relatórios a partir das evidências já coletadas; não executa migrations ou correções.

Todos os caminhos acima são relativos a esta pasta. Logs das tentativas de preparação foram preservados, mas a contagem considera a execução final apropriada de cada caso, sem somar repetições. Nenhum script de auditoria deve receber um alvo real no lugar dos endereços sintéticos fixos.
