# Laudos Técnicos Patrimoniais — implementação e homologação local

Módulo integrado ao workspace do projeto, com modelos organizacionais versionados, fontes controladas, editor em texto simples, validação no backend, aprovação/reabertura e versões preservadas. Não foram alteradas regras de inventário, placas, avaliações históricas, conciliações, contratos ou finanças. Sem commit, push, deploy ou migration de produção.

## 1. Análise prévia e capacidades do legado

Consultados os relatórios de auditoria, Conciliação Assistida, Avaliação em Lote, Gestão Contratual, DRE, validação técnica e segurança. Inspecionados projetos/empresas/unidades, itens físicos e contábeis, sessões/observações, conciliações/consolidações, decisões assistidas, avaliações/lotes, pendências, usuários/atribuições, permissões, imagens/storage e export jobs.

Fontes de referência: `docs/auditoria-legado-gai-2026-10-27/matriz-comparativa.md`, F079–F085, e os HTML `paineis/laudo.html` e `paineis/laudo_padrao.html` do pacote local de auditoria. O legado mantém modelos em localStorage/sharedStore, com envio ao servidor desativado em um dos caminhos. Sua exportação Word gera HTML com extensão `.doc`, sem DOCX nativo. Esses mecanismos não foram copiados.

| Capacidade | Tratamento nesta implementação |
|---|---|
| F079 — narrativa/escopo | Seções configuráveis, campos dinâmicos, conclusão, responsáveis e versões por projeto |
| F080 — modelo/textos padrão | Rascunhos, publicação imutável, histórico e arquivamento por organização |
| F081 — quadros/avaliações | Tabelas extraídas no backend, contagens e seleção rastreável; sem copiar percentuais/fórmulas sem fonte confiável |
| F082 — fotos/legendas | Infraestrutura atual de imagens analisada; composição e cópias imutáveis de fotos não são implementadas nesta etapa. Não são armazenadas URLs públicas ou presignadas no laudo |
| F083 — pendências antes de emissão | Validação estruturada no servidor e regras auditáveis por versão do modelo |
| F084 — impressão/documentos | Prévia profissional, CSS de impressão A4 e exportação JSON do snapshot aprovado; PDF/DOCX nativos dependem do contrato descrito adiante |
| F085 — afirmações normativas/assinatura | Nenhuma conformidade, habilitação, ART/RRT ou assinatura digital é presumida |

Avaliação monetária registrada não equivale a laudo formal. Cadastro mestre de valores não substitui o histórico de avaliações. Prestação/finanças não são fontes deste módulo.

## 2. Arquitetura, entidades e migration

Novo `TechnicalReportsModule` em `gai-backend/src/modules/technical-reports/`: DTOs, entidades, controller, serviço transacional, extrator de fontes e política documental pura. Reutiliza AuthModule, ProjectScopeService, PermissionsGuard e o catálogo vivo de permissões. Não cria autenticação ou layout principal alternativos.

Migration `1793900000001-create-technical-reports.ts`, classe `CreateTechnicalReports1793900000001`:

| Tabela | Responsabilidade |
|---|---|
| `technical_report_templates` | Rascunho atual do modelo, revisão, arquivamento e versão publicada |
| `technical_report_template_versions` | Revisões imutáveis de rascunho/publicação/arquivamento, hash, autor, data e motivo |
| `technical_report_responsibles` | Registro explícito de usuário autorizado, nome documental, função e informações profissionais declaradas |
| `technical_reports` | Laudo do projeto, revisão corrente, estado, conteúdo e referência à última aprovação |
| `technical_report_versions` | Snapshot imutável de cada revisão, validação, hash, ator, instante e motivo |
| `technical_report_commands` | Comandos idempotentes e histórico de operações, inclusive download do snapshot aprovado |

FKs de organização/projeto/usuário, FKs compostas de escopo para versões, referências à publicação/aprovação e índices únicos de revisão e chave idempotente. Referências de fontes em JSON são verificadas no serviço com organização e projeto. O `down` recusa exclusão destrutiva do histórico.

Destino confirmado antes de aplicar: `NODE_ENV=local`, `localhost:3306/gai`, MySQL 8.0.46, servidor Docker `f10269ba8da4`. Havia 30 migrations aplicadas; somente a migration de laudos foi executada, totalizando **31**, sem pendências. Nenhum dado anterior foi apagado ou recriado. A migration adiciona estrutura e cinco permissões, sem atribuições indiscriminadas a usuários.

## 3. Modelos e versionamento

O modelo define nome, tipo de laudo, descrição, seções ordenadas, textos padrão, campos, tabelas, requisitos e regras de validação. A interface permite adicionar/remover/reordenar seções, definir campos manuais ou ligados a fontes permitidas e escolher as tabelas aplicáveis.

Publicar cria uma nova versão imutável. Editar o rascunho, publicar outra versão ou arquivar o modelo não modifica a publicação anterior nem laudos existentes. Novos laudos exigem uma publicação válida da mesma organização e um modelo não arquivado. Modelos organizacionais podem ser reutilizados em outros projetos autorizados da organização.

Campos dinâmicos usam `{{chave}}`, vinculados a definições explícitas. Não há execução de expressões. As fontes permitidas incluem identificação do projeto/empresa, contagens de inventário/observações/base/conciliação/avaliações/pendências. Fonte não extraída permanece ausente; não é substituída por informação inventada.

## 4. Fontes e critérios dos snapshots

| Família | Dados selecionados e referências |
|---|---|
| identity | Projeto, empresa, documento e datas existentes; IDs e hashes de origem |
| units | Vínculos do projeto e unidades da empresa na mesma organização |
| inventory | Itens físicos ativos no armazenamento, placas cadastradas, descrição, unidade/local e status, sem modificá-los |
| accounting | Base contábil, descrição/conta, aquisição e status; sem criar cadastro contábil paralelo |
| observations | Observações da sessão explicitamente selecionada, rodada, item, resultado, data e notas; contagem de registros e itens distintos |
| reconciliation | Último `runNumber` da sessão, vínculos físicos/contábeis, decisões/notas de consolidação; hashes também incluem histórico assistido e sessão |
| valuation | Última avaliação por item, ordenada por data civil e ID, ou restrita a lote confirmado selecionado do projeto |
| issues | Pendências, situação, severidade e resolução; contagem de abertas/em revisão |

Projeto/empresa são sempre identificados. Observações e conciliação exigem ID explícito de sessão. Lote informado deve estar confirmado e pertencer ao projeto. Cada fonte exige suas permissões de leitura atuais, inclusive durante consulta de versões antigas e exportação.

O extrator gera tabelas e indicadores no backend, guarda critérios, instante de extração, IDs, hashes de registros e hash completo das fontes. O snapshot contém valores utilizados, não somente uma URL para dados mutáveis. Uma consulta de fonte com mais de 1.000 registros é recusada explicitamente; não há truncamento silencioso.

As fontes antigas de avaliação não possuem moeda tipada confiável. Valores individuais são apresentados como informados, com indicação dessa ausência. O total `valuation.used_total` fica indisponível e `valuation.currency` é sinalizada como lacuna. Não se somam valores sem unidade monetária conhecida nem se assume BRL. Métodos e notas de avaliações são informações declaradas na origem, sem atribuir conformidade normativa.

Conciliação representa a execução selecionada, que pode corresponder a recorte parcial/assistido. Suas contagens não certificam cobertura integral de todo o projeto. Divergências são consideradas sem decisão válida quando não há consolidação aceita/corrigida; consolidação rejeitada não é convertida em resolução. Limitações de cobertura devem ser documentadas pelo elaborador conforme o modelo.

## 5. Conteúdo, proveniência e validação

O laudo preserva a versão/hash do modelo, título, seções, campos, textos, observações, conclusão, responsáveis e fontes. A prévia distingue texto de modelo, texto manual, campo extraído, alteração manual com valor original identificado e campo não preenchido. Atualizar fontes exige comando explícito e cria nova revisão; campos manuais não são silenciosamente substituídos pelo valor oficial.

Todo conteúdo é texto simples, com limites de tamanho e rejeição de HTML ativo e caracteres de controle inválidos. React renderiza textos e células por interpolação segura; não há `dangerouslySetInnerHTML`, iframe com conteúdo do usuário ou avaliação de JavaScript.

Motor `technical-report-v1`. Checksums novos usam `sha256-canonical-json-v1`, registrado na validação, preservando o hash mesmo quando MySQL reordena chaves JSON. Validação retorna `valid`, `source_hash` e uma lista de `{code,severity,message,key?}`:

- Bloqueios fixos: projeto sem identificação; seção/campo obrigatório ausente; campo dinâmico indefinido/não preenchido; tabela exigida sem extração; responsável exigido ausente/inativo; registro profissional sem dados/evidência quando explicitamente exigido; avaliação/conciliação exigida sem registros.
- Regras configuráveis por publicação: divergências/pendências abertas, indicadores/fontes incompletos e fontes alteradas podem gerar aviso ou bloqueio. Pendência patrimonial não bloqueia universalmente todos os tipos de laudo.
- Conclusão geral ausente gera aviso; o administrador pode exigir uma seção de conclusão para tornar esse conteúdo obrigatório no tipo aplicável.
- A aprovação interna não constitui assinatura digital ou comprovação de habilitação; esse aviso acompanha validação e prévia.

## 6. Responsáveis técnicos

Cadastro explícito por administrador de modelos, vinculado a usuário ativo da organização com atribuição ativa. Nome documental e função são informados; registro profissional e evidência são opcionais, salvo exigência explícita do modelo. Cadastro não cria registro em conselho, não emite ART/RRT e não assina o documento.

Os perfis cadastrados são preservados nos snapshots e revalidados na aprovação. O cadastro de identificação desta etapa é imutável, com um registro por usuário/organização; não há edição retroativa de qualificações nos documentos aprovados. Alterações de autorização no usuário bloqueiam nova aprovação quando aplicável. Evolução de cadastro profissional com novas versões exige fluxo próprio; não foi simulada por regravação de perfis históricos.

## 7. Estados, aprovação, concorrência e auditoria

Fluxo: `draft` → `in_review` → `approved`; aprovado/em revisão pode ser reaberto com motivo (`reopened`), originando novas revisões. Rascunho/reaberto/aprovado pode ser arquivado. Estado arquivado não admite edição. A versão aprovada continua consultável e exportável após reabertura ou arquivamento.

Preparar revisão e aprovar executam novamente a validação das fontes e responsáveis no servidor. A revisão preparada é imutável; editar exige reabertura. Aprovação registra versão, autor, data, conteúdo, resultado da validação e hashes. Atualizações posteriores não reescrevem aprovação anterior; a interface informa novas fontes disponíveis.

Cada escrita exige motivo, `command_key` e revisão esperada quando altera registro existente. Transação MySQL bloqueia a organização **antes da primeira leitura consistente**: isso evita que `REPEATABLE READ` retenha revisão anterior enquanto aguarda o lock. Escrita do laudo também usa comparação de revisão no SQL. Uma corrida real produz um sucesso e 409, sem perder texto nem duplicar versão. Header, versão e comando são gravados atomicamente. Chave repetida com conteúdo/ator diferentes é recusada. Reenvio idêntico revalida permissões de fonte antes de devolver o snapshot anterior.

## 8. APIs e permissões

Prefixo `/api/v1/projects/:projectId/technical-reports`:

| Método | Caminho | Função |
|---|---|---|
| GET / POST | `/templates` | Listar/criar modelo organizacional |
| GET / PUT | `/templates/:id` | Histórico e novo rascunho |
| POST | `/templates/:id/publish`, `/templates/:id/archive` | Publicar/arquivar com revisão e motivo |
| GET / POST | `/responsibles` | Consultar/cadastrar responsáveis autorizados |
| GET / POST | `/` | Listar/criar laudos do projeto |
| GET / PUT | `/:id` | Consultar/editar conteúdo com revisão |
| POST | `/:id/refresh-sources` | Extração explícita em nova revisão |
| GET | `/:id/validation` | Validação atual estruturada |
| POST | `/:id/transitions` | Preparar revisão, aprovar, reabrir ou arquivar |
| GET | `/:id/versions/:versionId` | Conteúdo imutável de revisão específica |
| GET | `/:id/versions/:versionId/export` | Snapshot aprovado JSON, com auditoria |

Cinco chaves `ORGANIZATION` no catálogo e seed: `technical-reports:read`, `technical-reports:edit`, `technical-reports:templates`, `technical-reports:approve`, `technical-reports:export`. Todas as rotas também exigem leitura do projeto. Administração de modelos inclui cadastro de responsáveis. Preparação para revisão, aprovação/reabertura e arquivamento exigem permissão de aprovação.

ORG_ADMIN atua somente em sua organização, respeitando o catálogo vivo. Perfil com apenas `projects:read` não acessa laudos; leitura específica não concede criação, edição, aprovação ou exportação. Nenhuma nova permissão foi concedida automaticamente a ORG_USER/perfis personalizados.

Fontes adicionais: `companies:read`, `project-units:read`, `company-units:read`, `inventory-items:read`, `inventory-accounting-items:read`, `inventory-sessions:read`, `reconciliations:read`, `assisted-reconciliation:read`, `asset-valuations:read`, `inventory-pending-issues:read`, conforme seleção. Histórico e download revalidam as permissões registradas no snapshot, não apenas o token original. Uma versão de outro laudo/projeto não é aceita. Leituras de modelos e responsáveis são sempre organizacionais.

Listagens não retornam o conteúdo patrimonial de todos os laudos; o detalhe verifica leituras das fontes. Metadados de histórico não expõem resultados antigos de validação sem carregar a versão autorizada. O guard e a autenticação não foram alterados.

## 9. Interface, prévia e documentos

Rotas no layout persistente existente do projeto:

- `/app/projects/:projectId/technical-reports`
- `/app/projects/:projectId/technical-reports/templates`
- `/app/projects/:projectId/technical-reports/templates/new` e `/:templateId`
- `/app/projects/:projectId/technical-reports/responsibles`
- `/app/projects/:projectId/technical-reports/:reportId`
- Detalhe usa `?view=validation|history|preview`; `&version=:versionId` seleciona a revisão preservada.

Nova aba **Laudos**, sem duplicação de autenticação/layout. Gestão por formulários de seções/campos/regras, criação por modelo publicado, editor, fontes, validação, workflow, histórico e prévia. Reutiliza PageContainer, botões, modais, tabelas e estados existentes. Navegação contínua entre abas, refresh, links diretos, voltar/avançar e viewport móvel foram testados.

Prévia contém capa, identificação, sumário, seções, quadros, indicadores, conclusão, responsáveis e referências/hashes. CSS de impressão A4 define margens, quebra de capa, cabeçalho repetido de tabelas e prevenção de quebra de linhas. “Imprimir prévia” usa o navegador; não é uma geração de PDF certificada no servidor.

**PDF/DOCX nativos não foram implementados.** O backend existente tem gerador XLSX e infraestrutura de imagens, sem renderer/document templates profissionais para esses formatos. A entrega contém exportação real `application/json` do snapshot aprovado (`gai-technical-report-snapshot-v1`), sem HTML renomeado, extensão falsa ou alegação de assinatura.

Contrato para gerador posterior: entrada é a revisão aprovada imutável, com modelo, campos, textos, tabelas, origem e resultado da validação; renderizador deve escapar texto, materializar campos somente dos valores congelados, usar template A4 aprovado, paginar tabelas e validar visualmente o resultado. PDF/DOCX devem ser gerados como binários reais em export jobs privados, com checksum/expiração, auditoria e revalidação atual de organização/permissões no download. Imagens exigem referência autorizada do mesmo projeto e cópia/derivado imutável com checksum; URLs temporárias não devem entrar no snapshot.

## 10. Testes, evidências e homologação

Resultados finais em `testes.json`; conexão, catálogo, versões preservadas e referência ao projeto sintético em `runtime-local.json`; arquivos/hashes em `arquivos.json`. Prévia desktop/móvel e snapshot exportado estão em `evidencias/`.

Cobertura: políticas de modelo/obrigatoriedade/campos dinâmicos/HTML, snapshots, publicação e arquivamento, criação/edição, fontes reais de inventário/importação contábil/observações/conciliação/consolidação/avaliação, lacunas monetárias, validação, aprovação/reabertura, histórico, concorrência, autorização, escopo organizacional, IDs de outros pais, reenvios idempotentes e exportação após revogação. Regressões dos módulos de origem são executadas separadamente no mesmo banco descartável, sem paralelizar recriação do esquema.

Playwright real com `org.admin`, dados `SINTETICO`, sem mocks: cria cliente/projeto/item; cadastra responsável de desenvolvimento quando necessário; cria/publica modelo pela interface; gera laudo com quadro físico; edita; salva e atualiza página; valida; prepara/aprova; consulta histórico/prévia e exporta; altera somente descrição do item sintético; confirma aviso de novas fontes e versão aprovada intacta; reabre, edita, atualiza fontes; confirma hash histórico preservado; testa móvel, voltar/avançar e navegação Laudos → Itens → Laudos. Sem erros JavaScript/HTTP no percurso aprovado.

Banco de teste opt-in: `GAI_TEST_MYSQL_DISPOSABLE=1`, somente `127.0.0.1:33317/gai_validation_disposable`. Container temporário desta etapa: `gai-reports-mysql-test`, com dados em tmpfs. Não se usa a conexão de desenvolvimento para recriar esquema. Após validar, remove-se somente esse container; `gai-mysql` e seus volumes são preservados.

Para homologar: executar `scripts/local-start.ps1`, entrar com `org.admin` e senha do ambiente de desenvolvimento, abrir projeto autorizado → Laudos. Em Modelos, criar/publicar as seções aplicáveis. Em Responsáveis, cadastrar usuário de teste autorizado. Criar laudo por modelo publicado, selecionar fontes e IDs explícitos quando necessários, preencher conteúdo, validar, preparar revisão e aprovar. Consultar “Versão aprovada preservada”; após reabrir, a revisão anterior continua disponível. Não usar dados reais ou ambiente de produção.

Runners locais: `node .local/run-reports-checks.cjs backend|frontend|tests|regression|frontend-tests|reports-ui-tests`; `node .local/run-reports-playwright.cjs`. Testes HTTP exigem o MySQL descartável; Playwright exige backend e frontend locais. Credenciais não foram copiadas para os relatórios.

## 11. Limitações e riscos conhecidos

- Sem PDF/DOCX nativo, assinatura digital, validação externa de registro profissional, fotos incorporadas ou afirmação automática de norma técnica.
- Documentos e referências são texto simples; evidência documental de registro é uma referência informada, não uma comprovação validada por conselho profissional.
- Cobertura das fontes depende dos registros e do recorte selecionado. Sessão observada ou última execução de conciliação pode ser parcial; o laudo não transforma isso em declaração de completude.
- Moeda/metodologia de avaliação não são inventadas. Total monetário fica indisponível enquanto faltar unidade confiável na origem.
- Limites: 1.000 registros por família/consulta de fonte, 1.000 modelos por organização, 1.000 laudos por projeto, 30 seções, 30 campos e dez responsáveis por laudo. Não há teste de carga nem matriz de navegadores além de Chromium.
- IDs de sessão/lote são informados explicitamente na seleção e consultáveis nas abas existentes; não foi criado outro gerenciador de sessões ou avaliações.
- Sem salvamento automático. Conflito mantém o texto local na interface e exige conciliação/recarregamento consciente da versão; sair da página pode descartar alterações ainda não salvas.
- Cadastro de responsáveis é imutável nesta etapa; evolução de credenciais e qualificações requer versionamento próprio futuro.
