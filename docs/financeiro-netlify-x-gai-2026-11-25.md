# Financeiro (Inventariantes, Remuneração, Pagamentos e Despesas): Netlify × GAI

Data: 25/11/2026 · Branch: `feat/visual-netlify`

Fontes:
- Netlify: `referencia-netlify/paineis/inventariantes.html`, `remuneracao_tecnico.html`, `pagamentos_inventariantes.html` e `despesas_projetos.html`.
- GAI: módulos `field-agents` e `payments-expenses` (backend), e as telas `field-agents`, `remuneration`, `field-agent-payments` e `expenses` (frontend).

As funcionalidades entram no padrão do GAI (SaaS multiempresa), e não como cópia do Netlify. Cada inconsistência do Netlify foi decidida com o cliente antes de implementar.

## 1. O que o cliente pediu e o que o GAI já tinha

| Pedido | Netlify | GAI antes | Feito |
|---|---|---|---|
| Inventariante: anexar documentos (ficha cadastral, CNH, exames, certificados) | "Documentos anexados" no próprio formulário, até 2 MB, sem tipo | Os anexos já existiam, mas só apareciam na **edição** | Os anexos aparecem também no cadastro novo (são enviados logo depois de salvar). Cada documento tem um **tipo**: ficha cadastral, CNH, exame, certificado ou outro |
| Inventariante: indicação | Não existe | Não existia | Campo "Indicação" (quem indicou), texto livre |
| Inventariante: cidade de residência | Não existe (só a UF) | Só a UF | Campo "Cidade de residência", texto livre |
| Título "Remuneração por projeto" | "Remuneração Técnico" | "Remuneração" | Menu, página e caminho de navegação |
| Ordem das datas: inicial, final, prevista | Inicial, final, pagamento | Prevista, inicial, final | Data inicial, data final e data prevista de pagamento |
| Dias só de segunda a sexta | Dias corridos (os dados mostram que contavam dias úteis à mão) | Dias corridos | Dias úteis (segunda a sexta), na tela e no servidor |
| Vários pagamentos do mesmo inventariante no projeto | Um lançamento solto por pagamento, sem histórico nem checagem | Igual | Agrupamento por inventariante e "Novo pagamento" já preenchido (seção 2) |
| Planilha da véspera para o financeiro | Exportação geral, filtrada à mão | Exportação geral com filtros | "Resumo do dia" (seção 3) |
| Despesas: anexar comprovante | Anexos no formulário (até 2) | Comprovantes só por uma ação na linha | Comprovante dentro do formulário de nova despesa e de edição |

## 2. Pagamentos múltiplos: decisão

Opção escolhida: **agrupar na tela**. Cada pagamento continua sendo um lançamento próprio, e com isso seguem funcionando:
- os filtros por data;
- a baixa e a reversão de cada pagamento;
- o bloqueio de mês fechado.

**Remuneração por projeto:** uma linha por inventariante, que pode ser recolhida e mostra:
- o início do trabalho;
- o último período lançado;
- o último pagamento;
- o total pago e o total em aberto;
- o histórico de lançamentos.

Na própria linha fica o botão **Novo pagamento**. Ele já vem com inventariante, UF, a diária do último lançamento e a data inicial no primeiro dia útil depois do último período.

Opção recusada: um registro único por inventariante, com os pagamentos dentro. Ela obrigaria a refazer os filtros, a baixa, a reversão e o fechamento de mês.

## 3. Resumo do dia

Em **Pagamento de inventariantes**, o botão "Resumo do dia" pede uma data (o padrão é o próximo dia útil) e gera a planilha `pagamentos-previstos-AAAA-MM-DD.xlsx`:
- **Lançamentos que entram:** só os em aberto (pendentes e aprovados) com aquela data prevista.
- **Aba "Por inventariante":** projetos, quantidade de lançamentos e valor a pagar, com linha de total. Quem trabalha em mais de um projeto recebe um valor só.
- **Aba "Lançamentos":** o detalhe de cada lançamento.

Permissões exigidas: `payments:read` e `payments:export`. Os textos passam pela proteção contra fórmulas na planilha.

## 4. Inconsistências do Netlify e correções

| Netlify | Correção no GAI |
|---|---|
| Dias corridos na fórmula, mas dias úteis nos dados | Dias úteis calculados pelo servidor. Feriados não são descontados; para eles se usa o "Valor adicional" ou os "Descontos" (decisão do cliente: só cálculo automático, sem ajuste à mão) |
| Nenhuma checagem de períodos sobrepostos | O servidor **recusa** períodos que se cruzam para o mesmo inventariante no mesmo projeto. Lançamentos cancelados não contam. A verificação trava o inventariante durante a transação, para que dois lançamentos simultâneos não escapem dela |
| "Em aberto" × "Pendente", e `pagamento` com dois sentidos | No GAI já eram situações distintas (pendente, aprovado, pago, cancelado), e a data prevista é separada da data paga |
| Documentos sem tipo | Cada documento tem um tipo. Exames são dado de saúde (dado sensível na LGPD), por isso continuam sob as permissões próprias `field-agent-documents:*` |

## 5. Efeitos para quem já usa

- **Lançamentos já gravados** não mudam. Ao **editar** um lançamento pendente, os dias são recalculados pela nova regra (dias úteis).
- **Lançamentos antigos com períodos sobrepostos** continuam como estão. A regra só barra quem cria ou edita.
- **Documentos já anexados** ficam com o tipo "Outro".
- **Migração** `1796400000001-field-agent-city-referral-document-category`: aditiva e repetível. Cria as colunas `field_agents.city` e `field_agents.referral` e a coluna `field_agent_documents.category`.

## 6. Segurança e padrão SaaS

- **Isolamento por organização:** todas as consultas novas filtram pela organização do usuário.
- **Validação no servidor:**
  - cidade com até 120 caracteres e indicação com até 255; espaços repetidos são juntados;
  - tipo de documento só da lista;
  - data do resumo no formato AAAA-MM-DD.
- **Auditoria:**
  - cidade e indicação entram no histórico do inventariante;
  - o tipo do documento entra no registro do anexo;
  - criar e editar lançamentos continua auditado.
- **Concorrência:** a checagem de sobreposição roda dentro da transação do lançamento, com o inventariante travado.
