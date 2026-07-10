# Feature Specification: Import Sessions / Sincronizacao e Importacao em Lote

## Escopo

O modulo Import Sessions controla sessoes de importacao e sincronizacao de dados vinculadas obrigatoriamente a um projeto. Ele substitui os fluxos antigos de sincronizacao mobile e importacao em lote com uma API idempotente, paginada, auditavel e isolada por organization.

## Decisoes de arquitetura

- O projeto atual usa NestJS com TypeORM, portanto a implementacao usa entities, repositories e migrations TypeORM em vez de Prisma.
- Payloads podem chegar fora de ordem. A integridade e garantida por unicidade de `payload_number` por sessao e por idempotencia via `idempotency_key`/`checksum`.
- O processamento inicial e feito por um processor interno chamado a partir do service. A interface fica separada para migracao futura para fila/worker sem alterar controller/contrato.
- Erros por item nao derrubam todo o payload. O payload finaliza como `processed` quando todos os itens validos foram aplicados, mantendo `failed_count` e registros em `import_payload_errors`.
- Imagens no payload sao preservadas em metadata para integracao posterior com Inventory Item Images, sem criar imagens automaticamente nesta primeira versao.

## Regras Funcionais

- RF-001: Criar uma import_session para um project ativo e da mesma organization.
- RF-002: Garantir que usuarios de organization acessem apenas sessoes da propria organization; platform admin pode acessar qualquer organization.
- RF-003: Rejeitar criacao, recebimento, finalizacao, cancelamento e retry quando o project bloqueia mutacao operacional.
- RF-004: Gerar `session_uuid` opaco e unico.
- RF-005: Receber payloads por `payload_number`, `idempotency_key`, `checksum` e `items`.
- RF-006: Retornar resultado idempotente se o mesmo `payload_number` ou `idempotency_key` for reenviado com o mesmo checksum.
- RF-007: Retornar conflito se o mesmo `payload_number` ou `idempotency_key` for reenviado com checksum diferente.
- RF-008: Nao aceitar novos payloads em sessoes `finished`, `failed`, `cancelled` ou `expired`.
- RF-009: Expirar sessoes abertas quando `expires_at` estiver no passado.
- RF-010: Processar operacoes `create`, `update`, `upsert`, `delete` e `remove` sobre Inventory Items.
- RF-011: Normalizar placas removendo caracteres nao alfanumericos e convertendo para uppercase.
- RF-012: Registrar erro por item com `row_number`, `item_reference`, `error_code`, `error_message` e `raw_data`.
- RF-013: Atualizar contadores de sessao e payload apos processamento.
- RF-014: Finalizar sessao apenas quando todos os payloads esperados foram recebidos, se `expected_payloads` foi informado.
- RF-015: Permitir reprocessar payloads em `failed`.
- RF-016: Criar e confirmar arquivos brutos/backup via metadados e URLs assinadas.
- RF-017: Listagens de sessoes, payloads, erros e arquivos devem ser paginadas quando aplicavel.
- RF-018: Nao permitir exclusao fisica; cancelamento e soft delete preservam rastreabilidade.

## Permissoes

- `import-sessions:create`
- `import-sessions:read`
- `import-sessions:finish`
- `import-sessions:cancel`
- `import-sessions:retry`
- `import-payloads:create`
- `import-payloads:read`
- `import-payloads:reprocess`
- `import-errors:read`
- `import-files:create`
- `import-files:read`
- `import-files:download`

## Endpoints

- `POST /v1/projects/:projectId/import-sessions`
- `GET /v1/projects/:projectId/import-sessions`
- `GET /v1/projects/:projectId/import-sessions/:sessionId`
- `GET /v1/projects/:projectId/import-sessions/by-uuid/:sessionUuid`
- `POST /v1/projects/:projectId/import-sessions/:sessionId/finish`
- `POST /v1/projects/:projectId/import-sessions/:sessionId/cancel`
- `POST /v1/projects/:projectId/import-sessions/:sessionId/retry`
- `POST /v1/projects/:projectId/import-sessions/:sessionId/payloads`
- `GET /v1/projects/:projectId/import-sessions/:sessionId/payloads`
- `GET /v1/projects/:projectId/import-sessions/:sessionId/payloads/:payloadId`
- `POST /v1/projects/:projectId/import-sessions/:sessionId/payloads/:payloadId/reprocess`
- `GET /v1/projects/:projectId/import-sessions/:sessionId/errors`
- `GET /v1/projects/:projectId/import-sessions/:sessionId/payloads/:payloadId/errors`
- `POST /v1/projects/:projectId/import-sessions/:sessionId/files/upload-url`
- `POST /v1/projects/:projectId/import-sessions/:sessionId/files/:fileId/confirm-upload`
- `GET /v1/projects/:projectId/import-sessions/:sessionId/files`
- `POST /v1/projects/:projectId/import-sessions/:sessionId/files/:fileId/download-url`

## Requisitos Nao Funcionais

- RNF-001: Todas as mutacoes relevantes devem registrar auditoria estruturada em `import_session_audit_logs`.
- RNF-002: Mutacoes de payload, erros, contadores e itens devem ocorrer em transacao.
- RNF-003: Limites devem ser configuraveis por env: `IMPORT_SESSION_TTL_HOURS`, `IMPORT_PAYLOAD_MAX_ITEMS`, `IMPORT_PAYLOAD_MAX_IMAGES`.
- RNF-004: Banco armazena metadados e paths; arquivos brutos ficam em storage externo.
- RNF-005: Respostas nao devem expor `raw_data` de erro por padrao.
