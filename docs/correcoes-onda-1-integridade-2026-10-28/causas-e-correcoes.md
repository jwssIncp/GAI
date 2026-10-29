# Causas e correções — Onda 1

Execução iniciada em 28/10/2026 e continuada em 29/10/2026. O diretório mantém a data solicitada. Os resultados executados e a situação final são consolidados em [testes.md](testes.md) e [README.md](README.md).

## GAI-002 — Datas civis

**Causa:** validações de formato/ISO permissivas e construção de `Date` aceitavam dias inexistentes, normalizando fevereiro para março. Políticas internas também recebiam strings sem validar integralmente o calendário.

**Correção:** predicado gregoriano compartilhado `isCivilDate` e decorator `IsCivilDate`, com formato exato `YYYY-MM-DD`, limites inclusivos 1000–9999, mês/dia e regra secular de ano bissexto. Aplicados às entradas civis de pagamentos, despesas, recebíveis, contratos, orçamentos, parcelas, prestações, projetos, coordenação, preparação, inventário, exportações e filtros. Políticas de domínio também validam, preservando seus códigos de erro. Datas opcionais ausentes continuam opcionais; strings vazias/inválidas não limpam pagamentos silenciosamente. A geração mensal preserva o ajuste existente ao último dia do mês, mas rejeita parâmetros não inteiros e estouro do calendário. Competências mantêm o contrato `YYYY-MM` e sua validação própria.

**Impacto:** entrada impossível recebe 400, sem criação de pagamento/despesa ou auditoria correspondente. Não há correção automática de datas históricas. A faixa corresponde ao armazenamento MySQL; regras adicionais, como emissão não futura e ordenação dos períodos, permanecem no domínio.

**Aquisição contábil:** o campo opcional `acquisition_date`, anteriormente validado somente como string, também usa o calendário estrito. Um PATCH inválido não limpa a data existente. O parser contábil verifica limites em strings, objetos `Date` e números seriais de planilha, rejeita valores não finitos e desabilita inferência automática de datas textuais. As regressões mantêm a data válida após respostas 400 e comprovam erro nas linhas de XLSX inválidas sem novos itens.

**Evidências e testes:** `evidencias/reproduction-before.json`, inventário das entradas em `date-input-inventory.json`, testes unitários compartilhados e `temporal-integrity.mysql.e2e-spec.ts`. Há casos de 1900/2000, bissextos, meses curtos, formato, vazio, limites, arrays de vencimentos, parcelas e competências.

## GAI-011 — Instantes UTC e datas civis

**Causa:** Node em São Paulo e MySQL em UTC, com driver sem timezone explícito, misturavam datas ligadas pela aplicação e defaults SQL. Além disso, o TypeORM transforma `Date` destinado a uma coluna `DATE` usando getters locais antes de chamar o mysql2; configurar apenas o driver não evita deslocamento do dia.

**Correção:** `MYSQL_UTC_OPTIONS` define `timezone: 'Z'`, preserva `DATE` como string e configura cada nova conexão do pool com `SET SESSION time_zone = '+00:00'`. A configuração é compartilhada pela aplicação, CLI de migrations, CLI compilada e helper MySQL. Um transformer nas 24 colunas `DATE` mantém strings civis e extrai a data UTC de objetos `Date` internos; a leitura não reinterpreta o histórico. Instantes `DATETIME` continuam instantes, serializados com `Z`. `captured_at` exige ISO válido com offset explícito ou `Z`; offsets válidos são aceitos e convergem ao mesmo instante.

**Contrato:** instantes novos são escritos/lidos em UTC; dias civis são `YYYY-MM-DD`; competências são `YYYY-MM`. A apresentação mantém a política existente da interface/navegador. Não foi criada configuração nova de fuso por organização. Não se configura `TZ` globalmente como correção, nem se converte indiscriminadamente `DATE` em timestamp.

**Importação física:** a mesma validação de instante explícito é usada na observação direta, no DTO de lote, no parser e antes de materializar uma observação. CSV é lido sem inferência automática de datas pelo SheetJS. Texto impossível ou sem fuso permanece intacto para rejeição, em vez de virar outra data antes de validar. Uma entrada válida `2026-03-31T23:59:59-03:00` resulta em `2026-04-01T02:59:59.000Z`. Regressões verificam CSV, HTTP 400 e ausência de observações nas negativas, preservando idempotência e a placa mestre.

**Evidências e testes:** reprodução anterior com três horas de diferença; relógio UTC, SQL bruto, API, aprovação, baixa e auditoria; processos com UTC, America/Sao_Paulo, Pacific/Kiritimati e America/Los_Angeles, servidor configurado em +09:00, quatro conexões por pool, meia-noite e virada de mês; persistência de projeto/alocação e filtros por período. Ver `temporal-integrity.json` na pasta da execução MySQL e inventário das colunas civis.

**Risco residual:** `DATETIME` histórico não contém offset. Valores antigos ligados pela aplicação e valores gerados por defaults podem ter convenções distintas. A mudança define o corte para novas operações; não certifica a interpretação dos instantes antigos. Qualquer saneamento exige diagnóstico por origem/campo, cópia, aprovação operacional e plano separado.

## GAI-003 — Runners por motor

**Causa:** descoberta indiscriminada executava contratos dependentes de MySQL sobre SQLite; flags externas podiam contaminar uma execução local. Na configuração multiprojeto, o timeout precisa estar também no nível global do Jest.

**Correção:** runner Node controla explicitamente flags de cada motor, força execução serial e propaga o exit code. `npm test` executa unitários e HTTP/contratos compatíveis com SQLite. Scripts próprios cobrem unitários, SQLite, MySQL, S3 e Playwright real. Os diretórios que exigem locks, SQL e transações de MySQL são selecionados pela configuração MySQL; não foram substituídos por skips. S3 tem configuração própria e habilita todos os seus casos. A cobertura global de 60% foi preservada. O workflow recebe job específico com MySQL e S3 descartáveis; sua execução remota depende do CI e não é alegada como realizada localmente.

**Integridade dos IDs:** o helper MySQL agora usa metadata `BIGINT UNSIGNED`, como as migrations, em vez de declarar IDs inteiros de SQLite. Isso expôs IDs gerados como string pelo TypeORM em retornos recém-inseridos. Orçamentos e documentos estendem sua normalização existente ao evento de inserção; contratos e observações normalizam os IDs que retornam. Valores fora de `Number.isSafeInteger` falham explicitamente. Os tipos SQL e a regra financeira não mudam. Os cenários HTTP originais de orçamento → recebível, contrato/aditivo → recebível, documentos e reinventário permanecem como regressão.

**E2E real:** o helper permite incluir o `AppController` de saúde antes de inicializar o Nest, somente quando solicitado pelo harness. O runner compila o frontend com base de API `/api/v1` fixa e o serve por `vite preview`, com proxy apenas para 33339. Isso evita compilação a frio durante a primeira navegação e mantém as asserções e timeouts dos fluxos originais. Os demais perfis não incluem esse controller opcional.

## GAI-004 — Exportações financeiras

**Causa:** dois casos parametrizados tratavam `finance_xlsx` e `dre_xlsx` como tipos genéricos, embora seu contrato exija os endpoints especializados.

**Correção:** rota genérica exige 409 para esses dois tipos e comprova ausência de novo job. As demais expectativas de 403/201 continuam. Novos testes nas rotas específicas removem cada permissão de leitura separadamente, esperam 403 e verificam ausência de job; com todas as leituras, exigem 201 e conferem persistência de tipo, organização, solicitante e filtro de projeto. Permanecem os casos de download autenticado, conteúdo e revogação.

**Frontend:** o teste de criação preserva a navegação e todas as asserções; o mock de object URLs mantém o construtor `URL`, necessário à versão corrigida do React Router. A busca pelo formulário é assíncrona.

## GAI-009 — Metadata de coluna gerada

**Causa:** migration anterior criava `active_assignment_key` e seu índice único, mas não registrava a expressão em `typeorm_metadata`; a entidade também não descrevia a coluna. O SchemaBuilder falhava ao ler a expressão.

**Correção:** nova migration aditiva registra somente a metadata e cria a tabela de serviço se ausente. A entidade descreve a expressão `STORED`, a coluna não gravável e o índice único existentes; a expressão SQLite equivalente só serve ao banco de teste em memória. Nenhuma migration anterior foi editada. Ver [migrations-schema.md](migrations-schema.md).

## GAI-008 — Qualidade global

**Causa:** baseline com 82 erros Prettier e uma expressão regular com caracteres de controle, em quatro arquivos. Não havia erro de `any`, tipagem ou acesso inseguro nesse baseline específico.

**Correção:** formatação desses arquivos e varredura explícita de caracteres iniciais na proteção contra fórmulas de planilha, mantendo tratamento de tabulação/quebra de linha e prefixos `= + - @`. Nenhuma desativação global foi acrescentada. No frontend, a constante de status saiu do arquivo de componente para eliminar o aviso de React Refresh. O lint padrão é somente leitura; `lint:fix` é explícito.

## GAI-012 — Dependências

Atualizações compatíveis, distribuição oficial SheetJS vendorizada e riscos restantes são discriminados por pacote/advisory em [dependencias.md](dependencias.md). Um alerta ausente no npm audit de um tarball local não substitui a conferência de versão, origem, hash e faixas corrigidas. Não foi usado `npm audit fix --force`.

## GAI-001 e GAI-010 — Preservação da Onda 0

Mantidos locks, revalidação na transação, auditoria atômica, proteção dos estados quitados e agregação SQL `DECIMAL` sem limite de paginação. A reprodução financeira anterior foi executada novamente no MySQL exclusivo desta onda, incluindo corridas com barreira InnoDB, falha real de auditoria e duas instâncias Nest/pools. As evidências desta onda são gravadas em sua própria pasta. Nenhum arquivo da entrega documental/evidencial da Onda 0 deve mudar; o manifesto final confere os hashes.
