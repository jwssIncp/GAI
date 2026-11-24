# Kick-off: Netlify × GAI — funcionalidades, ações e plano

Data: 24/11/2026 · Branch: `feat/visual-netlify`

**Fontes**
- Netlify: `referencia-netlify/paineis/kickoff.html` (lido inteiro), `index.html`, `sync-remoto.js` e as telas que usam o kick-off.
- GAI: `gai-frontend/src/features/project-preparation/` e `gai-backend/src/modules/project-preparation/`.

Status usado na coluna "GAI hoje":
- **Pronto**: já existe.
- **Parcial**: existe de outra forma.
- **Falta**: não existe.

---

## 0. Princípios (valem para todas as entregas)

O GAI é um SaaS multiempresa. Por isso, as funcionalidades do Netlify entram **no padrão do GAI**, e não como cópia. Nenhuma inconsistência ou erro do Netlify é trazido sem antes decidirmos a correção (seção 10).

1. **Isolamento por organização:** toda leitura e gravação é filtrada pela organização e pelo projeto do usuário, no servidor. Nada fica guardado só no navegador, com exceção de preferências de tela.
2. **Uma permissão por ação**, sempre checada no servidor:
   - `project-preparation:read` para consultar e gerar prévias;
   - `project-preparation:edit` para responder, criar e excluir rascunhos;
   - `project-preparation:approve` para concluir e reabrir.
   - O front só esconde o que o servidor já recusaria.
3. **Auditoria:** criar, responder, concluir, reabrir, excluir, gerar e editar o e-mail ficam no histórico, com autor e data. Reabrir e excluir exigem motivo.
4. **Concorrência:** cada gravação leva a revisão. Se outro usuário alterou antes, o servidor recusa e a tela recarrega avisando, em vez de sobrescrever.
5. **Validação no servidor** de cada tipo de resposta (opções válidas, datas, números, telefone). O front valida só para ajudar quem está preenchendo.
6. **Nada de dados de uma empresa fixos no código:**
   - nome da empresa prestadora (o "Investor" do Netlify);
   - textos do e-mail e da mensagem ao técnico;
   - valores de diária, horário comercial e dia de pagamento.
   - Tudo isso vem da organização, de parâmetros ou do modelo versionado.
7. **Modelos versionados:** perguntas, opções e textos mudam pelo modelo da organização, gerando nova versão. Um kick-off em andamento continua na versão em que foi criado.
8. **Dados pessoais (LGPD):** nome e telefone dos focais aparecem só para quem tem permissão no projeto. Não entram em URLs, links de WhatsApp com destinatário nem em logs. Na exportação, só para quem pode exportar.
9. **Identificação por ID**, não por nome: o vínculo kick-off ↔ projeto é pelo ID do projeto, nunca por comparação de nomes normalizados.

## 1. Como o Netlify funciona (resumo)

- **Uma tela só:** lista de kick-offs em cima e detalhe embaixo. Tudo salva sozinho, sem botão Salvar.
- **Dados:** ficam no navegador e são sincronizados entre máquinas a cada 12 s. Quando chega dado novo aparece "Dados atualizados por outro usuário."
- **Um kick-off por projeto:** todo projeto **em aberto** do Painel Geral ganha um kick-off em branco automaticamente.
- **Alerta no menu:** a aba Kick-off fica vermelha, com ⚠, enquanto houver kick-off não concluído.
- **Itens:** 44 no total.
  - 30 em RESUMO PROJETO.
  - 7 em ETIQUETAS.
  - 7 em VIDA ÚTIL.
- **"Realizado" é independente da resposta:** responder um item não o marca como realizado.
- **Progresso:** conta só os itens marcados como realizados.
- **Sem perfis dentro da tela:** quem acessa pode fazer tudo.

## 2. Lista de kick-offs

| Netlify | GAI hoje | Status | O que fazer |
|---|---|---|---|
| Painel "Kick-offs" com contador "N kick-off(s)" e Ocultar/Mostrar | DataPanel "Kick-offs" (etapa 1.5) | Pronto | — |
| Busca "Buscar cliente…" | — | Falta | Front: busca na lista |
| Colunas Cliente · Data · Check list "X de Y (Z%)" · Situação | Título · Data · Progresso · Situação · Modelo | Pronto | Front: renomear para Cliente/Check list e esconder Modelo |
| Situação: "Concluída" (verde) / "Em andamento" (âmbar). Em andamento no topo | Rascunho/Em andamento/Aprovado/Arquivado, com em andamento no topo | Parcial | Front: rótulos Concluída/Em andamento |
| "✓ Concluir" na linha, com confirmação | "Concluir" no detalhe (= aprovar) | Parcial | Front: botão na linha, com confirmação |
| "Reabrir" na linha, sem confirmação | "Reabrir" no detalhe, com justificativa | Parcial | Front: botão na linha (o servidor pede motivo, que pode ir preenchido) |
| "+ Novo kick-off" pede **só o nome do cliente** | Pede modelo, versão e título | Parcial | Front: modelo padrão já escolhido e título = cliente do projeto |
| "Excluir" com confirmação | Excluir (backend) | Parcial | Front: botão Excluir com confirmação |
| **Criação automática** de kick-off para cada projeto em aberto | — | Falta | Back: criar no início do projeto (ou ao abrir a aba). Decisão: quando criar |
| Aba do menu em alerta enquanto houver kick-off não concluído | — | Falta | Front + back: contagem de kick-offs não concluídos para o alerta da sub-aba |

## 3. Detalhe do kick-off

| Netlify | GAI hoje | Status | O que fazer |
|---|---|---|---|
| Blocos RESUMO PROJETO, ETIQUETAS e VIDA ÚTIL com "X de Y verificado(s)" e Ocultar/Mostrar | Um DataPanel por categoria | Pronto | — |
| Filtro Situação: Todos / Realizado / Pendente | ViewToggle Todos / Pendentes / Realizados | Pronto | — |
| Colunas Nº · Realizado · Item · (Grupo) · Resposta · Observações | As mesmas, com Grupo e Ações | Pronto | Front: Observações editável na linha (hoje fica no modal) |
| Botão PENDENTE ⇄ REALIZADO, **independente da resposta** | A resposta muda o estado (selecionar = concluído) | Parcial | Front: botão próprio para Realizado, separado da resposta |
| Cores: pendente rosa, realizado verde e riscado, "Solicitar no kick-off" azul | Pronto (1.5) | Pronto | — |
| Marcador "* Solicitar no kickoff" (itens 18, 25, 27, 29, 36) | Tag "Solicitar no kick-off" | Pronto | — |
| Salvamento automático a cada campo | Seleções salvam na linha; textos pelo modal "Responder" | Parcial | Front: editar texto, número e data na própria linha, salvando ao sair do campo |
| Editar o **nome do item** (vale para todos os check lists) | Editar o modelo da organização (versionado) | Parcial | Manter o modelo versionado. Opcional: atalho "editar este item no modelo" |
| Arrastar colunas | — | Não portar | Grade com colunas fixas (regra geral do plano) |
| Imprimir (respeita o filtro e esconde a lista) | Imprimir | Pronto | — |
| Exportar Excel `kick-off-<cliente>.xlsx` | Exportar CSV | Parcial | Front: XLSX com o mesmo nome e as mesmas colunas (o GAI já usa xlsx) |
| Avisos "Dados atualizados por outro usuário" | Controle de revisão (conflito ao salvar) | Parcial | Front: recarregar e avisar quando a revisão mudar |

## 4. Tipos de resposta

| Netlify | Itens | GAI hoje | Status | O que fazer |
|---|---|---|---|---|
| Seleção simples com "Selecione…" | maioria | `select` + edição na linha | Pronto | — |
| Campo extra condicional (SIM → "QUAIS ERROS…", OUTRO → "QUAL SISTEMA?", SIM → "POR QUAL?", OUTROS → "QUAL MODELO?") | 05, 09, 17, 19, 34 | `enabled_when` com pergunta separada | Pronto | Front: mostrar o campo extra **dentro da linha** do item, como no Netlify |
| **Multisseleção em chips**: Escopo (6 opções), Perfil dos bens (6 opções, OUTROS com texto) | 04, 12 | — | Falta | Back: tipo `multi_select`. Front: chips |
| **Endereços**: lista (texto + qtde + % calculada), adicionar/remover, colar várias linhas, contagem de endereços/cidades e **27 chips de UF** | 07 | `unit_allocations` (unidades do projeto + qtde + %) | Parcial | Decisão: manter as unidades do GAI (com UF e cidade vindas do cadastro) e acrescentar a contagem de estados e cidades e o resumo por UF |
| **Contato**: Nome + Telefone | 26, 27 | Texto livre "NOME E TELEFONE" | Parcial | Back: tipo `contact`. Front: dois campos |
| **Intervalo de datas**: Início e Fim | 21 (Prazo campo) | Duas perguntas de data | Parcial | Back: tipo `date_range`, ou manter as duas datas lado a lado na mesma linha (só front) |
| **Horário especial**: Entrada, Saída e Finais de semana | 23 (ESPECIAL) | Texto "QUAL HORÁRIO?" | Parcial | Back: tipo `schedule`, ou campos extras estruturados |
| Percentual decimal "%" | 17 extra | `number` | Pronto | Front: sufixo "%" |
| Números com milhar pt-BR | 06, 32 | `number` | Pronto | Front: formatar |
| **Sequência** Nº inicial / Nº final | 33 | `sequence` | Pronto | — |
| **Contador − / +** de modelos antigos, que cria **N pares** de sequência | 35 → 36 | Número + texto longo | Falta | Back: tipo `sequence_list` (N sequências). Front: contador e N pares |
| Bloqueio por fornecedor N/A, com o texto "Bloqueado — etiquetas não se aplicam (N/A)" | 31 → 32–37 | `enabled_when` (fora de aplicabilidade) | Pronto | Front: texto de bloqueio igual ao do Netlify |
| Item sem resposta (caixa cinza) | 01, 28, 29 | — | Parcial | Back/front: tipo `none` (só Realizado e Observações) |
| Texto longo com altura automática | 30 | `long_text` | Pronto | — |
| Itens ocultos (Manuais, Cronograma) | — | `visible: false` | Pronto | — |

**Diferenças de opções** (modelo de referência do GAI × Netlify):
- O fornecedor de etiquetas e as despesas usam **GAI** onde o Netlify usa **INVESTOR**. Confirmar o nome com o cliente.
- O item 28 ("ACOMPANHANTE COM EXPERIÊNCIA EM ATIVOS") e o item 29 ("PLANTA DO LOCAL") não têm resposta no Netlify. No GAI são seleções.

## 5. Pré-preenchimento (Netlify: só preenche campos vazios, a partir do Painel Geral)

| Item | Origem no Netlify | Origem no GAI | Status |
|---|---|---|---|
| Escopo (04) | marcações do projeto (vistoria, inventário, conciliação, CPC 27/46/01) | `services` do contrato | Falta (back: mapear serviços → escopo) |
| Quantidade de itens (06) | `qtdeItensContrato` | `estimated_assets` do contrato | Falta |
| Endereços (07) | endereços do projeto (unidade - endereço, itens) | unidades vinculadas ao projeto | Parcial (as unidades já entram em `unit_allocations`) |
| Despesas (24) | `despesasCliente` | `expenses_paid_by` do contrato | Falta |

O GAI já tem `GET /preparations/context` (projeto, empresa, unidades e responsáveis). Falta trazer o contrato e aplicar os valores na criação ou ao abrir o kick-off, sem sobrescrever o que já foi respondido.

## 6. Comunicações

### 6.1 E-mail ao cliente — "Gerar e-mail cliente"

| Netlify | GAI hoje | Status |
|---|---|---|
| Modal "E-mail para o cliente", com texto editável e formatado (Calibri 11, azul; pendências em vermelho) | Prévia genérica de texto ("Ata e orientações…"), sem envio | Parcial |
| Modelo fixo de 15 tópicos montado pelas respostas (escopo, quantidade, endereços — até 5 listados, acima disso resumo por UF —, data-base, etiquetas, perfil, veículos, EPI, prazo, horário, textos fixos 11 e 12, focais, despesas, cronograma) | — | Falta |
| Bloco "SEGUEM PENDÊNCIAS PARA INICIARMOS" com regras (base contábil não realizada, etiquetas, política de despesas, documentos dos veículos, nomes dos técnicos) e prazo "primeira sexta depois do kick-off" | — | Falta |
| Edição salva no kick-off, "Restaurar original" e "Copiar" com formatação | — | Falta |

**O que fazer**
- **Back:** gerar o e-mail pelo modelo do Netlify (seção 7.1 do levantamento) e guardar a versão editada no kick-off.
- **Front:** modal com área editável, "Restaurar original" e "Copiar" (HTML mais texto simples).
- **Decisões a confirmar:**
  - Os textos fixos usam "Investor". Trocar pelo nome da empresa do usuário?
  - Corrigir três comportamentos acidentais do Netlify:
    - "EPI / integração: NÃO." sai como texto de pendência;
    - com fornecedor N/A, ainda entra a pendência de compra de etiquetas;
    - quando não há veículos informados, sai "Possui veículos: ." vazio.

### 6.2 Mensagem ao técnico (WhatsApp)

- No Netlify o código fica no Kick-off, mas o botão está na tela **Pendências - Campo**.
- **Modelo:** 14 tópicos, incluindo valor da diária, pagamento no dia 10 ou 25 e coordenador, seguidos de 16 orientações fixas.
- **Ações:** editar, restaurar, copiar e enviar pelo `wa.me`.
- **No GAI:** "Falta". Ficou para a fase de Pendências - Campo.
- **Dado sensível:** o modelo tem valores fixos de diária (R$ 185,00 e R$ 200,00). Confirmar se viram parâmetro.

## 7. Integrações com outras telas

| Netlify | GAI | Status |
|---|---|---|
| Pendências - Campo usa os dados do kick-off (endereços, prazo de campo, focal, etiquetas, despesas) | — | Falta |
| Inventário: o cronograma sugere os endereços do kick-off | — | Falta |
| Painel Geral: origem da criação automática e do pré-preenchimento | Contrato e unidades | Parcial |

## 8. Não portar

- Sincronização por polling, armazenamento no navegador e a regra de "mescla". O GAI usa banco com revisão.
- Arrastar colunas.
- Renomear um item globalmente sem versão. O GAI usa modelo versionado da organização.
- A carga inicial pontual de um projeto específico, que é uma migração de dados do sistema antigo.
- Os bugs do contador do Netlify (o RESUMO PROJETO passa a contar 39 itens depois de um clique).

---

## 9. Checklist de ações do usuário (Netlify) × GAI

| # | Ação | GAI |
|---|---|---|
| 1 | Abrir o Kick-off pela área Projetos | Pronto |
| 2 | Ver ⚠ na aba quando há kick-off não concluído | Falta |
| 3 | Buscar por cliente | Falta |
| 4 | Ocultar/mostrar a lista | Pronto |
| 5 | Ver Cliente · Data · Check list (X de Y, Z%) · Situação | Pronto (rótulos) |
| 6 | Abrir um kick-off pela linha | Pronto |
| 7 | Concluir na linha, com confirmação | Parcial |
| 8 | Reabrir na linha | Parcial |
| 9–10 | Novo kick-off só com o nome do cliente; cancelar | Parcial |
| 11 | Excluir com confirmação | Parcial |
| 12 | Kick-off automático por projeto em aberto | Falta |
| 13 | Filtro Situação | Pronto |
| 14 | Ocultar/mostrar bloco | Pronto |
| 15 | Arrastar colunas | Não portar |
| 16 | PENDENTE ⇄ REALIZADO independente da resposta | Parcial |
| 17 | Editar o nome do item | Parcial (pelo modelo) |
| 18 | Observações na linha | Parcial |
| 19 | Seleções na linha | Pronto |
| 20 | Campos extras condicionais | Pronto (separados) |
| 21 | Horário especial (entrada, saída, fins de semana) | Parcial |
| 22–23 | Chips de Escopo e Perfil dos bens (OUTROS com texto) | Falta |
| 24–26 | Números, datas e intervalo do prazo de campo | Pronto/Parcial |
| 27 | Focal Nome + Telefone | Parcial |
| 28–33 | Endereços: lista, qtde, %, adicionar/remover, colar, UFs | Parcial |
| 34 | Fornecedor N/A bloqueia etiquetas | Pronto |
| 35 | Sequência das etiquetas novas | Pronto |
| 36–37 | Contador de modelos antigos e N sequências | Falta |
| 38 | Outras informações | Pronto |
| 39 | Pré-preenchimento (escopo, qtde, endereços, despesas) | Falta/Parcial |
| 40 | Imprimir | Pronto |
| 41 | Exportar Excel (.xlsx) | Parcial (CSV) |
| 42–46 | E-mail ao cliente: gerar, editar, restaurar, copiar, fechar | Falta |
| 47 | Mensagem ao técnico (WhatsApp) | Falta (Pendências - Campo) |
| 48 | Atualizações de outros usuários | Parcial |

## 10. Inconsistências e erros do Netlify → correção proposta (decidir antes de implementar)

| # | No Netlify | Problema | Correção proposta no GAI |
|---|---|---|---|
| I1 | Kick-off ligado ao projeto **pelo nome** normalizado; criação automática e "mescla" apagam kick-offs em branco com o mesmo nome | Projetos homônimos se misturam e dados somem sem registro | Vínculo pelo ID do projeto. No máximo um kick-off **ativo** por projeto, regra no servidor. Nunca apagar automaticamente |
| I2 | Criação automática roda no navegador, em todo projeto "em aberto", por tentativa e espera | Depende de alguém abrir a tela; cria duplicados entre máquinas | Criação no servidor, num evento do projeto (decisão: criação ou ativação), idempotente |
| I3 | **Excluir e Concluir** sem permissão própria e sem motivo; Reabrir sem confirmação | Qualquer pessoa apaga ou reabre sem rastro | Excluir só rascunho, com `edit` e motivo. Concluir e reabrir com `approve`; reabrir com motivo. Tudo auditado |
| I4 | Nome do item editável **globalmente e sem versão**, compartilhado com o Check list - Cliente | Muda o texto de kick-offs já concluídos e de outra tela | Edição pelo modelo da organização (nova versão). Kick-offs existentes mantêm o texto da sua versão |
| I5 | Pré-preenchimento roda **a cada redesenho** e preenche de novo o que o usuário apagou | Impossível deixar o campo vazio de propósito | Aplicar uma vez, na criação ou pelo botão "Aplicar dados do projeto", registrando a origem (contrato/unidade). Nunca sobrescrever resposta existente |
| I6 | Valores de campos extras ficam gravados quando a condição deixa de valer | Respostas fantasmas aparecem no e-mail ou na exportação | O servidor marca a resposta como fora de aplicabilidade (já faz). E-mail, exportação e progresso ignoram respostas não aplicáveis |
| I7 | Campo "Endereços" editável, mas sobrescrito pela lista; participação % pode vir colada e divergir do cálculo | Dois valores para a mesma coisa | Contagens derivadas e somente leitura. Participação sempre calculada (qtde ÷ total); o % colado não é aceito |
| I8 | Texto "Informe a quantidade de modelos no **item 24**" (o item é o 35) e numeração do Excel diferente da tela | Referências erradas | Referências pelo nome do item. A numeração é a mesma na tela, na impressão e no Excel |
| I9 | Contador "X de Y verificado(s)" errado depois de um clique (RESUMO conta 39) | Progresso errado | Contadores calculados pelo servidor (progresso do kick-off) e redesenhados por bloco |
| I10 | Erros de digitação: "OCORRERA", "VALRO", "MANUTENÇAO" | Texto errado em documento para o cliente | Corrigidos no modelo de referência ("OCORRERAM", "VALOR", "MANUTENÇÃO") |
| I11 | Perfil dos bens: OUTROS abre `prompt` e existe um campo fantasma "QUAIS OUTROS BENS?" | Comportamento ambíguo | Chip OUTROS com campo de texto na própria linha, obrigatório quando marcado |
| I12 | Opções definidas que nunca aparecem (SIM/NÃO do acompanhante; SOLICITADO da planta) | Dúvida se são itens sem resposta | Decidir com o cliente: sem resposta (só Realizado) ou com as opções |
| I13 | Busca não ignora acentos | "Sao Paulo" não acha "São Paulo" | Busca sem acento e sem maiúsculas |
| I14 | E-mail editado continua o mesmo **mesmo que as respostas mudem**, sem aviso | Envio de informação desatualizada | Guardar a revisão das respostas usada no e-mail. Se mudaram, avisar e oferecer "Gerar de novo" |
| I15 | E-mail: "EPI / integração: NÃO." | Frase sem sentido | NÃO ou N/A → "Não será necessário EPI." |
| I16 | E-mail: fornecedor **N/A** gera a pendência "Aguardando compra de etiquetas" | Pendência indevida | Pendência só quando o fornecedor é a empresa prestadora |
| I17 | E-mail: "Possui veículos: ." quando vazio | Frase vazia | Sem resposta → linha omitida |
| I18 | Prazo das pendências = "primeira sexta depois da **data de criação**" | A data certa é a da reunião | Usar a data da reunião (`scheduled_date`), com a data de criação como reserva |
| I19 | "Investor" e textos fixos no código (e-mail, etiquetas, despesas, orientações) | Não serve para um SaaS | Nome da organização e textos no modelo ou parâmetros da organização |
| I20 | Mensagem ao técnico com **R$ 185,00 / R$ 200,00**, pagamento dia 10/25 e horário 8:30–18h fixos | Regra financeira escondida em texto | Parâmetros financeiros da organização (já existe a área "Parâmetros financeiros") |
| I21 | Telefone dos focais em texto livre; `wa.me` montado no navegador | Dado pessoal sem validação | Telefone validado e formatado. A mensagem é gerada no servidor; o link do WhatsApp vai sem destinatário e só com o texto aprovado |
| I22 | Excel sem Observações, lista de endereços, sequências antigas e horário especial | Exportação incompleta | Exportar todas as respostas e observações, respeitando a permissão |
| I23 | Itens ocultos (Manuais, Cronograma) saem no Excel | Exportação diferente da tela | Exportar só o que é visível no modelo |
| I24 | Sincronização a cada 12 s com mescla por "mais respostas" | Perda silenciosa de dados | Não portar: o servidor é a fonte única, com revisão (princípio 4) |
| I25 | Login automático e credenciais no `index.html` do Netlify | Falha de segurança | Não portar (registro apenas) |

## 11. Plano proposto (cada etapa = um commit; testes só no final do lote)

| # | Entrega | Camada | Princípios e correções aplicados |
|---|---|---|---|
| K1 | **Lista:** busca por cliente (sem acento); colunas Cliente/Check list; Situação Concluída/Em andamento; Concluir/Reabrir/Excluir na linha (excluir só rascunho, com motivo); Novo kick-off só com o cliente (modelo padrão já escolhido) | Front | P2, P3, I3, I13 |
| K2 | **Edição na linha:** botão Realizado separado da resposta; texto, número e data editáveis na linha com salvamento automático e revisão; Observações na linha; campos extras dentro da linha; texto de bloqueio; "%" e milhar | Front | P4, P5, I6 |
| K3 | **Novos tipos de resposta**, validados no servidor: multisseleção em chips (Escopo; Perfil dos bens com OUTROS + texto), contato (nome e telefone validado), intervalo de datas, horário especial, lista de sequências (contador − / +), item sem resposta. Modelo de referência nova versão, com textos corrigidos | Back + front | P5, P7, P8, I8, I10, I11, I12 |
| K4 | **Endereços:** contagem de estados e cidades e resumo por UF a partir das unidades; participação sempre calculada; colar várias linhas | Back + front | I7 |
| K5 | **Pré-preenchimento** a partir do contrato e das unidades (escopo, quantidade, endereços, despesas): uma vez, sem sobrescrever, com a origem registrada | Back + front | P9, I5 |
| K6 | **E-mail ao cliente:** modelo de 15 tópicos com os textos no modelo da organização; pendências com prazo pela data da reunião; edição salva com a revisão das respostas e aviso quando ficar desatualizada; restaurar; copiar com formatação; auditoria | Back + front | P3, P6, I14–I19 |
| K7 | **Exportar Excel (.xlsx)** completo, só com o visível, na mesma numeração da tela; alerta ⚠ na sub-aba Kick-off (kick-offs não concluídos do usuário) | Back + front | P1, P8, I8, I22, I23 |
| K8 | **Kick-off automático** no servidor, por ID do projeto, idempotente, no evento do projeto definido | Back | P9, I1, I2 |

A mensagem ao técnico (I20, I21) entra junto com Pendências - Campo.

**Decididas em 24/11/2026:**
- **K4:** endereços pelas **unidades cadastradas do projeto**. Não haverá lista livre.
- **K8:** kick-off automático criado **quando o projeto é ativado**.
- **K6:** correções I14–I18 do e-mail **aceitas**.
- **I19 (nome da empresa):** "Investor" é um cliente (organização) do GAI como qualquer outro. Nada de nome fixo no código.
  - No fornecedor de etiquetas e nas despesas, a opção mostra o **nome da organização** dona do projeto. Para a Investor aparece INVESTOR; para outra empresa, o nome dela.
  - O e-mail usa o mesmo nome.
  - A resposta é gravada com um código estável (ex.: `organization`), e não com o nome. Assim, renomear a organização não invalida respostas antigas.
- **K2:** "Realizado" **separado da resposta**, como no Netlify. Responder não conclui o item. O progresso e as pendências do e-mail usam o botão PENDENTE ⇄ REALIZADO.
- **I12:** itens 28 e 29 **com opções**:
  - 28 "ACOMPANHANTE COM EXPERIÊNCIA EM ATIVOS": SIM / NÃO;
  - 29 "PLANTA DO LOCAL": N/A / SOLICITADO / RECEBIDO.

Não há decisões pendentes para K1–K8.

**Como a K6 ficou (24/11/2026):**
- **Modelo do e-mail na versão do modelo da organização** (`email`): blocos de cabeçalho, 15 tópicos numerados, rodapé e pendências. As linhas usam marcadores (`{q:id}`, `{q:id.campo}`, `{notes:id}`, `{addresses:id}`, `{organization}`, `{client}`, `{deadline}`, `{greeting}`) e condições. O servidor valida tudo e recusa marcador desconhecido ou pergunta inexistente.
- **Linha omitida** quando uma condição falha ou um marcador fica vazio (I17). Respostas pendentes, ocultas ou fora de aplicabilidade são ignoradas (I6).
- **Versão editada guardada como texto simples**, e não HTML, para não haver injeção de código. A formatação (azul, vermelho a partir das pendências, destaques e prazo em negrito) é aplicada na tela e no "Copiar".
- **Concorrência própria do e-mail** (`email_version`): editar o e-mail não disputa a revisão com quem responde o kick-off.
- **Aviso de desatualizado** quando as respostas mudam depois da edição (I14). "Gerar de novo" e "Restaurar original" descartam a edição.
- **Histórico:** gerar, editar e restaurar ficam registrados, **sem o texto**, porque o e-mail tem dados pessoais dos focais.
- **Permissões e situação:** editar exige `project-preparation:edit`. Kick-off concluído pode ter o e-mail editado; excluído (arquivado) não.
- **"Prévia de comunicação":** passa a gerar só a orientação técnica, até a fase Pendências - Campo.

**Como a K7 ficou (24/11/2026):**
- **Excel (.xlsx) gerado no servidor**, no lugar do CSV montado no navegador: cabeçalho (cliente, data da reunião, situação, modelo e versão, check list), blocos por seção, e colunas Nº · Realizado · Item · Situação · Resposta · Observações.
- **Conteúdo:** só itens visíveis (I23), na mesma numeração da tela, com complementos na linha do item-pai (I8). Inclui observações, endereços com resumo de cidades e UFs, sequências e horário (I22). Respostas fora de aplicabilidade não saem (I6).
- **Fórmulas neutralizadas:** textos que começam com `=`, `+`, `-` ou `@` não viram fórmula no Excel.
- **Permissão nova `project-preparation:export`**, porque a planilha tem contatos dos focais (P8). A migração dá essa permissão aos papéis que já tinham `project-preparation:read`, para ninguém perder o que já fazia. Cada exportação fica no histórico.
- **Alerta ⚠ na sub-aba Kick-off (K7):** aparece enquanto houver kick-off não concluído na organização, só em projetos que ainda aceitam operação. A contagem é feita no servidor e atualizada a cada alteração de kick-off.

**Como a K8 ficou (24/11/2026):**
- **Quando cria:** ao ativar o projeto (rascunho → ativo) e ao reativar (inativo → ativo), o servidor cria o kick-off do projeto, vinculado pelo ID e nunca pelo nome (I1, I2).
- **Idempotente:** se o projeto já tem um kick-off que não foi excluído, nada é criado. Nada é apagado nem mesclado.
- **Modelo e título:** usa o modelo de kick-off mais recente não arquivado da organização (a mesma regra da tela). O título é o nome do cliente, ou o do projeto quando não há cliente. Se a organização não tem modelo de kick-off, nada é criado.
- **O que vem junto:** o pré-preenchimento da K5. O histórico registra a criação com a origem "ativação do projeto" e o usuário que ativou.
- **Desacoplado:** o módulo de Projetos só avisa "projeto ativado" (ganchos). Uma falha na criação do kick-off fica no log e não desfaz a ativação; o kick-off ainda pode ser criado pela tela.
