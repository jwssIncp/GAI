# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: AWS (Linux containers/compute — serviço específico no plano)

**Environments**: Homologação + Produção (isolados, config externalizada)

**CI/CD**: Pipeline automático (lint, audit, testes, build) + deploy manual para homologação/produção

**Observability**: Logs estruturados JSON → Kibana (ELK/OpenSearch)

**Project Type**: Backend API only (`gai-backend` — frontend lives in separate repos)

**Repository Scope**: Backend exclusivo; UI/frontend/mobile PROIBIDO neste repositório

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Pre-Design | Post-Design |
|-----------|------|------------|-------------|
| Escopo | Apenas backend/API; sem frontend, UI ou assets de interface | [ ] | [ ] |
| I. Clean Code | Nomes de domínio, funções coesas, erros explícitos | [ ] | [ ] |
| II. Arquitetura SOLID | Camadas Domain/Application/Infrastructure definidas; DIP respeitado | [ ] | [ ] |
| III. Performance (grandes volumes) | Paginação, índices, batch/async e metas de latência documentados | [ ] | [ ] |
| IV. Cobertura ≥ 80% | Estratégia de testes unitários + integração com gate de cobertura | [ ] | [ ] |
| V. Integridade de Dados | Transações, auditoria e validações de domínio especificadas | [ ] | [ ] |
| VI. Infraestrutura AWS | Ambientes homologação/produção isolados; IaC; config externalizada | [ ] | [ ] |
| VII. CI/CD | Pipeline qualidade automático; deploy homolog/prod sob demanda | [ ] | [ ] |
| VIII. Observabilidade | Logs JSON com campos Kibana; alertas para erros críticos | [ ] | [ ] |
| IX. IDs numéricos | PKs/FKs BIGINT UNSIGNED; contratos int64; exceções justificadas | [ ] | [ ] |

> Violações DEVEM ser registradas na tabela Complexity Tracking abaixo com
> justificativa aprovada antes da implementação.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── domain/
├── application/
├── infrastructure/
└── api/

tests/
├── unit/
├── integration/
└── contract/
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
