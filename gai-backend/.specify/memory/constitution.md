<!--
Sync Impact Report
==================
Version change: 1.2.0 → 1.3.0
Modified principles: N/A (no renames)
Added sections/principles:
  - IX. Identificadores Numéricos de Entidades de Negócio
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated
  - .specify/templates/spec-template.md ✅ updated
  - .specify/templates/tasks-template.md ✅ updated
  - .specify/templates/checklist-template.md ✅ (no changes required)
  - specs/003-users-roles-permissions/plan.md ✅ updated (Constitution Check)
  - .specify/templates/commands/*.md ⚠ N/A (directory does not exist)
Follow-up TODOs: None
-->

# GAI Backend Constitution

## Escopo do Repositório

Este repositório (`gai-backend`) contém **exclusivamente o backend** do sistema GAI
(Gestão do Ativo Imobilizado). É o limite formal de escopo desta constituição.

**Dentro do escopo**:

- API REST/HTTP (ou equivalente) para consumo por clientes externos.
- Regras de domínio, serviços de aplicação e persistência de ativos imobilizados.
- Jobs assíncronos, importações em lote e integrações server-side.
- Contratos de API, schemas de dados e documentação de endpoints.
- Testes de backend (unitários, integração, contrato).
- Infraestrutura como código, pipelines CI/CD e configuração de observabilidade.

**Fora do escopo** (PROIBIDO neste repositório):

- Frontend web, mobile ou desktop (SPAs, componentes UI, telas, CSS).
- Renderização server-side de views HTML para usuários finais.
- Assets estáticos de interface (imagens, fontes, bundles de cliente).
- Lógica de apresentação, roteamento de páginas ou estado de UI.

Clientes de interface DEVEM residir em repositórios separados e consumir este
backend via API. Features que exijam UI DEVEM ser especificadas apenas como
contratos de API neste projeto.

**Rationale**: Separar backend e frontend permite deploy independente, equipes
paralelas e evolução da API sem acoplamento a tecnologias de interface.

## Core Principles

### I. Clean Code

Todo código produzido DEVE seguir práticas de Clean Code como regra não negociável:

- Nomes de variáveis, funções, classes e módulos DEVEM expressar intenção de domínio
  (ex.: `AtivoImobilizado`, `DepreciacaoService`), nunca abreviações obscuras.
- Funções DEVEM ter responsabilidade única e preferencialmente ≤ 30 linhas; classes
  DEVEM permanecer coesas e pequenas.
- Duplicação DEVE ser eliminada via extração de abstrações reutilizáveis; comentários
  DEVEM explicar o *porquê*, nunca o *o quê* óbvio.
- Tratamento de erros DEVE ser explícito, com mensagens acionáveis e sem capturas
  genéricas silenciosas.
- Formatação e estilo DEVEM ser automatizados via linter/formatter configurado no CI.

**Rationale**: Código legível reduz defeitos, acelera onboarding e facilita evolução
do backend patrimonial ao longo de décadas de operação.

### II. Arquitetura SOLID

O design do sistema DEVE aplicar os cinco princípios SOLID de forma verificável:

- **SRP**: Cada módulo/classe tem exatamente um motivo para mudar.
- **OCP**: Extensão via interfaces e composição; modificação de código existente
  apenas quando inevitável.
- **LSP**: Implementações de contratos (repositórios, serviços) DEVEM ser
  substituíveis sem quebrar consumidores.
- **ISP**: Interfaces granulares; clientes NÃO DEVEM depender de métodos que não usam.
- **DIP**: Módulos de alto nível dependem de abstrações; implementações concretas
  (banco, filas, APIs externas) ficam nas bordas (adapters).

Camadas obrigatórias: **Domain** → **Application** → **Infrastructure** →
**Presentation/API**. Dependências DEVEM apontar sempre para dentro (em direção ao
domínio).

**Rationale**: SOLID garante que o backend GAI suporte evolução de regras fiscais,
depreciação e integrações sem refatorações destrutivas.

### III. Performance para Grandes Volumes (NON-NEGOTIABLE)

O backend DEVE ser projetado e implementado para operar com grandes volumes de dados
(milhões de ativos, movimentações e lançamentos contábeis):

- Consultas DEVEM usar paginação cursor-based ou offset com limites; respostas
  unbounded são PROIBIDAS.
- Operações em lote (importação, depreciação mensal, relatórios) DEVEM usar
  processamento assíncrono ou streaming; NUNCA carregar datasets completos em memória.
- Índices de banco DEVEM ser definidos e documentados para todo filtro/ordenação
  em produção; queries N+1 são PROIBIDAS.
- Endpoints críticos DEVEM ter metas de latência documentadas no plano da feature
  (ex.: p95 < 500 ms para listagens paginadas).
- Caching DEVE ser justificado e invalidado de forma determinística; cache como
  atalho para queries mal escritas é PROIBIDO.

**Rationale**: GAI lida com histórico patrimonial acumulado; performance inadequada
bloqueia fechamentos contábeis e relatórios regulatórios.

### IV. Cobertura de Testes ≥ 80% (NON-NEGOTIABLE)

A cobertura de testes do projeto DEVE permanecer ≥ 80% em todas as branches
integradas à main:

- Testes unitários DEVEM cobrir regras de domínio (depreciação, baixa, transferência,
  reavaliação) sem dependência de infraestrutura.
- Testes de integração DEVEM cobrir contratos de API, persistência e fluxos críticos
  de negócio.
- Testes DEVEM ser escritos antes ou em paralelo à implementação (Red-Green-Refactor);
  código sem teste correspondente NÃO DEVE ser mergeado.
- O pipeline de CI DEVE falhar se cobertura global ou por módulo crítico cair abaixo
  de 80%.
- Testes DEVEM ser determinísticos, isolados e rápidos; dependências externas DEVEM
  ser mockadas ou containerizadas.

**Rationale**: Regras patrimoniais e fiscais exigem confiança elevada; alta cobertura
é a principal salvaguarda contra regressões em cálculos financeiros.

### V. Integridade e Robustez de Dados

Operações sobre ativos imobilizados DEVEM preservar integridade e auditabilidade:

- Toda mutação de estado patrimonial DEVE ocorrer dentro de transação de banco com
  rollback em falha parcial.
- Validações de domínio DEVEM ocorrer na camada Domain antes de persistência; a API
  apenas traduz erros para respostas HTTP adequadas.
- Toda alteração relevante DEVE gerar registro de auditoria imutável (quem, quando,
  o quê, valor anterior/novo).
- Idempotência DEVE ser garantida em operações de importação e integração externa.
- Falhas DEVEM ser logadas com contexto estruturado (correlation ID, entidade,
  operação); nunca expor stack traces ou dados sensíveis ao cliente.

**Rationale**: Ativos imobilizados impactam balanço e compliance fiscal; perda ou
corrupção de dados tem consequências legais e financeiras.

### VI. Infraestrutura AWS e Ambientes (NON-NEGOTIABLE)

Todo o backend DEVE ser hospedado e operado em serviços AWS, com isolamento explícito
entre dois ambientes:

| Ambiente | Propósito | Regras |
|----------|-----------|--------|
| **Homologação** | Validação integrada, testes E2E, demos | Dados sintéticos ou anonimizados; espelha produção |
| **Produção** | Operação real com dados patrimoniais | Acesso restrito; mudanças apenas via pipeline aprovado |

Requisitos obrigatórios:

- Recursos de compute, banco, filas, storage e secrets DEVEM residir na AWS
  (ex.: ECS/EKS/Lambda, RDS, S3, SQS, Secrets Manager — escolha documentada no plano).
- Configuração por ambiente DEVE ser externalizada (variáveis, Parameter Store ou
  Secrets Manager); valores hardcoded por ambiente são PROIBIDOS.
- Infraestrutura DEVE ser definida como código (IaC) versionada neste repositório
  ou repositório de infra vinculado.
- Homologação e Produção DEVEM ter recursos isolados (VPC, banco, filas); compartilhar
  estado de produção em homologação é PROIBIDO.
- Migrations e seeds DEVEM ser executáveis de forma independente por ambiente.

**Rationale**: Ambientes isolados reduzem risco de regressão em dados reais e permitem
validação segura antes de impactar a operação patrimonial.

### VII. CI/CD Automatizado (NON-NEGOTIABLE)

O projeto DEVE ter pipelines automatizados que garantam qualidade e entrega controlada:

**Pipeline de qualidade** (execução automática em todo PR e push para `main`):

- Lint e formatação (falha bloqueia merge).
- Auditoria de dependências e vulnerabilidades (security audit).
- Suite de testes completa com verificação de cobertura ≥ 80%.
- Build e validação de artefato deployável.

**Pipelines de deploy** (disparo manual/sob demanda pelo responsável):

- **Deploy Homologação**: disponível após pipeline de qualidade verde; promove
  artefato validado para o ambiente de homologação.
- **Deploy Produção**: disponível sob demanda; DEVE exigir aprovação manual e
  pipeline de qualidade verde; rollback DEVE ser documentado e automatizável.

Requisitos transversais:

- Pipelines DEVEM ser versionados no repositório (ex.: GitHub Actions, GitLab CI,
  AWS CodePipeline — escolha documentada no plano).
- Secrets de pipeline DEVEM usar gerenciador de secrets da AWS ou do provedor CI;
  nunca commitados.
- Todo deploy DEVE registrar versão, commit SHA, ambiente e responsável no log de
  auditoria.
- Deploy em produção SEM passar por homologação DEVE ser justificado no Complexity
  Tracking.

**Rationale**: Automação garante qualidade consistente; deploy sob demanda preserva
controle do responsável sobre quando promover releases.

### VIII. Observabilidade e Logs no Kibana (NON-NEGOTIABLE)

O backend DEVE ser observável em todos os ambientes, com logs centralizados no Kibana:

- Toda requisição, job assíncrono e erro DEVEM emitir logs estruturados (JSON) com
  campos mínimos: `timestamp`, `level`, `service`, `environment`, `correlationId`,
  `message`, `operation`, `durationMs`.
- Logs de negócio relevantes (mutações patrimoniais, importações, falhas de validação)
  DEVEM incluir contexto de domínio sem expor dados sensíveis (PII, credenciais).
- Logs DEVEM ser encaminhados para a stack ELK/OpenSearch acessível via Kibana
  (ex.: Filebeat/Fluent Bit → Elasticsearch/OpenSearch).
- Ambientes DEVEM ser distinguíveis nos logs (`homologacao` vs `producao`) via campo
  `environment`.
- Alertas básicos DEVEM ser configurados para taxa de erro elevada e falhas de jobs
  críticos (depreciação, importação).
- Métricas de latência e throughput DEVEM ser coletadas para endpoints críticos,
  complementando os logs no Kibana.

**Rationale**: Operações patrimoniais exigem rastreabilidade ponta a ponta; Kibana
permite diagnóstico rápido de incidentes em homologação antes de chegarem à produção.

### IX. Identificadores Numéricos de Entidades de Negócio (NON-NEGOTIABLE)

Todas as entidades de negócio persistidas no MySQL DEVEM usar identificadores numéricos
auto-incremento como padrão de chave primária e de chaves estrangeiras:

- PKs e FKs de entidades de negócio DEVEM ser `BIGINT UNSIGNED AUTO_INCREMENT` no
  MySQL e mapeadas com `@PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })`
  no TypeORM.
- Contratos OpenAPI e respostas de API DEVEM expor esses identificadores como
  `integer` / `format: int64` em path params, request bodies e responses.
- O uso de UUID (`CHAR(36)`) como PK ou FK de entidade de negócio é **PROIBIDO** em
  código novo; entidades legadas DEVEM ser migradas conforme plano da feature ativa.
- O `data-model.md` de cada feature DEVE documentar o tipo de ID de cada entidade e
  justificar qualquer exceção na tabela Complexity Tracking do `plan.md`.
- Colunas de FK DEVEM ter o mesmo tipo da PK referenciada (`BIGINT UNSIGNED`).

**Exceções permitidas** (tokens e segredos expostos ao cliente — NÃO usar sequencial):

| Entidade / campo | Tipo | Motivo |
|------------------|------|--------|
| `sessions.id` | `CHAR(36)` UUID v4 | Token de sessão opaco; não deve ser adivinhável |
| Tokens de recuperação/redefinição (valor raw) | Hash persistido | Segurança; ID interno da tabela pode ser BIGINT |

**Rationale**: IDs numéricos facilitam gestão operacional, suporte, logs e integrações
internas. Tokens de autenticação e recuperação permanecem opacos por requisito de
segurança — sequência numérica em credenciais expostas facilita enumeração e ataques.

## Padrões de Performance

Metas mínimas para o backend GAI (ajustáveis por feature com justificativa documentada):

| Operação | Meta | Medição |
|----------|------|---------|
| Listagem paginada (50 itens) | p95 < 500 ms | APM/load test |
| Consulta unitária por ID | p95 < 100 ms | APM |
| Importação em lote (10k registros) | < 5 min | Job monitor |
| Cálculo depreciação mensal (100k ativos) | < 30 min | Job monitor |
| Throughput API (leitura) | ≥ 500 req/s | Load test |

Requisitos transversais:

- Conexões de banco DEVEM usar pool configurado; timeouts explícitos em todas as
  chamadas externas.
- Payloads de API DEVEM ter limite máximo documentado; campos retornados DEVEM ser
  os mínimos necessários.
- Migrations DEVEM ser reversíveis ou ter plano de rollback documentado.

## Fluxo de Desenvolvimento e Quality Gates

Todo PR para `main` DEVE passar pelos seguintes gates antes do merge:

1. **Escopo**: nenhum código de frontend/UI; apenas backend e contratos de API.
2. **Lint & Format**: zero violações de linter/formatter configurado.
3. **Testes**: suite completa verde; cobertura ≥ 80% mantida ou aumentada.
4. **Security Audit**: pipeline de auditoria de dependências sem vulnerabilidades críticas.
5. **Constitution Check**: revisão explícita dos princípios I–IX no plano da feature.
6. **Identificadores**: novas entidades e FKs seguem Princípio IX; exceções documentadas.
7. **Performance**: queries novas revisadas para índices e ausência de N+1; metas
   documentadas se endpoint for crítico.
8. **Observabilidade**: logs estruturados e campos Kibana definidos para operações novas.
9. **Code Review**: pelo menos uma aprovação; complexidade adicional DEVE constar
   na tabela de Complexity Tracking do plano.

**Fluxo de deploy**:

1. Merge em `main` → pipeline de qualidade executa automaticamente.
2. Responsável dispara deploy para **Homologação** quando desejar validar.
3. Após validação em homologação, responsável dispara deploy para **Produção**.

Violações de princípios DEVEM ser registradas e justificadas no `plan.md` da feature
antes da implementação. Implementação sem justificativa aprovada é bloqueada.

## Governance

Esta constituição é a autoridade máxima de governança técnica do repositório
`gai-backend`. Em caso de conflito entre esta constituição e outras práticas
documentadas, esta constituição prevalece.

**Procedimento de emenda**:

1. Propor alteração via `/speckit-constitution` com justificativa e impacto.
2. Atualizar versão conforme semver (MAJOR/MINOR/PATCH).
3. Propagar mudanças aos templates em `.specify/templates/` e revalidar features
   em andamento.
4. Registrar data de emenda e relatório de impacto no cabeçalho da constituição.

**Política de versionamento**:

- **MAJOR**: Remoção ou redefinição incompatível de princípios.
- **MINOR**: Novo princípio ou expansão material de seções.
- **PATCH**: Clarificações, correções de redação, ajustes não semânticos.

**Revisão de compliance**: A cada feature, `/speckit-analyze` DEVE verificar
alinhamento com esta constituição. Desvios sem justificativa são classificados
como CRITICAL.

Para orientação de desenvolvimento em tempo de execução, consultar o plano ativo
em `specs/` e `.cursor/rules/specify-rules.mdc`.

**Version**: 1.3.0 | **Ratified**: 2025-06-15 | **Last Amended**: 2026-06-19
