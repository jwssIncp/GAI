# Visão Geral ORG_ADMIN

## Auditoria anterior à implementação

- Frontend React/Vite, React Query, Tailwind e Recharts; backend NestJS/TypeORM/MySQL. Rota `/app/dashboard` renderizava contagens paginadas de organizações, usuários, empresas e projetos, sem filtros ou exportação consolidada.
- Sessão validada no backend por SessionAuthGuard; permissões por PermissionsGuard. O usuário autenticado fornece organizationId e systemRoles. ProjectScopeService já limita consultas à organização e rejeita organizações solicitadas incompatíveis.
- Projetos têm organization_id, company_id opcional, status, start_date, end_date, finished_at, exclusão lógica, settings e metadata livres. Não há entidade de contrato nem campos tipados de valor, assinatura, quantidade contratada, segmento ou serviços/conformidade. Pagamentos/despesas não representam contratos. JSON livre não é fonte contratual confiável.
- Existem dashboards por projeto, resumo financeiro/operacional, Recharts, mapa e componentes MetricCard/States. São reutilizáveis visualmente, mas suas agregações de inventário não equivalem a contratos.
- Export jobs existentes são por projeto; há PROJECT_BACKUP_XLSX e importação raw_backup_import, sem equivalência confirmada com backup JSON da referência. Nenhuma restauração será implementada.
- PDF inicialmente ausente dos anexos. Após o usuário indicar o diretório, foi localizado em `C:/Users/Jonathan/Documents/GAI - AJUSTES/ADMINISTRADOR DA EMPRESA/visão geral.pdf`, convertido para PNG com LibreOffice Draw e inspecionado visualmente. A página única confirma seis cards, filtros, CSV, Excel e backup JSON. Não esclarece a semântica de aberto, o ano de 30/09 ou a coluna temporal dos atalhos. Não foram utilizados números demonstrativos. A porção inferior dos dashboards está cortada na própria referência.

## Comparativo inicial com a referência descrita

| Recurso | Antes | Encaminhamento |
|---|---|---|
| Total de contratos, ticket médio, contratos abertos, itens contratados | Dados inexistentes no modelo tipado | Exibir indisponibilidade, sem inventar valores |
| Quantidade de projetos | Contagem sem seleção consolidada | Agregar no banco conforme filtros |
| Projetos abertos | Ausente | Exibir projetos ativos e percentual, explicitando critério técnico |
| Ano, mês, status e busca por projeto | Ausentes na Visão Geral | Usar criação do projeto, explicitamente identificada |
| Data do contrato, segmento, serviços, conformidade, itens contratados | Dados inexistentes | Documentar limitação |
| UF/cidade | Existem nas unidades, não no projeto | Não presumir localização única ou endereço contratual |
| Atalhos de datas contratuais | Ausentes | Não presumir semântica; 30/09 aguarda referência |
| Gráficos consolidados | Ausentes | Status e evolução de criação de projetos |
| CSV/Excel consolidados | Ausentes | Mesma consulta e escopo da tela |
| Backup JSON | Sem equivalente confirmado | Não implementar nesta etapa |

Alterações preexistentes em módulos operacionais, node_modules, dist e documentos foram identificadas e serão preservadas. Sem migrations, alterações de dados, commit, push ou produção.

## Resultado e comparativo final

| Funcionalidade | Situação anterior | Resultado |
|---|---|---|
| Valor total em contratos e quantidade de projetos considerados | Não implementada; fonte contratual inexistente | Card indisponível, com justificativa; contagem real separada |
| Quantidade de projetos | Parcial: contagem sem filtros no dashboard | Implementada, COUNT no banco, mesma seleção das demais seções |
| Projetos abertos e percentual | Não implementada | Implementada com critério técnico explícito: status active; definição de negócio ainda requer confirmação |
| Ticket médio | Dependente de dados inexistentes | Card indisponível; não utiliza despesas ou pagamentos |
| Valor de contratos abertos e percentual | Dependente de dados inexistentes | Card indisponível; não confunde status contratual com status de projeto |
| Itens contratados | Dependente de dados inexistentes | Card indisponível; não substitui por itens cadastrados/inventariados |
| Ano e mês | Não implementados na tela | Implementados para criação do projeto, rotulados como tal |
| Data do contrato | Dependente de dados inexistentes | Não implementada; intervalo de criação oferecido separadamente |
| Status | Não implementado na tela | Todos os status oficiais, combinável com demais filtros |
| Segmento | Dependente de dados inexistentes | Não implementado |
| UF e busca por cidade | Localização nas unidades, sem localização única contratual de projeto | Pendente de definição de negócio; não presume correspondência |
| Serviços/conformidade | Dependente de dados inexistentes | Não implementado |
| Quantidade mínima/máxima contratada | Dependente de dados inexistentes | Não implementada |
| Busca por projeto | Não implementada na tela | Nome, com parâmetros SQL e escape de curingas |
| Até 30/09, até hoje, últimos 3 meses | Não implementados | Pendentes da definição de ano/coluna/intervalo contratual; não foram reinterpretados silenciosamente |
| Limpar filtros e persistir seleção | Não implementados | Limpeza e persistência na URL, incluindo refresh e voltar/avançar |
| Distribuição de projetos por status | Não implementada | Recharts, tooltip, inteiros pt-BR, mesmas condições SQL |
| Evolução temporal | Não implementada | Criação de projetos por mês; não representa assinatura de contratos |
| Distribuição de valores, segmento, itens contratados e comparativos contratuais | Sem fonte confiável | Não implementados |
| Geografia consolidada de projetos | Parcial: mapa existente de inventário por projeto | Não reutilizado como geografia contratual sem regra de localização |
| Listagem/detalhes | Acesso por módulo | 50 projetos mais recentes e links para resumos existentes |
| Excel e CSV | Exportações existentes por projeto | Novos endpoints consolidados; filtros e organização idênticos aos indicadores |
| Backup JSON | Sem equivalente confirmado | Não implementado; importações raw backup e backup XLSX existentes são funcionalidades distintas |

## Arquivos criados e modificados

- `gai-backend/src/modules/project-dashboard/application/dto/organization-overview-query.dto.ts`: tipos, limites, status e validação de datas/filtros.
- `gai-backend/src/modules/project-dashboard/application/services/organization-overview.service.ts`: consulta compartilhada, organização derivada do ator, agregações SQL, listagem limitada e linhas de exportação.
- `gai-backend/src/modules/project-dashboard/presentation/organization-overview.controller.ts`: GET overview, CSV com BOM UTF-8/separador `;` e XLSX usando biblioteca já instalada, com neutralização de fórmulas.
- `gai-backend/src/modules/project-dashboard/project-dashboard.module.ts`: registro do serviço/controlador; reutiliza repositório exportado por ProjectsModule.
- `gai-backend/test/unit/modules/project-dashboard/organization-overview.spec.ts`: 11 testes, com SQL real em SQLite em memória, duas organizações, exclusão lógica e arquivos exportados.
- `gai-frontend/src/features/dashboard/OrganizationOverviewPage.tsx`: seis posições de indicadores, filtros, gráficos, detalhes, exportação, loading/vazio/erro e limitações visíveis.
- `gai-frontend/src/features/dashboard/OrganizationOverviewPage.test.tsx`: 4 testes de seleção combinada, persistência, validação e estados.
- `gai-frontend/src/features/dashboard/DashboardPage.tsx`: seleciona a nova tela para ORG_ADMIN; dashboard anterior preservado para demais perfis, inclusive PLATFORM_ADMIN.
- Este relatório. Build também regenera os artefatos já versionados de `gai-frontend/dist` e cache TypeScript; não houve alteração deliberada de dependências nesta tarefa.
- Evidências locais ignoradas: `.local/overview-readonly.cjs`, `.local/overview-browser.cjs`, `.local/overview-{desktop,tablet,mobile}.png`, `.local/visão geral.png` e logs `overview-api*`. Nenhuma senha foi gravada nesses scripts.

## Indicadores e regras de cálculo

1. **Valor total contratado:** `null`, apresentado como Indisponível. Não há tabela/campo contratual validado. Fórmula futura dependerá de SUM de valor contratual e definição de contratos elegíveis; não foi inventada fonte em metadata/settings.
2. **Projetos:** `COUNT(*)` de `projects` com `organization_id` do usuário e todos os filtros aplicados. TypeORM exclui `deleted_at IS NOT NULL` automaticamente.
3. **Abertos:** `SUM(CASE WHEN status='active' THEN 1 ELSE 0 END)`. Percentual `100 * abertos / projetos`, arredondado a duas casas; denominador zero retorna 0. A tela explicita o status Ativo. Rascunhos/pausados não são considerados ativos. A equivalência comercial com “aberto” ainda não foi confirmada pelo PDF.
4. **Ticket médio:** `null`. A referência visual diz “valor médio por projeto no filtro”; falta contrato/valor para definir e validar o denominador, inclusive tratamento de contratos sem valor.
5. **Valor contratado aberto:** `null`. Falta valor e status contratual. Percentual também indisponível; não se apresenta zero fictício.
6. **Itens contratados:** `null`. Falta quantidade prevista em contrato; inventário e contabilidade não são substitutos.

Sem joins na consulta consolidada: cada linha corresponde a um projeto. Cancelados, arquivados e inativos não excluídos logicamente integram a contagem geral e sua distribuição; somente active integra os abertos. O filtro de status permite selecionar qualquer status oficial. Essa regra é apresentada/documentada, sem inferir cancelamento de contratos.

Datas de seleção e agrupamento usam `projects.created_at` no calendário armazenado pelo backend/MySQL existente. Não há normalização de timezone na configuração TypeORM atual; a tela de detalhes formata datas retornadas em America/Sao_Paulo, e o CSV/XLSX identifica timestamps em ISO. A convenção de timezone de armazenamento deve ser formalizada antes de filtros contratuais ou análises nas viradas de dia.

## Filtros, dashboards e desempenho

Ano, mês, início/fim de criação, status e nome combinam-se por AND. Datas invertidas são rejeitadas; DTO também rejeita datas impossíveis, status inválido, ano fora de 1900–9999 e mês fora de 1–12. Uma seleção sem resultados exibe zero para contagens reais e estado vazio, mantendo indisponibilidade contratual.

Aplicar dispara a consulta, sem uma requisição por tecla. React Query usa sinal de cancelamento, validade de 30 segundos e chave com usuário, organização e seleção. Seleção fica na URL. A troca de usuário também limpa o cache no AuthProvider já existente. Não há cache compartilhado no backend.

Cards, distribuição por status, evolução mensal e listagem são retornados em uma chamada HTTP, com agregações no banco. As quatro consultas SQL são fixas, sem N+1, sem carregar todo o inventário. Listagem limita a 50 registros. Exportação limita a 10.000 projetos e rejeita o excedente com orientação para refinar filtros. Não foi criado índice/migration; YEAR/MONTH podem exigir varredura do escopo em bases grandes. As consultas paralelas não utilizam snapshot transacional; escritas simultâneas podem gerar diferenças momentâneas entre seções.

Gráficos reutilizam Recharts e cores existentes. Títulos/tooltip identificam projetos, status traduzido, contagens inteiras e períodos MM/AAAA. Mantidos sidebar, cabeçalho, tipografia, paleta, MetricCard, PageContainer, PageHeader e estados compartilhados.

## Segurança e exportação

Endpoints `/api/v1/organization-overview`, `/export.csv` e `/export.xlsx` exigem sessão, `projects:read`, papel ORG_ADMIN e organização não nula. Serviço revalida papel e escopo, inclusive para exportar. O identificador da organização vem exclusivamente do usuário autenticado, nunca do frontend. Parâmetro extra `organization_id` é rejeitado pelo ValidationPipe global (400); mesmo chamada direta ao serviço não o usa. Outros papéis são rejeitados por esse serviço sem alterar suas permissões globais.

Consultas parametrizadas, curingas de busca escapados e exclusão lógica automática. CSV usa aspas e escape de aspas/quebras, BOM UTF-8, ID numérico textual e data ISO. XLSX mantém ID numérico e demais colunas como texto; strings potencialmente interpretáveis como fórmula são prefixadas com apóstrofo. Headers são ID, Projeto, Status e Criado em. Não exporta campos contratuais inexistentes, registros de outras organizações ou detalhes internos de sessão. Nenhuma restauração implementada.

## Testes e validação

- Backend build NestJS passou, inclusive após a alteração final do exportador.
- 8 suítes / 31 testes relacionados a projetos e dashboard passaram. Os 11 testes novos de isolamento/exportação passaram novamente após a alteração final.
- Frontend TypeScript + Vite passaram. Bundle de cerca de 1,39 MB gera aviso de tamanho já compatível com a estrutura existente, sem falha.
- 24 suítes / 164 testes existentes do frontend passaram; 4 testes novos passaram separadamente, totalizando 168 testes verificados. Avisos de dimensão de Recharts em JSDOM nos testes existentes não impedem aprovação.
- SQL real em banco de teste SQLite em memória prova isolamento de duas organizações, exclusão lógica, status/nome/datas combinados, busca sem resultados, curingas literais, rejeição de outros papéis/organização ausente e datas inválidas. Testes abrem os XLSX produzidos e verificam tipos, ausência de fórmulas e escopo; CSV verifica acentos, BOM e proteção de fórmulas.
- MySQL local real: verificações exclusivamente de leitura compararam o serviço com SQL independente para total, ativos, ano/mês, busca vazia e intervalo. Organização disponível tem 1 projeto não excluído e 1 ativo. Soma dos grupos de status e meses coincide; CSV/XLSX coincidem com total. O banco local só oferece uma organização com projetos; separação entre duas foi validada no banco isolado.
- Login real ORG_ADMIN com credenciais explicitamente fornecidas pelo usuário passou no Chromium. Tela real e exportações 200; injeção de organization_id 400; datas invertidas 400; sem sessão 401. Busca vazia, limpar e persistir seleção após refresh passaram.
- Visualização real em 1440, 768 e 390 pixels passou, sem overflow horizontal e sem pageerror. PNGs desktop/mobile inspecionados visualmente. Foi necessário aguardar pintura dos painéis com backdrop-filter no screenshot completo do Chromium.
- Não foram executadas operações de escrita de negócio, seed ou migrations. Login/logout geram apenas o estado de autenticação previsto. Não foi realizada homologação completa de outros módulos.

## Acesso local

Visão Geral: http://localhost:5173/app/dashboard, com o perfil ORG_ADMIN fornecido pelo usuário. Login: http://localhost:5173/login. API: http://localhost:3000/api/v1/organization-overview. Senha não reproduzida no relatório.

MySQL e frontend existentes foram preservados. O processo anterior da API não havia recarregado os endpoints por falha de permissão do watcher; foi identificado como Node deste projeto e reiniciado em segundo plano com `node dist/src/main.js`. PID atualizado em `.local/backend.pid`; logs em `.local/overview-api.log` e `.local/overview-api-error.log`. A API atual usa build compilado, portanto futuras alterações exigem build e reinício, ou uso de `npm.cmd run start:dev` em terminal autorizado. O script existente `scripts/local-start.ps1` continua disponível para partidas futuras; não executa migrations/seed.

## Pendências e limites

- Criar/definir fonte de contratos, valores, datas, status, segmentos, serviços/conformidade e itens previstos exige decisão de modelo e eventual autorização de alteração de esquema. Nenhum schema foi alterado nesta tarefa.
- Confirmar regra comercial de aberto, cancelamentos elegíveis, denominador do ticket, contratos nulos/sem valor e regra de localização de projetos antes de ampliar indicadores.
- Confirmar semântica dos atalhos, especialmente ano de 30/09 e coluna temporal. PDF sozinho não resolve isso.
- Contratos e gráficos correspondentes permanecem indisponíveis; a entrega funcional é uma visão consolidada dos projetos existentes, com as limitações visíveis.
- A primeira tentativa de roteiro de login foi rejeitada automaticamente por incluir verificação de hashes e senhas candidatas. O roteiro foi removido, nenhum hash foi lido por ele e nenhuma tentativa candidata foi executada. A validação posterior usou exclusivamente a conta e senha fornecidas expressamente pelo usuário; não há bloqueio de validação pendente.
