# Modernização do cadastro e gestão de empresas — GAI

Implementação local de 02/11/2026. Sem commit, push, deploy ou alterações em produção.

## 1. Diagnóstico inicial

O cadastro usava o formulário reduzido de `ResourceListPage`, em um drawer, com organização, nome, razão social e documento. Não havia páginas próprias de edição e detalhes.

A entidade e a tabela local já possuíam 24 colunas. O cadastro no backend aceitava endereço e contato, mas a resposta não os serializava. A atualização persistia somente nome, razão social, documento e metadados. Por isso, ampliar apenas o formulário não resolveria a perda aparente de dados na edição.

O isolamento por organização já existia no serviço de escopo. Entretanto, o cadastro exigia `organization_id` do navegador e comparava esse valor ao usuário, impedindo o vínculo automático solicitado. A normalização e a busca de documentos removiam letras. A pesquisa geral não incluía CNPJ.

Foram inspecionados autenticação por sessão, permissões, controller, DTOs, serviços, repositório, entidades, migrations, rotas, cache, componentes visuais e testes. Não foi encontrada integração cadastral ou de CEP reutilizável. Laudos técnicos consomem o documento da empresa como texto e não exigiram adaptação. A validação de CPF/CNPJ do módulo de inventariantes não participa do fluxo de empresas e foi preservada.

O workspace já continha numerosas mudanças de trabalhos anteriores. A implementação foi feita sobre esse estado, preservando as alterações alheias ao módulo.

## 2. Arquitetura das páginas

As rotas seguem o prefixo real da aplicação:

| Rota | Finalidade | Permissões |
| --- | --- | --- |
| `/app/companies` | Pesquisa, filtro, paginação e gerenciamento | `companies:read` |
| `/app/companies/new` | Cadastro dedicado | `companies:create` |
| `/app/companies/:id` | Visualização completa | `companies:read` |
| `/app/companies/:id/edit` | Edição dedicada | `companies:read`, `companies:update` |

`CompanyFormPage` compartilha o editor entre cadastro e edição. `companyFields.ts` centraliza os campos, seções, máscaras e apresentação. `CompanyDetailPage` usa as mesmas seções. A integração postal fica em `postalLookup.ts`.

Foram reutilizados PageContainer, PageHeader, FormField, Input, Button, DataTable, Pagination, SearchInput, StatusBadge, estados de carregamento/erro, toast e ConfirmDialog. Não foram instaladas dependências nem introduzida outra biblioteca visual.

O formulário tem identificação, contato e endereço, duas colunas em desktop e uma em celular, largura máxima, labels acessíveis, campos obrigatórios sinalizados e mensagens próximas aos controles. A barra de ações fica ao final do formulário para não cobrir campos. Os temas usam os tokens existentes do GAI.

## 3. Arquivos criados e modificados

Caminhos relativos à raiz do repositório. A lista identifica o escopo desta implementação; arquivos compartilhados também podem conter alterações anteriores.

**Backend modificado:**

- `gai-backend/src/modules/companies/application/dto/company-inputs.dto.ts`
- `gai-backend/src/modules/companies/application/dto/company-response.dto.ts`
- `gai-backend/src/modules/companies/application/services/companies.service.ts`
- `gai-backend/src/modules/companies/application/services/company-scope.service.ts`
- `gai-backend/src/modules/companies/infrastructure/persistence/typeorm-companies.repository.ts`
- `gai-backend/src/modules/companies/presentation/companies.controller.ts`

**Backend criado:**

- `gai-backend/src/modules/companies/domain/cnpj.ts`
- `gai-backend/src/modules/companies/domain/company-registry.port.ts`
- `gai-backend/test/unit/modules/company-cnpj.spec.ts`
- `gai-backend/test/integration/companies/company-registration.e2e-spec.ts`
- `gai-backend/test/companies-browser-api.cjs`

**Frontend modificado:**

- `gai-frontend/src/features/companies/CompaniesPage.tsx`
- `gai-frontend/src/types/api.ts`
- `gai-frontend/src/api/endpoints.ts`
- `gai-frontend/src/router/router.tsx`

**Frontend criado:**

- `gai-frontend/src/features/companies/CompanyFormPage.tsx`
- `gai-frontend/src/features/companies/CompanyDetailPage.tsx`
- `gai-frontend/src/features/companies/companyFields.ts`
- `gai-frontend/src/features/companies/postalLookup.ts`
- `gai-frontend/src/features/companies/companies.test.tsx`
- `gai-frontend/src/features/companies/postalLookup.test.ts`
- `gai-frontend/e2e/companies.spec.ts`
- `gai-frontend/playwright.companies.config.ts`
- `gai-frontend/vite.companies.config.ts`

Os builds atualizam os artefatos locais de `dist`. Esta pasta de documentação contém esquema, provas de preservação, resultados e capturas.

## 4. Associação automática e segurança multi-tenant

O controller obtém o ator exclusivamente de `SessionAuthGuard`: usuário, perfis, organização e permissões resolvidas no servidor. Não foi criada seleção de tenant por header ou parâmetro não validado.

Para usuários da organização, `organization_id` pode ser omitido. O serviço usa `actor.organizationId`. Um identificador de outra organização é rejeitado; não há fallback para acesso global. A ausência de organização autorizada interrompe o cadastro com mensagem explícita. A sessão existente valida o estado ativo da organização, e a criação confirma a existência e atividade do vínculo.

O administrador global continua informando uma organização existente e ativa. A interface oferece seleção com busca e paginação. Os demais perfis não recebem esse seletor.

Listagem, detalhe, atualização, desativação e reativação continuam aplicando o escopo no backend. PATCH não aceita organização, identificador interno ou campos de auditoria: o DTO não os declara e o ValidationPipe existente rejeita propriedades extras.

Mudar a situação por PATCH também exige a permissão de ciclo de vida correspondente, além de `companies:update`. Desativar/bloquear requer `companies:deactivate`; ativar requer `companies:reactivate`. O administrador global mantém sua autorização existente. Empresas excluídas logicamente precisam ser reativadas antes de editar os dados.

O modelo atual tem uma organização vinculada ao usuário autenticado; não foi inventado um novo mecanismo de múltiplas organizações. Uma futura seleção ativa deverá produzir esse contexto no servidor antes de chegar ao módulo.

## 5. CNPJ numérico e alfanumérico

Implementação baseada no [manual oficial de cálculo de DV da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf), consultado antes da implementação. Também foi consultado o [portal oficial do CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico).

O algoritmo aceita 12 posições A–Z/0–9 e dois verificadores numéricos; converte letras para maiúsculas; preserva zeros iniciais; usa o valor ASCII menos 48, pesos cíclicos de 2 a 9 da direita para a esquerda e módulo 11 nas duas etapas. Sequências numéricas repetidas e caracteres não permitidos são rejeitados. A regex valida o formato; o cálculo valida os dois dígitos.

O exemplo oficial `12.ABC.345/01DE-35` e CNPJs numéricos válidos fazem parte dos testes. A máscara aceita letras e números. O documento é salvo sem pontuação. A listagem pesquisa nome, razão social, cidade e documento; filtros de CNPJ também mantêm letras.

A regra vigente foi preservada: documento único **por organização**, inclusive para empresas desativadas. Há verificação antecipada e tratamento da violação do índice único em concorrência. Campos de CNPJ continuam opcionais, conforme a entidade e a regra anteriores.

## 6. Cadastro, edição e auditoria

Passaram a ser persistidos e retornados todos os campos empresariais autorizados: nome, razão social, CNPJ, inscrições estadual e municipal, e-mail, telefone, CEP, logradouro, número, complemento, bairro, cidade, estado, país e situação operacional.

Os DTOs compartilham os contratos dos campos; o DTO de atualização é parcial e não herda o vínculo organizacional. Foram aplicados limites compatíveis com as colunas, enum de situação, validação de e-mail e validação de telefone/CEP brasileiros. Endereços internacionais permitem entrada manual. País padrão no novo cadastro: BR.

Semântica de atualização:

| Entrada | Resultado |
| --- | --- |
| Propriedade ausente | Valor preservado |
| Texto opcional vazio ou somente espaços | Campo limpo para `null` |
| `null` em campo opcional | Campo limpo |
| Novo valor válido | Campo atualizado |
| Nome obrigatório vazio ou `null` | Erro de validação |
| `metadata` ausente | Metadados preservados |
| `metadata` explicitamente enviado | Alteração explícita, inclusive limpeza por `null` |

O editor envia somente os campos alterados no PATCH e não inclui metadados. A API registra mudanças com antes/depois em transação com o salvamento e atualiza `updated_by_id` com o ator autenticado. Identificação da criação é preservada. Campos ausentes não são apagados.

O formulário bloqueia duplo envio, mostra processamento, preserva dados em falhas, foca e rola até o primeiro erro, emite feedback e pede confirmação ao abandonar alterações. O fechamento/recarregamento do navegador usa o aviso nativo de alterações pendentes.

## 7. Consulta por CEP

Integração HTTPS com [ViaCEP](https://viacep.com.br/), sem credenciais e sem nova dependência. Consulta ao sair do campo com oito dígitos válidos ou pelo botão Consultar CEP. A implementação segue o formato e o tratamento de CEP inexistente documentados pelo fornecedor.

Há timeout de oito segundos, cancelamento ao mudar CEP/país ou desmontar a página, cache limitado de respostas válidas e prevenção de repetição automática do mesmo CEP. O botão permite tentar novamente. Uma resposta atrasada não substitui campos que o usuário editou durante a consulta.

Apenas logradouro, bairro, cidade e estado são propostos. Número e complemento são preservados. Se a proposta substituir um endereço já preenchido, o usuário precisa confirmar. Todos os controles continuam editáveis. CEP inexistente, resposta inválida, falha de rede e indisponibilidade mantêm o preenchimento manual. Fora de BR, a consulta brasileira é desabilitada.

Uma chamada real ao CEP público 01001-000 retornou HTTP 200, São Paulo/SP; evidência em `viacep-live.json`. Os testes automatizados controlam respostas externas para verificar sucesso, inexistência, timeout, cache e indisponibilidade de forma reproduzível.

## 8. Listagem, detalhes e futura consulta cadastral

A listagem apresenta nome, razão social, CNPJ formatado, cidade/UF, situação e ações. Inclui pesquisa, filtro de situação, paginação, ordenação estável por criação/ID, total, carregamento, vazio e erro com nova tentativa. Criar, visualizar e editar abrem páginas reais. Desativar e reativar usam os endpoints existentes, com confirmação e atualização do cache.

Busca, filtro e página permanecem na URL ao percorrer os formulários e retornar à listagem. O detalhe apresenta as três seções cadastrais e usa “Não informado” para ausências. Informações administrativas são exibidas a ORG_ADMIN e PLATFORM_ADMIN; a edição segue a permissão correspondente.

Para futura consulta por CNPJ, foi criado somente o contrato `CompanyRegistryProvider`. Ele retorna fonte, instante, situação cadastral oficial separada e uma proposta de campos. Não existe endpoint habilitado, botão fictício, credencial, API paga ou chamada obrigatória a serviço cadastral.

O futuro adapter deverá validar CNPJ alfanumérico, guardar credenciais no backend, aplicar rate limit e timeout e exigir confirmação antes de substituir dados. Não foram adicionados atributos à entidade; fonte e situação oficial não são gravadas indevidamente no status operacional.

## 9. Banco e migrations

Inspeção real somente de leitura: 26 empresas, 24 colunas e `document VARCHAR(20) NULL`. O tipo já suporta os 14 caracteres alfanuméricos; não foi reduzido para VARCHAR(14). Os CNPJs dos 26 registros locais estavam vazios e não foram preenchidos artificialmente.

Índices verificados: chave primária, documento único por organização, organização/situação, organização/cidade/estado, nome e índices de auditoria. Dependências por chave estrangeira: budgets, company_audit_logs, company_unit_audit_logs, company_units, project_contracts, projects e receivables.

**Nenhuma migration foi necessária ou criada. Nenhum registro da base local foi alterado.** `database-before.json` registra o esquema, índices, referências e hash SHA-256 do conjunto completo de linhas ordenadas. `database-after.json` documenta a conferência final.

Os testes HTTP usam SQLite em memória e MySQL descartável na porta 33337, com destino fixado pelo helper de testes. A base de desenvolvimento na porta 3306 não é usada para escrita pelos testes.

## 10. Testes e resultados

Os comandos e resultados finais estão em `validation.json` e nos logs da pasta `evidence`. Os números das execuções do módulo se sobrepõem aos das suítes completas; não devem ser somados como testes únicos.

| Validação executada | Resultado |
| --- | --- |
| Backend: suíte unitária completa | 61 suítes, 443 testes aprovados |
| Backend: empresas e unidades, MySQL descartável | 2 suítes, 16 testes aprovados |
| Backend: empresas e unidades, SQLite em memória | 2 suítes, 16 testes aprovados |
| Frontend: regressão completa | 50 arquivos, 294 testes aprovados |
| Frontend: módulo de empresas após refinamentos finais | 2 arquivos, 25 testes aprovados |
| Playwright: ciclo completo e seis combinações de dispositivo/tema | 7 cenários aprovados |
| Lint completo de backend e frontend | Aprovado, códigos de saída 0 |
| Typecheck de backend e frontend | Aprovado, códigos de saída 0 |
| Build de backend e frontend | Aprovado; aviso de tamanho do bundle frontend |
| Consulta real ViaCEP | HTTP 200, endereço válido |
| Preservação da base local | 26 registros, SHA-256 idêntico antes/depois |

A regressão completa do frontend antecedeu os últimos refinamentos visuais e os quatro testes adicionais do formulário; a execução final do módulo e o navegador validaram esses refinamentos. Não houve falhas pendentes nos checks executados. A suíte completa de integração de todos os demais módulos não foi executada nesta tarefa.

As validações cobrem CNPJ tradicional/alfanumérico, máscaras, organização autenticada, organização forjada, acesso cruzado nas operações, campos protegidos, edição completa e parcial, limpeza explícita, metadados, auditoria, documento duplicado e exclusão lógica. No frontend, cobrem navegação, dados existentes, validação, envio duplicado, erros, contexto global, CEP, respostas atrasadas e alterações pendentes. O navegador percorre o ciclo completo com API real em memória e seis combinações de dispositivo/tema.

Comandos reproduzíveis, executados a partir do respectivo projeto:

```powershell
# gai-backend
node test/run-tests.cjs unit
node test/run-tests.cjs sqlite --runTestsByPath test/integration/companies/companies.e2e-spec.ts test/integration/companies/company-registration.e2e-spec.ts
node test/run-tests.cjs mysql --runTestsByPath test/integration/companies/companies.e2e-spec.ts test/integration/companies/company-registration.e2e-spec.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js "{src,apps,libs,test}/**/*.ts"
node node_modules/@nestjs/cli/bin/nest.js build

# gai-frontend
node node_modules/vitest/vitest.mjs run --config vitest.config.ts
node node_modules/vitest/vitest.mjs run --config vitest.config.ts src/features/companies
node node_modules/@playwright/test/cli.js test --config playwright.companies.config.ts
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

O comando MySQL pressupõe a infraestrutura descartável existente em 33337; nunca apontar o helper para produção. O Playwright próprio inicia API SQLite e Vite isolados em 33419/5341, sem reutilizar a API de desenvolvimento.

## 11. Falhas encontradas e corrigidas durante a validação

- Validação antiga removia letras do CNPJ: substituída pelo algoritmo oficial.
- Campos salvos não retornavam na resposta: serialização completa adicionada.
- PATCH ignorava contatos, endereço e inscrições: atualização parcial ampliada.
- Cadastro dependia do tenant informado pelo navegador: contexto autenticado passou a resolver o vínculo.
- Alteração de situação por PATCH poderia contornar a permissão específica: exigência explícita adicionada.
- Teste inicial de isolamento inseria empresa sem criar a segunda organização: fixture corrigida após o MySQL detectar a chave estrangeira.
- Massa padrão concedia todas as permissões ao operador: o teste de negação passou a remover a concessão necessária explicitamente.
- Node Request e AbortSignal do jsdom pertenciam a ambientes diferentes: adaptado somente no teste de navegação, sem alterar o código de produção.
- Servidor Vite do teste atendia localhost enquanto a verificação usava IPv4: bind explícito em 127.0.0.1.
- Barra fixa cobria campos nas capturas: substituída por ações no fluxo normal.
- Primeira execução de navegador passou pelo dashboard, cujas consultas MySQL não se aplicam ao SQLite. O teste passou a autenticar com retorno direto para empresas, evitando essa dependência externa ao módulo.
- Erros pontuais de lint e tipagem dos novos testes foram corrigidos e os checks repetidos.

## 12. Limitações e pendências

- A integração cadastral por CNPJ permanece intencionalmente apenas preparada, sem fornecedor selecionado.
- O ViaCEP é externo; o cadastro permite continuidade manual em falhas. Não foi estabelecido SLA de terceiros.
- O contexto multi-tenant atual usa a organização do usuário validada pela sessão. Uma futura troca de organização deve ser implementada e autorizada no servidor.
- O build do frontend emite o aviso de bundle acima de 500 kB. Não impede o build; a divisão geral de bundles envolve o restante da aplicação e não foi ampliada neste escopo.
- As suítes visuais foram executadas em Chromium. Outros motores e homologação humana continuam disponíveis como etapas de liberação.
- Os testes frontend existentes de gráficos podem emitir avisos de dimensão zero no jsdom; os resultados efetivos estão registrados, sem ocultar falhas.
- A manutenção assíncrona de exportações do ambiente de testes MySQL pode registrar “Pool is closed” durante o encerramento. Os 16 testes do módulo passaram; esse comportamento de encerramento de outro módulo não foi alterado.

## 13. Procedimento de homologação

1. Subir frontend e backend locais com as mudanças, usando as configurações habituais. Não executar seed ou recriar a base de desenvolvimento.
2. Entrar como ORG_ADMIN e abrir Empresas. Verificar ausência de seletor de organização no cadastro.
3. Cadastrar uma empresa de homologação com CNPJ válido numérico ou alfanumérico, inscrições, contato e endereço. Confirmar a organização persistida pela API.
4. Consultar CEP válido, inexistente e simular indisponibilidade; testar entrada manual, número/complemento e país diferente de BR.
5. Salvar, visualizar, voltar à listagem, pesquisar o CNPJ formatado e abrir edição. Alterar/limpar campos opcionais e confirmar que os demais permanecem.
6. Tentar sair com alterações pendentes, cancelar a saída e depois confirmar. Verificar teclado, foco e feedback.
7. Desativar e reativar com o perfil autorizado; conferir a preservação dos dados, auditoria e vínculos.
8. Com usuários de duas organizações, testar GET/PATCH e ações de ciclo de vida cruzados, inclusive envio forjado de `organization_id`.
9. Como administrador global, selecionar uma organização ativa por busca/paginação. Conferir bloqueio de vínculo inexistente ou inativo.
10. Revisar desktop, tablet e celular em ambos os temas. Capturas produzidas estão em `screenshots/`.

## 14. Requisitos para futura implantação

Revisar o diff juntamente com as mudanças anteriores do workspace e aprovar o escopo de release. Publicar backend e frontend compatíveis no processo habitual, depois de homologação. Não há migration nem permissão nova a aplicar para esta mudança; verificar em cada ambiente o índice único por organização e o tipo textual do documento antes da liberação.

Garantir HTTPS e acesso do navegador ao domínio ViaCEP; caso o ambiente imponha CSP, incluir esse destino na política de conexão aprovada. Manter as permissões existentes e a validação por sessão. Monitorar erros de validação/duplicidade, consultas externas e transações de auditoria.

O rollback deve restaurar os artefatos da versão anterior por meio do processo de release, sem excluir empresas ou seus dados. CNPJs alfanuméricos criados após a liberação precisam continuar preservados, mesmo durante rollback. Nenhuma dessas ações de produção foi executada nesta tarefa.

## Capturas

- [Desktop claro](screenshots/desktop-form-light.png)
- [Desktop escuro](screenshots/desktop-form-dark.png)
- [Tablet claro](screenshots/tablet-form-light.png)
- [Tablet escuro](screenshots/tablet-form-dark.png)
- [Celular claro](screenshots/mobile-form-light.png)
- [Celular escuro](screenshots/mobile-form-dark.png)
- [Detalhes em desktop](screenshots/desktop-detail-light.png)
