# DRE Gerencial — implementação e homologação local

Implementação por competência econômica explícita, integrada ao financeiro e ao workspace dos projetos. ORG_ADMIN administra apenas sua organização. Contratos, orçamentos, inventário, conciliação e baixas históricas não foram modificados. Nenhum commit, push, deploy ou migration de produção foi executado.

## Análise das fontes e referência funcional

Foram consultados a matriz comparativa e o inventário em `docs/auditoria-legado-gai-2026-10-27/` (F068 e capacidades financeiras F069–F072), os relatórios de gestão contratual, orçamentos, contas a receber, validação técnica e segurança, além dos serviços, DTOs, entidades e migrations desses módulos.

O HTML legado `paineis/fluxo_caixa.html`, do pacote de auditoria local, usa entradas de caixa e tratamento histórico com divisor 0,8667 e percentual de 13,33%. Essas fórmulas não foram transportadas. A implementação atual não presume tributos nem converte caixa em receita por competência.

| Fonte existente | Significado confirmado | Tratamento na DRE |
|---|---|---|
| Contrato/aditivo | Compromisso comercial; não prova serviço prestado | Nenhum reconhecimento automático |
| Orçamento aprovado | Formação comercial/preço; não prova realização | Nenhum reconhecimento automático |
| Recebível | Direito/documento financeiro, com moeda | Candidato para classificação explícita em receita; emissão/vencimento não definem competência |
| Baixa/estorno do recebível | Movimento financeiro | Não cria nem apaga receita econômica |
| Despesa aprovada/paga | Gasto documental elegível a análise | Competência e categoria explícitas; data da despesa é referência |
| Pagamento de inventariante aprovado/pago | Gasto de equipe | Reconhecimento uma vez pela origem; pagamento não define competência |
| Prestação de contas | Agrupamento de despesas existentes | Não é nova origem econômica |
| Parcelas de despesas | Distribuição do pagamento | Não duplicam a despesa original |

Despesas e pagamentos antigos não possuem moeda confiável nem campo de competência econômica. Exigem moeda e justificativa documental no reconhecimento. Não há migração inferindo valores ou datas para esses registros.

## Arquitetura e persistência

Novo `ManagerialDreModule` em `gai-backend/src/modules/managerial-dre/`, com controller HTTP, DTOs validados, serviço transacional, motor decimal puro, contrato de relatório e exportação. Reutiliza autenticação, PermissionsGuard, catálogo vivo de permissões, escopo organizacional e processador seguro de export jobs existentes.

Migration `1793800000001-create-managerial-dre.ts`, classe `CreateManagerialDre1793800000001`:

- `dre_accounts`: contas por organização, código único, revisão e configuração.
- `dre_account_versions`: versões de nome/ativação, autor, data e motivo.
- `dre_entries`: fatos econômicos por organização, projeto opcional, chave econômica única e origem única.
- `dre_entry_versions`: snapshots imutáveis de classificação, competência, categoria, documento, moeda, status e hash.
- `dre_periods`: fechamento organizacional mensal, revisão, política, cobertura, snapshot e hash.
- `dre_commands`: idempotência e auditoria imutável de comandos, incluindo snapshots de todos os fechamentos/reaberturas.

Chaves estrangeiras SQL protegem organizações, projetos, autores e versões com organização correspondente. Referências polimórficas de origem e referências de contas dentro dos snapshots JSON são verificadas transacionalmente pelo serviço, sempre na organização do ator. Os snapshots preservam o significado histórico da conta mesmo após renomeação/inativação. Não há endpoint de exclusão física nem edição de versões antigas. O `down` recusa apagar histórico.

Foi confirmado antes da execução: `NODE_ENV=local`, `localhost:3306`, banco `gai`, MySQL 8.0.46, servidor Docker `f10269ba8da4`. Existiam 29 migrations aplicadas; foi aplicada somente a nova migration pendente, totalizando 30. A migration cria estrutura e seis permissões; não reconhece valores nem concede permissões a perfis personalizados. Evidências de execução e catálogo: `runtime-local.json`.

## Plano de contas

Cada organização configura contas agrupadoras e analíticas, com hierarquia de até seis níveis. Somente contas analíticas ativas da organização recebem classificações. Código, grupo, natureza e hierarquia permanecem estáveis; nome e ativação são versionados. Para mudar o significado, cria-se outra conta e reclassifica-se por comando auditável.

Os sete grupos do motor são estáveis para preservar as fórmulas: receita, deduções, custo direto, despesa operacional, receita financeira, despesa financeira e tributos sobre lucro reconhecidos. As categorias e subcategorias são configuráveis.

“Publicar plano sugerido” é uma ação explícita, disponível somente quando o plano está vazio. Cria sete agrupadores e 19 contas analíticas: serviços/outras receitas; tributos sobre receita/descontos/devoluções; equipe/deslocamento/hospedagem/alimentação/materiais/outros custos; administrativas/comerciais/tecnologia/terceiros/outras despesas; receitas financeiras; despesas financeiras; tributos sobre lucro reconhecidos. Não cria lançamentos, obrigações nem alíquotas.

## Reconhecimento, ajustes e prevenção de duplicidade

Um fato exige chave econômica, documento/evidência, descrição, moeda, status e motivo. Cada alocação informa mês, valor decimal positivo e conta ou decisão de manter sem classificação. Um fato pode distribuir o valor documental entre meses e categorias; a soma não pode superar a origem.

Origens aceitas: `manual`, `receivable`, `expense`, `payment`. Contratos, orçamentos, recibos, prestações e parcelas não são aceitos como origens adicionais. Despesas/pagamentos devem estar aprovados ou pagos para reconhecimento. Recebíveis cancelados não podem gerar novo reconhecimento. O vínculo de projeto deve coincidir com a origem e pertencer à organização.

Estados: `draft`, `recognized`, `excluded`, `void`. Somente alocações reconhecidas e classificadas entram nas linhas da DRE. Rascunhos, alocações sem conta e fontes sem decisão aparecem separadamente. Uma origem parcialmente alocada mantém seu saldo em `remaining_amount`, sem competência definida e fora do resultado validado. Exclusão ou estorno econômico são decisões explícitas, com motivo e versões preservadas; não alteram o financeiro.

Deduplicação por `(organization_id, economic_key)` e por `(organization_id, source_key)`. Recebimentos/estornos não são candidatos; prestações não são somadas às despesas. Essa proteção impede repetir origens conhecidas. Eventos manuais exigem uma chave documental consistente: o sistema não pode descobrir que dois documentos de texto diferentes representam o mesmo fato do mundo real.

Cada comando exige `command_key`. Repetição idêntica do mesmo ator retorna o resultado anterior; reutilização com conteúdo/ator divergente retorna 409. A transação bloqueia a linha da organização no MySQL, verifica revisão, grava o estado corrente e a versão atômica. Leituras de relatórios usam `REPEATABLE READ`. Concorrência de duas alterações sobre a mesma revisão produz um vencedor e um conflito. Toda edição examina as competências anteriores e novas; nenhuma pode estar fechada.

## Fórmulas e indicadores

Motor versionado `managerial-accrual-v1`; operações monetárias em centavos com `BigInt`, retornando strings decimais. Valores de moedas diferentes nunca são somados. Não há conversão cambial implícita.

```text
Receita líquida = receita bruta − deduções
Lucro bruto gerencial = receita líquida − custos diretos
Resultado operacional = lucro bruto − despesas operacionais
Resultado financeiro = receitas financeiras − despesas financeiras
Resultado antes dos tributos sobre lucro = operacional + financeiro
Resultado após tributos reconhecidos = antes dos tributos − tributos explicitamente reconhecidos
Margem bruta (%) = lucro bruto / receita líquida × 100
Margem operacional (%) = resultado operacional / receita líquida × 100
```

Margens com denominador nulo/negativo são indisponíveis. Arredondamento percentual de duas casas, sem ponto flutuante no cálculo financeiro. Conversão numérica no frontend é usada apenas para desenhar o gráfico.

Cada linha retorna `known_amount` (apurado parcial), `amount` (validado ou `null`), `complete`, grupos dependentes e IDs de fatos para detalhamento. Um valor conhecido zero não certifica ausência de fatos. Faltando cobertura, o valor validado é `null`, com indicação explícita “Não validado”. O resultado após tributos não é certificado sem revisão explícita desse grupo.

Consulta mensal, trimestre/ano atual, acumulado no ano e intervalo customizado de até 60 meses. Comparação exige dois intervalos com o mesmo número de meses. Há totais por moeda, série mensal, comparação por projeto, distribuição por conta e detalhamento das fórmulas. O detalhamento usa as dependências da linha para não incluir uma alocação de outra categoria do mesmo fato.

## Cobertura e competências

Fontes com competência desconhecida são apresentadas mesmo fora do intervalo consultado; não são descartadas por data financeira. Fontes não decididas, rascunhos, saldo não alocado, falta de permissões de leitura, contas não classificadas e origens alteradas impedem resultado definitivo. Mudanças econômicas na origem geram aviso e exigem revisão explícita; o histórico não é reescrito silenciosamente.

Fechamento exige mês civil encerrado, referência de política aprovada, revisão esperada, indicação das fontes revisadas e grupos revisados. Fechamento incompleto exige autorização explícita de fechamento parcial e continua marcado incompleto. O fechamento é de toda a organização, não do filtro de projeto. Reabertura exige permissão, revisão e motivo; preserva o snapshot anterior no histórico de comandos.

A certificação mensal atual é de uma moeda por organização. Outras moedas continuam com valores parciais e lacuna de cobertura; não são convertidas ou certificadas automaticamente. Em meses abertos, valores permanecem apurados parciais. Cobertura é conservadora: uma fonte com competência ainda desconhecida pode impedir a validação de vários períodos/projetos. A referência de política é um registro documental informado por usuário autorizado; não foi implementado um módulo novo de aprovação documental.

## APIs

Prefixo `/api/v1/finance/dre`:

| Método | Caminho | Operação |
|---|---|---|
| GET | `/accounts`, `/accounts/:id` | Plano e histórico de conta |
| POST | `/accounts`, `/accounts/bootstrap` | Criar conta/publicar plano sugerido |
| PUT | `/accounts/:id` | Nome/ativação com revisão |
| GET | `/sources` | Candidatos e vínculo com decisão já registrada |
| GET | `/entries`, `/entries/:id` | Fatos e histórico imutável |
| POST | `/entries` | Reconhecimento explícito |
| PUT | `/entries/:id` | Ajuste/reclassificação/estorno econômico |
| GET | `/report` | DRE, comparação, detalhamento e cobertura |
| GET | `/periods`, `/periods/:month` | Competências e histórico |
| POST | `/periods/:month/close`, `/periods/:month/reopen` | Fechar/reabrir |
| POST | `/exports` | Gerar job XLSX |
| GET | `/exports/:id`, `/exports/:id/download` | Consultar/baixar arquivo protegido |

Filtros organizacionais/projeto são validados no servidor. `start_month`/`end_month` usam `AAAA-MM`; comparação usa `compare_start_month`/`compare_end_month`. Listas de fatos/fontes são paginadas. Erros usam 400 para entrada/referência inválida, 401 para ausência de autenticação, 403 para autorização e 409 para revisão/duplicidade/período fechado.

## Permissões

Todas organizacionais: `dre:read`, `dre:configure`, `dre:classify`, `dre:adjust`, `dre:periods`, `dre:export`. ORG_ADMIN utiliza essas capacidades apenas em sua organização, desde que registradas corretamente no catálogo. ORG_USER e perfis personalizados exigem concessão explícita. `projects:read` não libera dados da DRE.

Classificar exige leitura e classificação; ajustar exige também `dre:adjust`; configurar exige `dre:configure`; fechar/reabrir exige `dre:periods`. Seleção de fontes e cobertura completa exigem as leituras financeiras correspondentes (`receivables:read`, `expenses:read`, `payments:read`). Um leitor somente de DRE recebe os fatos reconhecidos autorizados, sem consultar nem revelar fontes financeiras brutas. O histórico completo de fechamento exige essas leituras; a listagem de competências retorna apenas resumo do snapshot.

Exportação exige `dre:export` e `export-jobs:create`; download exige `export-jobs:download`. O snapshot do job registra as permissões de todas as fontes usadas; status/download revalidam catálogo, organização e permissões atuais, mesmo com token anterior à revogação. O PermissionsGuard e a autenticação não foram afrouxados.

## Interface e exportação

Rotas internas persistentes, usando os layouts financeiros existentes:

- `http://localhost:5173/app/finance/dre`
- `http://localhost:5173/app/finance/dre/entries`
- `http://localhost:5173/app/finance/dre/accounts`
- `http://localhost:5173/app/finance/dre/periods`
- `/app/finance/dre/entries/:entryId`

Atalho “DRE Gerencial” no menu principal e no projeto autorizado, com `?project_id=...`. Navegação por React Router, preservando escopo, refresh e voltar/avançar. Componentes visuais, tabelas roláveis, botões, modais e cores existentes foram reutilizados.

Sete exportações XLSX: demonstrativo consolidado, projetos, mensal, receitas, custos, despesas e não classificados. O consolidado inclui detalhamento, pendências, comparação quando solicitada e cobertura/regras. São snapshots com versão do motor, filtros, hashes e versões de fatos. Reutilizam fila/processador, sanitização contra fórmulas, limites, validade, checksum e armazenamento privado de export jobs. Nenhum link público de arquivo é criado.

## Validação e homologação

Resultados detalhados em `testes.json`, `runtime-local.json` e evidências Playwright em `.local/dre-playwright/`. Manifesto dos arquivos implementados/alterados nesta etapa: `arquivos.json`.

- Testes unitários: fórmulas completas, tributo explícito, cobertura desconhecida, centavos próximos ao limite DECIMAL, margem negativa/divisor zero, dependências de detalhamento, períodos inválidos e limite anual.
- HTTP com MySQL descartável: migrations reais, idempotência, concorrência, versões, fechamento/reabertura, datas de pagamento diferentes da competência, recebimentos/estornos sem receita duplicada, despesa/prestação/pagamento sem custo duplicado, moedas ausentes, saldo parcialmente reconhecido, isolamento com duas organizações reais sintéticas, IDs externos e permissões/revogação de exportação.
- Integração frontend e suíte completa; TypeScript, builds e lint dos arquivos alterados.
- Playwright Chromium real com `org.admin`: novo cliente/projeto/recebível sintéticos, criação de conta pela tela, classificação em janeiro com emissão em outubro, ajuste de 100,01 para 80,01, histórico de duas versões, saldo 20,00 sem competência, refresh, detalhamento, download XLSX, voltar/avançar e tela móvel. Fechamento parcial e reabertura pela interface, deixando a competência sintética aberta. Sem erros JavaScript/HTTP nesse percurso.

O MySQL de integração usa exclusivamente `127.0.0.1:33317/gai_validation_disposable`, com opt-in `GAI_TEST_MYSQL_DISPOSABLE=1`; não lê a conexão de desenvolvimento para recriar esquema. O container temporário desta etapa é `gai-dre-mysql-test` e é removido após a validação. O banco `gai` e seus volumes são preservados.

Para repetir homologação local: executar `scripts/local-start.ps1`, entrar com a conta de desenvolvimento ORG_ADMIN `org.admin` e a senha configurada no ambiente, abrir um projeto autorizado e clicar em DRE Gerencial. Criar/selecionar conta analítica, abrir Classificações, escolher uma fonte sintética, informar evidência, competência e motivo; consultar o mês e projeto correspondentes e exportar. Não usar dados reais nem repetir o teste contra produção. As credenciais não são copiadas neste relatório.

Comandos auxiliares reproduzíveis: `node .local/run-dre-checks.cjs backend`, `frontend`, `tests`, `regression`, `frontend-tests`, `dre-ui-tests`; Playwright: `node .local/run-dre-playwright.cjs`. Os testes HTTP requerem o container descartável indicado; o Playwright requer frontend/backend e storage locais disponíveis. Nenhum desses runners executa migration de produção.

## Limites conhecidos

Não há reconhecimento automático sem evidência, apuração tributária, câmbio, integração bancária, escrituração oficial nem substituição de contabilidade profissional. Esses itens não foram simulados como concluídos. Referências de documento são textuais; não foi criado repositório de anexos novo.

Limites operacionais: 1.000 contas, 10.000 fatos por consulta de escopo, 10.000 fontes por família, 50.000 alocações/linhas por aba e 60 competências por consulta; refine projeto/período ao atingir o limite. A enumeração das fontes usa os serviços e validações atuais e pode requerer otimização para grandes volumes. Homologação foi funcional em dados sintéticos, sem teste de carga ou browser matrix além de Chromium.

Uma única categoria analítica de uma origem é limitada pelo valor original e pelas regras de grupo: recebível em receita; despesa/pagamento em gasto. Ajustes negativos são representados por revisão/estorno econômico auditável, não por valores negativos soltos. Mudanças retroativas em uma alocação exigem reabrir todos os meses fechados afetados pelo fato. Isso é deliberadamente conservador.
